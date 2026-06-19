import path from "path";
import fs from "fs";

export interface StrategyModule {
  id: string;
  name: string;
  shortName: string;
  version: string;
  category: string;
  subcategory: string;
  description: string;
  tags: string[];
  supportedAssets: string[];
  supportedTimeframes: string[];
  primaryTimeframe: string;
  bestMarketConditions: string[];
  avoidConditions: string[];
  complexity: string;
  estimatedWinRate: number;
  estimatedRR: number;
  estimatedSharpe: number;
  minAccountSize: number;
  connections: string[];
  scoreSystem: {
    maxScore: number;
    threshold: number;
    layers: Array<{ name: string; indicator: string; maxPoints: number; description: string }>;
  };
  indicators: Array<{ name: string; type: string; layer: string; weight: number; description: string; period?: number }>;
  entryRules: { long: string[]; short: string[] };
  exitRules: { takeProfit: string; stopLoss: string; trailingStop?: boolean; trailingActivation?: string; trailingDistance?: string };
  riskRules: { riskPerTrade: number; maxPositions: number; maxDrawdown: number; dailyLossLimit: number; positionSizing: string };
}

// ── Indicator math (self-contained, no external deps) ─────────────────────────

interface OHLCV { open: number; high: number; low: number; close: number; volume: number; timestamp: number }

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
  return 100 - (100 / (1 + gains / losses));
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

function calcBB(closes: number[], period: number, mult: number) {
  const slice = closes.slice(-period);
  if (slice.length < period) return { upper: 0, middle: 0, lower: 0, widthPct: 0, percentB: 50 };
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((acc, v) => acc + Math.pow(v - middle, 2), 0) / period);
  const upper = middle + mult * std;
  const lower = middle - mult * std;
  const widthPct = middle > 0 ? ((upper - lower) / middle) * 100 : 0;
  const cp = closes[closes.length - 1] ?? middle;
  const percentB = (upper - lower) > 0 ? ((cp - lower) / (upper - lower)) * 100 : 50;
  return { upper, middle, lower, widthPct, percentB };
}

// ── Strategy 001 Evaluation ────────────────────────────────────────────────────

