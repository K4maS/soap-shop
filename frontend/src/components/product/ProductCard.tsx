import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Heart } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { SkeletonProductCard } from '@components/ui/Skeleton';
import { useCartStore } from '@store/cart.store';
import { formatPrice } from '@utils/format';
import type { Product, ProductVariant } from '@/types';
import toast from 'react-hot-toast';

// =============================================================================
// ProductCard — product grid card with add-to-cart
// =============================================================================

type ProductCardProps = {
  product: Product;
  className?: string;
};

export function ProductCard({ product, className }: ProductCardProps) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];

  // Use cheapest active variant as default
  const defaultVariant: ProductVariant | undefined = product.variants
    .filter((v) => v.isActive && v.stock > 0)
    .sort((a, b) => a.priceKopecks - b.priceKopecks)[0];

  const isOutOfStock =
    product.variants.filter((v) => v.isActive && v.stock > 0).length === 0;

  const hasDiscount =
    defaultVariant?.compareAtPriceKopecks != null &&
    defaultVariant.compareAtPriceKopecks > defaultVariant.priceKopecks;

  const discountPercent =
    hasDiscount && defaultVariant?.compareAtPriceKopecks != null
      ? Math.round(
          (1 - defaultVariant.priceKopecks / defaultVariant.compareAtPriceKopecks) * 100,
        )
      : null;

  const handleAddToCart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!defaultVariant || isOutOfStock) return;

      addItem({
        productId: product.id,
        variantId: defaultVariant.id,
        productName: product.name,
        variantName: defaultVariant.name,
        imageUrl: primaryImage?.url ?? null,
        slug: product.slug,
        priceKopecks: defaultVariant.priceKopecks,
        quantity: 1,
      });

      toast.success(`${product.name} добавлен в корзину`, {
        icon: '🛒',
        duration: 2000,
      });
    },
    [defaultVariant, isOutOfStock, addItem, product, primaryImage],
  );

  const handleWishlist = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWishlisted((w) => !w);
  }, []);

  return (
    <article
      className={clsx(
        'group bg-white rounded-2xl overflow-hidden shadow-card',
        'hover:shadow-card-hover transition-shadow duration-200',
        className,
      )}
    >
      <Link
        to={`/products/${product.slug}`}
        className="block"
        aria-label={`Перейти к ${product.name}`}
      >
        {/* Image */}
        <div className="relative overflow-hidden bg-beige-50 aspect-square">
          {primaryImage ? (
            <img
              src={primaryImage.url}
              alt={primaryImage.altText ?? product.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-beige-100">
              <svg
                className="h-12 w-12 text-beige-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}

          {/* Badges overlay */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {discountPercent && (
              <Badge variant="error" size="sm">
                -{discountPercent}%
              </Badge>
            )}
            {product.isFeatured && (
              <Badge variant="sage" size="sm">
                Хит
              </Badge>
            )}
            {isOutOfStock && (
              <Badge variant="default" size="sm">
                Нет в наличии
              </Badge>
            )}
          </div>

          {/* Wishlist */}
          <button
            type="button"
            onClick={handleWishlist}
            aria-label={isWishlisted ? 'Убрать из избранного' : 'Добавить в избранное'}
            aria-pressed={isWishlisted}
            className={clsx(
              'absolute top-2 right-2 p-1.5 rounded-full',
              'bg-white/80 backdrop-blur-sm shadow-sm',
              'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
              'hover:bg-white focus-visible:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400',
            )}
          >
            <Heart
              className={clsx(
                'h-4 w-4 transition-colors',
                isWishlisted ? 'fill-rose-500 text-rose-500' : 'text-warm-400',
              )}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Category */}
          <p className="text-xs text-warm-400 mb-1 truncate">
            {product.category.name}
          </p>

          {/* Name */}
          <h3 className="text-sm font-medium text-warm-900 line-clamp-2 leading-snug mb-2">
            {product.name}
          </h3>

          {/* Variants count */}
          {product.variants.length > 1 && (
            <p className="text-xs text-warm-400 mb-2">
              {product.variants.length} вариантов
            </p>
          )}

          {/* Price + cart */}
          <div className="flex items-center justify-between gap-2 mt-auto">
            <div>
              <p className="text-base font-semibold text-warm-900">
                {defaultVariant
                  ? formatPrice(defaultVariant.priceKopecks)
                  : 'Нет в наличии'}
              </p>
              {hasDiscount && defaultVariant?.compareAtPriceKopecks != null && (
                <p className="text-xs text-warm-400 line-through">
                  {formatPrice(defaultVariant.compareAtPriceKopecks)}
                </p>
              )}
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              aria-label={`Добавить ${product.name} в корзину`}
              leftIcon={<ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              В корзину
            </Button>
          </div>
        </div>
      </Link>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------
export { SkeletonProductCard as ProductCardSkeleton };
