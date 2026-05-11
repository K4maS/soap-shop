import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Header } from './Header';
import { Footer } from './Footer';

// =============================================================================
// Layout — public-facing layout with header + footer
// =============================================================================

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-beige-50">
      {/* Skip to content — accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-sage-700 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-medium"
      >
        Перейти к содержимому
      </a>

      <Header />

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      <Footer />

      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#34302b',
            border: '1px solid #ece8e0',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
            fontSize: '14px',
            padding: '12px 16px',
          },
          success: {
            iconTheme: { primary: '#4e7940', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#dc2626', secondary: '#fff' },
          },
        }}
      />
    </div>
  );
}