function evaluateStrategy001(
  candles: OHLCV[],
  aiConfidence: number,
  aiSentiment: string,
  params: Record<string, number>
) {
  const p = {
    emaFast: params.emaFast ?? 50,
    emaSlow: params.emaSlow ?? 200,
    rsiPeriod: params.rsiPeriod ?? 14,
    rsiBullThreshold: params.rsiBullThreshold ?? 55,
    rsiBearThreshold: params.rsiBearThreshold ?? 45,
    macdFast: params.macdFast ?? 12,
    macdSlow: params.macdSlow ?? 26,
    macdSignal: params.macdSignal ?? 9,
    volumePeriod: params.volumePeriod ?? 20,
    volumeMultiplier: params.volumeMultiplier ?? 1.0,
    aiConfidenceThreshold: params.aiConfidenceThreshold ?? 65,
    atrPeriod: params.atrPeriod ?? 14,
    atrMultiplierSL: params.atrMultiplierSL ?? 2.0,
    rrRatio: params.rrRatio ?? 3.0,
    riskPerTrade: params.riskPerTrade ?? 1.0,
    scoreThreshold: params.scoreThreshold ?? 70,
  };

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  const ema50s = calcEMA(closes, p.emaFast);
  const ema200s = calcEMA(closes, p.emaSlow);
  const ema50 = ema50s[ema50s.length - 1] ?? closes[closes.length - 1];
  const ema200 = ema200s[ema200s.length - 1] ?? closes[closes.length - 1];

  const rsi = calcRSI(closes, p.rsiPeriod);

  const macdFastEMAs = calcEMA(closes, p.macdFast);
  const macdSlowEMAs = calcEMA(closes, p.macdSlow);
  const macdLines = closes.map((_, i) => (macdFastEMAs[i] ?? 0) - (macdSlowEMAs[i] ?? 0));
  const signalEMAs = calcEMA(macdLines, p.macdSignal);
  const macdLine = macdLines[macdLines.length - 1] ?? 0;
  const macdSignalLine = signalEMAs[signalEMAs.length - 1] ?? 0;
  const macdPrevLine = macdLines[macdLines.length - 2] ?? macdLine;
  const macdPrevSignal = signalEMAs[signalEMAs.length - 2] ?? macdSignalLine;
  const macdCrossover = macdPrevLine <= macdPrevSignal && macdLine > macdSignalLine ? "bullish" :
    macdPrevLine >= macdPrevSignal && macdLine < macdSignalLine ? "bearish" : "none";

  const recentVols = volumes.slice(-p.volumePeriod);
  const volumeAvg = recentVols.length > 0 ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length : 0;
  const currentVolume = volumes[volumes.length - 1] ?? 0;
  const volumeRatio = volumeAvg > 0 ? currentVolume / volumeAvg : 1;

  const atr = calcATR(candles, p.atrPeriod);
  const currentPrice = closes[closes.length - 1] ?? 0;

  const trendBullish = ema50 > ema200;
  const trendBearish = ema50 < ema200;
  const rsiLong = rsi > p.rsiBullThreshold;
  const rsiShort = rsi < p.rsiBearThreshold;
  const macdLong = macdCrossover === "bullish" || (macdLine > macdSignalLine);
  const macdShort = macdCrossover === "bearish" || (macdLine < macdSignalLine);
  const volumeOk = volumeRatio >= p.volumeMultiplier;
  const aiOk = aiConfidence >= p.aiConfidenceThreshold;

  const longVotes = [trendBullish, rsiLong, macdLong, aiSentiment === "Bullish"].filter(Boolean).length;
  const shortVotes = [trendBearish, rsiShort, macdShort, aiSentiment === "Bearish"].filter(Boolean).length;
  const direction = longVotes >= 3 && longVotes > shortVotes ? "LONG" :
    shortVotes >= 3 && shortVotes > longVotes ? "SHORT" : "NEUTRAL";

  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";
  const trendScore = (isLong ? trendBullish : isShort ? trendBearish : false) ? 30 : 0;
  const momentumScore = (isLong ? rsiLong : isShort ? rsiShort : false) ? 25 : 0;
  const macdScore = (isLong ? macdLong : isShort ? macdShort : false) ? 20 : 0;
  const volumeScore = volumeOk ? 15 : 0;
  const aiScore = aiOk ? 10 : 0;
  const totalScore = trendScore + momentumScore + macdScore + volumeScore + aiScore;

  const passesThreshold = totalScore >= p.scoreThreshold && direction !== "NEUTRAL";
  const stopDistance = atr * p.atrMultiplierSL;
  const tpDistance = stopDistance * p.rrRatio;

  return {
    direction, totalScore, maxScore: 100, passesThreshold,
    action: direction === "LONG" && passesThreshold ? "BUY" : direction === "SHORT" && passesThreshold ? "SELL" : "HOLD",
    indicators: { ema50: Math.round(ema50 * 100) / 100, ema200: Math.round(ema200 * 100) / 100, rsi: Math.round(rsi * 100) / 100, macdLine: Math.round(macdLine * 6) / 1000000, macdSignalLine: Math.round(macdSignalLine * 6) / 1000000, macdCrossover, volumeRatio: Math.round(volumeRatio * 100) / 100, atr: Math.round(atr * 100) / 100, currentPrice },
    breakdown: [
      { layer: "Trend", score: trendScore, maxScore: 30, passed: trendScore > 0, reason: `EMA${p.emaFast} ${ema50 > ema200 ? ">" : "<"} EMA${p.emaSlow}` },
      { layer: "Momentum", score: momentumScore, maxScore: 25, passed: momentumScore > 0, reason: `RSI ${rsi.toFixed(1)}` },
      { layer: "MACD", score: macdScore, maxScore: 20, passed: macdScore > 0, reason: `MACD ${macdCrossover} | line ${macdLine > macdSignalLine ? "above" : "below"} signal` },
      { layer: "Volume", score: volumeScore, maxScore: 15, passed: volumeOk, reason: `Volume ${volumeRatio.toFixed(2)}x avg` },
      { layer: "AI", score: aiScore, maxScore: 10, passed: aiOk, reason: `AI ${aiConfidence}% (${aiSentiment})` },
    ],
    exitLevels: direction !== "NEUTRAL" ? {
      stopLoss: Math.round((direction === "LONG" ? currentPrice - stopDistance : currentPrice + stopDistance) * 100) / 100,
      takeProfit: Math.round((direction === "LONG" ? currentPrice + tpDistance : currentPrice - tpDistance) * 100) / 100,
      rrRatio: p.rrRatio,
    } : null,
  };
}

