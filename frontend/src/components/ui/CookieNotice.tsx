import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './Button';

export function CookieNotice() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)] border-t border-warm-100">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-sm text-warm-600 leading-relaxed">
          Мы используем файлы cookie для улучшения работы сайта. Продолжая просмотр, вы соглашаетесь с нашей{' '}
          <Link to="/privacy" className="text-sage-600 hover:underline">политикой конфиденциальности</Link>.
        </div>
        <Button variant="primary" size="sm" onClick={handleAccept}>
          Принять
        </Button>
      </div>
    </div>
  );
}
