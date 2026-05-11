import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

// =============================================================================
// ErrorBoundary — class component (required by React for error boundaries)
// =============================================================================

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log to error reporting service in production
    if (import.meta.env.PROD) {
      console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
      // TODO: Send to Sentry / other error reporting
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Default error UI
// ---------------------------------------------------------------------------

function DefaultErrorFallback({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) {
  return (
    <div
      role="alert"
      className="min-h-screen flex items-center justify-center bg-beige-50 px-4"
    >
      <div className="max-w-md w-full text-center">
        {/* Illustration */}
        <div className="mx-auto mb-6 h-24 w-24 rounded-full bg-rose-100 flex items-center justify-center">
          <svg
            className="h-12 w-12 text-rose-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-warm-900 font-serif mb-2">
          Что-то пошло не так
        </h1>
        <p className="text-warm-500 mb-6">
          Произошла непредвиденная ошибка. Попробуйте обновить страницу или вернитесь позже.
        </p>

        {/* Show error details only in dev */}
        {import.meta.env.DEV && error && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-warm-500 hover:text-warm-700">
              Подробности ошибки (dev)
            </summary>
            <pre className="mt-2 p-3 bg-warm-100 rounded-lg text-xs text-red-700 overflow-auto max-h-40">
              {error.message}
              {'\n'}
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onReset}
            className="px-5 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors text-sm font-medium"
          >
            Попробовать снова
          </button>
          <a
            href="/"
            className="px-5 py-2 bg-beige-100 text-warm-700 rounded-lg hover:bg-beige-200 transition-colors text-sm font-medium"
          >
            На главную
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route-level error boundary (lighter, for page errors)
// ---------------------------------------------------------------------------

type RouteErrorBoundaryProps = {
  children: ReactNode;
};

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  { hasError: boolean }
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('[RouteErrorBoundary]', error, errorInfo);
    }
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center py-24 px-4 text-center"
        >
          <p className="text-warm-500 mb-4">
            Не удалось загрузить эту страницу.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-sage-600 hover:underline text-sm"
          >
            Попробовать снова
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
