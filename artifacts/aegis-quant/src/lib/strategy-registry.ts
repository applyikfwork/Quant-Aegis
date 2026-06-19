export interface StrategyLayer {
  name: string;
  indicator: string;
  maxPoints: number;
  description: string;
}

export interface StrategyIndicatorDef {
  name: string;
  type: string;
  layer: string;
  weight: number;
  description: string;
  period?: number;
}

export interface StrategyRiskRules {
  riskPerTrade: number;
  maxPositions: number;
  maxDrawdown: number;
  dailyLossLimit: number;
  positionSizing: string;
}

export interface StrategyModuleDef {
  id: string;
  moduleFolder: string;
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
  complexity: "Beginner" | "Intermediate" | "Advanced";
  estimatedWinRate: number;
  estimatedRR: number;
  estimatedSharpe: number;
  minAccountSize: number;
  connections: string[];
  scoreSystem: {
    maxScore: number;
    threshold: number;
    layers: StrategyLayer[];
  };
  indicators: StrategyIndicatorDef[];
  entryRules: { long: string[]; short: string[] };
  exitRules: {
    takeProfit: string;
    stopLoss: string;
    trailingStop?: boolean;
    trailingActivation?: string;
    trailingDistance?: string;
  };
  riskRules: StrategyRiskRules;
  color: string;
  icon: "TrendingUp" | "Zap";
  riskRulesList: string[];
}

