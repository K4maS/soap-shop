import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useCartStore } from '@store/cart.store';
import { formatPrice } from '@utils/format';
import type { CartItem as CartItemType } from '@/types';

// =============================================================================
// CartItem — cart line item with quantity controls
// =============================================================================

type CartItemProps = {
  item: CartItemType;
  className?: string;
};

export function CartItem({ item, className }: CartItemProps) {
  const { updateQuantity, removeItem } = useCartStore();

  const handleDecrement = useCallback(() => {
    if (item.quantity <= 1) {
      removeItem(item.variantId);
    } else {
      updateQuantity(item.variantId, item.quantity - 1);
    }
  }, [item.quantity, item.variantId, removeItem, updateQuantity]);

  const handleIncrement = useCallback(() => {
    updateQuantity(item.variantId, item.quantity + 1);
  }, [item.variantId, item.quantity, updateQuantity]);

  const handleRemove = useCallback(() => {
    removeItem(item.variantId);
  }, [item.variantId, removeItem]);

  const lineTotal = item.priceKopecks * item.quantity;

  return (
    <article
      className={clsx(
        'flex items-start gap-4 py-4',
        'border-b border-warm-100 last:border-0',
        className,
      )}
      aria-label={`${item.productName}, ${item.variantName}`}
    >
      {/* Product image */}
      <Link
        to={`/products/${item.slug}`}
        className="flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 rounded-xl"
        tabIndex={0}
      >
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-beige-50">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.productName}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-beige-100">
              <svg
                className="h-6 w-6 text-beige-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"
                />
              </svg>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/products/${item.slug}`}
              className="text-sm font-medium text-warm-900 hover:text-sage-700 transition-colors line-clamp-2"
            >
              {item.productName}
            </Link>
            <p className="text-xs text-warm-400 mt-0.5">{item.variantName}</p>
          </div>

          {/* Remove */}
          <button
            type="button"
            onClick={handleRemove}
            aria-label={`Удалить ${item.productName} из корзины`}
            className={clsx(
              'flex-shrink-0 p-1 rounded-lg text-warm-400',
              'hover:text-red-500 hover:bg-red-50',
              'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400',
            )}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Price + qty */}
        <div className="flex items-center justify-between mt-3">
          {/* Quantity stepper */}
          <div
            className="flex items-center rounded-xl border border-warm-200 overflow-hidden"
            role="group"
            aria-label="Количество товара"
          >
            <button
              type="button"
              onClick={handleDecrement}
              aria-label="Уменьшить количество"
              className={clsx(
                'w-8 h-8 flex items-center justify-center',
                'text-warm-500 hover:text-warm-800 hover:bg-warm-50',
                'transition-colors focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-sage-400',
              )}
            >
              {item.quantity === 1 ? (
                <Trash2 className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
              ) : (
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>

            <span
              className="w-8 text-center text-sm font-medium text-warm-900 tabular-nums"
              aria-live="polite"
              aria-atomic="true"
            >
              {item.quantity}
            </span>

            <button
              type="button"
              onClick={handleIncrement}
              aria-label="Увеличить количество"
              className={clsx(
                'w-8 h-8 flex items-center justify-center',
                'text-warm-500 hover:text-warm-800 hover:bg-warm-50',
                'transition-colors focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-sage-400',
              )}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Line total */}
          <div className="text-right">
            <p className="text-sm font-semibold text-warm-900">
              {formatPrice(lineTotal)}
            </p>
            {item.quantity > 1 && (
              <p className="text-xs text-warm-400">
                {formatPrice(item.priceKopecks)} × {item.quantity}
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
