export interface OHLCV {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
  width: number;
  widthPct: number;
  percentB: number;
}

export interface Strategy002Indicators {
  bb: BollingerBands;
  bbPrev: BollingerBands;
  atr: number;
  atrPrev: number;
  atrTrend: "increasing" | "decreasing" | "stable";
  volumeAvg: number;
  currentVolume: number;
  volumeRatio: number;
  volumeSpike: boolean;
  bbCompression: boolean;
  priceAboveUpper: boolean;
  priceBelowLower: boolean;
  breakoutStrength: number;
  currentPrice: number;
  historicalBBWidthAvg: number;
}

function calcSMA(data: number[], period: number): number {
  const slice = data.slice(-period);
  return slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
}

function calcStdDev(data: number[], mean: number): number {
  const n = data.length;
  if (n === 0) return 0;
  const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  return Math.sqrt(variance);
}

function calcBollinger(closes: number[], period: number, stdDevMult: number): BollingerBands {
  const slice = closes.slice(-period);
  if (slice.length < period) return { upper: 0, middle: 0, lower: 0, width: 0, widthPct: 0, percentB: 0 };
  const middle = calcSMA(slice, period);
  const std = calcStdDev(slice, middle);
  const upper = middle + stdDevMult * std;
  const lower = middle - stdDevMult * std;
  const width = upper - lower;
  const widthPct = middle > 0 ? (width / middle) * 100 : 0;
  const currentPrice = closes[closes.length - 1] ?? middle;
  const percentB = width > 0 ? ((currentPrice - lower) / width) * 100 : 50;
  return { upper, middle, lower, width, widthPct, percentB };
}

function calcATR(candles: OHLCV[], period: number): number {
  if (candles.length < 2) return 0;
  const trs = candles.slice(1).map((c, i) => {
    const prev = candles[i];
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  });
  const recent = trs.slice(-period);
  return recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
}

export function calculateIndicators(
  candles: OHLCV[],
  params: {
    bollingerPeriod: number;
    bollingerDeviation: number;
    atrPeriod: number;
    volumePeriod: number;
    compressionThreshold: number;
  }
): Strategy002Indicators {
  if (candles.length < params.bollingerPeriod + 5) {
    return {
      bb: { upper: 0, middle: 0, lower: 0, width: 0, widthPct: 0, percentB: 50 },
      bbPrev: { upper: 0, middle: 0, lower: 0, width: 0, widthPct: 0, percentB: 50 },
      atr: 0, atrPrev: 0, atrTrend: "stable",
      volumeAvg: 0, currentVolume: 0, volumeRatio: 1, volumeSpike: false,
      bbCompression: false, priceAboveUpper: false, priceBelowLower: false,
      breakoutStrength: 0, currentPrice: 0, historicalBBWidthAvg: 0,
    };
  }

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  const bb = calcBollinger(closes, params.bollingerPeriod, params.bollingerDeviation);
  const bbPrev = calcBollinger(closes.slice(0, -1), params.bollingerPeriod, params.bollingerDeviation);

  const historicalWidths: number[] = [];
  for (let i = params.bollingerPeriod; i < closes.length - 1; i++) {
    const slice = closes.slice(i - params.bollingerPeriod, i);
    const m = calcSMA(slice, params.bollingerPeriod);
    const s = calcStdDev(slice, m);
    historicalWidths.push(m > 0 ? ((m + 2 * s - (m - 2 * s)) / m) * 100 : 0);
  }
  const historicalBBWidthAvg = historicalWidths.length > 0 ? historicalWidths.reduce((a, b) => a + b, 0) / historicalWidths.length : bb.widthPct;

  const atr = calcATR(candles, params.atrPeriod);
  const atrPrev = calcATR(candles.slice(0, -1), params.atrPeriod);
  const atrTrend: "increasing" | "decreasing" | "stable" = atr > atrPrev * 1.05 ? "increasing" : atr < atrPrev * 0.95 ? "decreasing" : "stable";

  const recentVols = volumes.slice(-params.volumePeriod);
  const volumeAvg = recentVols.length > 0 ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length : 0;
  const currentVolume = volumes[volumes.length - 1] ?? 0;
  const volumeRatio = volumeAvg > 0 ? currentVolume / volumeAvg : 1;

  const currentPrice = closes[closes.length - 1] ?? 0;
  const priceAboveUpper = currentPrice > bb.upper;
  const priceBelowLower = currentPrice < bb.lower;
  const bbCompression = bb.widthPct < historicalBBWidthAvg * params.compressionThreshold * 33;
  const volumeSpike = volumeRatio >= 1.5;

  let breakoutStrength = 0;
  if (priceAboveUpper && bb.upper > 0) {
    breakoutStrength = ((currentPrice - bb.upper) / bb.upper) * 100;
  } else if (priceBelowLower && bb.lower > 0) {
    breakoutStrength = ((bb.lower - currentPrice) / bb.lower) * 100;
  }

  return {
    bb, bbPrev, atr, atrPrev, atrTrend, volumeAvg, currentVolume, volumeRatio,
    volumeSpike, bbCompression, priceAboveUpper, priceBelowLower, breakoutStrength,
    currentPrice, historicalBBWidthAvg,
  };
}
