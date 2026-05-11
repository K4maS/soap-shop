// =============================================================================
// Mylo Master — Core TypeScript Types
// =============================================================================

// ---------------------------------------------------------------------------
// Primitives / Shared
// ---------------------------------------------------------------------------

export type ID = string; // UUID v4
export type ISODateString = string; // e.g. "2024-01-15T10:30:00.000Z"
export type RUBAmount = number; // kopecks (integer) — display divides by 100

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginationMeta;
};

export type ApiResponse<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
};

// ---------------------------------------------------------------------------
// User / Auth
// ---------------------------------------------------------------------------

export type UserRole = 'customer' | 'admin' | 'manager';

export type User = {
  id: ID;
  phone: string;       // "+79991234567"
  name: string | null;
  email: string | null;
  role: UserRole;
  isVerified: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type AuthTokenPayload = {
  sub: ID;             // userId
  role: UserRole;
  iat: number;
  exp: number;
};

// What we keep IN MEMORY (never persisted)
export type AuthState = {
  userId: ID | null;
  role: UserRole | null;
  accessToken: string | null;  // JWT — in-memory only
  isAuthenticated: boolean;
};

export type OtpRequestPayload = {
  phone: string;
};

export type OtpVerifyPayload = {
  phone: string;
  code: string;
};

export type AuthResponse = {
  accessToken: string;
  user: User;
};

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export type Category = {
  id: ID;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: ID | null;
  children?: Category[];
  productCount?: number;
  sortOrder: number;
  isActive: boolean;
};

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

export type ProductStatus = 'active' | 'draft' | 'archived';

export type ProductImage = {
  id: ID;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export type ProductVariant = {
  id: ID;
  name: string;         // e.g. "100г", "200г"
  sku: string;
  priceKopecks: RUBAmount;
  compareAtPriceKopecks: RUBAmount | null;
  stock: number;
  isActive: boolean;
};

export type Product = {
  id: ID;
  name: string;
  slug: string;
  description: string;
  shortDescription: string | null;
  category: Category;
  images: ProductImage[];
  variants: ProductVariant[];
  // Convenience — price of the cheapest active variant
  minPriceKopecks: RUBAmount;
  maxPriceKopecks: RUBAmount;
  tags: string[];
  status: ProductStatus;
  isFeatured: boolean;
  rating: number | null;  // 0-5
  reviewCount: number;
  weight: number | null;   // grams
  ingredients: string | null;
  howToUse: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export type CartItem = {
  productId: ID;
  variantId: ID;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  slug: string;
  priceKopecks: RUBAmount;
  quantity: number;
};

export type Cart = {
  items: CartItem[];
  totalItems: number;
  subtotalKopecks: RUBAmount;
};

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'failed';

export type DeliveryMethod = 'courier' | 'pickup' | 'post';

export type OrderItem = {
  id: ID;
  productId: ID;
  variantId: ID;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  priceKopecks: RUBAmount;
  quantity: number;
  totalKopecks: RUBAmount;
};

export type DeliveryAddress = {
  city: string;
  street: string;
  building: string;
  apartment: string | null;
  postalCode: string;
  comment: string | null;
};

export type Order = {
  id: ID;
  orderNumber: string;    // e.g. "MM-2024-00123"
  userId: ID;
  items: OrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  deliveryMethod: DeliveryMethod;
  deliveryAddress: DeliveryAddress | null;
  subtotalKopecks: RUBAmount;
  deliveryKopecks: RUBAmount;
  discountKopecks: RUBAmount;
  totalKopecks: RUBAmount;
  comment: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export type CheckoutFormData = {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  deliveryMethod: DeliveryMethod;
  city: string;
  street: string;
  building: string;
  apartment: string;
  postalCode: string;
  comment: string;
};

// ---------------------------------------------------------------------------
// Admin — Dashboard Metrics
// ---------------------------------------------------------------------------

export type DashboardMetrics = {
  ordersToday: number;
  ordersWeek: number;
  revenueToday: RUBAmount;
  revenueWeek: RUBAmount;
  newCustomers: number;
  pendingOrders: number;
  lowStockProducts: number;
};

// ---------------------------------------------------------------------------
// Filters / Search
// ---------------------------------------------------------------------------

export type ProductFilters = {
  categoryId?: ID | undefined;
  categorySlug?: string | undefined;
  search?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  tags?: string[] | undefined;
  isFeatured?: boolean | undefined;
  status?: ProductStatus | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: 'name' | 'price' | 'createdAt' | 'rating' | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
};

export type OrderFilters = {
  status?: OrderStatus | undefined;
  paymentStatus?: PaymentStatus | undefined;
  search?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
};
