import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@components/ui/Button';
import { CartItem } from '@components/cart/CartItem';
import { useCartStore } from '@store/cart.store';
import { useAuthStore } from '@store/auth.store';
import { formatPrice, pluralize } from '@utils/format';

// =============================================================================
// CartPage — cart items list, totals, checkout CTA
// =============================================================================

const DELIVERY_THRESHOLD = 300000; // 3000 ₽ in kopecks — free delivery above this
const STANDARD_DELIVERY = 30000;   // 300 ₽

export default function CartPage() {
  const { items, subtotalKopecks, totalItems, clearCart } = useCartStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();

  const deliveryKopecks = subtotalKopecks >= DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY;
  const totalKopecks = subtotalKopecks + deliveryKopecks;
  const remainingForFreeDelivery = DELIVERY_THRESHOLD - subtotalKopecks;

  const handleCheckout = () => {
    if (!isAuthenticated) {
      // Redirect to login, then back to checkout
      navigate('/login?redirect=/checkout');
      return;
    }
    navigate('/checkout');
  };

  // Empty cart
  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-beige-100 flex items-center justify-center">
          <ShoppingCart className="h-10 w-10 text-beige-400" aria-hidden="true" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-warm-900 mb-3">
          Корзина пуста
        </h1>
        <p className="text-warm-500 text-sm mb-8">
          Добавьте товары из каталога, чтобы оформить заказ
        </p>
        <Button
          variant="primary"
          size="lg"
          onClick={() => navigate('/catalog')}
          leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
        >
          Перейти в каталог
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-serif text-2xl md:text-3xl font-bold text-warm-900 mb-2">
        Корзина
      </h1>
      <p className="text-sm text-warm-500 mb-8">
        {pluralize(totalItems, 'товар', 'товара', 'товаров')}
      </p>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* ===== Cart items ===== */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3 border-b border-warm-100 flex items-center justify-between">
              <span className="text-sm font-medium text-warm-700">Товары</span>
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-warm-400 hover:text-red-500 transition-colors"
              >
                Очистить корзину
              </button>
            </div>

            {/* Items */}
            <div className="px-5">
              {items.map((item) => (
                <CartItem key={item.variantId} item={item} />
              ))}
            </div>
          </div>

          {/* Continue shopping */}
          <Link
            to="/catalog"
            className="inline-flex items-center gap-1.5 mt-5 text-sm text-warm-500 hover:text-warm-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Продолжить покупки
          </Link>
        </div>

        {/* ===== Order summary ===== */}
        <aside className="lg:w-80 flex-shrink-0" aria-label="Итого">
          <div className="bg-white rounded-2xl shadow-card p-5 sticky top-24">
            <h2 className="font-semibold text-warm-900 mb-4">Итого</h2>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-warm-500">
                  {pluralize(totalItems, 'товар', 'товара', 'товаров')}
                </dt>
                <dd className="text-warm-800 font-medium">
                  {formatPrice(subtotalKopecks)}
                </dd>
              </div>

              <div className="flex justify-between">
                <dt className="text-warm-500">Доставка</dt>
                <dd className={deliveryKopecks === 0 ? 'text-green-600 font-medium' : 'text-warm-800 font-medium'}>
                  {deliveryKopecks === 0 ? 'Бесплатно' : formatPrice(deliveryKopecks)}
                </dd>
              </div>
            </dl>

            {/* Free delivery progress */}
            {remainingForFreeDelivery > 0 && (
              <div className="mt-4 p-3 bg-beige-50 rounded-xl">
                <p className="text-xs text-warm-600 mb-2">
                  До бесплатной доставки осталось{' '}
                  <span className="font-semibold">{formatPrice(remainingForFreeDelivery)}</span>
                </p>
                <div
                  className="h-1.5 bg-beige-200 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={subtotalKopecks}
                  aria-valuemin={0}
                  aria-valuemax={DELIVERY_THRESHOLD}
                  aria-label="Прогресс до бесплатной доставки"
                >
                  <div
                    className="h-full bg-sage-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (subtotalKopecks / DELIVERY_THRESHOLD) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="border-t border-warm-100 mt-4 pt-4 flex justify-between font-semibold">
              <span className="text-warm-800">К оплате</span>
              <span className="text-warm-900 text-lg">{formatPrice(totalKopecks)}</span>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleCheckout}
              className="mt-4"
              rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
            >
              {isAuthenticated ? 'Оформить заказ' : 'Войти и оформить'}
            </Button>

            {/* Security note */}
            <p className="text-xs text-warm-400 text-center mt-3 flex items-center justify-center gap-1">
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
              Безопасная оплата
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
