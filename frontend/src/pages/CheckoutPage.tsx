import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Input } from '@components/ui/Input';
import { Button } from '@components/ui/Button';
import { CartItem } from '@components/cart/CartItem';
import { useCartStore } from '@store/cart.store';
import { createOrder } from '@api/orders.api';
import { checkoutSchemaWithDelivery, type CheckoutInput } from '@utils/validation';
import { formatPrice, pluralize, applyPhoneMask } from '@utils/format';
import type { Order } from '@/types';
import toast from 'react-hot-toast';

// =============================================================================
// CheckoutPage — order form with full Zod validation
// =============================================================================

const DELIVERY_THRESHOLD = 300000;
const STANDARD_DELIVERY = 30000;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotalKopecks, totalItems, clearCart } = useCartStore();
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  const deliveryKopecks = subtotalKopecks >= DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY;
  const totalKopecks = subtotalKopecks + deliveryKopecks;

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchemaWithDelivery),
    defaultValues: {
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      deliveryMethod: 'courier',
      city: '',
      street: '',
      building: '',
      apartment: '',
      postalCode: '',
      comment: '',
    },
  });

  const deliveryMethod = watch('deliveryMethod');
  const needsAddress = deliveryMethod !== 'pickup';

  const orderMutation = useMutation({
    mutationFn: (data: CheckoutInput) =>
      createOrder({
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail || undefined,
        deliveryMethod: data.deliveryMethod,
        deliveryAddress: needsAddress
          ? {
              city: data.city,
              street: data.street,
              building: data.building,
              apartment: data.apartment || undefined,
              postalCode: data.postalCode,
              comment: data.comment || undefined,
            }
          : undefined,
        comment: data.comment || undefined,
      }),
    onSuccess: (order) => {
      setCompletedOrder(order);
      clearCart();
    },
    onError: () => {
      toast.error('Не удалось оформить заказ. Попробуйте снова.');
    },
  });

  if (items.length === 0 && !completedOrder) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-warm-500 mb-6">Корзина пуста. Добавьте товары для оформления заказа.</p>
        <Button variant="primary" onClick={() => navigate('/catalog')}>
          В каталог
        </Button>
      </div>
    );
  }

  // ===== SUCCESS STATE =====
  if (completedOrder) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-sage-100 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-sage-600" aria-hidden="true" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-warm-900 mb-2">
          Заказ оформлен!
        </h1>
        <p className="text-warm-500 text-sm mb-2">
          Ваш заказ №{completedOrder.orderNumber}
        </p>
        <p className="text-warm-500 text-sm mb-8">
          Мы отправим вам SMS с подтверждением на номер{' '}
          <span className="font-medium">{completedOrder.contactPhone}</span>
        </p>
        <div className="flex flex-col gap-3">
          <Button variant="primary" onClick={() => navigate('/orders')}>
            Мои заказы
          </Button>
          <Button variant="secondary" onClick={() => navigate('/catalog')}>
            Продолжить покупки
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/cart"
          className="p-1.5 text-warm-400 hover:text-warm-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 rounded-lg"
          aria-label="Вернуться в корзину"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h1 className="font-serif text-2xl font-bold text-warm-900">Оформление заказа</h1>
      </div>

      <form
        onSubmit={handleSubmit((data) => orderMutation.mutate(data))}
        noValidate
        className="flex flex-col lg:flex-row gap-8"
      >
        {/* ===== Left — Form ===== */}
        <div className="flex-1 space-y-6">
          {/* Contact info */}
          <section className="bg-white rounded-2xl shadow-card p-5">
            <h2 className="font-semibold text-warm-900 mb-4">Контактные данные</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                {...register('contactName')}
                label="Имя и фамилия"
                placeholder="Иван Иванов"
                autoComplete="name"
                required
                error={errors.contactName?.message}
              />

              <div className="flex flex-col gap-1">
                <label htmlFor="checkout-phone" className="text-sm font-medium text-warm-700">
                  Телефон <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <Controller
                  name="contactPhone"
                  control={control}
                  render={({ field }) => (
                    <input
                      id="checkout-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+7 (___) ___-__-__"
                      maxLength={18}
                      aria-invalid={!!errors.contactPhone}
                      aria-describedby={errors.contactPhone ? 'checkout-phone-error' : undefined}
                      value={applyPhoneMask(field.value.replace(/\D/g, ''))}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        let normalized = digits;
                        if (normalized.startsWith('8')) normalized = '7' + normalized.slice(1);
                        if (!normalized.startsWith('7')) normalized = '7' + normalized;
                        if (normalized.length === 11) {
                          field.onChange('+' + normalized);
                        } else {
                          field.onChange('');
                        }
                        e.target.value = applyPhoneMask(digits);
                      }}
                      className={`w-full rounded-lg border px-3 py-2 text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                        errors.contactPhone
                          ? 'border-red-400 bg-red-50 focus:ring-red-300'
                          : 'border-warm-300 focus:ring-sage-300 focus:border-sage-400'
                      }`}
                    />
                  )}
                />
                {errors.contactPhone && (
                  <p id="checkout-phone-error" role="alert" className="text-xs text-red-600">
                    {errors.contactPhone.message}
                  </p>
                )}
              </div>

              <Input
                {...register('contactEmail')}
                label="Email (необязательно)"
                type="email"
                placeholder="ivan@example.com"
                autoComplete="email"
                error={errors.contactEmail?.message}
                containerClassName="sm:col-span-2"
              />
            </div>
          </section>

          {/* Delivery method */}
          <section className="bg-white rounded-2xl shadow-card p-5">
            <h2 className="font-semibold text-warm-900 mb-4">Способ доставки</h2>
            <div className="space-y-2" role="radiogroup" aria-label="Способ доставки">
              {(
                [
                  { value: 'courier', label: 'Курьером', desc: 'По адресу', price: deliveryKopecks === 0 ? 'Бесплатно' : formatPrice(STANDARD_DELIVERY) },
                  { value: 'pickup', label: 'Самовывоз', desc: 'Москва, ул. Примерная, 1', price: 'Бесплатно' },
                  { value: 'post', label: 'Почта России', desc: 'По всей России', price: formatPrice(STANDARD_DELIVERY) },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    deliveryMethod === opt.value
                      ? 'border-sage-400 bg-sage-50'
                      : 'border-warm-200 hover:border-warm-300'
                  }`}
                >
                  <input
                    type="radio"
                    {...register('deliveryMethod')}
                    value={opt.value}
                    className="sr-only"
                    aria-checked={deliveryMethod === opt.value}
                  />
                  <div
                    className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                      deliveryMethod === opt.value ? 'border-sage-500' : 'border-warm-300'
                    }`}
                    aria-hidden="true"
                  >
                    {deliveryMethod === opt.value && (
                      <div className="h-2 w-2 rounded-full bg-sage-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-warm-800">{opt.label}</p>
                    <p className="text-xs text-warm-500">{opt.desc}</p>
                  </div>
                  <span className="text-sm font-medium text-warm-700">{opt.price}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Address — shown for courier/post */}
          {needsAddress && (
            <section className="bg-white rounded-2xl shadow-card p-5">
              <h2 className="font-semibold text-warm-900 mb-4">Адрес доставки</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  {...register('city')}
                  label="Город"
                  placeholder="Москва"
                  autoComplete="address-level2"
                  required
                  error={errors.city?.message}
                  containerClassName="sm:col-span-2"
                />
                <Input
                  {...register('street')}
                  label="Улица"
                  placeholder="ул. Примерная"
                  autoComplete="address-line1"
                  required
                  error={errors.street?.message}
                />
                <Input
                  {...register('building')}
                  label="Дом"
                  placeholder="12"
                  required
                  error={errors.building?.message}
                />
                <Input
                  {...register('apartment')}
                  label="Квартира (необязательно)"
                  placeholder="45"
                  error={errors.apartment?.message}
                />
                <Input
                  {...register('postalCode')}
                  label="Почтовый индекс"
                  placeholder="123456"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="postal-code"
                  required
                  error={errors.postalCode?.message}
                />
              </div>
            </section>
          )}

          {/* Comment */}
          <section className="bg-white rounded-2xl shadow-card p-5">
            <h2 className="font-semibold text-warm-900 mb-4">Комментарий к заказу</h2>
            <textarea
              {...register('comment')}
              placeholder="Пожелания, время доставки, и т.д."
              rows={3}
              className="w-full rounded-xl border border-warm-300 px-3 py-2 text-sm text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-sage-400 resize-none"
            />
            {errors.comment && (
              <p className="mt-1 text-xs text-red-600">{errors.comment.message}</p>
            )}
          </section>
        </div>

        {/* ===== Right — Order summary ===== */}
        <aside className="lg:w-80 flex-shrink-0" aria-label="Сводка заказа">
          <div className="bg-white rounded-2xl shadow-card p-5 sticky top-24 space-y-4">
            <h2 className="font-semibold text-warm-900">Ваш заказ</h2>

            {/* Cart items summary */}
            <div className="max-h-60 overflow-y-auto">
              {items.map((item) => (
                <CartItem key={item.variantId} item={item} />
              ))}
            </div>

            {/* Totals */}
            <dl className="space-y-2 text-sm border-t border-warm-100 pt-3">
              <div className="flex justify-between">
                <dt className="text-warm-500">
                  {pluralize(totalItems, 'товар', 'товара', 'товаров')}
                </dt>
                <dd className="text-warm-800 font-medium">{formatPrice(subtotalKopecks)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-warm-500">Доставка</dt>
                <dd className={deliveryKopecks === 0 ? 'text-green-600 font-medium' : 'text-warm-800 font-medium'}>
                  {deliveryKopecks === 0 ? 'Бесплатно' : formatPrice(deliveryKopecks)}
                </dd>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-warm-100">
                <dt className="text-warm-800">Итого</dt>
                <dd className="text-warm-900 text-lg">{formatPrice(totalKopecks)}</dd>
              </div>
            </dl>

            <div className="space-y-4 pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  required
                  className="mt-1 h-4 w-4 rounded border-warm-300 text-sage-600 focus:ring-sage-500 cursor-pointer"
                />
                <span className="text-xs text-warm-500 leading-snug group-hover:text-warm-700 transition-colors">
                  Даю согласие на{' '}
                  <Link to="/privacy" className="text-sage-600 hover:underline">обработку персональных данных</Link> и принимаю условия{' '}
                  <Link to="/terms" className="text-sage-600 hover:underline">публичной оферты</Link>
                </span>
              </label>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={orderMutation.isPending}
                loadingText="Оформляем заказ..."
              >
                Подтвердить заказ
              </Button>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
