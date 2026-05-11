import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PhoneForm } from '@components/auth/PhoneForm';
import { OtpForm } from '@components/auth/OtpForm';
import { useAuth } from '@hooks/useAuth';

// =============================================================================
// LoginPage — two-step OTP login (phone → OTP)
// Security: no password, no localStorage, tokens in memory / httpOnly cookie
// =============================================================================

type LoginStep = 'phone' | 'otp';

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [otpExpiresIn, setOtpExpiresIn] = useState(120);
  const [sendError, setSendError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const { sendOtp, verifyCode, isLoading } = useAuth();

  // ---------------------------------------------------------------------------
  // Step 1 — send OTP
  // ---------------------------------------------------------------------------
  const handlePhoneSuccess = useCallback(
    async (submittedPhone: string) => {
      setIsSending(true);
      setSendError(null);
      try {
        const result = await sendOtp(submittedPhone);
        setPhone(submittedPhone);
        setOtpExpiresIn(result.expiresIn);
        setStep('otp');
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Не удалось отправить код. Попробуйте позже.';
        setSendError(message);
      } finally {
        setIsSending(false);
      }
    },
    [sendOtp],
  );

  // ---------------------------------------------------------------------------
  // Step 2 — verify OTP
  // ---------------------------------------------------------------------------
  const handleOtpSuccess = useCallback(
    async (code: string) => {
      setVerifyError(null);
      try {
        await verifyCode(phone, code);
        // Navigation is handled inside verifyCode (navigates to redirectTo or /)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Неверный код. Попробуйте снова.';
        setVerifyError(message);
      }
    },
    [phone, verifyCode],
  );

  // ---------------------------------------------------------------------------
  // Resend
  // ---------------------------------------------------------------------------
  const handleResend = useCallback(async () => {
    setVerifyError(null);
    const result = await sendOtp(phone);
    setOtpExpiresIn(result.expiresIn);
  }, [phone, sendOtp]);

  // ---------------------------------------------------------------------------
  // Go back to phone step
  // ---------------------------------------------------------------------------
  const handleChangePhone = () => {
    setStep('phone');
    setVerifyError(null);
    setSendError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-brand flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-2">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-sage-400 to-beige-400 flex items-center justify-center shadow-soft">
              <span className="text-white font-bold text-2xl font-serif" aria-hidden="true">M</span>
            </div>
            <span className="font-serif font-semibold text-warm-900 text-xl">
              Mylo Master
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-soft border border-warm-100 p-6">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6" aria-hidden="true">
            <div
              className={`h-1.5 w-10 rounded-full transition-colors ${
                step === 'phone' ? 'bg-sage-500' : 'bg-sage-300'
              }`}
            />
            <div
              className={`h-1.5 w-10 rounded-full transition-colors ${
                step === 'otp' ? 'bg-sage-500' : 'bg-warm-200'
              }`}
            />
          </div>

          {/* Heading */}
          <div className="text-center mb-6">
            <h1 className="font-serif text-xl font-bold text-warm-900">
              {step === 'phone' ? 'Войти в аккаунт' : 'Введите код'}
            </h1>
            <p className="text-sm text-warm-500 mt-1">
              {step === 'phone'
                ? 'Введите номер телефона для входа'
                : 'Код из SMS действителен 2 минуты'}
            </p>
          </div>

          {/* Error from send OTP */}
          {sendError && step === 'phone' && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"
            >
              {sendError}
            </div>
          )}

          {step === 'phone' ? (
            <PhoneForm onSuccess={handlePhoneSuccess} isLoading={isSending} />
          ) : (
            <>
              <OtpForm
                phone={phone}
                expiresIn={otpExpiresIn}
                onSuccess={handleOtpSuccess}
                onResend={handleResend}
                isLoading={isLoading}
                error={verifyError}
              />

              {/* Change phone link */}
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleChangePhone}
                  className="text-xs text-warm-400 hover:text-warm-600 transition-colors underline"
                >
                  Изменить номер телефона
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-warm-400 mt-6">
          Входя, вы соглашаетесь с{' '}
          <Link to="/privacy" className="underline hover:text-warm-600">
            политикой конфиденциальности
          </Link>{' '}
          и{' '}
          <Link to="/terms" className="underline hover:text-warm-600">
            условиями использования
          </Link>
        </p>
      </div>
    </div>
  );
}