export const STRATEGY_REGISTRY: StrategyModuleDef[] = [
  {
    id: "strategy_001",
    moduleFolder: "strategy_001_adaptive_trend_engine",
    name: "Adaptive AI Trend Fusion Engine",
    shortName: "AATFE",
    version: "1.0.0",
    category: "Trend Following",
    subcategory: "Multi-Timeframe Momentum",
    description: "Multi-timeframe trend following with momentum confirmation and AI sentiment overlay. Captures large market movements using a 5-layer scoring system (Trend + Momentum + MACD + Volume + AI). Designed for strong trending markets.",
    tags: ["trend", "momentum", "multi-timeframe", "ai-enhanced", "ema", "rsi", "macd"],
    supportedAssets: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "AVAXUSDT", "DOGEUSDT"],
    supportedTimeframes: ["1h", "4h", "1d"],
    primaryTimeframe: "4h",
    bestMarketConditions: ["Strong Trending", "Momentum Driven", "Post-Consolidation Breakout"],
    avoidConditions: ["Sideways", "Ranging", "Low Volatility", "Choppy"],
    complexity: "Intermediate",
    estimatedWinRate: 52,
    estimatedRR: 3.0,
    estimatedSharpe: 1.4,
    minAccountSize: 500,
    connections: ["AI Center", "Risk Center", "Analytics", "Portfolio", "Paper Trading"],
    color: "blue",
    icon: "TrendingUp",
    scoreSystem: {
      maxScore: 100,
      threshold: 70,
      layers: [
        { name: "Trend", indicator: "EMA 50 / EMA 200", maxPoints: 30, description: "EMA50 > EMA200 = bullish trend confirmed" },
        { name: "Momentum", indicator: "RSI 14", maxPoints: 25, description: "RSI > 55 bullish / RSI < 45 bearish" },
        { name: "MACD", indicator: "MACD (12,26,9)", maxPoints: 20, description: "MACD line crossover confirmation" },
        { name: "Volume", indicator: "Volume MA (20)", maxPoints: 15, description: "Current volume > average volume" },
        { name: "AI", indicator: "AI Confidence", maxPoints: 10, description: "AI confidence >= threshold" },
      ],
    },
    indicators: [
      { name: "EMA 50", period: 50, type: "EMA", layer: "Trend", weight: 30, description: "Medium-term trend direction" },
      { name: "EMA 200", period: 200, type: "EMA", layer: "Trend", weight: 0, description: "Major trend / golden cross" },
      { name: "RSI 14", period: 14, type: "RSI", layer: "Momentum", weight: 25, description: "Overbought/oversold momentum" },
      { name: "MACD (12,26,9)", type: "MACD", layer: "MACD", weight: 20, description: "Trend momentum crossover" },
      { name: "Volume MA (20)", period: 20, type: "VolumeMA", layer: "Volume", weight: 15, description: "Volume confirmation" },
      { name: "ATR 14", period: 14, type: "ATR", layer: "Risk", weight: 0, description: "Dynamic stop loss" },
    ],
    entryRules: {
      long: [
        "EMA 50 > EMA 200 (bullish golden cross zone)",
        "RSI > 55 (bullish momentum confirmed)",
        "MACD line crosses above signal line",
        "Volume > average volume (×1.0 multiplier)",
        "AI confidence ≥ 65%",
      ],
      short: [
        "EMA 50 < EMA 200 (bearish death cross zone)",
        "RSI < 45 (bearish momentum confirmed)",
        "MACD line crosses below signal line",
        "Volume > average volume (×1.0 multiplier)",
        "AI confidence ≥ 65%",
      ],
    },
    exitRules: {
      takeProfit: "Entry ± (ATR × 2.0 × RR 3.0) → 1:3 target",
      stopLoss: "Entry ∓ (ATR × 2.0) — dynamic",
      trailingStop: false,
    },
    riskRules: {
      riskPerTrade: 1.0,
      maxPositions: 5,
      maxDrawdown: 15,
      dailyLossLimit: 3,
      positionSizing: "ATR-based fixed fractional",
    },
    riskRulesList: [
      "Risk per trade: 1% of account balance (adjustable 0.5–3%)",
      "Maximum 5 simultaneous open positions",
      "Maximum drawdown: 15% — strategy auto-pauses",
      "Stop loss required on every entry (ATR × 2.0)",
      "No averaging down — one position per signal",
      "Daily loss limit: 3% — trading halted until next session",
      "Correlation check: avoid >3 correlated assets simultaneously",
      "Reduce position size 50% after 3 consecutive losses",
    ],
  },
  {
    id: "strategy_002",
    moduleFolder: "strategy_002_volatility_breakout_engine",
    name: "Volatility Breakout Intelligence Engine",
    shortName: "VBIE",
    version: "1.0.0",
    category: "Breakout",
    subcategory: "Volatility Expansion",
    description: "Captures explosive breakout moves using Bollinger Band compression/expansion with ATR volatility confirmation and AI regime detection. Optimized for news events, momentum breakouts, and volatility expansion periods.",
    tags: ["breakout", "volatility", "bollinger", "atr", "ai-enhanced", "momentum"],
    supportedAssets: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "AVAXUSDT"],
    supportedTimeframes: ["15m", "1h", "4h"],
    primaryTimeframe: "1h",
    bestMarketConditions: ["Volatility Expansion", "News Breakouts", "Range Compression Release"],
    avoidConditions: ["Low Volume", "Extreme Overextension", "Known Manipulation Zones"],
    complexity: "Advanced",
    estimatedWinRate: 48,
    estimatedRR: 4.0,
    estimatedSharpe: 1.6,
    minAccountSize: 1000,
    connections: ["AI Center", "Risk Center", "Analytics", "Portfolio", "Research Lab", "Paper Trading"],
    color: "purple",
    icon: "Zap",
    scoreSystem: {
      maxScore: 100,
      threshold: 75,
      layers: [
        { name: "Breakout Strength", indicator: "Bollinger Bands (20,2)", maxPoints: 30, description: "Price closes outside Bollinger Band" },
        { name: "Volume Spike", indicator: "Volume / Volume MA", maxPoints: 25, description: "Volume ≥ 1.5x average" },
        { name: "ATR Expansion", indicator: "ATR 14", maxPoints: 20, description: "ATR increasing vs recent average" },
        { name: "AI Regime", indicator: "AI Confidence", maxPoints: 25, description: "AI confidence >= 75%" },
      ],
    },
    indicators: [
      { name: "Bollinger Bands (20,2)", period: 20, type: "BollingerBands", layer: "Breakout", weight: 30, description: "Band compression before breakout" },
      { name: "ATR 14", period: 14, type: "ATR", layer: "Volatility", weight: 20, description: "Dynamic position sizing and stops" },
      { name: "Volume MA (20)", period: 20, type: "VolumeMA", layer: "Volume", weight: 25, description: "Volume spike detection" },
    ],
    entryRules: {
      long: [
        "Price closes above Bollinger upper band",
        "Volume ≥ 1.5x the 20-period volume average",
        "ATR is increasing (volatility expanding)",
        "AI confidence ≥ 75%",
        "Wait 1 candle close confirmation (anti-fake-out)",
      ],
      short: [
        "Price closes below Bollinger lower band",
        "Volume ≥ 1.5x the 20-period volume average",
        "ATR is increasing (volatility expanding)",
        "AI confidence ≥ 75%",
        "Wait 1 candle close confirmation",
      ],
    },
    exitRules: {
      takeProfit: "Entry ± (ATR × 4.0)",
      stopLoss: "Entry ∓ (ATR × 1.5) — tight breakout stop",
      trailingStop: true,
      trailingActivation: "After ATR × 1.5 profit",
      trailingDistance: "ATR × 1.0 from peak",
    },
    riskRules: {
      riskPerTrade: 1.5,
      maxPositions: 3,
      maxDrawdown: 20,
      dailyLossLimit: 4,
      positionSizing: "ATR-dynamic fractional",
    },
    riskRulesList: [
      "Risk per trade: 1.5% of account balance (adjustable 0.5–3%)",
      "Maximum 3 simultaneous breakout positions",
      "Maximum drawdown: 20% — strategy auto-pauses",
      "Stop loss: ATR × 1.5 (tight breakout stop)",
      "Trailing stop activates after ATR × 1.5 profit",
      "Wait 1 candle close before entry (anti-fakeout)",
      "Daily loss limit: 4% — session halted",
      "No entry during first 5 minutes of major hourly candles",
    ],
  },
];

export function getStrategyById(id: string): StrategyModuleDef | undefined {
  return STRATEGY_REGISTRY.find(s => s.id === id);
}
