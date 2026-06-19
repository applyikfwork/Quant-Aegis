import type { Strategy001Parameters } from "./parameters";

export interface PositionSizeResult {
  positionSize: number;
  positionValue: number;
  riskAmount: number;
  stopDistance: number;
  stopLoss: number;
  takeProfit: number;
  rrRatio: number;
  riskRewardLabel: string;
  lotSize: number;
}

export function calculatePositionSize(
  accountBalance: number,
  entryPrice: number,
  atr: number,
  direction: "LONG" | "SHORT",
  params: Strategy001Parameters
): PositionSizeResult {
  const riskAmount = accountBalance * (params.riskPerTrade / 100);
  const stopDistance = atr * params.atrMultiplierSL;
  const tpDistance = stopDistance * params.rrRatio;

  const positionSize = stopDistance > 0 ? riskAmount / stopDistance : 0;
  const positionValue = positionSize * entryPrice;

  const stopLoss = direction === "LONG" ? entryPrice - stopDistance : entryPrice + stopDistance;
  const takeProfit = direction === "LONG" ? entryPrice + tpDistance : entryPrice - tpDistance;

  return {
    positionSize: Math.floor(positionSize * 10000) / 10000,
    positionValue: Math.round(positionValue * 100) / 100,
    riskAmount: Math.round(riskAmount * 100) / 100,
    stopDistance: Math.round(stopDistance * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
    takeProfit: Math.round(takeProfit * 100) / 100,
    rrRatio: params.rrRatio,
    riskRewardLabel: `1:${params.rrRatio}`,
    lotSize: Math.floor(positionSize * 1000) / 1000,
  };
}

export const RISK_RULES = [
  { rule: "Risk per trade: 1% of account balance (adjustable 0.5–3%)", category: "Position Sizing", critical: true },
  { rule: "Maximum 5 simultaneous open positions", category: "Exposure", critical: true },
  { rule: "Maximum drawdown: 15% — strategy auto-pauses", category: "Drawdown", critical: true },
  { rule: "Stop loss required on every entry (ATR × 2.0)", category: "Stop Loss", critical: true },
  { rule: "No averaging down — one position per signal", category: "Entry", critical: false },
  { rule: "Daily loss limit: 3% — trading halted until next session", category: "Daily Limit", critical: true },
  { rule: "Correlation check: avoid >3 correlated assets simultaneously", category: "Correlation", critical: false },
  { rule: "Reduce position size 50% after 3 consecutive losses", category: "Adaptive", critical: false },
] as const;

export function checkRiskApproval(
  accountBalance: number,
  currentDrawdown: number,
  openPositions: number,
  params: Strategy001Parameters
): { approved: boolean; reason: string } {
  if (currentDrawdown >= params.maxDrawdown) {
    return { approved: false, reason: `Max drawdown ${params.maxDrawdown}% reached — strategy paused` };
  }
  if (openPositions >= params.maxPositions) {
    return { approved: false, reason: `Maximum positions (${params.maxPositions}) already open` };
  }
  if (accountBalance < 100) {
    return { approved: false, reason: "Account balance too low" };
  }
  return { approved: true, reason: "Risk rules passed" };
}
