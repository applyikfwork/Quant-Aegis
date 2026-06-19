import type { OHLCV } from "./indicators";
import { calculateIndicators } from "./indicators";
import { evaluateEntry } from "./entry_rules";
import { calculateExitLevels } from "./exit_rules";
import { calculatePositionSize, checkRiskApproval } from "./risk";
import { DEFAULT_PARAMETERS, type Strategy002Parameters } from "./parameters";

export interface Strategy002Signal {
  strategyId: "strategy_002";
  strategyName: "Volatility Breakout Intelligence Engine";
  timestamp: string;
  asset: string;
  timeframe: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  score: number;
  maxScore: 100;
  confidence: number;
  passesThreshold: boolean;
  action: "BUY" | "SELL" | "HOLD";
  indicators: ReturnType<typeof calculateIndicators>;
  entryScore: ReturnType<typeof evaluateEntry>;
  position: ReturnType<typeof calculatePositionSize> | null;
  exitLevels: ReturnType<typeof calculateExitLevels> | null;
  riskApproval: ReturnType<typeof checkRiskApproval>;
  message: string;
  phase: "Compression" | "Breakout" | "Expansion" | "Unknown";
}

function detectPhase(indicators: ReturnType<typeof calculateIndicators>): "Compression" | "Breakout" | "Expansion" | "Unknown" {
  if (indicators.bbCompression) return "Compression";
  if (indicators.priceAboveUpper || indicators.priceBelowLower) {
    return indicators.atrTrend === "increasing" ? "Breakout" : "Expansion";
  }
  return "Unknown";
}

export function evaluate(
  candles: OHLCV[],
  asset: string,
  timeframe: string,
  accountBalance: number = 10000,
  aiConfidence: number = 75,
  aiSentiment: "Bullish" | "Bearish" | "Neutral" = "Neutral",
  currentDrawdown: number = 0,
  openPositions: number = 0,
  params: Strategy002Parameters = DEFAULT_PARAMETERS
): Strategy002Signal {
  const indicators = calculateIndicators(candles, params);
  const entryScore = evaluateEntry(indicators, params, aiConfidence, aiSentiment);
  const phase = detectPhase(indicators);
  const riskApproval = checkRiskApproval(accountBalance, currentDrawdown, openPositions, params);

  let position: ReturnType<typeof calculatePositionSize> | null = null;
  let exitLevels: ReturnType<typeof calculateExitLevels> | null = null;

  if (entryScore.passesThreshold && entryScore.direction !== "NEUTRAL" && riskApproval.approved && indicators.atr > 0) {
    position = calculatePositionSize(accountBalance, indicators.currentPrice, indicators.atr, entryScore.direction, params);
    exitLevels = calculateExitLevels(indicators.currentPrice, entryScore.direction, indicators.atr, params);
  }

  const confidence = Math.round((entryScore.totalScore / entryScore.maxScore) * 100);
  const action = entryScore.direction === "LONG" && entryScore.passesThreshold ? "BUY" :
    entryScore.direction === "SHORT" && entryScore.passesThreshold ? "SELL" : "HOLD";

  const message = !riskApproval.approved ? `⚠ Risk check failed: ${riskApproval.reason}` :
    entryScore.passesThreshold ? `${entryScore.direction} breakout confirmed — Score ${entryScore.totalScore}/100 | Phase: ${phase}` :
    phase === "Compression" ? `Compression detected — monitoring for breakout (Score: ${entryScore.totalScore})` :
    `No breakout — Score ${entryScore.totalScore} below threshold ${params.scoreThreshold}`;

  return {
    strategyId: "strategy_002",
    strategyName: "Volatility Breakout Intelligence Engine",
    timestamp: new Date().toISOString(),
    asset,
    timeframe,
    direction: entryScore.direction,
    score: entryScore.totalScore,
    maxScore: 100,
    confidence,
    passesThreshold: entryScore.passesThreshold && riskApproval.approved,
    action,
    indicators,
    entryScore,
    position,
    exitLevels,
    riskApproval,
    message,
    phase,
  };
}
