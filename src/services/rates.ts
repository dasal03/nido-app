/**
 * Exchange rates for converting a nest's savings when its currency changes.
 * Source: ExchangeRate-API's open endpoint (free, no key, updated daily) — https://www.exchangerate-api.com
 */
const cache = new Map<string, { at: number; rates: Record<string, number> }>();
const TTL = 60 * 60 * 1000;

/** How many units of `to` one unit of `from` is worth. Throws when offline or the pair is unknown. */
export async function getRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  let entry = cache.get(from);
  if (!entry || Date.now() - entry.at > TTL) {
    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`);
    const data = await res.json();
    if (data?.result !== 'success') throw new Error('rates_unavailable');
    entry = { at: Date.now(), rates: data.rates };
    cache.set(from, entry);
  }
  const rate = entry.rates[to];
  if (!(rate > 0)) throw new Error('rates_unavailable');
  return rate;
}
