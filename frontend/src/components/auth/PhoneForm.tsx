import { useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Phone } from 'lucide-react';
import { Button } from '@components/ui/Button';
import { requestOtpSchema, type RequestOtpInput } from '@utils/validation';
import { applyPhoneMask } from '@utils/format';

// =============================================================================
// PhoneForm — step 1 of OTP login
// Russian phone format mask: +7 (XXX) XXX-XX-XX
// =============================================================================

type PhoneFormProps = {
  onSuccess: (phone: string) => void;
  isLoading?: boolean;
};

export function PhoneForm({ onSuccess, isLoading = false }: PhoneFormProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Stores normalized E.164 value e.g. "+79991234567"
  const normalizedPhoneRef = useRef<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<RequestOtpInput>({
    resolver: zodResolver(requestOtpSchema),
    defaultValues: { phone: '' },
  });

  const { ref: formRef, ...restRegister } = register('phone');

  // ---------------------------------------------------------------------------
  // Input handler — applies visual mask while storing normalized E.164 value
  // ---------------------------------------------------------------------------
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const digits = raw.replace(/\D/g, '');

      // Normalize to E.164 "+7XXXXXXXXXX"
      let normalized = digits;
      if (normalized.startsWith('8')) normalized = '7' + normalized.slice(1);
      if (!normalized.startsWith('7')) normalized = '7' + normalized;
      normalized = normalized.slice(0, 11);

      const masked = applyPhoneMask(digits);
      e.target.value = masked;

      if (normalized.length === 11) {
        normalizedPhoneRef.current = '+' + normalized;
        setValue('phone', '+' + normalized, { shouldValidate: true });
      } else {
        normalizedPhoneRef.current = '';
        setValue('phone', '', { shouldValidate: false });
      }
    },
    [setValue],
  );

  const onSubmit = handleSubmit(() => {
    onSuccess(normalizedPhoneRef.current);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-1">
        <label
          htmlFor="phone-input"
          className="block text-sm font-medium text-warm-700"
        >
          Номер телефона
        </label>

        <div className="relative">
          <span
            className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-warm-400"
            aria-hidden="true"
          >
            <Phone className="h-4 w-4" />
          </span>

          <input
            {...restRegister}
            ref={(el) => {
              formRef(el);
              inputRef.current = el;
            }}
            id="phone-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+7 (___) ___-__-__"
            maxLength={18}
            onChange={handleInput}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? 'phone-error' : undefined}
            className={`
              w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm bg-white
              transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0
              ${
                errors.phone
                  ? 'border-red-400 bg-red-50 focus:ring-red-300 focus:border-red-500'
                  : 'border-warm-300 hover:border-warm-400 focus:ring-sage-300 focus:border-sage-400'
              }
            `}
          />
        </div>

        {errors.phone && (
          <p id="phone-error" role="alert" className="text-xs text-red-600 flex items-center gap-1 mt-1">
            <svg
              className="h-3 w-3 flex-shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {errors.phone.message}
          </p>
        )}
      </div>

      <p className="text-xs text-warm-500">
        На ваш номер будет отправлен код подтверждения. Стандартная тарификация вашего оператора.
      </p>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        isLoading={isLoading}
        loadingText="Отправляем код..."
      >
        Получить код
      </Button>
    </form>
  );
}
