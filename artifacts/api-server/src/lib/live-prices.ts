// Shared live price cache — populated by Bybit market worker on every sync
// All modules (paper trading, risk, portfolio) read from here for consistent prices

const DEFAULTS: Record<string, number> = {
  BTCUSDT:  63000,
  ETHUSDT:  1700,
  SOLUSDT:  150,
  BNBUSDT:  576,
  XRPUSDT:  0.52,
  AVAXUSDT: 28,
  ADAUSDT:  0.44,
  DOGEUSDT: 0.12,
};

interface PriceEntry { price: number; ts: number; }
const cache: Record<string, PriceEntry> = {};

export function updateLivePrice(symbol: string, price: number): void {
  if (price > 0) cache[symbol] = { price, ts: Date.now() };
}

// Returns the latest known price; falls back to defaults if stale (>5 min) or missing
export function getLivePrice(symbol: string): number {
  const e = cache[symbol];
  if (e && Date.now() - e.ts < 300_000) return e.price;
  return DEFAULTS[symbol] ?? 1;
}

export function getAllLivePrices(): Record<string, number> {
  const result = { ...DEFAULTS };
  for (const [sym, e] of Object.entries(cache)) {
    if (Date.now() - e.ts < 300_000) result[sym] = e.price;
  }
  return result;
}

export function isPriceFresh(symbol: string): boolean {
  const e = cache[symbol];
  return !!e && Date.now() - e.ts < 300_000;
}
