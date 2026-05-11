import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from '@components/layout/Layout';
import { AdminLayout } from '@components/layout/AdminLayout';
import { ErrorBoundary, RouteErrorBoundary } from '@components/ErrorBoundary';
import { useAuthStore } from '@store/auth.store';

// =============================================================================
// App — Router setup with lazy-loaded pages, auth guards, code splitting
// =============================================================================

// ---------------------------------------------------------------------------
// Lazy-loaded pages — public
// ---------------------------------------------------------------------------
const HomePage = lazy(() => import('@pages/HomePage'));
const CatalogPage = lazy(() => import('@pages/CatalogPage'));
const ProductPage = lazy(() => import('@pages/ProductPage'));
const CartPage = lazy(() => import('@pages/CartPage'));
const CheckoutPage = lazy(() => import('@pages/CheckoutPage'));
const OrdersPage = lazy(() => import('@pages/OrdersPage'));
const ProfilePage = lazy(() => import('@pages/ProfilePage'));
const LoginPage = lazy(() => import('@pages/auth/LoginPage'));
const NotFoundPage = lazy(() => import('@pages/NotFoundPage'));

// ---------------------------------------------------------------------------
// Lazy-loaded admin pages
// ---------------------------------------------------------------------------
const AdminDashboardPage = lazy(() => import('@pages/admin/DashboardPage'));
const AdminOrdersPage = lazy(() => import('@pages/admin/OrdersPage'));
const AdminProductsPage = lazy(() => import('@pages/admin/ProductsPage'));

// ---------------------------------------------------------------------------
// Page loading fallback
// ---------------------------------------------------------------------------
function PageLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-beige-50"
      aria-label="Загрузка страницы"
      role="status"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sage-400 to-beige-400 animate-pulse-soft" />
        <p className="text-sm text-warm-400">Загрузка...</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth guard — redirects to /login if not authenticated
// ---------------------------------------------------------------------------
function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// ---------------------------------------------------------------------------
// Admin guard — requires admin or manager role
// ---------------------------------------------------------------------------
function RequireAdmin() {
  const { isAuthenticated, role, isLoading } = useAuthStore();

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role !== 'admin' && role !== 'manager') {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* ===== PUBLIC ROUTES ===== */}
            <Route element={<Layout />}>
              <Route
                index
                element={
                  <RouteErrorBoundary>
                    <HomePage />
                  </RouteErrorBoundary>
                }
              />
              <Route
                path="catalog"
                element={
                  <RouteErrorBoundary>
                    <CatalogPage />
                  </RouteErrorBoundary>
                }
              />
              <Route
                path="products/:slug"
                element={
                  <RouteErrorBoundary>
                    <ProductPage />
                  </RouteErrorBoundary>
                }
              />
              <Route
                path="cart"
                element={
                  <RouteErrorBoundary>
                    <CartPage />
                  </RouteErrorBoundary>
                }
              />

              {/* ===== AUTHENTICATED ROUTES ===== */}
              <Route element={<RequireAuth />}>
                <Route
                  path="checkout"
                  element={
                    <RouteErrorBoundary>
                      <CheckoutPage />
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="orders"
                  element={
                    <RouteErrorBoundary>
                      <OrdersPage />
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="orders/:orderId"
                  element={
                    <RouteErrorBoundary>
                      <OrdersPage />
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="profile"
                  element={
                    <RouteErrorBoundary>
                      <ProfilePage />
                    </RouteErrorBoundary>
                  }
                />
              </Route>
            </Route>

            {/* ===== AUTH PAGE (no header/footer) ===== */}
            <Route path="login" element={<LoginPage />} />

            {/* ===== ADMIN ROUTES ===== */}
            <Route element={<RequireAdmin />}>
              <Route path="admin" element={<AdminLayout />}>
                <Route
                  index
                  element={
                    <RouteErrorBoundary>
                      <AdminDashboardPage />
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="orders"
                  element={
                    <RouteErrorBoundary>
                      <AdminOrdersPage />
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="orders/:orderId"
                  element={
                    <RouteErrorBoundary>
                      <AdminOrdersPage />
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="products"
                  element={
                    <RouteErrorBoundary>
                      <AdminProductsPage />
                    </RouteErrorBoundary>
                  }
                />
              </Route>
            </Route>

            {/* ===== 404 ===== */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
