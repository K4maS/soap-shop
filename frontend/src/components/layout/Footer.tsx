import { Link } from 'react-router-dom';

// =============================================================================
// Footer
// =============================================================================

const currentYear = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="bg-warm-900 text-warm-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sage-400 to-beige-400 flex items-center justify-center">
                <span className="text-white font-bold text-sm" aria-hidden="true">M</span>
              </div>
              <span className="font-serif font-semibold text-white text-lg">
                Mylo Master
              </span>
            </div>
            <p className="text-sm leading-relaxed text-warm-400">
              Натуральная косметика и мыло ручной работы. Всё — с заботой о вас и природе.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3 mt-4">
              <a
                href="https://t.me/mylomaster"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="text-warm-400 hover:text-white transition-colors"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 14.618l-2.93-.918c-.64-.203-.653-.64.136-.95l11.43-4.408c.537-.194 1.006.131.737.906z"/>
                </svg>
              </a>
              <a
                href="https://vk.com/mylomaster"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="ВКонтакте"
                className="text-warm-400 hover:text-white transition-colors"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.585-1.496c.596-.19 1.365 1.26 2.182 1.815.616.42 1.082.328 1.082.328l2.17-.03s1.136-.071.598-.964c-.044-.073-.312-.658-1.61-1.86-1.36-1.257-1.176-1.054.46-3.23.999-1.333 1.398-2.146 1.272-2.495-.12-.333-.856-.245-.856-.245l-2.44.015s-.181-.025-.316.055c-.132.078-.217.262-.217.262s-.387 1.035-.903 1.913c-1.088 1.853-1.523 1.95-1.7 1.836-.413-.267-.31-1.075-.31-1.648 0-1.793.271-2.54-.527-2.733-.265-.064-.46-.107-1.137-.114-.869-.009-1.605.003-2.02.206-.277.136-.49.44-.36.457.16.022.525.098.719.362.249.341.24 1.106.24 1.106s.143 2.11-.334 2.372c-.327.18-.776-.187-1.739-1.865-.494-.855-.867-1.8-.867-1.8s-.072-.176-.202-.272c-.156-.115-.376-.151-.376-.151l-2.322.015s-.348.01-.476.162C3.937 8.98 4.043 9.3 4.043 9.3s1.817 4.25 3.873 6.396c1.888 1.97 4.031 1.84 4.031 1.84h.838z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Catalog */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Каталог</h3>
            <ul className="space-y-2">
              {[
                { to: '/catalog', label: 'Все товары' },
                { to: '/catalog?category=soap', label: 'Мыло' },
                { to: '/catalog?category=cosmetics', label: 'Косметика' },
                { to: '/catalog?category=oils', label: 'Масла' },
                { to: '/catalog?category=gifts', label: 'Подарочные наборы' },
                { to: '/catalog?isFeatured=true', label: 'Хиты продаж' },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-warm-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Покупателям</h3>
            <ul className="space-y-2">
              {[
                { to: '/delivery', label: 'Доставка и оплата' },
                { to: '/returns', label: 'Возврат и обмен' },
                { to: '/faq', label: 'Вопросы и ответы' },
                { to: '/wholesale', label: 'Оптовые заказы (B2B)' },
                { to: '/contacts', label: 'Контакты' },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-warm-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Контакты</h3>
            <ul className="space-y-2 text-sm text-warm-400">
              <li>
                <a
                  href="tel:+78001234567"
                  className="hover:text-white transition-colors"
                >
                  8 800 123-45-67
                </a>
                <p className="text-xs text-warm-500 mt-0.5">Бесплатно по России</p>
              </li>
              <li>
                <a
                  href="mailto:hello@mylomaster.ru"
                  className="hover:text-white transition-colors break-all"
                >
                  hello@mylomaster.ru
                </a>
              </li>
              <li className="text-warm-500 text-xs">
                Пн–Пт: 9:00 – 18:00 (МСК)
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-warm-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-warm-500">
          <p>© {currentYear} Mylo Master. Все права защищены.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-warm-300 transition-colors">
              Политика конфиденциальности
            </Link>
            <Link to="/terms" className="hover:text-warm-300 transition-colors">
              Условия использования
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
