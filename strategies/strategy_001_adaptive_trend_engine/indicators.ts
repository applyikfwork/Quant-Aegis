export interface OHLCV {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface Strategy001Indicators {
  ema50: number;
  ema200: number;
  rsi: number;
  macdLine: number;
  macdSignalLine: number;
  macdHistogram: number;
  macdCrossover: "bullish" | "bearish" | "none";
  macdPrevCrossover: "bullish" | "bearish" | "none";
  volumeAvg: number;
  currentVolume: number;
  volumeRatio: number;
  atr: number;
  trendStrength: number;
  currentPrice: number;
}

function calcEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return prices.map(() => prices[prices.length - 1] ?? 0);
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result: number[] = new Array(period - 1).fill(0);
  result.push(ema);
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcRSI(prices: number[], period: number): number {
  if (prices.length < period + 1) return 50;
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  const recent = changes.slice(-period);
  const gains = recent.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  const losses = Math.abs(recent.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;
  if (losses === 0) return gains > 0 ? 100 : 50;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
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
    emaFast: number; emaSlow: number; rsiPeriod: number;
    macdFast: number; macdSlow: number; macdSignal: number;
    volumePeriod: number; atrPeriod: number;
  }
): Strategy001Indicators {
  if (candles.length < 2) {
    return { ema50: 0, ema200: 0, rsi: 50, macdLine: 0, macdSignalLine: 0, macdHistogram: 0, macdCrossover: "none", macdPrevCrossover: "none", volumeAvg: 0, currentVolume: 0, volumeRatio: 1, atr: 0, trendStrength: 0, currentPrice: 0 };
  }

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  const ema50s = calcEMA(closes, params.emaFast);
  const ema200s = calcEMA(closes, params.emaSlow);
  const ema50 = ema50s[ema50s.length - 1] ?? closes[closes.length - 1];
  const ema200 = ema200s[ema200s.length - 1] ?? closes[closes.length - 1];
  const ema50Prev = ema50s[ema50s.length - 2] ?? ema50;
  const ema200Prev = ema200s[ema200s.length - 2] ?? ema200;

  const trendStrength = ema200 > 0 ? Math.abs((ema50 - ema200) / ema200) * 100 : 0;

  const rsi = calcRSI(closes, params.rsiPeriod);

  const macdFastEMAs = calcEMA(closes, params.macdFast);
  const macdSlowEMAs = calcEMA(closes, params.macdSlow);
  const macdLines: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLines.push((macdFastEMAs[i] ?? 0) - (macdSlowEMAs[i] ?? 0));
  }
  const signalEMAs = calcEMA(macdLines, params.macdSignal);
  const macdLine = macdLines[macdLines.length - 1] ?? 0;
  const macdPrevLine = macdLines[macdLines.length - 2] ?? macdLine;
  const macdSignalLine = signalEMAs[signalEMAs.length - 1] ?? 0;
  const macdPrevSignal = signalEMAs[signalEMAs.length - 2] ?? macdSignalLine;
  const macdHistogram = macdLine - macdSignalLine;

  const detectCross = (curr: number, currSig: number, prev: number, prevSig: number): "bullish" | "bearish" | "none" =>
    prev <= prevSig && curr > currSig ? "bullish" :
    prev >= prevSig && curr < currSig ? "bearish" : "none";

  const macdCrossover = detectCross(macdLine, macdSignalLine, macdPrevLine, macdPrevSignal);
  const macdPrevCrossover = detectCross(macdPrevLine, macdPrevSignal, macdLines[macdLines.length - 3] ?? macdPrevLine, signalEMAs[signalEMAs.length - 3] ?? macdPrevSignal);

  const recentVols = volumes.slice(-params.volumePeriod);
  const volumeAvg = recentVols.length > 0 ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length : 0;
  const currentVolume = volumes[volumes.length - 1] ?? 0;
  const volumeRatio = volumeAvg > 0 ? currentVolume / volumeAvg : 1;

  const atr = calcATR(candles, params.atrPeriod);
  const currentPrice = closes[closes.length - 1] ?? 0;

  return {
    ema50, ema200, rsi, macdLine, macdSignalLine, macdHistogram,
    macdCrossover, macdPrevCrossover,
    volumeAvg, currentVolume, volumeRatio, atr, trendStrength, currentPrice,
  };
}
