import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { Button } from '@components/ui/Button';

// =============================================================================
// NotFoundPage — 404
// =============================================================================

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-brand flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Large 404 */}
        <div className="relative mb-8">
          <p
            className="text-[8rem] sm:text-[10rem] font-bold font-serif text-beige-200 select-none leading-none"
            aria-hidden="true"
          >
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-sage-100 flex items-center justify-center">
              <svg
                className="h-8 w-8 text-sage-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <h1 className="font-serif text-2xl font-bold text-warm-900 mb-3">
          Страница не найдена
        </h1>
        <p className="text-warm-500 text-sm mb-8 leading-relaxed">
          Возможно, страница была удалена или вы перешли по устаревшей ссылке.
          Давайте вернёмся туда, где всё пахнет хорошо.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate(-1)}
            leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          >
            Назад
          </Button>
          <Button
            variant="primary"
            leftIcon={<Home className="h-4 w-4" aria-hidden="true" />}
            onClick={() => navigate('/')}
          >
            На главную
          </Button>
        </div>
      </div>
    </div>
  );
}
