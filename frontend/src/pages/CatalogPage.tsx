import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@components/ui/Button';
import { ProductGrid } from '@components/product/ProductGrid';
import { useProducts, useCategories } from '@hooks/useProducts';
import type { ProductFilters } from '@/types';

// =============================================================================
// CatalogPage — product grid, filters sidebar, pagination, search
// =============================================================================

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Новинки' },
  { value: 'price:asc', label: 'Цена: по возрастанию' },
  { value: 'price:desc', label: 'Цена: по убыванию' },
  { value: 'rating:desc', label: 'По рейтингу' },
  { value: 'name:asc', label: 'По названию' },
] as const;

const PAGE_SIZE = 16;

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');

  // Read filters from URL
  const page = Number(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? undefined;
  const categorySlug = searchParams.get('categorySlug') ?? undefined;
  const categoryId = searchParams.get('categoryId') ?? undefined;
  const isFeatured = searchParams.get('isFeatured') === 'true' ? true : undefined;
  const sortRaw = searchParams.get('sort') ?? 'createdAt:desc';
  const [sortBy, sortOrder] = sortRaw.split(':') as [string, 'asc' | 'desc'];

  const filters: ProductFilters = {
    page,
    limit: PAGE_SIZE,
    search,
    categorySlug,
    categoryId,
    isFeatured,
    status: 'active',
    sortBy: sortBy as ProductFilters['sortBy'],
    sortOrder,
    minPrice: priceFrom ? Number(priceFrom) * 100 : undefined,
    maxPrice: priceTo ? Number(priceTo) * 100 : undefined,
  };

  const { data, isLoading, isFetching } = useProducts(filters);
  const { data: categories } = useCategories();

  const updateParam = useCallback(
    (key: string, value: string | undefined) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        next.delete('page'); // reset page on filter change
        return next;
      });
    },
    [setSearchParams],
  );

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateParam('sort', e.target.value);
  };

  const handleCategoryChange = (slug: string) => {
    updateParam('categorySlug', categorySlug === slug ? undefined : slug);
  };

  const handlePriceApply = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (priceFrom) next.set('minPrice', priceFrom);
      else next.delete('minPrice');
      if (priceTo) next.set('maxPrice', priceTo);
      else next.delete('maxPrice');
      next.delete('page');
      return next;
    });
    setIsFilterOpen(false);
  };

  const handleClearFilters = () => {
    setSearchParams({});
    setPriceFrom('');
    setPriceTo('');
  };

  const hasActiveFilters = !!(categorySlug || categoryId || isFeatured || searchParams.get('minPrice') || searchParams.get('maxPrice'));

  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-warm-900">
          {search ? `Результаты поиска: "${search}"` : 'Каталог товаров'}
        </h1>
        {data && (
          <p className="text-sm text-warm-500 mt-1">
            {data.meta.total} товаров
          </p>
        )}
      </div>

      <div className="flex gap-6">
        {/* ===== FILTERS SIDEBAR (desktop) ===== */}
        <aside
          className="hidden lg:block w-56 flex-shrink-0"
          aria-label="Фильтры товаров"
        >
          <FiltersSidebar
            categories={categories ?? []}
            selectedCategorySlug={categorySlug}
            onCategoryChange={handleCategoryChange}
            priceFrom={priceFrom}
            priceTo={priceTo}
            onPriceFromChange={setPriceFrom}
            onPriceToChange={setPriceTo}
            onPriceApply={handlePriceApply}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
          />
        </aside>

        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 mb-5">
            {/* Mobile filter button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsFilterOpen(true)}
              leftIcon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
              className="lg:hidden"
              aria-expanded={isFilterOpen}
            >
              Фильтры
              {hasActiveFilters && (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-sage-500" aria-label="активные фильтры" />
              )}
            </Button>

            <div className="flex items-center gap-3 ml-auto">
              {/* Sort */}
              <label htmlFor="sort-select" className="text-sm text-warm-500 hidden sm:block">
                Сортировка:
              </label>
              <select
                id="sort-select"
                value={sortRaw}
                onChange={handleSortChange}
                className="text-sm border border-warm-200 rounded-xl px-3 py-1.5 bg-white text-warm-700 focus:outline-none focus:ring-2 focus:ring-sage-300"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mb-4">
              {categorySlug && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-sage-100 text-sage-700 text-xs rounded-full">
                  {categories?.find((c) => c.slug === categorySlug)?.name ?? categorySlug}
                  <button
                    type="button"
                    onClick={() => updateParam('categorySlug', undefined)}
                    aria-label="Убрать фильтр категории"
                    className="hover:text-sage-900"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-warm-500 hover:text-warm-700 underline"
              >
                Сбросить всё
              </button>
            </div>
          )}

          {/* Product grid */}
          <ProductGrid
            products={data?.data}
            isLoading={isLoading || isFetching}
            columns={3}
            emptyMessage="Товары по выбранным фильтрам не найдены. Попробуйте изменить критерии поиска."
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              className="flex items-center justify-center gap-2 mt-10"
              aria-label="Постраничная навигация"
            >
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateParam('page', String(page - 1))}
                aria-label="Предыдущая страница"
              >
                ←
              </Button>

              {Array.from({ length: Math.min(totalPages, 7) }).map((_, idx) => {
                const p = idx + 1;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => updateParam('page', String(p))}
                    aria-label={`Страница ${p}`}
                    aria-current={page === p ? 'page' : undefined}
                    className={`w-8 h-8 rounded-xl text-sm font-medium transition-colors ${
                      page === p
                        ? 'bg-sage-600 text-white'
                        : 'text-warm-600 hover:bg-warm-100'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateParam('page', String(page + 1))}
                aria-label="Следующая страница"
              >
                →
              </Button>
            </nav>
          )}
        </div>
      </div>

      {/* Mobile filters drawer */}
      {isFilterOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            aria-hidden="true"
            onClick={() => setIsFilterOpen(false)}
          />
          <div
            className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl p-5 overflow-y-auto"
            role="dialog"
            aria-label="Фильтры"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-warm-900">Фильтры</h2>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                aria-label="Закрыть фильтры"
                className="p-1 text-warm-400 hover:text-warm-600"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <FiltersSidebar
              categories={categories ?? []}
              selectedCategorySlug={categorySlug}
              onCategoryChange={(slug) => {
                handleCategoryChange(slug);
                setIsFilterOpen(false);
              }}
              priceFrom={priceFrom}
              priceTo={priceTo}
              onPriceFromChange={setPriceFrom}
              onPriceToChange={setPriceTo}
              onPriceApply={() => {
                handlePriceApply();
                setIsFilterOpen(false);
              }}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={() => {
                handleClearFilters();
                setIsFilterOpen(false);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FiltersSidebar component
// ---------------------------------------------------------------------------

type FiltersSidebarProps = {
  categories: Array<{ id: string; name: string; slug: string }>;
  selectedCategorySlug?: string | undefined;
  onCategoryChange: (slug: string) => void;
  priceFrom: string;
  priceTo: string;
  onPriceFromChange: (v: string) => void;
  onPriceToChange: (v: string) => void;
  onPriceApply: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
};

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center justify-between w-full text-sm font-semibold text-warm-800 mb-3"
        aria-expanded={isOpen}
      >
        {title}
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-warm-400" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-warm-400" aria-hidden="true" />
        )}
      </button>
      {isOpen && children}
    </div>
  );
}

function FiltersSidebar({
  categories,
  selectedCategorySlug,
  onCategoryChange,
  priceFrom,
  priceTo,
  onPriceFromChange,
  onPriceToChange,
  onPriceApply,
  hasActiveFilters,
  onClearFilters,
}: FiltersSidebarProps) {
  return (
    <div>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="flex items-center gap-1 text-xs text-warm-500 hover:text-warm-700 mb-4"
        >
          <X className="h-3 w-3" aria-hidden="true" />
          Сбросить фильтры
        </button>
      )}

      {/* Categories */}
      <FilterSection title="Категории">
        <ul className="space-y-1">
          {categories.map((cat) => (
            <li key={cat.id}>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedCategorySlug === cat.slug}
                  onChange={() => onCategoryChange(cat.slug)}
                  className="rounded border-warm-300 text-sage-600 focus:ring-sage-400 h-3.5 w-3.5"
                />
                <span className="text-sm text-warm-700 group-hover:text-warm-900 transition-colors">
                  {cat.name}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </FilterSection>

      {/* Price */}
      <FilterSection title="Цена (₽)">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={priceFrom}
              onChange={(e) => onPriceFromChange(e.target.value)}
              placeholder="от"
              min="0"
              aria-label="Цена от"
              className="w-full px-3 py-1.5 text-sm border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-300"
            />
            <span className="text-warm-400 text-sm">—</span>
            <input
              type="number"
              value={priceTo}
              onChange={(e) => onPriceToChange(e.target.value)}
              placeholder="до"
              min="0"
              aria-label="Цена до"
              className="w-full px-3 py-1.5 text-sm border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-300"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={onPriceApply}
          >
            Применить
          </Button>
        </div>
      </FilterSection>
    </div>
  );
}
