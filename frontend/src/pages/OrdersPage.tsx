import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { OrderStatusBadge, PaymentStatusBadge } from '@components/ui/Badge';
import { SkeletonOrderRow } from '@components/ui/Skeleton';
import { Button } from '@components/ui/Button';
import { getMyOrders } from '@api/orders.api';
import { formatDate, formatPrice } from '@utils/format';

// =============================================================================
// OrdersPage — customer's order list with status
// =============================================================================

const PAGE_SIZE = 10;

export default function OrdersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', 'my', page],
    queryFn: () => getMyOrders(page, PAGE_SIZE),
    staleTime: 1000 * 60,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-serif text-2xl font-bold text-warm-900 mb-8">Мои заказы</h1>

      {isLoading && (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonOrderRow key={i} />
          ))}
        </div>
      )}

      {error && (
        <div role="alert" className="text-center py-12">
          <p className="text-warm-500">Не удалось загрузить заказы.</p>
        </div>
      )}

      {!isLoading && data?.data.length === 0 && (
        <div className="text-center py-20">
          <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-beige-100 flex items-center justify-center">
            <Package className="h-8 w-8 text-beige-400" aria-hidden="true" />
          </div>
          <h2 className="font-serif text-lg font-semibold text-warm-800 mb-2">
            Заказов пока нет
          </h2>
          <p className="text-warm-500 text-sm mb-6">Оформите первый заказ из нашего каталога</p>
          <Button variant="primary" onClick={() => navigate('/catalog')}>
            Перейти в каталог
          </Button>
        </div>
      )}

      {data && data.data.length > 0 && (
        <>
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-warm-100 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-warm-500 whitespace-nowrap">
                      Заказ
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-warm-500 whitespace-nowrap">
                      Дата
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-warm-500 whitespace-nowrap">
                      Сумма
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-warm-500 whitespace-nowrap">
                      Статус
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-warm-500 whitespace-nowrap">
                      Оплата
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-warm-500 whitespace-nowrap">
                      <span className="sr-only">Действия</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-warm-50 hover:bg-warm-50/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-warm-800">{order.orderNumber}</span>
                      </td>
                      <td className="px-4 py-3 text-warm-500 whitespace-nowrap">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-medium text-warm-800 whitespace-nowrap">
                        {formatPrice(order.totalKopecks)}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={order.paymentStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/orders/${order.id}`}
                          className="text-xs text-sage-600 hover:text-sage-700 hover:underline whitespace-nowrap"
                        >
                          Подробнее
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data.meta.totalPages > 1 && (
            <nav
              className="flex items-center justify-center gap-2 mt-6"
              aria-label="Постраничная навигация"
            >
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Предыдущая страница"
              >
                ←
              </Button>
              <span className="text-sm text-warm-500" aria-live="polite">
                Страница {page} из {data.meta.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Следующая страница"
              >
                →
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
