import type { Strategy002Parameters } from "./parameters";

export interface PositionSizeResult {
  positionSize: number;
  positionValue: number;
  riskAmount: number;
  stopDistance: number;
  stopLoss: number;
  takeProfit: number;
  rrRatio: number;
  riskRewardLabel: string;
}

export function calculatePositionSize(
  accountBalance: number,
  entryPrice: number,
  atr: number,
  direction: "LONG" | "SHORT",
  params: Strategy002Parameters
): PositionSizeResult {
  const riskAmount = accountBalance * (params.riskPerTrade / 100);
  const stopDistance = atr * params.atrMultiplierSL;
  const tpDistance = atr * params.atrMultiplierTP;
  const positionSize = stopDistance > 0 ? riskAmount / stopDistance : 0;
  const positionValue = positionSize * entryPrice;
  const stopLoss = direction === "LONG" ? entryPrice - stopDistance : entryPrice + stopDistance;
  const takeProfit = direction === "LONG" ? entryPrice + tpDistance : entryPrice - tpDistance;
  const rrRatio = params.atrMultiplierTP / params.atrMultiplierSL;

  return {
    positionSize: Math.floor(positionSize * 10000) / 10000,
    positionValue: Math.round(positionValue * 100) / 100,
    riskAmount: Math.round(riskAmount * 100) / 100,
    stopDistance: Math.round(stopDistance * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
    takeProfit: Math.round(takeProfit * 100) / 100,
    rrRatio: Math.round(rrRatio * 10) / 10,
    riskRewardLabel: `1:${Math.round(rrRatio * 10) / 10}`,
  };
}

export const RISK_RULES = [
  { rule: "Risk per trade: 1.5% of account balance (adjustable 0.5–3%)", category: "Position Sizing", critical: true },
  { rule: "Maximum 3 simultaneous breakout positions", category: "Exposure", critical: true },
  { rule: "Maximum drawdown: 20% — strategy auto-pauses", category: "Drawdown", critical: true },
  { rule: "Stop loss: ATR × 1.5 from entry (tight breakout stop)", category: "Stop Loss", critical: true },
  { rule: "Trailing stop activates after ATR × 1.5 profit", category: "Trailing", critical: false },
  { rule: "Wait 1 candle close confirmation before entry", category: "Anti-Fakeout", critical: true },
  { rule: "Daily loss limit: 4% — session halted", category: "Daily Limit", critical: true },
  { rule: "No entry during major liquidity events (first 5min of hour)", category: "Timing", critical: false },
] as const;

export function checkRiskApproval(
  accountBalance: number,
  currentDrawdown: number,
  openPositions: number,
  params: Strategy002Parameters
): { approved: boolean; reason: string } {
  if (currentDrawdown >= params.maxDrawdown) {
    return { approved: false, reason: `Max drawdown ${params.maxDrawdown}% reached — strategy paused` };
  }
  if (openPositions >= params.maxPositions) {
    return { approved: false, reason: `Maximum breakout positions (${params.maxPositions}) already open` };
  }
  if (accountBalance < 200) {
    return { approved: false, reason: "Account balance below minimum $200" };
  }
  return { approved: true, reason: "Risk rules passed" };
}
