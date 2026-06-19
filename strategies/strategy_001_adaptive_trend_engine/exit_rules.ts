import type { Strategy001Indicators } from "./indicators";
import type { Strategy001Parameters } from "./parameters";

export type ExitType = "TAKE_PROFIT" | "STOP_LOSS" | "TREND_EXIT" | "HOLD";

export interface ExitLevels {
  stopLoss: number;
  takeProfit: number;
  stopDistance: number;
  tpDistance: number;
}

export interface ExitEvaluation {
  shouldExit: boolean;
  type: ExitType;
  reason: string;
  urgency: "immediate" | "next_candle" | "monitor";
  stopLoss: number;
  takeProfit: number;
  currentPnlPct: number;
}

export function calculateExitLevels(
  entryPrice: number,
  direction: "LONG" | "SHORT",
  atr: number,
  params: Strategy001Parameters
): ExitLevels {
  const stopDistance = atr * params.atrMultiplierSL;
  const tpDistance = stopDistance * params.rrRatio;
  return {
    stopDistance: Math.round(stopDistance * 100) / 100,
    tpDistance: Math.round(tpDistance * 100) / 100,
    stopLoss: Math.round((direction === "LONG" ? entryPrice - stopDistance : entryPrice + stopDistance) * 100) / 100,
    takeProfit: Math.round((direction === "LONG" ? entryPrice + tpDistance : entryPrice - tpDistance) * 100) / 100,
  };
}

export function evaluateExit(
  indicators: Strategy001Indicators,
  params: Strategy001Parameters,
  entryPrice: number,
  currentPrice: number,
  direction: "LONG" | "SHORT",
  stopLoss: number,
  takeProfit: number
): ExitEvaluation {
  const pnlPct = direction === "LONG"
    ? ((currentPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - currentPrice) / entryPrice) * 100;

  if (direction === "LONG") {
    if (currentPrice >= takeProfit) {
      return { shouldExit: true, type: "TAKE_PROFIT", reason: `Target reached: ${currentPrice.toFixed(2)} ≥ ${takeProfit.toFixed(2)}`, urgency: "immediate", stopLoss, takeProfit, currentPnlPct: Math.round(pnlPct * 100) / 100 };
    }
    if (currentPrice <= stopLoss) {
      return { shouldExit: true, type: "STOP_LOSS", reason: `Stop hit: ${currentPrice.toFixed(2)} ≤ ${stopLoss.toFixed(2)}`, urgency: "immediate", stopLoss, takeProfit, currentPnlPct: Math.round(pnlPct * 100) / 100 };
    }
    if (indicators.ema50 < indicators.ema200) {
      return { shouldExit: true, type: "TREND_EXIT", reason: "EMA death cross — trend reversed bearish", urgency: "next_candle", stopLoss, takeProfit, currentPnlPct: Math.round(pnlPct * 100) / 100 };
    }
  } else {
    if (currentPrice <= takeProfit) {
      return { shouldExit: true, type: "TAKE_PROFIT", reason: `Target reached: ${currentPrice.toFixed(2)} ≤ ${takeProfit.toFixed(2)}`, urgency: "immediate", stopLoss, takeProfit, currentPnlPct: Math.round(pnlPct * 100) / 100 };
    }
    if (currentPrice >= stopLoss) {
      return { shouldExit: true, type: "STOP_LOSS", reason: `Stop hit: ${currentPrice.toFixed(2)} ≥ ${stopLoss.toFixed(2)}`, urgency: "immediate", stopLoss, takeProfit, currentPnlPct: Math.round(pnlPct * 100) / 100 };
    }
    if (indicators.ema50 > indicators.ema200) {
      return { shouldExit: true, type: "TREND_EXIT", reason: "EMA golden cross — trend reversed bullish", urgency: "next_candle", stopLoss, takeProfit, currentPnlPct: Math.round(pnlPct * 100) / 100 };
    }
  }

  return { shouldExit: false, type: "HOLD", reason: "No exit condition triggered — holding position", urgency: "monitor", stopLoss, takeProfit, currentPnlPct: Math.round(pnlPct * 100) / 100 };
}
