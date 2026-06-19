import type { Strategy001Indicators } from "./indicators";
import type { Strategy001Parameters } from "./parameters";

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
  breakdown: {
    trend: ScoreBreakdown;
    momentum: ScoreBreakdown;
    macd: ScoreBreakdown;
    volume: ScoreBreakdown;
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
  indicators: Strategy001Indicators,
  params: Strategy001Parameters,
  aiConfidence: number,
  aiSentiment: "Bullish" | "Bearish" | "Neutral"
): EntryScore {
  const trendBullish = indicators.ema50 > indicators.ema200;
  const trendBearish = indicators.ema50 < indicators.ema200;
  const rsiLong = indicators.rsi > params.rsiBullThreshold;
  const rsiShort = indicators.rsi < params.rsiBearThreshold;
  const macdLong = indicators.macdCrossover === "bullish" || (indicators.macdLine > indicators.macdSignalLine && indicators.macdHistogram > 0);
  const macdShort = indicators.macdCrossover === "bearish" || (indicators.macdLine < indicators.macdSignalLine && indicators.macdHistogram < 0);
  const volumeOk = indicators.volumeRatio >= params.volumeMultiplier;
  const aiOk = aiConfidence >= params.aiConfidenceThreshold;

  const longVotes = [trendBullish, rsiLong, macdLong, aiSentiment === "Bullish"].filter(Boolean).length;
  const shortVotes = [trendBearish, rsiShort, macdShort, aiSentiment === "Bearish"].filter(Boolean).length;

  const direction: "LONG" | "SHORT" | "NEUTRAL" =
    longVotes >= 3 && longVotes > shortVotes ? "LONG" :
    shortVotes >= 3 && shortVotes > longVotes ? "SHORT" : "NEUTRAL";

  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  const trendPassed = isLong ? trendBullish : isShort ? trendBearish : false;
  const momentumPassed = isLong ? rsiLong : isShort ? rsiShort : false;
  const macdPassed = isLong ? macdLong : isShort ? macdShort : false;

  const trendScore = trendPassed ? 30 : 0;
  const momentumScore = momentumPassed ? 25 : 0;
  const macdScore = macdPassed ? 20 : 0;
  const volumeScore = volumeOk ? 15 : 0;
  const aiScore = aiOk ? 10 : 0;
  const totalScore = trendScore + momentumScore + macdScore + volumeScore + aiScore;

  return {
    direction,
    totalScore,
    maxScore: 100,
    passesThreshold: totalScore >= params.scoreThreshold && direction !== "NEUTRAL",
    breakdown: {
      trend: {
        score: trendScore, maxScore: 30, passed: trendPassed,
        reason: `EMA${params.emaFast} (${indicators.ema50.toFixed(2)}) ${trendPassed ? (isLong ? ">" : "<") : "⚠ not crossed"} EMA${params.emaSlow} (${indicators.ema200.toFixed(2)})`,
      },
      momentum: {
        score: momentumScore, maxScore: 25, passed: momentumPassed,
        reason: `RSI ${indicators.rsi.toFixed(1)} ${isLong ? `> ${params.rsiBullThreshold} required` : `< ${params.rsiBearThreshold} required`}`,
      },
      macd: {
        score: macdScore, maxScore: 20, passed: macdPassed,
        reason: `MACD ${indicators.macdCrossover !== "none" ? `${indicators.macdCrossover} crossover` : `line ${indicators.macdLine > indicators.macdSignalLine ? "above" : "below"} signal`} | Histogram: ${indicators.macdHistogram.toFixed(6)}`,
      },
      volume: {
        score: volumeScore, maxScore: 15, passed: volumeOk,
        reason: `Volume ${indicators.volumeRatio.toFixed(2)}x average (threshold: ≥${params.volumeMultiplier}x)`,
      },
      ai: {
        score: aiScore, maxScore: 10, passed: aiOk,
        reason: `AI confidence ${aiConfidence}% | Sentiment: ${aiSentiment} (threshold: ≥${params.aiConfidenceThreshold}%)`,
      },
    },
    conditions: [
      { name: "EMA Trend Alignment",  passed: trendPassed,   value: `EMA${params.emaFast}: ${indicators.ema50.toFixed(2)} | EMA${params.emaSlow}: ${indicators.ema200.toFixed(2)}`, required: true },
      { name: "RSI Momentum",         passed: momentumPassed, value: `RSI: ${indicators.rsi.toFixed(1)}`,                                                                          required: true },
      { name: "MACD Crossover",       passed: macdPassed,     value: `${indicators.macdCrossover} | Hist: ${indicators.macdHistogram.toFixed(6)}`,                                 required: true },
      { name: "Volume Confirmation",  passed: volumeOk,       value: `${indicators.volumeRatio.toFixed(2)}x average volume`,                                                       required: true },
      { name: "AI Confidence",        passed: aiOk,           value: `${aiConfidence}% confidence (${aiSentiment})`,                                                               required: true },
    ],
  };
}
