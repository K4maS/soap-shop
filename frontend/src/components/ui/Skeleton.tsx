import { clsx } from 'clsx';

// =============================================================================
// Skeleton — loading state placeholders
// =============================================================================

type SkeletonProps = {
  className?: string;
  rounded?: boolean;
  circle?: boolean;
  width?: string | number;
  height?: string | number;
};

export function Skeleton({
  className,
  rounded = false,
  circle = false,
  width,
  height,
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      role="presentation"
      className={clsx(
        'animate-pulse-soft bg-warm-200',
        circle ? 'rounded-full' : rounded ? 'rounded-lg' : 'rounded',
        className,
      )}
      style={{
        width: width !== undefined ? width : undefined,
        height: height !== undefined ? height : undefined,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Skeleton variants
// ---------------------------------------------------------------------------

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={clsx('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={clsx('h-4', i === lines - 1 ? 'w-3/4' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonProductCard({ className }: { className?: string }) {
  return (
    <div
      className={clsx('bg-white rounded-2xl overflow-hidden shadow-card', className)}
      aria-hidden="true"
      role="presentation"
    >
      {/* Image */}
      <Skeleton className="w-full h-52" />

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Category */}
        <Skeleton className="h-3 w-20" />
        {/* Name */}
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
        {/* Price + button */}
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonOrderRow({ className }: { className?: string }) {
  return (
    <div
      className={clsx('flex items-center gap-4 p-4 border-b border-warm-100', className)}
      aria-hidden="true"
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-6 w-24 rounded-full" />
    </div>
  );
}

export function SkeletonDashboardCard({ className }: { className?: string }) {
  return (
    <div
      className={clsx('bg-white rounded-2xl p-5 shadow-card space-y-3', className)}
      aria-hidden="true"
    >
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}
