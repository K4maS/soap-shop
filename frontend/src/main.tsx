import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { App } from './App';
import './index.css';

// =============================================================================
// Application entry point — React 18 createRoot
// =============================================================================

// ---------------------------------------------------------------------------
// TanStack Query global client
// ---------------------------------------------------------------------------
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry on 4xx errors (auth, not found, etc.)
      retry: (failureCount, error) => {
        if (error instanceof Error) {
          const status = (error as { status?: number }).status;
          if (status != null && status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      staleTime: 1000 * 60 * 1,     // 1 minute default
      gcTime: 1000 * 60 * 10,       // 10 minutes cache
      refetchOnWindowFocus: import.meta.env.PROD,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------
const container = document.getElementById('root');

if (!container) {
  throw new Error(
    '[main] #root element not found. Check index.html — the <div id="root"> must exist.',
  );
}

const root = createRoot(container);

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {import.meta.env.DEV && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      )}
    </QueryClientProvider>
  </StrictMode>,
);
