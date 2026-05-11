import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { Button } from './Button';

// =============================================================================
// Modal — accessible, focus trap, keyboard navigation, portal
// =============================================================================

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  hideCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full mx-4',
};

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  hideCloseButton = false,
  closeOnBackdropClick = true,
  closeOnEsc = true,
  children,
  footer,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // ---------------------------------------------------------------------------
  // Focus trap
  // ---------------------------------------------------------------------------
  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (!dialogRef.current) return;

    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.key === 'Tab') {
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Escape key
  // ---------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      trapFocus(e);
    },
    [closeOnEsc, onClose, trapFocus],
  );

  // ---------------------------------------------------------------------------
  // Mount / unmount effects
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    // Store currently focused element to restore later
    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    // Focus the dialog
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTORS);
    firstFocusable?.focus() ?? dialogRef.current?.focus();

    // Prevent background scroll
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      // Restore focus
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const modalId = 'modal-title';
  const descId = 'modal-desc';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
        onClick={closeOnBackdropClick ? onClose : undefined}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? modalId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={clsx(
          'relative z-10 w-full bg-white rounded-2xl shadow-2xl',
          'animate-scale-in',
          'focus:outline-none',
          sizeClasses[size],
          className,
        )}
      >
        {/* Header */}
        {(title || !hideCloseButton) && (
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-warm-100">
            {title && (
              <div>
                <h2
                  id={modalId}
                  className="text-lg font-semibold text-warm-900 font-serif"
                >
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-0.5 text-sm text-warm-500">
                    {description}
                  </p>
                )}
              </div>
            )}
            {!hideCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Закрыть"
                className="ml-auto -mr-1 rounded-full"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-warm-100 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Confirm dialog — convenience wrapper
// ---------------------------------------------------------------------------

type ConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
};

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  isDangerous = false,
  isLoading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={isDangerous ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-sm text-warm-600">{message}</p>
    </Modal>
  );
}
