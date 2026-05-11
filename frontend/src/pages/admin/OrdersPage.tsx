import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, Eye } from 'lucide-react';
import { Button } from '@components/ui/Button';
import { OrderStatusBadge, PaymentStatusBadge } from '@components/ui/Badge';
import { SkeletonOrderRow } from '@components/ui/Skeleton';
import { Modal } from '@components/ui/Modal';
import { adminGetOrders, adminUpdateOrderStatus } from '@api/orders.api';
import { formatPrice, formatDateTime, formatPhone } from '@utils/format';
import type { Order, OrderStatus, OrderFilters } from '@/types';
import toast from 'react-hot-toast';

// =============================================================================
// Admin OrdersPage — orders management with filters and status changes
// =============================================================================

const STATUS_OPTIONS: Array<{ value: OrderStatus | ''; label: string }> = [
  { value: '', label: 'Все статусы' },
  { value: 'pending', label: 'Ожидает' },
  { value: 'confirmed', label: 'Подтверждён' },
  { value: 'processing', label: 'В обработке' },
  { value: 'shipped', label: 'Отправлен' },
  { value: 'delivered', label: 'Доставлен' },
  { value: 'cancelled', label: 'Отменён' },
  { value: 'refunded', label: 'Возврат' },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'processing',
  processing: 'shipped',
  shipped: 'delivered',
};

export default function AdminOrdersPage() {
  const [filters, setFilters] = useState<OrderFilters>({ page: 1, limit: 20 });
  const [searchInput, setSearchInput] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders', filters],
    queryFn: () => adminGetOrders(filters),
    staleTime: 1000 * 30,
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      adminUpdateOrderStatus(orderId, status),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
      toast.success('Статус обновлён');
    },
    onError: () => toast.error('Не удалось обновить статус'),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: searchInput.trim() || undefined, page: 1 }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-warm-900">Заказы</h1>
          {data && (
            <p className="text-sm text-warm-500 mt-0.5">
              Всего: {data.meta.total}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-card p-4 mb-5 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px] flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-warm-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Номер заказа, телефон, имя..."
              aria-label="Поиск заказов"
              className="w-full pl-9 pr-4 py-1.5 text-sm border border-warm-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sage-300"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Найти
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-warm-400" aria-hidden="true" />
          <select
            value={filters.status ?? ''}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                status: (e.target.value as OrderStatus) || undefined,
                page: 1,
              }))
            }
            aria-label="Фильтр по статусу"
            className="text-sm border border-warm-200 rounded-xl px-3 py-1.5 bg-white text-warm-700 focus:outline-none focus:ring-2 focus:ring-sage-300"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonOrderRow key={i} />)
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-100 bg-warm-50">
                  <th className="px-4 py-3 text-xs font-medium text-warm-500 text-left whitespace-nowrap">Заказ</th>
                  <th className="px-4 py-3 text-xs font-medium text-warm-500 text-left">Клиент</th>
                  <th className="px-4 py-3 text-xs font-medium text-warm-500 text-left whitespace-nowrap">Дата</th>
                  <th className="px-4 py-3 text-xs font-medium text-warm-500 text-left whitespace-nowrap">Сумма</th>
                  <th className="px-4 py-3 text-xs font-medium text-warm-500 text-left">Статус</th>
                  <th className="px-4 py-3 text-xs font-medium text-warm-500 text-left">Оплата</th>
                  <th className="px-4 py-3 text-xs font-medium text-warm-500 text-left">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((order) => {
                  const nextStatus = NEXT_STATUS[order.status];
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-warm-50 hover:bg-warm-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-warm-800 whitespace-nowrap">
                        {order.orderNumber}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-warm-800 truncate max-w-[120px]">{order.contactName}</p>
                        <p className="text-warm-400 text-xs">
                          {formatPhone(order.contactPhone)}
                        </p>
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
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={order.paymentStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {nextStatus && (
                            <Button
                              variant="outline"
                              size="xs"
                              isLoading={statusMutation.isPending && statusMutation.variables?.orderId === order.id}
                              onClick={() =>
                                statusMutation.mutate({ orderId: order.id, status: nextStatus })
                              }
                            >
                              → {STATUS_OPTIONS.find((s) => s.value === nextStatus)?.label}
                            </Button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            aria-label={`Просмотреть заказ ${order.orderNumber}`}
                            className="p-1 text-warm-400 hover:text-sage-600 transition-colors"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
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
                Заказы не найдены
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

      {/* Order detail modal */}
      {selectedOrder && (
        <Modal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Заказ ${selectedOrder.orderNumber}`}
          size="lg"
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-warm-400">Клиент</p>
                <p className="font-medium text-warm-800">{selectedOrder.contactName}</p>
              </div>
              <div>
                <p className="text-xs text-warm-400">Телефон</p>
                <p className="font-medium text-warm-800">
                  {formatPhone(selectedOrder.contactPhone)}
                </p>
              </div>
              <div>
                <p className="text-xs text-warm-400">Статус</p>
                <OrderStatusBadge status={selectedOrder.status} />
              </div>
              <div>
                <p className="text-xs text-warm-400">Оплата</p>
                <PaymentStatusBadge status={selectedOrder.paymentStatus} />
              </div>
              <div className="col-span-2">
                <p className="text-xs text-warm-400">Итого</p>
                <p className="font-semibold text-lg text-warm-900">
                  {formatPrice(selectedOrder.totalKopecks)}
                </p>
              </div>
            </div>

            {selectedOrder.deliveryAddress && (
              <div>
                <p className="text-xs text-warm-400 mb-1">Адрес доставки</p>
                <p className="text-warm-700">
                  {selectedOrder.deliveryAddress.city},{' '}
                  {selectedOrder.deliveryAddress.street},{' '}
                  {selectedOrder.deliveryAddress.building}
                  {selectedOrder.deliveryAddress.apartment
                    ? `, кв. ${selectedOrder.deliveryAddress.apartment}`
                    : ''}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs text-warm-400 mb-2">Товары</p>
              {selectedOrder.items.map((item) => (
                <div key={item.id} className="flex justify-between py-1.5 border-b border-warm-50">
                  <div>
                    <p className="text-warm-800">{item.productName}</p>
                    <p className="text-xs text-warm-400">
                      {item.variantName} × {item.quantity}
                    </p>
                  </div>
                  <p className="font-medium text-warm-800">
                    {formatPrice(item.totalKopecks)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
