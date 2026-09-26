export const CURRENCIES = [
  { code: 'MXN', flag: '🇲🇽', locale: 'es-MX', symbol: '$' },
  { code: 'USD', flag: '🇺🇸', locale: 'es-US', symbol: '$' },
  { code: 'EUR', flag: '🇪🇺', locale: 'es-ES', symbol: '€' },
  { code: 'COP', flag: '🇨🇴', locale: 'es-CO', symbol: '$' },
  { code: 'ARS', flag: '🇦🇷', locale: 'es-AR', symbol: '$' },
  { code: 'CLP', flag: '🇨🇱', locale: 'es-CL', symbol: '$' },
  { code: 'PEN', flag: '🇵🇪', locale: 'es-PE', symbol: 'S/' },
  { code: 'GTQ', flag: '🇬🇹', locale: 'es-GT', symbol: 'Q' },
] as const;

const currencyInfo = (code: string) => CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];

const ZERO_DECIMALS = new Set(['COP', 'CLP']);

export const hasCents = (currency: string) => !ZERO_DECIMALS.has(currency);

/**
 * "$410.000 COP", "1.234,50 €". Currencies that share the "$" sign get their code appended so
 * amounts are never ambiguous; `compact` drops cents and the code (tight spots like legends).
 */
export function formatMoney(amount: number, currency: string, opts: { compact?: boolean } = {}) {
  const info = currencyInfo(currency);
  const decimals = ZERO_DECIMALS.has(currency) || opts.compact ? 0 : 2;
  const options = { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals } as const;
  let text: string;
  try {
    text = new Intl.NumberFormat(info.locale, { ...options, currencyDisplay: 'narrowSymbol' }).format(amount);
  } catch {
    // Older Intl implementations don't know narrowSymbol.
    text = new Intl.NumberFormat(info.locale, options).format(amount);
  }
  return info.symbol === '$' && !opts.compact ? `${text} ${currency}` : text;
}

export function currencySymbol(currency: string) {
  return currencyInfo(currency).symbol;
}

/** Formats a raw keypad string ("12345.5") with the currency's separators, preserving a trailing dot. */
export function formatAmountInput(value: string, currency: string) {
  const [int, dec] = value.split('.');
  const nf = new Intl.NumberFormat(currencyInfo(currency).locale, { useGrouping: true });
  const decimalSep = nf.format(1.5).charAt(1);
  const grouped = nf.format(Number(int));
  return dec === undefined ? grouped : `${grouped}${decimalSep}${dec}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function formatDayLabel(iso: string, locale: string, labels: { today: string; yesterday: string }) {
  const date = new Date(iso);
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return labels.today;
  if (diffDays === 1) return labels.yesterday;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(date);
}

export function formatShortDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function formatTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

export function monthsUntil(iso: string) {
  const now = new Date();
  const target = new Date(iso);
  return (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
