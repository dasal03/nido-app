/**
 * Minimum and maximum per contribution, withdrawal and automatic contribution, by currency
 * (roughly 10 / 500,000 MXN). Keep in sync with `amount_limits` in supabase/migrations/006.
 */
const LIMITS: Record<string, { min: number; max: number }> = {
  MXN: { min: 10, max: 500_000 },
  USD: { min: 1, max: 25_000 },
  EUR: { min: 1, max: 25_000 },
  COP: { min: 2_000, max: 100_000_000 },
  ARS: { min: 500, max: 25_000_000 },
  CLP: { min: 500, max: 25_000_000 },
  PEN: { min: 2, max: 100_000 },
  GTQ: { min: 5, max: 200_000 },
};

export const amountLimits = (currency: string) => LIMITS[currency] ?? LIMITS.MXN;

export type AmountIssue = 'tooSmall' | 'tooLarge' | null;

/**
 * Checks an amount against the currency's limits. `wholeBalance` lets a withdrawal take everything
 * that's left even when it's below the minimum.
 */
export function amountIssue(amount: number, currency: string, wholeBalance?: number): AmountIssue {
  const { min, max } = amountLimits(currency);
  if (amount > max) return 'tooLarge';
  if (amount < min && !(wholeBalance !== undefined && Math.abs(amount - wholeBalance) < 0.005)) return 'tooSmall';
  return null;
}
