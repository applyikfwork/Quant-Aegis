export interface Strategy002Parameters {
  bollingerPeriod: number;
  bollingerDeviation: number;
  atrPeriod: number;
  atrMultiplierSL: number;
  atrMultiplierTP: number;
  volumePeriod: number;
  volumeMultiplier: number;
  aiConfidenceThreshold: number;
  confirmationCandles: number;
  trailingStop: boolean;
  trailingActivationMultiplier: number;
  trailingDistanceMultiplier: number;
  riskPerTrade: number;
  maxPositions: number;
  maxDrawdown: number;
  scoreThreshold: number;
  compressionThreshold: number;
}

export const DEFAULT_PARAMETERS: Strategy002Parameters = {
  bollingerPeriod: 20,
  bollingerDeviation: 2.0,
  atrPeriod: 14,
  atrMultiplierSL: 1.5,
  atrMultiplierTP: 4.0,
  volumePeriod: 20,
  volumeMultiplier: 1.5,
  aiConfidenceThreshold: 75,
  confirmationCandles: 1,
  trailingStop: true,
  trailingActivationMultiplier: 1.5,
  trailingDistanceMultiplier: 1.0,
  riskPerTrade: 1.5,
  maxPositions: 3,
  maxDrawdown: 20,
  scoreThreshold: 75,
  compressionThreshold: 0.03,
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

export const PARAMETER_METADATA: Record<keyof Strategy002Parameters, ParameterMeta> = {
  bollingerPeriod:              { label: "Bollinger Period",           description: "Bollinger bands lookback period",                      min: 10,  max: 50,  step: 1,   group: "Bollinger" },
  bollingerDeviation:           { label: "Bollinger Deviation",        description: "Standard deviations for band width",                   min: 1.5, max: 3.0, step: 0.1, group: "Bollinger" },
  atrPeriod:                    { label: "ATR Period",                 description: "ATR calculation lookback",                             min: 7,   max: 28,  step: 1,   group: "Volatility" },
  atrMultiplierSL:              { label: "ATR Stop Multiplier",        description: "Stop loss = ATR × this value",                        min: 0.5, max: 3.0, step: 0.5, group: "Risk" },
  atrMultiplierTP:              { label: "ATR Take Profit Multiplier", description: "Take profit = ATR × this value",                      min: 2.0, max: 8.0, step: 0.5, group: "Risk" },
  volumePeriod:                 { label: "Volume MA Period",           description: "Volume moving average lookback",                       min: 10,  max: 50,  step: 1,   group: "Volume" },
  volumeMultiplier:             { label: "Volume Spike Multiplier",    description: "Volume must exceed avg × this value",                 min: 1.0, max: 4.0, step: 0.1, group: "Volume" },
  aiConfidenceThreshold:        { label: "AI Confidence Threshold",    description: "Minimum AI confidence % to allow trade",              min: 60,  max: 95,  step: 5,   group: "AI",   unit: "%" },
  confirmationCandles:          { label: "Confirmation Candles",       description: "Candles to wait after breakout for confirmation",      min: 0,   max: 3,   step: 1,   group: "Entry" },
  trailingStop:                 { label: "Trailing Stop Enabled",      description: "Enable trailing stop after activation level",          min: 0,   max: 1,   step: 1,   group: "Exit" },
  trailingActivationMultiplier: { label: "Trailing Activation ATR×",  description: "Activate trailing after this ATR profit",             min: 1.0, max: 3.0, step: 0.5, group: "Exit" },
  trailingDistanceMultiplier:   { label: "Trailing Distance ATR×",    description: "Trail at this ATR distance from price",               min: 0.5, max: 2.0, step: 0.5, group: "Exit" },
  riskPerTrade:                 { label: "Risk Per Trade",             description: "Account % risked per trade",                          min: 0.5, max: 3.0, step: 0.5, group: "Risk", unit: "%" },
  maxPositions:                 { label: "Max Open Positions",         description: "Maximum simultaneous breakout trades",                 min: 1,   max: 5,   step: 1,   group: "Risk" },
  maxDrawdown:                  { label: "Max Drawdown",               description: "Strategy pauses at this drawdown level",              min: 5,   max: 30,  step: 1,   group: "Risk", unit: "%" },
  scoreThreshold:               { label: "Score Threshold",            description: "Minimum score (0-100) to execute trade",              min: 60,  max: 95,  step: 5,   group: "Engine" },
  compressionThreshold:         { label: "Compression Threshold",      description: "BB width below this = compression detected",          min: 0.01, max: 0.1, step: 0.005, group: "Bollinger" },
};
