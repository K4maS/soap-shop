import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

// =============================================================================
// Button — accessible, multiple variants, supports loading state
// =============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'bg-sage-600 text-white',
    'hover:bg-sage-700 active:bg-sage-800',
    'focus-visible:ring-sage-500',
    'disabled:bg-sage-300 disabled:cursor-not-allowed',
    'shadow-sm hover:shadow',
  ].join(' '),

  secondary: [
    'bg-beige-100 text-warm-800',
    'hover:bg-beige-200 active:bg-beige-300',
    'focus-visible:ring-beige-400',
    'disabled:bg-beige-50 disabled:text-warm-400 disabled:cursor-not-allowed',
    'border border-beige-300',
  ].join(' '),

  ghost: [
    'bg-transparent text-warm-700',
    'hover:bg-warm-100 active:bg-warm-200',
    'focus-visible:ring-warm-400',
    'disabled:text-warm-400 disabled:cursor-not-allowed',
  ].join(' '),

  danger: [
    'bg-red-600 text-white',
    'hover:bg-red-700 active:bg-red-800',
    'focus-visible:ring-red-500',
    'disabled:bg-red-300 disabled:cursor-not-allowed',
    'shadow-sm hover:shadow',
  ].join(' '),

  outline: [
    'bg-transparent text-sage-700 border border-sage-600',
    'hover:bg-sage-50 active:bg-sage-100',
    'focus-visible:ring-sage-500',
    'disabled:border-sage-300 disabled:text-sage-400 disabled:cursor-not-allowed',
  ].join(' '),
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs rounded-md gap-1',
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'px-6 py-2.5 text-base rounded-xl gap-2',
};

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || isLoading;

    const spinnerSizeClass = {
      xs: 'h-3 w-3',
      sm: 'h-3.5 w-3.5',
      md: 'h-4 w-4',
      lg: 'h-5 w-5',
    }[size];

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={isLoading}
        className={clsx(
          // Base
          'inline-flex items-center justify-center font-medium',
          'transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'select-none whitespace-nowrap',
          // Variant
          variantClasses[variant],
          // Size
          sizeClasses[size],
          // Full width
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <Spinner className={spinnerSizeClass} />
            {loadingText ?? children}
          </>
        ) : (
          <>
            {leftIcon && (
              <span className="flex-shrink-0" aria-hidden="true">
                {leftIcon}
              </span>
            )}
            {children}
            {rightIcon && (
              <span className="flex-shrink-0" aria-hidden="true">
                {rightIcon}
              </span>
            )}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
