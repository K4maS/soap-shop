import { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Bell,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@store/auth.store';
import { useAuth } from '@hooks/useAuth';

// =============================================================================
// AdminLayout — sidebar + top bar for admin panel
// =============================================================================

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Заказы', icon: ShoppingBag },
  { to: '/admin/products', label: 'Товары', icon: Package },
  { to: '/admin/customers', label: 'Клиенты', icon: Users },
  { to: '/admin/analytics', label: 'Аналитика', icon: BarChart3 },
  { to: '/admin/settings', label: 'Настройки', icon: Settings },
] as const;

export function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-warm-50 flex">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-hidden="true"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-warm-200 flex flex-col',
          'transition-transform duration-300',
          'md:translate-x-0 md:static md:z-auto',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Панель администратора"
      >
        {/* Sidebar header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-warm-100">
          <Link to="/admin" className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 rounded-lg">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-sage-500 to-beige-400 flex items-center justify-center">
              <span className="text-white font-bold text-xs" aria-hidden="true">M</span>
            </div>
            <span className="font-serif font-semibold text-warm-900 text-sm">
              Mylo Admin
            </span>
          </Link>

          <button
            type="button"
            className="md:hidden p-1 text-warm-400 hover:text-warm-600"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Закрыть меню"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Навигация администратора">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sage-50 text-sage-700'
                    : 'text-warm-600 hover:text-warm-900 hover:bg-warm-50',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={clsx('h-4 w-4 flex-shrink-0', isActive ? 'text-sage-600' : 'text-warm-400')}
                    aria-hidden="true"
                  />
                  {item.label}
                  {isActive && (
                    <ChevronRight className="h-3 w-3 ml-auto text-sage-400" aria-hidden="true" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar footer — user info */}
        <div className="p-4 border-t border-warm-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-sage-100 flex items-center justify-center">
              <span className="text-sage-700 text-xs font-semibold" aria-hidden="true">
                {user?.name?.[0]?.toUpperCase() ?? 'A'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-warm-900 truncate">
                {user?.name ?? 'Администратор'}
              </p>
              <p className="text-xs text-warm-400 truncate">{user?.role}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-warm-200 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="md:hidden p-2 rounded-xl text-warm-500 hover:text-warm-700 hover:bg-warm-50"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Открыть меню"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Breadcrumb placeholder — filled by pages */}
            <nav aria-label="Хлебные крошки">
              <Link to="/" className="text-xs text-warm-400 hover:text-warm-600 transition-colors">
                Сайт
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button
              type="button"
              aria-label="Уведомления"
              className="relative p-2 rounded-xl text-warm-500 hover:text-warm-700 hover:bg-warm-50 transition-colors"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Visit store */}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sage-700 border border-sage-300 rounded-xl hover:bg-sage-50 transition-colors"
            >
              Перейти в магазин
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
