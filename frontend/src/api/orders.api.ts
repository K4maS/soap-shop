import { get, post, patch, del } from './client';
import type {
  Order,
  PaginatedResponse,
  OrderFilters,
  DashboardMetrics,
} from '@/types';

// =============================================================================
// Orders & Cart API
// =============================================================================

// ---------------------------------------------------------------------------
// Cart — server-side cart (authenticated users)
// ---------------------------------------------------------------------------

export type CartItemPayload = {
  productId: string;
  variantId: string;
  quantity: number;
};

export type ServerCart = {
  items: Array<{
    productId: string;
    variantId: string;
    productName: string;
    variantName: string;
    imageUrl: string | null;
    slug: string;
    priceKopecks: number;
    quantity: number;
  }>;
  subtotalKopecks: number;
  totalItems: number;
};

export async function getServerCart(): Promise<ServerCart> {
  return get<ServerCart>('/cart');
}

export async function addToServerCart(item: CartItemPayload): Promise<ServerCart> {
  return post<ServerCart, CartItemPayload>('/cart/items', item);
}

export async function updateServerCartItem(
  variantId: string,
  quantity: number,
): Promise<ServerCart> {
  return patch<ServerCart, { quantity: number }>(`/cart/items/${variantId}`, { quantity });
}

export async function removeFromServerCart(variantId: string): Promise<ServerCart> {
  return del<ServerCart>(`/cart/items/${variantId}`);
}

export async function clearServerCart(): Promise<void> {
  return del<void>('/cart');
}

// ---------------------------------------------------------------------------
// Checkout / Create order
// ---------------------------------------------------------------------------

export type CreateOrderPayload = {
  contactName: string;
  contactPhone: string;
  contactEmail?: string | undefined;
  deliveryMethod: 'courier' | 'pickup' | 'post';
  deliveryAddress?: {
    city: string;
    street: string;
    building: string;
    apartment?: string | undefined;
    postalCode: string;
    comment?: string | undefined;
  } | undefined;
  comment?: string | undefined;
};

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  return post<Order, CreateOrderPayload>('/orders', payload);
}

// ---------------------------------------------------------------------------
// Orders — customer
// ---------------------------------------------------------------------------

export async function getMyOrders(
  page = 1,
  limit = 10,
): Promise<PaginatedResponse<Order>> {
  return get<PaginatedResponse<Order>>(
    `/orders/my?page=${page}&limit=${limit}`,
  );
}

export async function getOrderById(orderId: string): Promise<Order> {
  return get<Order>(`/orders/${orderId}`);
}

export async function cancelOrder(orderId: string): Promise<Order> {
  return patch<Order, { status: 'cancelled' }>(`/orders/${orderId}/cancel`, {
    status: 'cancelled',
  });
}

// ---------------------------------------------------------------------------
// Orders — admin
// ---------------------------------------------------------------------------

export async function adminGetOrders(
  filters: OrderFilters = {},
): Promise<PaginatedResponse<Order>> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
  if (filters.search) params.set('search', filters.search);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  return get<PaginatedResponse<Order>>(`/admin/orders?${params.toString()}`);
}

export async function adminGetOrderById(orderId: string): Promise<Order> {
  return get<Order>(`/admin/orders/${orderId}`);
}

export async function adminUpdateOrderStatus(
  orderId: string,
  status: Order['status'],
): Promise<Order> {
  return patch<Order, { status: Order['status'] }>(
    `/admin/orders/${orderId}/status`,
    { status },
  );
}

// ---------------------------------------------------------------------------
// Admin — Dashboard metrics
// ---------------------------------------------------------------------------

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return get<DashboardMetrics>('/admin/dashboard/metrics');
}