// ── Strategy 002 Evaluation ────────────────────────────────────────────────────

function evaluateStrategy002(
  candles: OHLCV[],
  aiConfidence: number,
  aiSentiment: string,
  params: Record<string, number>
) {
  const p = {
    bollingerPeriod: params.bollingerPeriod ?? 20,
    bollingerDeviation: params.bollingerDeviation ?? 2.0,
    atrPeriod: params.atrPeriod ?? 14,
    atrMultiplierSL: params.atrMultiplierSL ?? 1.5,
    atrMultiplierTP: params.atrMultiplierTP ?? 4.0,
    volumePeriod: params.volumePeriod ?? 20,
    volumeMultiplier: params.volumeMultiplier ?? 1.5,
    aiConfidenceThreshold: params.aiConfidenceThreshold ?? 75,
    scoreThreshold: params.scoreThreshold ?? 75,
    compressionThreshold: params.compressionThreshold ?? 0.03,
  };

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  const bb = calcBB(closes, p.bollingerPeriod, p.bollingerDeviation);
  const bbPrev = calcBB(closes.slice(0, -1), p.bollingerPeriod, p.bollingerDeviation);

  const atr = calcATR(candles, p.atrPeriod);
  const atrPrev = calcATR(candles.slice(0, -1), p.atrPeriod);
  const atrTrend = atr > atrPrev * 1.05 ? "increasing" : atr < atrPrev * 0.95 ? "decreasing" : "stable";

  const recentVols = volumes.slice(-p.volumePeriod);
  const volumeAvg = recentVols.length > 0 ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length : 0;
  const currentVolume = volumes[volumes.length - 1] ?? 0;
  const volumeRatio = volumeAvg > 0 ? currentVolume / volumeAvg : 1;

  const currentPrice = closes[closes.length - 1] ?? 0;
  const priceAboveUpper = currentPrice > bb.upper;
  const priceBelowLower = currentPrice < bb.lower;
  const volumeOk = volumeRatio >= p.volumeMultiplier;
  const volatilityOk = atrTrend === "increasing" || atrTrend === "stable";
  const aiOk = aiConfidence >= p.aiConfidenceThreshold;
  const bbCompression = bb.widthPct < bbPrev.widthPct * 0.85;

  let breakoutStrength = 0;
  if (priceAboveUpper && bb.upper > 0) breakoutStrength = ((currentPrice - bb.upper) / bb.upper) * 100;
  else if (priceBelowLower && bb.lower > 0) breakoutStrength = ((bb.lower - currentPrice) / bb.lower) * 100;

  const direction = priceAboveUpper && aiSentiment !== "Bearish" ? "LONG" :
    priceBelowLower && aiSentiment !== "Bullish" ? "SHORT" : "NEUTRAL";

  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";
  const breakoutPassed = isLong ? priceAboveUpper : isShort ? priceBelowLower : false;

  const breakoutScore = breakoutPassed ? (breakoutStrength > 1.0 ? 30 : breakoutStrength > 0.5 ? 25 : 20) : 0;
  const volumeScore = volumeOk ? (volumeRatio >= 2.0 ? 25 : volumeRatio >= 1.5 ? 20 : 15) : 0;
  const volatilityScore = volatilityOk ? (atrTrend === "increasing" ? 20 : 15) : 0;
  const aiScore = aiOk ? 25 : aiConfidence >= p.aiConfidenceThreshold - 10 ? 15 : 0;
  const totalScore = breakoutScore + volumeScore + volatilityScore + aiScore;

  const passesThreshold = totalScore >= p.scoreThreshold && direction !== "NEUTRAL";
  const stopDistance = atr * p.atrMultiplierSL;
  const tpDistance = atr * p.atrMultiplierTP;

  const phase = bbCompression ? "Compression" :
    (priceAboveUpper || priceBelowLower) && atrTrend === "increasing" ? "Breakout" :
    (priceAboveUpper || priceBelowLower) ? "Expansion" : "Unknown";

  return {
    direction, totalScore, maxScore: 100, passesThreshold, phase,
    action: direction === "LONG" && passesThreshold ? "BUY" : direction === "SHORT" && passesThreshold ? "SELL" : "HOLD",
    indicators: {
      bbUpper: Math.round(bb.upper * 100) / 100,
      bbMiddle: Math.round(bb.middle * 100) / 100,
      bbLower: Math.round(bb.lower * 100) / 100,
      bbWidthPct: Math.round(bb.widthPct * 100) / 100,
      bbPercentB: Math.round(bb.percentB * 100) / 100,
      atr: Math.round(atr * 100) / 100,
      atrTrend,
      volumeRatio: Math.round(volumeRatio * 100) / 100,
      breakoutStrength: Math.round(breakoutStrength * 1000) / 1000,
      bbCompression,
      currentPrice,
    },
    breakdown: [
      { layer: "Breakout Strength", score: breakoutScore, maxScore: 30, passed: breakoutPassed, reason: breakoutPassed ? `${isLong ? "Above" : "Below"} BB band by ${breakoutStrength.toFixed(3)}%` : "Price inside Bollinger Bands" },
      { layer: "Volume Spike", score: volumeScore, maxScore: 25, passed: volumeOk, reason: `Volume ${volumeRatio.toFixed(2)}x avg (need ≥${p.volumeMultiplier}x)` },
      { layer: "ATR Expansion", score: volatilityScore, maxScore: 20, passed: volatilityOk, reason: `ATR ${atrTrend}: ${atr.toFixed(4)}` },
      { layer: "AI Regime", score: aiScore, maxScore: 25, passed: aiOk, reason: `AI ${aiConfidence}% (${aiSentiment})` },
    ],
    exitLevels: direction !== "NEUTRAL" ? {
      stopLoss: Math.round((direction === "LONG" ? currentPrice - stopDistance : currentPrice + stopDistance) * 100) / 100,
      takeProfit: Math.round((direction === "LONG" ? currentPrice + tpDistance : currentPrice - tpDistance) * 100) / 100,
      rrRatio: Math.round((p.atrMultiplierTP / p.atrMultiplierSL) * 10) / 10,
    } : null,
  };
}

