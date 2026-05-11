import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Input, Textarea } from '@components/ui/Input';
import { Modal, ConfirmModal } from '@components/ui/Modal';
import { ProductStatusBadge } from '@components/ui/Badge';
import { SkeletonProductCard } from '@components/ui/Skeleton';
import {
  useAdminProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useUpdateProductStatus,
} from '@hooks/useProducts';
import { useCategories } from '@hooks/useProducts';
import { productAdminSchema, type ProductAdminInput } from '@utils/validation';
import { formatPrice } from '@utils/format';
import type { Product, ProductFilters } from '@/types';

// =============================================================================
// Admin ProductsPage — products CRUD
// =============================================================================

export default function AdminProductsPage() {
  const [filters, setFilters] = useState<ProductFilters>({ page: 1, limit: 20 });
  const [searchInput, setSearchInput] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  const { data, isLoading } = useAdminProducts(filters);
  const { data: categories } = useCategories();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();
  const statusMutation = useUpdateProductStatus();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: searchInput.trim() || undefined, page: 1 }));
  };

  const handleDelete = () => {
    if (!deleteProduct) return;
    deleteMutation.mutate(deleteProduct.id, {
      onSuccess: () => setDeleteProduct(null),
    });
  };

  const handleToggleStatus = (product: Product) => {
    const newStatus = product.status === 'active' ? 'draft' : 'active';
    statusMutation.mutate({ id: product.id, status: newStatus });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-warm-900">Товары</h1>
          {data && (
            <p className="text-sm text-warm-500 mt-0.5">Всего: {data.meta.total}</p>
          )}
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          Добавить товар
        </Button>
      </div>

      {/* Search + filters */}
      <div className="bg-white rounded-2xl shadow-card p-4 mb-5 flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px] flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-warm-400" aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Поиск товаров..."
              aria-label="Поиск товаров"
              className="w-full pl-9 pr-4 py-1.5 text-sm border border-warm-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sage-300"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Найти
          </Button>
        </form>

        <select
          value={filters.status ?? ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              status: (e.target.value as Product['status']) || undefined,
              page: 1,
            }))
          }
          aria-label="Фильтр по статусу"
          className="text-sm border border-warm-200 rounded-xl px-3 py-1.5 bg-white text-warm-700 focus:outline-none focus:ring-2 focus:ring-sage-300"
        >
          <option value="">Все статусы</option>
          <option value="active">Активные</option>
          <option value="draft">Черновики</option>
          <option value="archived">Архив</option>
        </select>
      </div>

      {/* Products table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonProductCard key={i} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-100 bg-warm-50 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-warm-500">Товар</th>
                  <th className="px-4 py-3 text-xs font-medium text-warm-500">Категория</th>
                  <th className="px-4 py-3 text-xs font-medium text-warm-500">Цена</th>
                  <th className="px-4 py-3 text-xs font-medium text-warm-500">Статус</th>
                  <th className="px-4 py-3 text-xs font-medium text-warm-500">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((product) => {
                  const primaryImage = product.images.find((i) => i.isPrimary) ?? product.images[0];
                  return (
                    <tr
                      key={product.id}
                      className="border-b border-warm-50 hover:bg-warm-50/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg overflow-hidden bg-beige-50 flex-shrink-0">
                            {primaryImage ? (
                              <img
                                src={primaryImage.url}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full bg-beige-100" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-warm-800 truncate max-w-[200px]">
                              {product.name}
                            </p>
                            <p className="text-xs text-warm-400 truncate">{product.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-warm-600">{product.category.name}</td>
                      <td className="px-4 py-3 font-medium text-warm-800 whitespace-nowrap">
                        {formatPrice(product.minPriceKopecks)}
                        {product.maxPriceKopecks !== product.minPriceKopecks && (
                          <span className="text-warm-400">
                            {' '}– {formatPrice(product.maxPriceKopecks)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ProductStatusBadge status={product.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Toggle active */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(product)}
                            aria-label={
                              product.status === 'active'
                                ? 'Снять с публикации'
                                : 'Опубликовать'
                            }
                            className="p-1.5 text-warm-400 hover:text-sage-600 transition-colors"
                          >
                            {product.status === 'active' ? (
                              <ToggleRight className="h-4 w-4 text-sage-500" aria-hidden="true" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => setEditProduct(product)}
                            aria-label={`Редактировать ${product.name}`}
                            className="p-1.5 text-warm-400 hover:text-sage-600 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" aria-hidden="true" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setDeleteProduct(product)}
                            aria-label={`Удалить ${product.name}`}
                            className="p-1.5 text-warm-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {data?.data.length === 0 && (
              <div className="py-12 text-center text-warm-400 text-sm">
                Товары не найдены
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.meta.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 mt-5" aria-label="Страницы">
          <Button
            variant="secondary"
            size="sm"
            disabled={(filters.page ?? 1) <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
          >
            ←
          </Button>
          <span className="text-sm text-warm-500">
            {filters.page} / {data.meta.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={(filters.page ?? 1) >= data.meta.totalPages}
            onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
          >
            →
          </Button>
        </nav>
      )}

      {/* Create modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Добавить товар"
        size="lg"
      >
        <ProductForm
          categories={categories ?? []}
          isLoading={createMutation.isPending}
          onSubmit={(data) => {
            createMutation.mutate(data, {
              onSuccess: () => setIsCreateOpen(false),
            });
          }}
          onCancel={() => setIsCreateOpen(false)}
        />
      </Modal>

      {/* Edit modal */}
      {editProduct && (
        <Modal
          isOpen={!!editProduct}
          onClose={() => setEditProduct(null)}
          title={`Редактировать: ${editProduct.name}`}
          size="lg"
        >
          <ProductForm
            initialData={{
              name: editProduct.name,
              description: editProduct.description,
              shortDescription: editProduct.shortDescription ?? undefined,
              categoryId: editProduct.category.id,
              tags: editProduct.tags,
              isFeatured: editProduct.isFeatured,
              status: editProduct.status,
              weight: editProduct.weight ?? undefined,
              ingredients: editProduct.ingredients ?? undefined,
              howToUse: editProduct.howToUse ?? undefined,
            }}
            categories={categories ?? []}
            isLoading={updateMutation.isPending}
            onSubmit={(data) => {
              updateMutation.mutate(
                { id: editProduct.id, payload: data },
                { onSuccess: () => setEditProduct(null) },
              );
            }}
            onCancel={() => setEditProduct(null)}
          />
        </Modal>
      )}

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!deleteProduct}
        onClose={() => setDeleteProduct(null)}
        onConfirm={handleDelete}
        title="Удалить товар"
        message={`Вы уверены, что хотите удалить "${deleteProduct?.name}"? Это действие нельзя отменить.`}
        confirmText="Удалить"
        isDangerous
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProductForm — reusable for create/edit
// ---------------------------------------------------------------------------

