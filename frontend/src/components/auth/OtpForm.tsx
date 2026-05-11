import { useRef, useCallback, useEffect, useState } from 'react';
import { Button } from '@components/ui/Button';

// =============================================================================
// OtpForm — 6-digit OTP input
// Features: auto-focus, auto-advance, paste support, countdown timer
// =============================================================================

const OTP_LENGTH = 6;

type OtpFormProps = {
  phone: string;
  expiresIn?: number;     // seconds
  onSuccess: (code: string) => void;
  onResend: () => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
};

export function OtpForm({
  phone,
  expiresIn = 120,
  onSuccess,
  onResend,
  isLoading = false,
  error = null,
}: OtpFormProps) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(expiresIn);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(OTP_LENGTH).fill(null));

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const id = window.setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [countdown]);

  // Auto-submit when all digits filled
  useEffect(() => {
    const code = digits.join('');
    if (code.length === OTP_LENGTH && /^\d{6}$/.test(code)) {
      onSuccess(code);
    }
  }, [digits, onSuccess]);

  // ---------------------------------------------------------------------------
  // Input handling
  // ---------------------------------------------------------------------------
  const updateDigit = useCallback((index: number, value: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
      const val = e.target.value.replace(/\D/g, '');
      if (!val) {
        updateDigit(index, '');
        return;
      }

      // Take last typed digit
      const digit = val[val.length - 1] ?? '';
      updateDigit(index, digit);

      // Advance to next
      if (index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [updateDigit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
      if (e.key === 'Backspace') {
        if (digits[index] !== '') {
          updateDigit(index, '');
        } else if (index > 0) {
          // Move back
          updateDigit(index - 1, '');
          inputRefs.current[index - 1]?.focus();
        }
        e.preventDefault();
      }

      if (e.key === 'ArrowLeft' && index > 0) {
        inputRefs.current[index - 1]?.focus();
        e.preventDefault();
      }

      if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
        e.preventDefault();
      }
    },
    [digits, updateDigit],
  );

  // ---------------------------------------------------------------------------
  // Paste support — allows pasting the full 6-digit code
  // ---------------------------------------------------------------------------
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
      if (!text) return;

      setDigits((prev) => {
        const next = [...prev];
        for (let i = 0; i < text.length; i++) {
          if (index + i < OTP_LENGTH) {
            next[index + i] = text[i] ?? '';
          }
        }
        return next;
      });

      // Focus last filled input
      const lastIndex = Math.min(index + text.length - 1, OTP_LENGTH - 1);
      inputRefs.current[lastIndex]?.focus();
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Resend
  // ---------------------------------------------------------------------------
  const handleResend = useCallback(async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setDigits(Array(OTP_LENGTH).fill(''));
    try {
      await onResend();
      setCountdown(expiresIn);
      inputRefs.current[0]?.focus();
    } finally {
      setIsResending(false);
    }
  }, [countdown, expiresIn, isResending, onResend]);

  const formatCountdown = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const canResend = countdown <= 0 && !isResending;
  const code = digits.join('');
  const isComplete = code.length === OTP_LENGTH && /^\d{6}$/.test(code);

  return (
    <div className="space-y-6">
      <p className="text-sm text-warm-600 text-center">
        Код отправлен на{' '}
        <span className="font-medium text-warm-800">{phone}</span>
      </p>

      {/* OTP inputs */}
      <div
        role="group"
        aria-label="Код подтверждения"
        className="flex items-center justify-center gap-2"
      >
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            pattern="\d*"
            maxLength={1}
            value={digit}
            aria-label={`Цифра ${i + 1} из ${OTP_LENGTH}`}
            aria-invalid={!!error}
            onChange={(e) => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onPaste={(e) => handlePaste(e, i)}
            className={`
              w-12 h-12 text-center text-xl font-semibold rounded-xl border-2
              transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1
              ${
                error
                  ? 'border-red-400 bg-red-50 text-red-700 focus:ring-red-300'
                  : digit
                  ? 'border-sage-400 bg-sage-50 text-warm-900 focus:ring-sage-300'
                  : 'border-warm-300 bg-white text-warm-900 focus:border-sage-400 focus:ring-sage-200'
              }
            `}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <p role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Submit button (also auto-submits) */}
      <Button
        type="button"
        variant="primary"
        size="lg"
        fullWidth
        disabled={!isComplete}
        isLoading={isLoading}
        loadingText="Проверяем код..."
        onClick={() => {
          if (isComplete) onSuccess(code);
        }}
      >
        Подтвердить
      </Button>

      {/* Resend */}
      <div className="text-center">
        {countdown > 0 ? (
          <p className="text-sm text-warm-500" aria-live="polite">
            Повторная отправка через{' '}
            <span className="font-medium text-warm-700 tabular-nums">
              {formatCountdown(countdown)}
            </span>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={!canResend}
            className="text-sm text-sage-600 hover:text-sage-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isResending ? 'Отправляем...' : 'Отправить код повторно'}
          </button>
        )}
      </div>
    </div>
  );
}
