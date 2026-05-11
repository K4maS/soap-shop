import { clsx } from 'clsx';

// =============================================================================
// Card — flexible container with optional header, body, footer sections
// =============================================================================

type CardProps = {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md';
};

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

const shadowClasses = {
  none: '',
  sm: 'shadow-card',
  md: 'shadow-soft',
};

export function Card({
  children,
  className,
  hoverable = false,
  padding = 'md',
  shadow = 'sm',
}: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-2xl border border-warm-100',
        paddingClasses[padding],
        shadowClasses[shadow],
        hoverable && 'transition-shadow duration-200 hover:shadow-card-hover cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type CardHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-start justify-between gap-4', className)}>
      <div>
        <h3 className="text-base font-semibold text-warm-900 font-serif">{title}</h3>
        {description && (
          <p className="mt-0.5 text-sm text-warm-500">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function CardDivider({ className }: { className?: string }) {
  return <hr className={clsx('border-warm-100 -mx-5 my-4', className)} />;
}

// ---------------------------------------------------------------------------
// Stat card — used in admin dashboard
// ---------------------------------------------------------------------------

type StatCardProps = {
  label: string;
  value: string | number;
  change?: {
    value: number;
    suffix?: string;
  };
  icon?: React.ReactNode;
  iconColor?: string;
  className?: string;
};

export function StatCard({
  label,
  value,
  change,
  icon,
  iconColor = 'bg-sage-100 text-sage-600',
  className,
}: StatCardProps) {
  const isPositive = (change?.value ?? 0) >= 0;

  return (
    <Card className={clsx('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-warm-500">{label}</span>
        {icon && (
          <span className={clsx('p-2 rounded-xl', iconColor)} aria-hidden="true">
            {icon}
          </span>
        )}
      </div>

      <div>
        <p className="text-2xl font-bold text-warm-900">{value}</p>
        {change !== undefined && (
          <p
            className={clsx(
              'mt-1 text-xs flex items-center gap-0.5',
              isPositive ? 'text-green-600' : 'text-red-600',
            )}
          >
            <span aria-hidden="true">{isPositive ? '↑' : '↓'}</span>
            <span>
              {Math.abs(change.value)}
              {change.suffix ?? '%'} за 7 дней
            </span>
          </p>
        )}
      </div>
    </Card>
  );
}
