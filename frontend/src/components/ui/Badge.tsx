import { clsx } from 'clsx';
import type { OrderStatus, PaymentStatus, ProductStatus } from '@/types';

// =============================================================================
// Badge — status indicators, labels
// =============================================================================

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'sage'
  | 'beige'
  | 'rose';

type BadgeSize = 'sm' | 'md';

type BadgeProps = {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-warm-100 text-warm-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  sage: 'bg-sage-100 text-sage-700',
  beige: 'bg-beige-100 text-beige-700',
  rose: 'bg-rose-100 text-rose-700',
};

const dotVariantClasses: Record<BadgeVariant, string> = {
  default: 'bg-warm-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  sage: 'bg-sage-500',
  beige: 'bg-beige-500',
  rose: 'bg-rose-500',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {dot && (
        <span
          className={clsx('h-1.5 w-1.5 rounded-full flex-shrink-0', dotVariantClasses[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Typed status badges
// ---------------------------------------------------------------------------

const orderStatusMap: Record<OrderStatus, { variant: BadgeVariant; label: string }> = {
  pending: { variant: 'warning', label: 'Ожидает' },
  confirmed: { variant: 'info', label: 'Подтверждён' },
  processing: { variant: 'info', label: 'В обработке' },
  shipped: { variant: 'sage', label: 'Отправлен' },
  delivered: { variant: 'success', label: 'Доставлен' },
  cancelled: { variant: 'error', label: 'Отменён' },
  refunded: { variant: 'default', label: 'Возврат' },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { variant, label } = orderStatusMap[status];
  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}

const paymentStatusMap: Record<PaymentStatus, { variant: BadgeVariant; label: string }> = {
  unpaid: { variant: 'warning', label: 'Не оплачен' },
  paid: { variant: 'success', label: 'Оплачен' },
  refunded: { variant: 'default', label: 'Возврат' },
  failed: { variant: 'error', label: 'Ошибка оплаты' },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { variant, label } = paymentStatusMap[status];
  return <Badge variant={variant}>{label}</Badge>;
}

const productStatusMap: Record<ProductStatus, { variant: BadgeVariant; label: string }> = {
  active: { variant: 'success', label: 'Активен' },
  draft: { variant: 'warning', label: 'Черновик' },
  archived: { variant: 'default', label: 'Архив' },
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const { variant, label } = productStatusMap[status];
  return <Badge variant={variant}>{label}</Badge>;
}
