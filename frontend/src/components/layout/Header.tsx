import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Menu, X, Search, LogOut, Package, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@store/auth.store';
import { useCartStore } from '@store/cart.store';
import { useAuth } from '@hooks/useAuth';

// =============================================================================
// Header — navigation, cart icon, user menu
// =============================================================================

const NAV_LINKS = [
  { to: '/catalog', label: 'Каталог' },
  { to: '/catalog?category=soap', label: 'Мыло' },
  { to: '/catalog?category=cosmetics', label: 'Косметика' },
  { to: '/catalog?category=gifts', label: 'Подарки' },
];

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const userMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const totalItems = useCartStore((s) => s.totalItems);
  const { logout, isAdmin } = useAuth();

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/catalog?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-warm-100 shadow-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            to="/"
            className="flex-shrink-0 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 rounded-lg"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sage-400 to-beige-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm" aria-hidden="true">M</span>
            </div>
            <span className="font-serif font-semibold text-warm-900 text-lg hidden sm:block">
              Mylo Master
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Основная навигация">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  clsx(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sage-50 text-sage-700'
                      : 'text-warm-600 hover:text-warm-900 hover:bg-warm-50',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Search — desktop */}
          <form
            onSubmit={handleSearch}
            role="search"
            className="hidden lg:flex flex-1 max-w-xs items-center"
          >
            <div className="relative w-full">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-warm-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск товаров..."
                aria-label="Поиск товаров"
                className="w-full pl-9 pr-4 py-1.5 text-sm border border-warm-200 rounded-xl bg-warm-50 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-sage-400 transition-colors"
              />
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Cart */}
            <Link
              to="/cart"
              className="relative p-2 rounded-xl text-warm-600 hover:text-warm-900 hover:bg-warm-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400"
              aria-label={`Корзина, ${totalItems} товаров`}
            >
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
              {totalItems > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-sage-500 text-white text-[10px] font-bold"
                  aria-hidden="true"
                >
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>

            {/* User menu */}
            {isAuthenticated ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((o) => !o)}
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Меню пользователя"
                  className="p-2 rounded-xl text-warm-600 hover:text-warm-900 hover:bg-warm-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400"
                >
                  <User className="h-5 w-5" aria-hidden="true" />
                </button>

                {isUserMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-soft border border-warm-100 py-1 animate-slide-down"
                  >
                    {/* User info */}
                    <div className="px-4 py-2 border-b border-warm-100">
                      <p className="text-sm font-medium text-warm-900 truncate">
                        {user?.name ?? 'Пользователь'}
                      </p>
                      <p className="text-xs text-warm-400 truncate">{user?.phone}</p>
                    </div>

                    <Link
                      to="/profile"
                      role="menuitem"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-warm-700 hover:bg-warm-50 transition-colors"
                    >
                      <User className="h-4 w-4" aria-hidden="true" />
                      Профиль
                    </Link>

                    <Link
                      to="/orders"
                      role="menuitem"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-warm-700 hover:bg-warm-50 transition-colors"
                    >
                      <Package className="h-4 w-4" aria-hidden="true" />
                      Мои заказы
                    </Link>

                    {isAdmin && (
                      <>
                        <hr className="my-1 border-warm-100" />
                        <Link
                          to="/admin"
                          role="menuitem"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-sage-700 hover:bg-sage-50 transition-colors"
                        >
                          <Settings className="h-4 w-4" aria-hidden="true" />
                          Панель управления
                        </Link>
                      </>
                    )}

                    <hr className="my-1 border-warm-100" />

                    <button
                      role="menuitem"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        void logout();
                      }}
                      className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Выйти
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-warm-700 hover:text-warm-900 hover:bg-warm-50 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                Войти
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((o) => !o)}
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
              className="md:hidden p-2 rounded-xl text-warm-600 hover:text-warm-900 hover:bg-warm-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-warm-100 py-3 animate-slide-down">
            {/* Mobile search */}
            <form onSubmit={handleSearch} role="search" className="mb-3">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-warm-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск товаров..."
                  aria-label="Поиск товаров"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-warm-200 rounded-xl bg-warm-50 focus:outline-none focus:ring-2 focus:ring-sage-300"
                />
              </div>
            </form>

            <nav aria-label="Мобильная навигация">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'block px-3 py-2 rounded-lg text-sm font-medium mb-0.5',
                      isActive
                        ? 'bg-sage-50 text-sage-700'
                        : 'text-warm-700 hover:bg-warm-50',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}

              {!isAuthenticated && (
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2 mt-2 text-sm font-medium text-sage-700 border border-sage-300 rounded-lg text-center hover:bg-sage-50"
                >
                  Войти
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