// ── Load modules ───────────────────────────────────────────────────────────────

const STRATEGIES_DIR = path.resolve(process.cwd(), "strategies");

function loadStrategyModule(moduleId: string): StrategyModule | null {
  try {
    const jsonPath = path.join(STRATEGIES_DIR, moduleId, "strategy.json");
    if (!fs.existsSync(jsonPath)) return null;
    return JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as StrategyModule;
  } catch {
    return null;
  }
}

export function loadAllModules(): StrategyModule[] {
  const modules: StrategyModule[] = [];
  try {
    if (!fs.existsSync(STRATEGIES_DIR)) return modules;
    const entries = fs.readdirSync(STRATEGIES_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const mod = loadStrategyModule(entry.name);
        if (mod) modules.push(mod);
      }
    }
  } catch { /* return what we have */ }
  return modules.sort((a, b) => a.id.localeCompare(b.id));
}

export function getModule(moduleId: string): StrategyModule | null {
  const all = loadAllModules();
  return all.find(m => m.id === moduleId || m.moduleFolder === moduleId) ?? null;
}

// ── Main evaluate function ─────────────────────────────────────────────────────

export interface EvaluateRequest {
  strategyId: string;
  asset: string;
  timeframe: string;
  candles: OHLCV[];
  accountBalance?: number;
  aiConfidence?: number;
  aiSentiment?: string;
  currentDrawdown?: number;
  openPositions?: number;
  parameters?: Record<string, number>;
}

export function evaluateStrategy(req: EvaluateRequest) {
  const { strategyId, asset, timeframe, candles, accountBalance = 10000, aiConfidence = 70, aiSentiment = "Neutral", parameters = {} } = req;

  if (candles.length < 10) {
    return { error: "Insufficient candle data — minimum 10 candles required" };
  }

  if (strategyId === "strategy_001") {
    const result = evaluateStrategy001(candles, aiConfidence, aiSentiment, parameters);
    return { strategyId, strategyName: "Adaptive AI Trend Fusion Engine", asset, timeframe, timestamp: new Date().toISOString(), accountBalance, aiConfidence, aiSentiment, ...result };
  }

  if (strategyId === "strategy_002") {
    const result = evaluateStrategy002(candles, aiConfidence, aiSentiment, parameters);
    return { strategyId, strategyName: "Volatility Breakout Intelligence Engine", asset, timeframe, timestamp: new Date().toISOString(), accountBalance, aiConfidence, aiSentiment, ...result };
  }

  return { error: `Unknown strategy: ${strategyId}` };
}
