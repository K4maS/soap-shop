import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

// =============================================================================
// Input — accessible, error state, label, helper text
// =============================================================================

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string | undefined;
  error?: string | undefined;
  helperText?: string | undefined;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  containerClassName?: string | undefined;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftAddon,
      rightAddon,
      containerClassName,
      className,
      id: idProp,
      required,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const hasError = Boolean(error);
    const hasHelper = Boolean(helperText);

    return (
      <div className={clsx('flex flex-col gap-1', containerClassName)}>
        {label && (
          <label
            htmlFor={id}
            className={clsx(
              'text-sm font-medium',
              hasError ? 'text-red-700' : 'text-warm-700',
              disabled && 'opacity-50',
            )}
          >
            {label}
            {required && (
              <span className="ml-0.5 text-red-500" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <div className="relative flex items-center">
          {leftAddon && (
            <div
              className={clsx(
                'absolute left-3 flex items-center pointer-events-none',
                hasError ? 'text-red-400' : 'text-warm-400',
              )}
              aria-hidden="true"
            >
              {leftAddon}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            required={required}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={
              [hasError && errorId, hasHelper && helperId]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={clsx(
              // Base
              'w-full rounded-lg border bg-white px-3 py-2 text-sm text-warm-900',
              'placeholder:text-warm-400',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              // Left addon padding
              leftAddon && 'pl-9',
              // Right addon padding
              rightAddon && 'pr-9',
              // Normal state
              !hasError && [
                'border-warm-300',
                'hover:border-warm-400',
                'focus:border-sage-400 focus:ring-sage-300',
              ],
              // Error state
              hasError && [
                'border-red-400 bg-red-50',
                'focus:border-red-500 focus:ring-red-300',
              ],
              // Disabled state
              disabled && 'cursor-not-allowed bg-warm-50 opacity-60',
              className,
            )}
            {...props}
          />

          {rightAddon && (
            <div
              className="absolute right-3 flex items-center pointer-events-none text-warm-400"
              aria-hidden="true"
            >
              {rightAddon}
            </div>
          )}
        </div>

        {hasError && (
          <p id={errorId} role="alert" className="text-xs text-red-600 flex items-center gap-1">
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
            {error}
          </p>
        )}

        {hasHelper && !hasError && (
          <p id={helperId} className="text-xs text-warm-500">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

// ---------------------------------------------------------------------------
// Textarea variant
// ---------------------------------------------------------------------------

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string | undefined;
  error?: string | undefined;
  helperText?: string | undefined;
  containerClassName?: string | undefined;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      containerClassName,
      className,
      id: idProp,
      required,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;
    const hasError = Boolean(error);
    const hasHelper = Boolean(helperText);

    return (
      <div className={clsx('flex flex-col gap-1', containerClassName)}>
        {label && (
          <label
            htmlFor={id}
            className={clsx(
              'text-sm font-medium',
              hasError ? 'text-red-700' : 'text-warm-700',
              disabled && 'opacity-50',
            )}
          >
            {label}
            {required && (
              <span className="ml-0.5 text-red-500" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <textarea
          ref={ref}
          id={id}
          required={required}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={
            [hasError && errorId, hasHelper && helperId]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className={clsx(
            'w-full rounded-lg border bg-white px-3 py-2 text-sm text-warm-900',
            'placeholder:text-warm-400 resize-vertical min-h-[80px]',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            !hasError && [
              'border-warm-300 hover:border-warm-400',
              'focus:border-sage-400 focus:ring-sage-300',
            ],
            hasError && [
              'border-red-400 bg-red-50',
              'focus:border-red-500 focus:ring-red-300',
            ],
            disabled && 'cursor-not-allowed bg-warm-50 opacity-60',
            className,
          )}
          {...props}
        />

        {hasError && (
          <p id={errorId} role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}

        {hasHelper && !hasError && (
          <p id={helperId} className="text-xs text-warm-500">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
