import type { Strategy002Parameters } from "./parameters";

export type ExitType = "TAKE_PROFIT" | "STOP_LOSS" | "TRAILING_STOP" | "VOLATILITY_COLLAPSE" | "HOLD";

export interface ExitLevels {
  stopLoss: number;
  takeProfit: number;
  trailingActivation: number;
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
  trailingStop: number | null;
  currentPnlPct: number;
}

export function calculateExitLevels(
  entryPrice: number,
  direction: "LONG" | "SHORT",
  atr: number,
  params: Strategy002Parameters
): ExitLevels {
  const stopDistance = atr * params.atrMultiplierSL;
  const tpDistance = atr * params.atrMultiplierTP;
  const trailingActivationDist = atr * params.trailingActivationMultiplier;

  return {
    stopDistance: Math.round(stopDistance * 100) / 100,
    tpDistance: Math.round(tpDistance * 100) / 100,
    stopLoss: Math.round((direction === "LONG" ? entryPrice - stopDistance : entryPrice + stopDistance) * 100) / 100,
    takeProfit: Math.round((direction === "LONG" ? entryPrice + tpDistance : entryPrice - tpDistance) * 100) / 100,
    trailingActivation: Math.round((direction === "LONG" ? entryPrice + trailingActivationDist : entryPrice - trailingActivationDist) * 100) / 100,
  };
}

export function evaluateExit(
  params: Strategy002Parameters,
  entryPrice: number,
  currentPrice: number,
  direction: "LONG" | "SHORT",
  stopLoss: number,
  takeProfit: number,
  atr: number,
  currentAtr: number,
  highestPrice?: number,
  lowestPrice?: number
): ExitEvaluation {
  const pnlPct = direction === "LONG"
    ? ((currentPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - currentPrice) / entryPrice) * 100;

  let trailingStop: number | null = null;
  const trailingActivation = direction === "LONG"
    ? entryPrice + atr * params.trailingActivationMultiplier
    : entryPrice - atr * params.trailingActivationMultiplier;

  if (params.trailingStop) {
    const activated = direction === "LONG" ? currentPrice >= trailingActivation : currentPrice <= trailingActivation;
    if (activated) {
      const peak = direction === "LONG" ? (highestPrice ?? currentPrice) : (lowestPrice ?? currentPrice);
      trailingStop = direction === "LONG"
        ? peak - currentAtr * params.trailingDistanceMultiplier
        : peak + currentAtr * params.trailingDistanceMultiplier;
    }
  }

  if (direction === "LONG") {
    if (currentPrice >= takeProfit) {
      return { shouldExit: true, type: "TAKE_PROFIT", reason: `Target hit: ${currentPrice.toFixed(2)} ≥ ${takeProfit.toFixed(2)} (ATR×${params.atrMultiplierTP})`, urgency: "immediate", stopLoss, takeProfit, trailingStop, currentPnlPct: Math.round(pnlPct * 100) / 100 };
    }
    if (currentPrice <= stopLoss) {
      return { shouldExit: true, type: "STOP_LOSS", reason: `Stop hit: ${currentPrice.toFixed(2)} ≤ ${stopLoss.toFixed(2)} (ATR×${params.atrMultiplierSL})`, urgency: "immediate", stopLoss, takeProfit, trailingStop, currentPnlPct: Math.round(pnlPct * 100) / 100 };
    }
    if (trailingStop !== null && currentPrice <= trailingStop) {
      return { shouldExit: true, type: "TRAILING_STOP", reason: `Trailing stop triggered: ${currentPrice.toFixed(2)} ≤ ${trailingStop.toFixed(2)}`, urgency: "immediate", stopLoss, takeProfit, trailingStop, currentPnlPct: Math.round(pnlPct * 100) / 100 };
    }
  } else {
    if (currentPrice <= takeProfit) {
      return { shouldExit: true, type: "TAKE_PROFIT", reason: `Target hit: ${currentPrice.toFixed(2)} ≤ ${takeProfit.toFixed(2)} (ATR×${params.atrMultiplierTP})`, urgency: "immediate", stopLoss, takeProfit, trailingStop, currentPnlPct: Math.round(pnlPct * 100) / 100 };
    }
    if (currentPrice >= stopLoss) {
      return { shouldExit: true, type: "STOP_LOSS", reason: `Stop hit: ${currentPrice.toFixed(2)} ≥ ${stopLoss.toFixed(2)} (ATR×${params.atrMultiplierSL})`, urgency: "immediate", stopLoss, takeProfit, trailingStop, currentPnlPct: Math.round(pnlPct * 100) / 100 };
    }
    if (trailingStop !== null && currentPrice >= trailingStop) {
      return { shouldExit: true, type: "TRAILING_STOP", reason: `Trailing stop triggered: ${currentPrice.toFixed(2)} ≥ ${trailingStop.toFixed(2)}`, urgency: "immediate", stopLoss, takeProfit, trailingStop, currentPnlPct: Math.round(pnlPct * 100) / 100 };
    }
  }

  return { shouldExit: false, type: "HOLD", reason: "No exit condition triggered — holding breakout position", urgency: "monitor", stopLoss, takeProfit, trailingStop, currentPnlPct: Math.round(pnlPct * 100) / 100 };
}
