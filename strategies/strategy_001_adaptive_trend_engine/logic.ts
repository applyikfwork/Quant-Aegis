import type { OHLCV } from "./indicators";
import { calculateIndicators } from "./indicators";
import { evaluateEntry } from "./entry_rules";
import { calculateExitLevels, evaluateExit } from "./exit_rules";
import { calculatePositionSize, checkRiskApproval } from "./risk";
import { DEFAULT_PARAMETERS, type Strategy001Parameters } from "./parameters";

export interface Strategy001Signal {
  strategyId: "strategy_001";
  strategyName: "Adaptive AI Trend Fusion Engine";
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
  riskApproval: ReturnType<typeof checkRiskApproval>;
  message: string;
  regime: "Trending" | "Ranging" | "Unknown";
}

function detectRegime(indicators: ReturnType<typeof calculateIndicators>): "Trending" | "Ranging" | "Unknown" {
  if (indicators.trendStrength > 2) return "Trending";
  if (indicators.trendStrength < 0.5) return "Ranging";
  return "Unknown";
}

export function evaluate(
  candles: OHLCV[],
  asset: string,
  timeframe: string,
  accountBalance: number = 10000,
  aiConfidence: number = 65,
  aiSentiment: "Bullish" | "Bearish" | "Neutral" = "Neutral",
  currentDrawdown: number = 0,
  openPositions: number = 0,
  params: Strategy001Parameters = DEFAULT_PARAMETERS
): Strategy001Signal {
  const indicators = calculateIndicators(candles, params);
  const entryScore = evaluateEntry(indicators, params, aiConfidence, aiSentiment);
  const regime = detectRegime(indicators);
  const riskApproval = checkRiskApproval(accountBalance, currentDrawdown, openPositions, params);

  let position: ReturnType<typeof calculatePositionSize> | null = null;
  if (entryScore.passesThreshold && entryScore.direction !== "NEUTRAL" && riskApproval.approved && indicators.atr > 0) {
    position = calculatePositionSize(accountBalance, indicators.currentPrice, indicators.atr, entryScore.direction, params);
  }

  const confidence = Math.round((entryScore.totalScore / entryScore.maxScore) * 100);
  const action = entryScore.direction === "LONG" && entryScore.passesThreshold ? "BUY" :
    entryScore.direction === "SHORT" && entryScore.passesThreshold ? "SELL" : "HOLD";

  const message = !riskApproval.approved ? `⚠ Risk check failed: ${riskApproval.reason}` :
    entryScore.passesThreshold ? `${entryScore.direction} signal confirmed — Score ${entryScore.totalScore}/100 in ${regime} market` :
    `No trade — Score ${entryScore.totalScore} below threshold ${params.scoreThreshold} (${regime})`;

  return {
    strategyId: "strategy_001",
    strategyName: "Adaptive AI Trend Fusion Engine",
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
    riskApproval,
    message,
    regime,
  };
}

export { calculateExitLevels, evaluateExit };
