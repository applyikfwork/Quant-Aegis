export interface Strategy001Parameters {
  emaFast: number;
  emaSlow: number;
  rsiPeriod: number;
  rsiBullThreshold: number;
  rsiBearThreshold: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  volumePeriod: number;
  volumeMultiplier: number;
  aiConfidenceThreshold: number;
  atrPeriod: number;
  atrMultiplierSL: number;
  rrRatio: number;
  riskPerTrade: number;
  maxPositions: number;
  maxDrawdown: number;
  scoreThreshold: number;
}

export const DEFAULT_PARAMETERS: Strategy001Parameters = {
  emaFast: 50,
  emaSlow: 200,
  rsiPeriod: 14,
  rsiBullThreshold: 55,
  rsiBearThreshold: 45,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  volumePeriod: 20,
  volumeMultiplier: 1.0,
  aiConfidenceThreshold: 65,
  atrPeriod: 14,
  atrMultiplierSL: 2.0,
  rrRatio: 3.0,
  riskPerTrade: 1.0,
  maxPositions: 5,
  maxDrawdown: 15,
  scoreThreshold: 70,
};

export interface ParameterMeta {
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  group: string;
  unit?: string;
}

export const PARAMETER_METADATA: Record<keyof Strategy001Parameters, ParameterMeta> = {
  emaFast:              { label: "EMA Fast Period",        description: "Medium-term trend EMA",                      min: 10,  max: 100,  step: 1,   group: "Trend" },
  emaSlow:              { label: "EMA Slow Period",        description: "Major trend / golden cross EMA",             min: 50,  max: 500,  step: 5,   group: "Trend" },
  rsiPeriod:            { label: "RSI Period",             description: "RSI calculation lookback",                   min: 7,   max: 28,   step: 1,   group: "Momentum" },
  rsiBullThreshold:     { label: "RSI Bull Threshold",     description: "RSI level confirming bullish momentum",      min: 50,  max: 70,   step: 1,   group: "Momentum" },
  rsiBearThreshold:     { label: "RSI Bear Threshold",     description: "RSI level confirming bearish momentum",      min: 30,  max: 50,   step: 1,   group: "Momentum" },
  macdFast:             { label: "MACD Fast EMA",          description: "MACD fast period",                           min: 8,   max: 20,   step: 1,   group: "MACD" },
  macdSlow:             { label: "MACD Slow EMA",          description: "MACD slow period",                           min: 20,  max: 40,   step: 1,   group: "MACD" },
  macdSignal:           { label: "MACD Signal Period",     description: "MACD signal line period",                    min: 5,   max: 15,   step: 1,   group: "MACD" },
  volumePeriod:         { label: "Volume MA Period",       description: "Volume moving average lookback",             min: 10,  max: 50,   step: 1,   group: "Volume" },
  volumeMultiplier:     { label: "Volume Multiplier",      description: "Volume must exceed avg × this",             min: 0.8, max: 3.0,  step: 0.1, group: "Volume" },
  aiConfidenceThreshold:{ label: "AI Confidence Threshold",description: "Minimum AI confidence % to allow trade",    min: 50,  max: 90,   step: 5,   group: "AI",   unit: "%" },
  atrPeriod:            { label: "ATR Period",             description: "ATR lookback for stop loss sizing",          min: 7,   max: 28,   step: 1,   group: "Risk" },
  atrMultiplierSL:      { label: "ATR Stop Multiplier",   description: "Stop loss = ATR × this value",              min: 1.0, max: 4.0,  step: 0.5, group: "Risk" },
  rrRatio:              { label: "Risk:Reward Ratio",      description: "Take profit = SL distance × ratio",         min: 1.5, max: 5.0,  step: 0.5, group: "Risk" },
  riskPerTrade:         { label: "Risk Per Trade",         description: "Account % risked per trade",                min: 0.5, max: 3.0,  step: 0.5, group: "Risk",  unit: "%" },
  maxPositions:         { label: "Max Open Positions",     description: "Maximum simultaneous open trades",           min: 1,   max: 10,   step: 1,   group: "Risk" },
  maxDrawdown:          { label: "Max Drawdown",           description: "Strategy pauses at this drawdown level",    min: 5,   max: 30,   step: 1,   group: "Risk",  unit: "%" },
  scoreThreshold:       { label: "Score Threshold",        description: "Minimum score (0-100) to execute trade",    min: 50,  max: 95,   step: 5,   group: "Engine" },
};
