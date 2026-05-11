import { clsx } from 'clsx';
import { ProductCard } from './ProductCard';
import { SkeletonProductCard } from '@components/ui/Skeleton';
import type { Product } from '@/types';

// =============================================================================
// ProductGrid — responsive grid with loading and empty states
// =============================================================================

type ProductGridProps = {
  products?: Product[] | undefined;
  isLoading?: boolean;
  skeletonCount?: number;
  emptyMessage?: string;
  columns?: 2 | 3 | 4;
  className?: string;
};

const columnsClass = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
};

export function ProductGrid({
  products,
  isLoading = false,
  skeletonCount = 8,
  emptyMessage = 'Товары не найдены',
  columns = 4,
  className,
}: ProductGridProps) {
  if (isLoading) {
    return (
      <div
        className={clsx('grid gap-5', columnsClass[columns], className)}
        aria-busy="true"
        aria-label="Загрузка товаров"
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonProductCard key={i} />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 h-16 w-16 rounded-full bg-beige-100 flex items-center justify-center">
          <svg
            className="h-8 w-8 text-beige-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"
            />
          </svg>
        </div>
        <p className="text-warm-500 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={clsx('grid gap-5', columnsClass[columns], className)}
      role="list"
      aria-label="Список товаров"
    >
      {products.map((product) => (
        <div key={product.id} role="listitem">
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  );
}
