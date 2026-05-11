import { get, post, put, del, patch } from './client';
import type {
  Product,
  Category,
  PaginatedResponse,
  ProductFilters,
} from '@/types';

// =============================================================================
// Products & Categories API
// =============================================================================

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  return get<Category[]>('/categories');
}

export async function getCategoryBySlug(slug: string): Promise<Category> {
  return get<Category>(`/categories/${slug}`);
}

// ---------------------------------------------------------------------------
// Products — public
// ---------------------------------------------------------------------------

export async function getProducts(
  filters: ProductFilters = {},
): Promise<PaginatedResponse<Product>> {
  // Serialize filters to query params
  const params = new URLSearchParams();

  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.categorySlug) params.set('categorySlug', filters.categorySlug);
  if (filters.search) params.set('search', filters.search.trim());
  if (filters.minPrice != null) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice != null) params.set('maxPrice', String(filters.maxPrice));
  if (filters.tags?.length) params.set('tags', filters.tags.join(','));
  if (filters.isFeatured != null) params.set('isFeatured', String(filters.isFeatured));
  if (filters.status) params.set('status', filters.status);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

  return get<PaginatedResponse<Product>>(`/products?${params.toString()}`);
}

export async function getProductBySlug(slug: string): Promise<Product> {
  return get<Product>(`/products/${slug}`);
}

export async function getProductById(id: string): Promise<Product> {
  return get<Product>(`/products/id/${id}`);
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const result = await getProducts({ isFeatured: true, status: 'active', limit });
  return result.data;
}

export async function searchProducts(
  query: string,
  limit = 10,
): Promise<Product[]> {
  const result = await getProducts({ search: query, status: 'active', limit });
  return result.data;
}

export async function getRelatedProducts(
  productId: string,
  limit = 4,
): Promise<Product[]> {
  return get<Product[]>(`/products/${productId}/related?limit=${limit}`);
}

// ---------------------------------------------------------------------------
// Products — admin
// ---------------------------------------------------------------------------

export type CreateProductPayload = {
  name: string;
  description: string;
  shortDescription?: string | undefined;
  categoryId: string;
  tags?: string[] | undefined;
  isFeatured?: boolean | undefined;
  status?: 'active' | 'draft' | 'archived' | undefined;
  weight?: number | undefined;
  ingredients?: string | undefined;
  howToUse?: string | undefined;
};

export type UpdateProductPayload = Partial<CreateProductPayload>;

export async function adminGetProducts(
  filters: ProductFilters = {},
): Promise<PaginatedResponse<Product>> {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.status) params.set('status', filters.status);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

  return get<PaginatedResponse<Product>>(`/admin/products?${params.toString()}`);
}

export async function adminCreateProduct(
  payload: CreateProductPayload,
): Promise<Product> {
  return post<Product, CreateProductPayload>('/admin/products', payload);
}

export async function adminUpdateProduct(
  id: string,
  payload: UpdateProductPayload,
): Promise<Product> {
  return patch<Product, UpdateProductPayload>(`/admin/products/${id}`, payload);
}

export async function adminDeleteProduct(id: string): Promise<void> {
  return del<void>(`/admin/products/${id}`);
}

export async function adminUpdateProductStatus(
  id: string,
  status: 'active' | 'draft' | 'archived',
): Promise<Product> {
  return put<Product, { status: string }>(`/admin/products/${id}/status`, { status });
}
