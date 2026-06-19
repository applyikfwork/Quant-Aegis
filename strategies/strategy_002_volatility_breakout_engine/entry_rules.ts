import type { Strategy002Indicators } from "./indicators";
import type { Strategy002Parameters } from "./parameters";

export interface ScoreBreakdown {
  score: number;
  maxScore: number;
  passed: boolean;
  reason: string;
}

export interface EntryScore {
  direction: "LONG" | "SHORT" | "NEUTRAL";
  totalScore: number;
  maxScore: 100;
  passesThreshold: boolean;
  compressionDetected: boolean;
  breakdown: {
    breakout: ScoreBreakdown;
    volume: ScoreBreakdown;
    volatility: ScoreBreakdown;
    ai: ScoreBreakdown;
  };
  conditions: {
    name: string;
    passed: boolean;
    value: string;
    required: boolean;
  }[];
}

export function evaluateEntry(
  indicators: Strategy002Indicators,
  params: Strategy002Parameters,
  aiConfidence: number,
  aiSentiment: "Bullish" | "Bearish" | "Neutral"
): EntryScore {
  const breakoutLong = indicators.priceAboveUpper;
  const breakoutShort = indicators.priceBelowLower;
  const volumeOk = indicators.volumeRatio >= params.volumeMultiplier;
  const volatilityOk = indicators.atrTrend === "increasing" || indicators.atrTrend === "stable";
  const aiOk = aiConfidence >= params.aiConfidenceThreshold;

  let direction: "LONG" | "SHORT" | "NEUTRAL" = "NEUTRAL";
  if (breakoutLong && (aiSentiment !== "Bearish" || aiConfidence < params.aiConfidenceThreshold)) {
    direction = "LONG";
  } else if (breakoutShort && (aiSentiment !== "Bullish" || aiConfidence < params.aiConfidenceThreshold)) {
    direction = "SHORT";
  }

  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  const breakoutPassed = isLong ? breakoutLong : isShort ? breakoutShort : false;

  let breakoutScore = 0;
  if (breakoutPassed) {
    breakoutScore = indicators.breakoutStrength > 1.0 ? 30 : indicators.breakoutStrength > 0.5 ? 25 : 20;
  }

  let volumeScore = 0;
  if (volumeOk) {
    volumeScore = indicators.volumeRatio >= 2.0 ? 25 : indicators.volumeRatio >= 1.5 ? 20 : 15;
  }

  const volatilityScore = volatilityOk ? (indicators.atrTrend === "increasing" ? 20 : 15) : 0;
  const aiScore = aiOk ? 25 : aiConfidence >= params.aiConfidenceThreshold - 10 ? 15 : 0;

  const totalScore = breakoutScore + volumeScore + volatilityScore + aiScore;

  return {
    direction,
    totalScore,
    maxScore: 100,
    passesThreshold: totalScore >= params.scoreThreshold && direction !== "NEUTRAL",
    compressionDetected: indicators.bbCompression,
    breakdown: {
      breakout: {
        score: breakoutScore, maxScore: 30, passed: breakoutPassed,
        reason: breakoutPassed
          ? `Price ${isLong ? "above upper" : "below lower"} BB (${isLong ? indicators.bb.upper.toFixed(2) : indicators.bb.lower.toFixed(2)}) — strength: ${indicators.breakoutStrength.toFixed(3)}%`
          : `No breakout — price ${indicators.currentPrice.toFixed(2)} inside bands [${indicators.bb.lower.toFixed(2)} – ${indicators.bb.upper.toFixed(2)}]`,
      },
      volume: {
        score: volumeScore, maxScore: 25, passed: volumeOk,
        reason: `Volume ${indicators.volumeRatio.toFixed(2)}x average (${volumeOk ? "✓ spike confirmed" : `need ≥${params.volumeMultiplier}x`})`,
      },
      volatility: {
        score: volatilityScore, maxScore: 20, passed: volatilityOk,
        reason: `ATR ${indicators.atrTrend} (current: ${indicators.atr.toFixed(4)}, prev: ${indicators.atrPrev.toFixed(4)})`,
      },
      ai: {
        score: aiScore, maxScore: 25, passed: aiOk,
        reason: `AI confidence ${aiConfidence}% | Sentiment: ${aiSentiment} (threshold: ≥${params.aiConfidenceThreshold}%)`,
      },
    },
    conditions: [
      { name: "Bollinger Breakout",     passed: breakoutPassed, value: `${isLong ? "Above upper" : isShort ? "Below lower" : "Inside"} band | BB Width: ${indicators.bb.widthPct.toFixed(2)}%`,      required: true },
      { name: "Volume Spike",           passed: volumeOk,       value: `${indicators.volumeRatio.toFixed(2)}x avg volume`,                                                                              required: true },
      { name: "ATR Expansion",          passed: volatilityOk,   value: `ATR ${indicators.atrTrend}: ${indicators.atr.toFixed(4)}`,                                                                     required: true },
      { name: "AI Confidence",          passed: aiOk,           value: `${aiConfidence}% (${aiSentiment})`,                                                                                             required: true },
      { name: "Pre-breakout Squeeze",   passed: indicators.bbCompression, value: indicators.bbCompression ? "Compression detected before breakout" : "No prior compression",                           required: false },
    ],
  };
}
