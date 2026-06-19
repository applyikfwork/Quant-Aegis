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
  breakoutConfirmation: number;
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
  slippagePct: 0.001,
  primaryAsset: "BTCUSDT",
  primaryTimeframe: "1h",
  benchmarkAsset: "BTCUSDT",
  warmupPeriod: 50,
  breakoutConfirmation: 1,
  walkForward: {
    enabled: true,
    inSamplePct: 70,
    outOfSamplePct: 30,
    windows: 5,
  },
  optimization: {
    metric: "profit_factor",
    method: "genetic",
    maxIterations: 2000,
  },
  monteCarlo: {
    enabled: true,
    iterations: 1000,
    confidenceLevel: 95,
  },
  parameterRanges: {
    bollingerPeriod:    { min: 15,  max: 30,  step: 1 },
    bollingerDeviation: { min: 1.5, max: 2.5, step: 0.1 },
    atrMultiplierSL:    { min: 1.0, max: 2.5, step: 0.5 },
    atrMultiplierTP:    { min: 2.5, max: 6.0, step: 0.5 },
    volumeMultiplier:   { min: 1.2, max: 2.5, step: 0.1 },
    scoreThreshold:     { min: 65,  max: 85,  step: 5 },
  },
};
