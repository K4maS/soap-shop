import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Leaf, Shield, Truck, Star } from 'lucide-react';
import { Button } from '@components/ui/Button';
import { ProductGrid } from '@components/product/ProductGrid';
import { useFeaturedProducts, useCategories } from '@hooks/useProducts';

// =============================================================================
// HomePage — hero, featured products, categories, value props
// =============================================================================

export default function HomePage() {
  const navigate = useNavigate();
  const { data: featured, isLoading: loadingFeatured } = useFeaturedProducts(8);
  const { data: categories, isLoading: loadingCategories } = useCategories();

  return (
    <div>
      {/* ===== HERO ===== */}
      <section
        className="relative overflow-hidden bg-gradient-hero"
        aria-labelledby="hero-heading"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <div className="max-w-2xl">
            <p className="text-sage-600 text-sm font-medium tracking-wider uppercase mb-4">
              Натуральная косметика ручной работы
            </p>
            <h1
              id="hero-heading"
              className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-warm-900 leading-tight mb-6"
            >
              Забота о коже —
              <br />
              <span className="text-sage-600">с любовью к природе</span>
            </h1>
            <p className="text-warm-600 text-lg mb-8 leading-relaxed">
              Мыло ручной работы, натуральные масла и уходовая косметика без парабенов и SLS.
              Только природные ингредиенты.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                size="lg"
                rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                onClick={() => navigate('/catalog')}
              >
                Смотреть каталог
              </Button>
              <Link
                to="/catalog?isFeatured=true"
                className="inline-flex items-center gap-2 px-6 py-2.5 text-base font-medium text-warm-700 bg-white/80 hover:bg-white border border-warm-200 rounded-xl transition-colors"
              >
                Хиты продаж
              </Link>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-8 mt-12">
              {[
                { value: '500+', label: 'видов товаров' },
                { value: '10 000+', label: 'довольных клиентов' },
                { value: '5 лет', label: 'на рынке' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl font-bold text-warm-900 font-serif">{stat.value}</p>
                  <p className="text-sm text-warm-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Decorative background */}
        <div
          className="absolute right-0 top-0 h-full w-1/2 hidden lg:block"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-gradient-to-l from-sage-50/60 to-transparent" />
          <div className="absolute bottom-8 right-8 w-64 h-64 rounded-full bg-beige-200/50 blur-3xl" />
          <div className="absolute top-8 right-32 w-48 h-48 rounded-full bg-sage-200/40 blur-2xl" />
        </div>
      </section>

      {/* ===== VALUE PROPOSITIONS ===== */}
      <section className="bg-white border-b border-warm-100" aria-label="Наши преимущества">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              {
                icon: Leaf,
                title: 'Натуральный состав',
                desc: 'Без парабенов, SLS и минеральных масел',
              },
              {
                icon: Shield,
                title: 'Гипоаллергенно',
                desc: 'Протестировано дерматологами',
              },
              {
                icon: Truck,
                title: 'Быстрая доставка',
                desc: 'По всей России от 1 дня',
              },
              {
                icon: Star,
                title: 'Ручная работа',
                desc: 'Каждое изделие сделано с душой',
              },
            ].map((prop) => (
              <div key={prop.title} className="flex items-start gap-3">
                <div className="flex-shrink-0 p-2 rounded-xl bg-sage-50">
                  <prop.icon className="h-5 w-5 text-sage-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-warm-800">{prop.title}</p>
                  <p className="text-xs text-warm-500 mt-0.5">{prop.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CATEGORIES GRID ===== */}
      <section className="py-16" aria-labelledby="categories-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2
                id="categories-heading"
                className="font-serif text-2xl font-bold text-warm-900"
              >
                Категории
              </h2>
              <p className="text-sm text-warm-500 mt-1">Найдите то, что подходит именно вам</p>
            </div>
            <Link
              to="/catalog"
              className="text-sm text-sage-600 hover:text-sage-700 hover:underline flex items-center gap-1"
            >
              Все категории
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {loadingCategories ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-beige-100 rounded-2xl aspect-[3/4] animate-pulse-soft"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {(categories ?? []).slice(0, 6).map((category) => (
                <Link
                  key={category.id}
                  to={`/catalog?categorySlug=${category.slug}`}
                  className="group relative overflow-hidden rounded-2xl bg-beige-100 aspect-[3/4] flex items-end p-4 hover:shadow-card-hover transition-shadow"
                >
                  {category.imageUrl && (
                    <img
                      src={category.imageUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      aria-hidden="true"
                      loading="lazy"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-card" aria-hidden="true" />
                  <div className="relative">
                    <p className="text-white font-medium text-sm leading-tight">
                      {category.name}
                    </p>
                    {category.productCount != null && (
                      <p className="text-white/70 text-xs mt-0.5">
                        {category.productCount} товаров
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== FEATURED PRODUCTS ===== */}
      <section className="py-16 bg-white" aria-labelledby="featured-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2
                id="featured-heading"
                className="font-serif text-2xl font-bold text-warm-900"
              >
                Хиты продаж
              </h2>
              <p className="text-sm text-warm-500 mt-1">Самые популярные у наших покупателей</p>
            </div>
            <Link
              to="/catalog?isFeatured=true"
              className="text-sm text-sage-600 hover:text-sage-700 hover:underline flex items-center gap-1"
            >
              Смотреть все
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <ProductGrid
            products={featured}
            isLoading={loadingFeatured}
            skeletonCount={8}
            columns={4}
          />
        </div>
      </section>

      {/* ===== B2B BANNER ===== */}
      <section className="py-16" aria-labelledby="b2b-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-r from-sage-800 to-sage-600 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-white">
              <h2 id="b2b-heading" className="font-serif text-2xl md:text-3xl font-bold mb-3">
                Оптовые заказы B2B
              </h2>
              <p className="text-sage-200 text-sm md:text-base max-w-lg">
                Специальные условия для розничных магазинов, спа-центров и корпоративных клиентов.
                Собственная торговая марка, индивидуальная упаковка.
              </p>
            </div>
            <Link
              to="/wholesale"
              className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-white text-sage-800 font-medium rounded-xl hover:bg-beige-50 transition-colors"
            >
              Узнать подробнее
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
