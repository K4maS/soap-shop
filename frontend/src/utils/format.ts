// =============================================================================
// Formatting utilities — prices (RUB), phone, dates
// =============================================================================

/**
 * Format kopecks to Russian Ruble display string.
 * e.g. 15000 → "150 ₽"  |  15050 → "150,50 ₽"
 */
export function formatPrice(kopecks: number): string {
  const rubles = kopecks / 100;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: rubles % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rubles);
}

/**
 * Format a numeric kopeck value as a plain number string without currency symbol.
 * e.g. 150000 → "1 500"
 */
export function formatPriceNumber(kopecks: number): string {
  const rubles = kopecks / 100;
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: rubles % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rubles);
}

/**
 * Format a Russian phone number to a human-readable format.
 * Input: "+79991234567" or "79991234567" or "89991234567"
 * Output: "+7 (999) 123-45-67"
 */
export function formatPhone(phone: string): string {
  // Normalize — strip everything except digits
  const digits = phone.replace(/\D/g, '');

  let normalized = digits;
  if (normalized.startsWith('8')) {
    normalized = '7' + normalized.slice(1);
  }
  if (!normalized.startsWith('7')) {
    normalized = '7' + normalized;
  }

  if (normalized.length !== 11) {
    // Return as-is if format is unexpected
    return phone;
  }

  const [, code, p1, p2, p3] = normalized.match(/^7(\d{3})(\d{3})(\d{2})(\d{2})$/) ?? [];
  if (!code) return phone;

  return `+7 (${code}) ${p1}-${p2}-${p3}`;
}

/**
 * Apply a phone mask to a raw digit string (for input fields).
 * Turns "9991234567" → "+7 (999) 123-45-67" progressively.
 */
export function applyPhoneMask(rawDigits: string): string {
  // Keep only digits, strip leading 7/8
  let digits = rawDigits.replace(/\D/g, '');
  if (digits.startsWith('7') || digits.startsWith('8')) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);

  let result = '+7';
  if (digits.length === 0) return result;

  result += ' (';
  result += digits.slice(0, 3);
  if (digits.length < 4) return result + (digits.length === 3 ? ')' : '');

  result += ') ';
  result += digits.slice(3, 6);
  if (digits.length < 7) return result;

  result += '-';
  result += digits.slice(6, 8);
  if (digits.length < 9) return result;

  result += '-';
  result += digits.slice(8, 10);
  return result;
}

/**
 * Format an ISO date string to a localized Russian date.
 * e.g. "2024-01-15T10:30:00.000Z" → "15 января 2024"
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Format an ISO date string to a short date + time.
 * e.g. "2024-01-15T10:30:00.000Z" → "15.01.2024, 13:30"
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format a relative time string.
 * e.g. "2 часа назад", "5 минут назад", "вчера"
 */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });

  if (diffSeconds < 60) return rtf.format(-diffSeconds, 'second');
  if (diffMinutes < 60) return rtf.format(-diffMinutes, 'minute');
  if (diffHours < 24) return rtf.format(-diffHours, 'hour');
  if (diffDays < 7) return rtf.format(-diffDays, 'day');

  return formatDate(isoString);
}

/**
 * Pluralize a Russian noun based on count.
 * e.g. pluralize(1, 'товар', 'товара', 'товаров') → "1 товар"
 */
export function pluralize(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const abs = Math.abs(count) % 100;
  const n = abs % 10;

  if (abs > 10 && abs < 20) return `${count} ${many}`;
  if (n === 1) return `${count} ${one}`;
  if (n >= 2 && n <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}

/**
 * Truncate a string to maxLength with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
}

/**
 * Convert kopecks to rubles (float).
 */
export function kopecksToRubles(kopecks: number): number {
  return kopecks / 100;
}

/**
 * Convert rubles (float) to kopecks (integer).
 */
export function rublesToKopecks(rubles: number): number {
  return Math.round(rubles * 100);
}
