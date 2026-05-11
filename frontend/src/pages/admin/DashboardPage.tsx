import { useQuery } from '@tanstack/react-query';
import {
  ShoppingBag,
  TrendingUp,
  Users,
  Clock,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';
import { StatCard } from '@components/ui/Card';
import { OrderStatusBadge } from '@components/ui/Badge';
import { SkeletonDashboardCard, SkeletonOrderRow } from '@components/ui/Skeleton';
import { getDashboardMetrics, adminGetOrders } from '@api/orders.api';
import { formatPrice, formatDateTime } from '@utils/format';

// =============================================================================
// Admin DashboardPage — metrics cards, recent orders table
// =============================================================================

export default function AdminDashboardPage() {
  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['admin', 'dashboard', 'metrics'],
    queryFn: getDashboardMetrics,
    refetchInterval: 1000 * 60 * 2, // Auto-refresh every 2 min
    staleTime: 1000 * 60,
  });

  const { data: recentOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ['admin', 'orders', 'recent'],
    queryFn: () => adminGetOrders({ limit: 10, page: 1 }),
    staleTime: 1000 * 60,
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-warm-900">Dashboard</h1>
        <p className="text-sm text-warm-500 mt-1">
          Обзор магазина Mylo Master
        </p>
      </div>

      {/* ===== Metric cards ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {loadingMetrics ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonDashboardCard key={i} />)
        ) : (
          <>
            <StatCard
              label="Заказы сегодня"
              value={metrics?.ordersToday ?? 0}
              change={{ value: 12 }}
              icon={<ShoppingBag className="h-5 w-5" aria-hidden="true" />}
            />
            <StatCard
              label="Выручка сегодня"
              value={formatPrice(metrics?.revenueToday ?? 0)}
              change={{ value: 8 }}
              icon={<DollarSign className="h-5 w-5" aria-hidden="true" />}
              iconColor="bg-beige-100 text-beige-600"
            />
            <StatCard
              label="Выручка за неделю"
              value={formatPrice(metrics?.revenueWeek ?? 0)}
              change={{ value: 5 }}
              icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
              iconColor="bg-sage-100 text-sage-600"
            />
            <StatCard
              label="Новые клиенты"
              value={metrics?.newCustomers ?? 0}
              change={{ value: -3 }}
              icon={<Users className="h-5 w-5" aria-hidden="true" />}
              iconColor="bg-blue-100 text-blue-600"
            />
          </>
        )}
      </div>

      {/* ===== Alert row ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-orange-500 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-orange-800">Ожидают обработки</p>
            <p className="text-2xl font-bold text-orange-900">{metrics?.pendingOrders ?? '—'}</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-red-800">Товары заканчиваются</p>
            <p className="text-2xl font-bold text-red-900">{metrics?.lowStockProducts ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* ===== Recent orders ===== */}
      <section aria-labelledby="recent-orders-heading">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="recent-orders-heading"
            className="font-semibold text-warm-900"
          >
            Последние заказы
          </h2>
          <a
            href="/admin/orders"
            className="text-sm text-sage-600 hover:underline"
          >
            Все заказы →
          </a>
        </div>

        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          {loadingOrders ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonOrderRow key={i} />)
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-warm-100 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-warm-500">Заказ</th>
                    <th className="px-4 py-3 text-xs font-medium text-warm-500">Клиент</th>
                    <th className="px-4 py-3 text-xs font-medium text-warm-500">Дата</th>
                    <th className="px-4 py-3 text-xs font-medium text-warm-500">Сумма</th>
                    <th className="px-4 py-3 text-xs font-medium text-warm-500">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders?.data.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-warm-50 hover:bg-warm-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-warm-800 whitespace-nowrap">
                        <a
                          href={`/admin/orders/${order.id}`}
                          className="hover:text-sage-700 hover:underline"
                        >
                          {order.orderNumber}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-warm-600 max-w-[140px] truncate">
                        {order.contactName}
                      </td>
                      <td className="px-4 py-3 text-warm-500 whitespace-nowrap">
                        {formatDateTime(order.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-medium text-warm-800 whitespace-nowrap">
                        {formatPrice(order.totalKopecks)}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
