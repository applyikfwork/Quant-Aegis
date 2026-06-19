export interface BacktestConfig {
  defaultStartDate: string;
  defaultEndDate: string;
  initialCapital: number;
  commissionRate: number;
  slippagePct: number;
  primaryAsset: string;
  primaryTimeframe: string;
  benchmarkAsset: string;
  warmupPeriod: number;
  walkForward: {
    enabled: boolean;
    inSamplePct: number;
    outOfSamplePct: number;
    windows: number;
  };
  optimization: {
    metric: "sharpe" | "calmar" | "win_rate" | "profit_factor" | "total_return";
    method: "grid" | "genetic" | "walk_forward" | "bayesian";
    maxIterations: number;
  };
  monteCarlo: {
    enabled: boolean;
    iterations: number;
    confidenceLevel: number;
  };
  parameterRanges: Record<string, { min: number; max: number; step: number }>;
}

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  defaultStartDate: "2024-01-01",
  defaultEndDate: "2026-01-01",
  initialCapital: 10000,
  commissionRate: 0.001,
  slippagePct: 0.0005,
  primaryAsset: "BTCUSDT",
  primaryTimeframe: "4h",
  benchmarkAsset: "BTCUSDT",
  warmupPeriod: 200,
  walkForward: {
    enabled: true,
    inSamplePct: 70,
    outOfSamplePct: 30,
    windows: 5,
  },
  optimization: {
    metric: "sharpe",
    method: "walk_forward",
    maxIterations: 1000,
  },
  monteCarlo: {
    enabled: false,
    iterations: 1000,
    confidenceLevel: 95,
  },
  parameterRanges: {
    emaFast:          { min: 20,  max: 100, step: 5 },
    emaSlow:          { min: 100, max: 300, step: 10 },
    rsiPeriod:        { min: 7,   max: 21,  step: 1 },
    rsiBullThreshold: { min: 50,  max: 65,  step: 1 },
    rsiBearThreshold: { min: 35,  max: 50,  step: 1 },
    atrMultiplierSL:  { min: 1.0, max: 3.0, step: 0.5 },
    rrRatio:          { min: 2.0, max: 4.0, step: 0.5 },
    scoreThreshold:   { min: 60,  max: 85,  step: 5 },
  },
};