type ProductFormProps = {
  initialData?: Partial<ProductAdminInput>;
  categories: Array<{ id: string; name: string }>;
  isLoading: boolean;
  onSubmit: (data: ProductAdminInput) => void;
  onCancel: () => void;
};

function ProductForm({
  initialData,
  categories,
  isLoading,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductAdminInput>({
    resolver: zodResolver(productAdminSchema),
    defaultValues: initialData ?? { status: 'draft', isFeatured: false },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Input
        {...register('name')}
        label="Название товара"
        required
        error={errors.name?.message}
      />

      <Textarea
        {...register('description')}
        label="Описание"
        rows={4}
        required
        error={errors.description?.message}
      />

      <Input
        {...register('shortDescription')}
        label="Краткое описание"
        error={errors.shortDescription?.message}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="pf-category" className="text-sm font-medium text-warm-700">
            Категория <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <select
            {...register('categoryId')}
            id="pf-category"
            aria-invalid={!!errors.categoryId}
            className={`rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sage-300 ${
              errors.categoryId ? 'border-red-400' : 'border-warm-300'
            }`}
          >
            <option value="">Выберите категорию</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          {errors.categoryId && (
            <p className="text-xs text-red-600">{errors.categoryId.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="pf-status" className="text-sm font-medium text-warm-700">
            Статус
          </label>
          <select
            {...register('status')}
            id="pf-status"
            className="rounded-lg border border-warm-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sage-300"
          >
            <option value="draft">Черновик</option>
            <option value="active">Активен</option>
            <option value="archived">Архив</option>
          </select>
        </div>
      </div>

      <Textarea
        {...register('ingredients')}
        label="Состав"
        rows={3}
        error={errors.ingredients?.message}
      />

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="pf-featured"
          {...register('isFeatured')}
          className="h-4 w-4 rounded border-warm-300 text-sage-600 focus:ring-sage-400"
        />
        <label htmlFor="pf-featured" className="text-sm text-warm-700">
          Отображать как хит продаж
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Отмена
        </Button>
        <Button type="submit" variant="primary" isLoading={isLoading}>
          {initialData ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </form>
  );
}
