import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import {
  getProducts,
  getProductBySlug,
  getFeaturedProducts,
  getCategories,
  searchProducts,
  getRelatedProducts,
  adminGetProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminUpdateProductStatus,
  type CreateProductPayload,
  type UpdateProductPayload,
} from '@api/products.api';
import type { Product, PaginatedResponse, ProductFilters } from '@/types';
import toast from 'react-hot-toast';

// =============================================================================
// Query key factory — centralized, type-safe
// =============================================================================

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: ProductFilters) => [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (slug: string) => [...productKeys.details(), slug] as const,
  featured: (limit?: number) => [...productKeys.all, 'featured', limit] as const,
  related: (id: string) => [...productKeys.all, 'related', id] as const,
  search: (q: string) => [...productKeys.all, 'search', q] as const,
  admin: {
    all: ['admin', 'products'] as const,
    list: (filters: ProductFilters) => ['admin', 'products', 'list', filters] as const,
  },
} as const;

export const categoryKeys = {
  all: ['categories'] as const,
  detail: (slug: string) => ['categories', 'detail', slug] as const,
} as const;

// =============================================================================
// Public product hooks
// =============================================================================

/**
 * Paginated + filtered product list
 */
export function useProducts(
  filters: ProductFilters = {},
  options?: Partial<UseQueryOptions<PaginatedResponse<Product>>>,
) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () => getProducts(filters),
    staleTime: 1000 * 60 * 2,   // 2 minutes
    gcTime: 1000 * 60 * 10,     // 10 minutes
    placeholderData: (previousData) => previousData,
    ...options,
  });
}

/**
 * Infinite scroll product list
 */
export function useInfiniteProducts(filters: Omit<ProductFilters, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: [...productKeys.lists(), 'infinite', filters],
    queryFn: ({ pageParam }) =>
      getProducts({ ...filters, page: pageParam as number, limit: filters.limit ?? 12 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.page < lastPage.meta.totalPages) {
        return lastPage.meta.page + 1;
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Single product by slug
 */
export function useProduct(
  slug: string,
  options?: Partial<UseQueryOptions<Product>>,
) {
  return useQuery({
    queryKey: productKeys.detail(slug),
    queryFn: () => getProductBySlug(slug),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

/**
 * Featured products for homepage
 */
export function useFeaturedProducts(limit = 8) {
  return useQuery({
    queryKey: productKeys.featured(limit),
    queryFn: () => getFeaturedProducts(limit),
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Product search (debounced at component level)
 */
export function useProductSearch(query: string, limit = 10) {
  return useQuery({
    queryKey: productKeys.search(query),
    queryFn: () => searchProducts(query, limit),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Related products
 */
export function useRelatedProducts(productId: string, limit = 4) {
  return useQuery({
    queryKey: productKeys.related(productId),
    queryFn: () => getRelatedProducts(productId, limit),
    enabled: Boolean(productId),
    staleTime: 1000 * 60 * 5,
  });
}

// =============================================================================
// Category hooks
// =============================================================================

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: getCategories,
    staleTime: 1000 * 60 * 30,  // 30 minutes — rarely changes
    gcTime: 1000 * 60 * 60,
  });
}

// =============================================================================
// Admin product hooks
// =============================================================================

export function useAdminProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: productKeys.admin.list(filters),
    queryFn: () => adminGetProducts(filters),
    staleTime: 1000 * 30,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProductPayload) => adminCreateProduct(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.admin.all });
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('Товар успешно создан');
    },
    onError: () => {
      toast.error('Не удалось создать товар');
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProductPayload }) =>
      adminUpdateProduct(id, payload),
    onSuccess: (updatedProduct) => {
      void queryClient.invalidateQueries({ queryKey: productKeys.admin.all });
      queryClient.setQueryData(productKeys.detail(updatedProduct.slug), updatedProduct);
      toast.success('Товар обновлён');
    },
    onError: () => {
      toast.error('Не удалось обновить товар');
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adminDeleteProduct(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.admin.all });
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('Товар удалён');
    },
    onError: () => {
      toast.error('Не удалось удалить товар');
    },
  });
}

export function useUpdateProductStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: 'active' | 'draft' | 'archived';
    }) => adminUpdateProductStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.admin.all });
    },
    onError: () => {
      toast.error('Не удалось изменить статус');
    },
  });
}
