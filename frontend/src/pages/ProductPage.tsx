import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Minus, Plus, ChevronRight, Star, Leaf } from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { ProductGrid } from '@components/product/ProductGrid';
import { Skeleton, SkeletonText } from '@components/ui/Skeleton';
import { useProduct, useRelatedProducts } from '@hooks/useProducts';
import { useCartStore } from '@store/cart.store';
import { formatPrice } from '@utils/format';
import type { ProductVariant } from '@/types';
import toast from 'react-hot-toast';

// =============================================================================
// ProductPage — product detail, images, variant selector, add to cart
// =============================================================================

export default function ProductPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data: product, isLoading, error } = useProduct(slug);
  const { data: related } = useRelatedProducts(product?.id ?? '', 4);
  const addItem = useCartStore((s) => s.addItem);

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'description' | 'ingredients' | 'howToUse'>('description');

  // Pick default variant once product loads
  const activeVariant: ProductVariant | undefined =
    selectedVariant ??
    product?.variants.filter((v) => v.isActive && v.stock > 0).sort((a, b) => a.priceKopecks - b.priceKopecks)[0];

  const isOutOfStock = !activeVariant || activeVariant.stock === 0;

  const handleAddToCart = useCallback(() => {
    if (!product || !activeVariant) return;

    const primaryImage = product.images.find((i) => i.isPrimary) ?? product.images[0];

    addItem({
      productId: product.id,
      variantId: activeVariant.id,
      productName: product.name,
      variantName: activeVariant.name,
      imageUrl: primaryImage?.url ?? null,
      slug: product.slug,
      priceKopecks: activeVariant.priceKopecks,
      quantity,
    });

    toast.success(`${product.name} (${activeVariant.name}) добавлен в корзину`, {
      icon: '🛒',
    });
  }, [product, activeVariant, quantity, addItem]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex gap-2 mb-6">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="aspect-square rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <SkeletonText lines={4} />
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-12 w-48 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
        <p className="text-warm-500">Товар не найден.</p>
        <Link to="/catalog" className="mt-4 inline-block text-sage-600 hover:underline">
          Вернуться в каталог
        </Link>
      </div>
    );
  }

  const images = product.images.sort((a, b) => a.sortOrder - b.sortOrder);
  const currentImage = images[activeImageIndex];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-warm-400 mb-6" aria-label="Хлебные крошки">
        <Link to="/" className="hover:text-warm-600">Главная</Link>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
        <Link to="/catalog" className="hover:text-warm-600">Каталог</Link>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
        <Link
          to={`/catalog?categorySlug=${product.category.slug}`}
          className="hover:text-warm-600"
        >
          {product.category.name}
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
        <span className="text-warm-700 truncate max-w-xs">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* ===== LEFT — Images ===== */}
        <div>
          {/* Main image */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-beige-50 mb-3">
            {currentImage ? (
              <img
                src={currentImage.url}
                alt={currentImage.altText ?? product.name}
                className="w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Leaf className="h-16 w-16 text-beige-300" aria-hidden="true" />
              </div>
            )}

            {/* Discount badge */}
            {activeVariant?.compareAtPriceKopecks != null &&
              activeVariant.compareAtPriceKopecks > activeVariant.priceKopecks && (
                <div className="absolute top-3 left-3">
                  <Badge variant="error">
                    -{Math.round(
                      (1 - activeVariant.priceKopecks / activeVariant.compareAtPriceKopecks) * 100,
                    )}%
                  </Badge>
                </div>
              )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Фотографии товара">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  aria-label={`Фотография ${idx + 1}`}
                  aria-pressed={activeImageIndex === idx}
                  className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 ${
                    activeImageIndex === idx
                      ? 'border-sage-500'
                      : 'border-transparent hover:border-warm-300'
                  }`}
                >
                  <img
                    src={img.url}
                    alt={img.altText ?? ''}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ===== RIGHT — Product info ===== */}
        <div>
          {/* Category + badges */}
          <div className="flex items-center gap-2 mb-3">
            <Link
              to={`/catalog?categorySlug=${product.category.slug}`}
              className="text-xs text-sage-600 hover:underline"
            >
              {product.category.name}
            </Link>
            {product.isFeatured && <Badge variant="sage" size="sm">Хит</Badge>}
          </div>

          {/* Title */}
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-warm-900 mb-3">
            {product.name}
          </h1>

          {/* Rating */}
          {product.rating != null && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-0.5" aria-label={`Рейтинг: ${product.rating} из 5`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= Math.round(product.rating!)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-warm-200'
                    }`}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <span className="text-xs text-warm-500">
                {product.rating.toFixed(1)} ({product.reviewCount} отзывов)
              </span>
            </div>
          )}

          {/* Price */}
          <div className="mb-5">
            <span className="text-3xl font-bold text-warm-900">
              {activeVariant ? formatPrice(activeVariant.priceKopecks) : '—'}
            </span>
            {activeVariant?.compareAtPriceKopecks != null &&
              activeVariant.compareAtPriceKopecks > activeVariant.priceKopecks && (
                <span className="ml-3 text-lg text-warm-400 line-through">
                  {formatPrice(activeVariant.compareAtPriceKopecks)}
                </span>
              )}
          </div>

          {/* Short description */}
          {product.shortDescription && (
            <p className="text-warm-600 text-sm leading-relaxed mb-5">
              {product.shortDescription}
            </p>
          )}

          {/* Variant selector */}
          {product.variants.length > 1 && (
            <div className="mb-5">
              <p className="text-sm font-medium text-warm-700 mb-2">
                Вариант: <span className="text-warm-900">{activeVariant?.name}</span>
              </p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Варианты товара">
                {product.variants.map((variant) => {
                  const isActive = activeVariant?.id === variant.id;
                  const isAvailable = variant.isActive && variant.stock > 0;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      aria-label={`${variant.name} — ${formatPrice(variant.priceKopecks)}${!isAvailable ? ', нет в наличии' : ''}`}
                      disabled={!isAvailable}
                      onClick={() => {
                        setSelectedVariant(variant);
                        setQuantity(1);
                      }}
                      className={`px-3 py-1.5 text-sm rounded-xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 ${
                        isActive
                          ? 'border-sage-500 bg-sage-50 text-sage-800 font-medium'
                          : isAvailable
                          ? 'border-warm-200 text-warm-700 hover:border-warm-400'
                          : 'border-warm-100 text-warm-300 cursor-not-allowed line-through'
                      }`}
                    >
                      {variant.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock warning */}
          {activeVariant && activeVariant.stock > 0 && activeVariant.stock <= 5 && (
            <p className="text-xs text-orange-600 mb-4 flex items-center gap-1">
              <span aria-hidden="true">⚠</span>
              Осталось {activeVariant.stock} шт.
            </p>
          )}

          {/* Quantity + Add to cart */}
          <div className="flex items-center gap-3 mb-6">
            {/* Quantity stepper */}
            <div
              className="flex items-center rounded-xl border border-warm-200 overflow-hidden"
              role="group"
              aria-label="Количество"
            >
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Уменьшить количество"
                disabled={quantity <= 1}
                className="w-10 h-10 flex items-center justify-center text-warm-500 hover:text-warm-800 hover:bg-warm-50 transition-colors disabled:opacity-40"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="w-10 text-center text-sm font-medium text-warm-900 tabular-nums" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() =>
                  setQuantity((q) =>
                    activeVariant ? Math.min(activeVariant.stock, q + 1) : q + 1,
                  )
                }
                aria-label="Увеличить количество"
                disabled={activeVariant ? quantity >= activeVariant.stock : false}
                className="w-10 h-10 flex items-center justify-center text-warm-500 hover:text-warm-800 hover:bg-warm-50 transition-colors disabled:opacity-40"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              leftIcon={<ShoppingCart className="h-4 w-4" aria-hidden="true" />}
              className="flex-1"
            >
              {isOutOfStock ? 'Нет в наличии' : 'В корзину'}
            </Button>
          </div>

          {/* Product meta */}
          <div className="flex flex-wrap gap-2 mb-6">
            {product.tags.map((tag) => (
              <Badge key={tag} variant="beige" size="sm">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Delivery info */}
          <div className="bg-beige-50 rounded-xl p-4 text-xs text-warm-600 space-y-1">
            <p>🚚 Доставка по России от 1 дня</p>
            <p>🔄 Возврат в течение 14 дней</p>
            <p>🌿 Натуральный состав, гипоаллергенно</p>
          </div>
        </div>
      </div>

      {/* ===== TABS — Description / Ingredients / How to use ===== */}
      <div className="mt-12">
        <div
          className="flex border-b border-warm-200 gap-0"
          role="tablist"
          aria-label="Информация о товаре"
        >
          {(
            [
              { key: 'description', label: 'Описание' },
              { key: 'ingredients', label: 'Состав' },
              { key: 'howToUse', label: 'Применение' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`tab-panel-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 ${
                activeTab === tab.key
                  ? 'border-sage-500 text-sage-700'
                  : 'border-transparent text-warm-500 hover:text-warm-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="py-6 prose prose-sm max-w-none text-warm-700">
          {activeTab === 'description' && (
            <div id="tab-panel-description" role="tabpanel">
              <p className="whitespace-pre-wrap">{product.description}</p>
            </div>
          )}
          {activeTab === 'ingredients' && (
            <div id="tab-panel-ingredients" role="tabpanel">
              {product.ingredients ? (
                <p className="whitespace-pre-wrap">{product.ingredients}</p>
              ) : (
                <p className="text-warm-400">Информация о составе недоступна.</p>
              )}
            </div>
          )}
          {activeTab === 'howToUse' && (
            <div id="tab-panel-howToUse" role="tabpanel">
              {product.howToUse ? (
                <p className="whitespace-pre-wrap">{product.howToUse}</p>
              ) : (
                <p className="text-warm-400">Инструкция по применению недоступна.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== Related products ===== */}
      {related && related.length > 0 && (
        <section className="mt-12" aria-labelledby="related-heading">
          <h2 id="related-heading" className="font-serif text-xl font-bold text-warm-900 mb-6">
            Похожие товары
          </h2>
          <ProductGrid products={related} columns={4} />
        </section>
      )}
    </div>
  );
}
