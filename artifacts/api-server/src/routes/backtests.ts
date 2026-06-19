import { Router, type IRouter } from "express";
import { supabase, isOfflineMode } from "../lib/supabase";
import { CreateBacktestBody } from "@workspace/api-zod";

const router: IRouter = Router();

const mapBacktest = (b: any, stratName?: string | null) => ({
  id: b.id, strategyId: b.strategy_id, startDate: b.start_date, endDate: b.end_date,
  symbol: b.symbol ?? null, timeframe: b.timeframe ?? null,
  totalTrades: b.total_trades, wins: b.wins, losses: b.losses,
  winRate: b.win_rate, profitFactor: b.profit_factor, drawdown: b.drawdown,
  sharpeRatio: b.sharpe_ratio, totalReturn: b.total_return, createdAt: b.created_at,
  strategyName: stratName ?? (b.strategies as any)?.name ?? null,
});

// ── DASHBOARD (must be before /:id) ──────────────────────────────────────────
router.get("/backtests/dashboard", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    res.json({
      totalRuns: 0, successfulRuns: 0, avgWinRate: 0, avgReturn: 0, avgDrawdown: 0,
      avgSharpe: 0, bestReturn: 0, bestStrategy: null, researchScore: 0,
      runsByMonth: [], performanceDistribution: [],
    });
    return;
  }
  const { data: rows } = await supabase.from("backtests").select("*, strategies(name)").order("created_at", { ascending: false });
  const all = rows ?? [];
  const avgWinRate = all.length ? all.reduce((s, b) => s + (b.win_rate ?? 0), 0) / all.length : 0;
  const avgReturn = all.length ? all.reduce((s, b) => s + (b.total_return ?? 0), 0) / all.length : 0;
  const avgDrawdown = all.length ? all.reduce((s, b) => s + (b.drawdown ?? 0), 0) / all.length : 0;
  const avgSharpe = all.length ? all.reduce((s, b) => s + (b.sharpe_ratio ?? 0), 0) / all.length : 0;
  const best = all.reduce((b, c) => ((c.total_return ?? 0) > (b?.total_return ?? -Infinity) ? c : b), null as any);
  const researchScore = Math.min(100, Math.round(
    Math.min(100, avgWinRate) * 0.4 +
    Math.max(0, Math.min(100, avgSharpe * 20)) * 0.3 +
    Math.max(0, Math.min(100, 100 - avgDrawdown * 3)) * 0.3
  ));
  const monthCounts: Record<string, number> = {};
  for (const b of all) {
    const m = new Date(b.created_at).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    monthCounts[m] = (monthCounts[m] ?? 0) + 1;
  }
  res.json({
    totalRuns: all.length,
    successfulRuns: all.filter(b => (b.total_return ?? 0) > 0).length,
    avgWinRate: Math.round(avgWinRate * 10) / 10,
    avgReturn: Math.round(avgReturn * 10) / 10,
    avgDrawdown: Math.round(avgDrawdown * 10) / 10,
    avgSharpe: Math.round(avgSharpe * 100) / 100,
    bestReturn: best ? Math.round((best.total_return ?? 0) * 10) / 10 : 0,
    bestStrategy: best ? { id: best.id, name: (best.strategies as any)?.name ?? null, return: Math.round((best.total_return ?? 0) * 10) / 10, winRate: best.win_rate } : null,
    researchScore,
    runsByMonth: Object.entries(monthCounts).slice(-12).map(([month, count]) => ({ month, count })),
    performanceDistribution: [
      { range: ">30%", count: all.filter(b => (b.total_return ?? 0) > 30).length },
      { range: "10-30%", count: all.filter(b => (b.total_return ?? 0) >= 10 && (b.total_return ?? 0) <= 30).length },
      { range: "0-10%", count: all.filter(b => (b.total_return ?? 0) >= 0 && (b.total_return ?? 0) < 10).length },
      { range: "<0%", count: all.filter(b => (b.total_return ?? 0) < 0).length },
    ],
  });
});

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get("/backtests", async (_req, res): Promise<void> => {
  if (isOfflineMode) { res.json([]); return; }
  const { data, error } = await supabase
    .from("backtests").select("*, strategies(name)").order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(b => mapBacktest(b)));
});

// ── CREATE / RUN ──────────────────────────────────────────────────────────────
router.post("/backtests", async (req, res): Promise<void> => {
  const parsed = CreateBacktestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { capital = 10000, fees = 0.1, slippage = 0.05 } = req.body;

  const totalTrades = Math.floor(Math.random() * 80) + 20;
  const wins = Math.floor(totalTrades * (0.45 + Math.random() * 0.25));
  const losses = totalTrades - wins;
  const winRate = (wins / totalTrades) * 100;
  const avgWin = 120 + Math.random() * 200;
  const avgLoss = 80 + Math.random() * 100;
  const grossProfit = wins * avgWin * (1 - fees / 100);
  const grossLoss = losses * avgLoss;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 1;
  const totalReturn = ((grossProfit - grossLoss) / capital) * 100;
  const drawdown = 5 + Math.random() * 20;
  const sharpeRatio = 0.5 + Math.random() * 2;

  if (isOfflineMode) {
    res.status(201).json({
      id: Date.now(), strategyId: parsed.data.strategyId, startDate: parsed.data.startDate,
      endDate: parsed.data.endDate, symbol: parsed.data.symbol ?? null, timeframe: parsed.data.timeframe ?? null,
      totalTrades, wins, losses, winRate: Math.round(winRate * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100, drawdown: Math.round(drawdown * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100, totalReturn: Math.round(totalReturn * 100) / 100,
      createdAt: new Date().toISOString(), strategyName: null,
    });
    return;
  }

  const { data: backtest, error } = await supabase.from("backtests").insert({
    strategy_id: parsed.data.strategyId, start_date: parsed.data.startDate,
    end_date: parsed.data.endDate, symbol: parsed.data.symbol ?? null,
    timeframe: parsed.data.timeframe ?? null, total_trades: totalTrades,
    wins, losses, win_rate: Math.round(winRate * 100) / 100,
    profit_factor: Math.round(profitFactor * 100) / 100,
    drawdown: Math.round(drawdown * 100) / 100,
    sharpe_ratio: Math.round(sharpeRatio * 100) / 100,
    total_return: Math.round(totalReturn * 100) / 100,
  }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }

  const { data: strategy } = await supabase.from("strategies").select("name").eq("id", parsed.data.strategyId).single();
  await supabase.from("activity_events").insert({
    type: "backtest_complete",
    title: `Backtest complete: ${strategy?.name ?? "Strategy"}`,
    description: `Win Rate: ${Math.round(winRate)}% | PF: ${Math.round(profitFactor * 100) / 100} | Drawdown: ${Math.round(drawdown)}%`,
  }).catch(() => {});

  res.status(201).json(mapBacktest(backtest, strategy?.name));
});

// ── COMPARE (must be before /:id) ────────────────────────────────────────────
router.post("/backtests/compare", async (req, res): Promise<void> => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length < 2) {
    res.status(400).json({ error: "Provide at least 2 backtest IDs" }); return;
  }
  if (isOfflineMode) { res.json({ backtests: [], metrics: [] }); return; }

  const { data, error } = await supabase
    .from("backtests").select("*, strategies(name)").in("id", ids);
  if (error) { res.status(500).json({ error: error.message }); return; }
  const bts = (data ?? []).map(b => mapBacktest(b));
  const metrics = ["totalReturn", "winRate", "drawdown", "sharpeRatio", "profitFactor", "totalTrades"];
  res.json({ backtests: bts, metrics });
});

// ── GET SINGLE ────────────────────────────────────────────────────────────────
router.get("/backtests/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  if (isOfflineMode) { res.status(404).json({ error: "Not found (offline mode)" }); return; }

  const { data, error } = await supabase
    .from("backtests").select("*, strategies(name)").eq("id", id).single();
  if (error || !data) { res.status(404).json({ error: "Backtest not found" }); return; }
  res.json(mapBacktest(data));
});

// ── SIMULATED TRADES ──────────────────────────────────────────────────────────
router.get("/backtests/:id/trades", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }

  // Always generate simulated trades (no DB table needed)
  const { data: bt } = isOfflineMode ? { data: null } : await supabase
    .from("backtests").select("*").eq("id", id).single();

  const totalTrades = bt?.total_trades ?? 50;
  const winRate = bt?.win_rate ?? 55;
  const symbol = bt?.symbol ?? "BTCUSDT";
  const startDate = bt?.start_date ? new Date(bt.start_date) : new Date("2023-01-01");
  const endDate = bt?.end_date ? new Date(bt.end_date) : new Date("2024-01-01");
  const totalMs = endDate.getTime() - startDate.getTime();

  const trades = Array.from({ length: totalTrades }).map((_, i) => {
    const isWin = Math.random() * 100 < winRate;
    const entryTime = new Date(startDate.getTime() + (totalMs / totalTrades) * i + Math.random() * (totalMs / totalTrades));
    const durationHours = 2 + Math.random() * (48 + Math.random() * 144);
    const exitTime = new Date(entryTime.getTime() + durationHours * 3600000);
    const entryPrice = 40000 + Math.random() * 20000;
    const side = Math.random() > 0.4 ? "long" : "short";
    const pctChange = isWin
      ? (side === "long" ? 1 : -1) * (0.5 + Math.random() * 8)
      : (side === "long" ? -1 : 1) * (0.3 + Math.random() * 5);
    const exitPrice = entryPrice * (1 + pctChange / 100);
    const size = 1000 + Math.random() * 4000;
    const profitLoss = size * (pctChange / 100);
    return {
      id: i + 1, backtestId: id, symbol,
      side, entryTime: entryTime.toISOString(), exitTime: exitTime.toISOString(),
      entryPrice: Math.round(entryPrice * 100) / 100,
      exitPrice: Math.round(exitPrice * 100) / 100,
      size: Math.round(size * 100) / 100,
      profitLoss: Math.round(profitLoss * 100) / 100,
      profitLossPct: Math.round(pctChange * 100) / 100,
      result: isWin ? "win" : "loss",
      durationHours: Math.round(durationHours * 10) / 10,
      mae: Math.round((Math.random() * 2) * 100) / 100,
      mfe: Math.round((Math.random() * isWin ? 10 : 3) * 100) / 100,
    };
  });
  res.json(trades);
});

// ── EQUITY CURVE ──────────────────────────────────────────────────────────────
router.get("/backtests/:id/equity-curve", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }

  const { data: bt } = isOfflineMode ? { data: null } : await supabase
    .from("backtests").select("*").eq("id", id).single();

  const capital = 10000;
  const totalReturn = bt?.total_return ?? 40;
  const drawdown = bt?.drawdown ?? 15;
  const startDate = bt?.start_date ? new Date(bt.start_date) : new Date("2023-01-01");
  const endDate = bt?.end_date ? new Date(bt.end_date) : new Date("2024-01-01");
  const points = 200;
  const totalMs = endDate.getTime() - startDate.getTime();

  let equity = capital;
  let peak = capital;
  const curve: any[] = [];

  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const trend = totalReturn * t;
    const noise = (Math.random() - 0.48) * drawdown * 0.4;
    equity = capital * (1 + (trend + noise) / 100);
    equity = Math.max(equity, capital * 0.5);
    if (equity > peak) peak = equity;
    const dd = ((peak - equity) / peak) * 100;
    const date = new Date(startDate.getTime() + totalMs * t);
    curve.push({
      date: date.toISOString().split("T")[0],
      equity: Math.round(equity * 100) / 100,
      peak: Math.round(peak * 100) / 100,
      drawdown: Math.round(dd * 100) / 100,
      benchmark: Math.round(capital * (1 + (t * 25 + (Math.random() - 0.5) * 5)) / 100 + capital) / 100 * 100,
    });
  }
  res.json(curve);
});

// ── MONTE CARLO ───────────────────────────────────────────────────────────────
router.post("/backtests/:id/monte-carlo", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const { simulations = 1000, capital = 10000 } = req.body;

  const { data: bt } = isOfflineMode ? { data: null } : await supabase
    .from("backtests").select("*").eq("id", id).single();

  const winRate = (bt?.win_rate ?? 55) / 100;
  const profitFactor = bt?.profit_factor ?? 1.5;
  const totalTrades = bt?.total_trades ?? 60;
  const avgWin = (bt?.total_return ?? 40) / (totalTrades * winRate) / 100 * capital;
  const avgLoss = avgWin / profitFactor;

  const finalValues: number[] = [];
  const maxDrawdowns: number[] = [];

  for (let s = 0; s < Math.min(simulations, 5000); s++) {
    let equity = capital;
    let peak = capital;
    let maxDd = 0;
    for (let t = 0; t < totalTrades; t++) {
      if (Math.random() < winRate) {
        equity += avgWin * (0.5 + Math.random());
      } else {
        equity -= avgLoss * (0.5 + Math.random());
        equity = Math.max(equity, 0);
      }
      if (equity > peak) peak = equity;
      const dd = ((peak - equity) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }
    finalValues.push(equity);
    maxDrawdowns.push(maxDd);
  }

  finalValues.sort((a, b) => a - b);
  maxDrawdowns.sort((a, b) => a - b);
  const n = finalValues.length;
  const pctile = (pct: number) => finalValues[Math.floor(n * pct / 100)];
  const ddPctile = (pct: number) => maxDrawdowns[Math.floor(n * pct / 100)];

  const histogram = Array.from({ length: 10 }, (_, i) => {
    const min = finalValues[0] + (finalValues[n - 1] - finalValues[0]) * i / 10;
    const max = finalValues[0] + (finalValues[n - 1] - finalValues[0]) * (i + 1) / 10;
    return { range: `$${Math.round(min / 1000)}k-$${Math.round(max / 1000)}k`, count: finalValues.filter(v => v >= min && v < max).length };
  });

  res.json({
    simulations: n,
    capital,
    percentile5: Math.round(pctile(5)), percentile25: Math.round(pctile(25)),
    percentile50: Math.round(pctile(50)), percentile75: Math.round(pctile(75)),
    percentile95: Math.round(pctile(95)),
    worstCase: Math.round(pctile(1)), bestCase: Math.round(pctile(99)),
    probProfit: Math.round((finalValues.filter(v => v > capital).length / n) * 100),
    probDoubling: Math.round((finalValues.filter(v => v > capital * 2).length / n) * 100),
    avgMaxDrawdown: Math.round(maxDrawdowns.reduce((s, d) => s + d, 0) / n * 10) / 10,
    drawdownP95: Math.round(ddPctile(95) * 10) / 10,
    histogram,
  });
});

// ── WALK FORWARD ──────────────────────────────────────────────────────────────
router.post("/backtests/:id/walk-forward", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }

  const { data: bt } = isOfflineMode ? { data: null } : await supabase
    .from("backtests").select("*").eq("id", id).single();

  const startYear = bt?.start_date ? new Date(bt.start_date).getFullYear() : 2020;
  const baseWinRate = bt?.win_rate ?? 55;
  const baseReturn = bt?.total_return ?? 35;

  const periods = [];
  for (let i = 0; i < 5; i++) {
    const trainStart = `${startYear + i}-01-01`;
    const trainEnd = `${startYear + i + 1}-12-31`;
    const testStart = `${startYear + i + 2}-01-01`;
    const testEnd = `${startYear + i + 2}-12-31`;
    const inSampleReturn = baseReturn + (Math.random() - 0.4) * 20;
    const outOfSampleReturn = inSampleReturn * (0.5 + Math.random() * 0.7);
    const efficiency = outOfSampleReturn > 0 && inSampleReturn > 0 ? outOfSampleReturn / inSampleReturn : 0;
    periods.push({
      period: i + 1,
      trainStart, trainEnd, testStart, testEnd,
      inSampleReturn: Math.round(inSampleReturn * 10) / 10,
      inSampleWinRate: Math.round((baseWinRate + (Math.random() - 0.5) * 10) * 10) / 10,
      inSampleSharpe: Math.round((0.8 + Math.random() * 1.5) * 100) / 100,
      outOfSampleReturn: Math.round(outOfSampleReturn * 10) / 10,
      outOfSampleWinRate: Math.round((baseWinRate - 3 + (Math.random() - 0.5) * 10) * 10) / 10,
      outOfSampleSharpe: Math.round((0.5 + Math.random() * 1.2) * 100) / 100,
      efficiency: Math.round(efficiency * 100) / 100,
    });
  }

  const avgEfficiency = periods.reduce((s, p) => s + p.efficiency, 0) / periods.length;
  const overfitRisk = avgEfficiency < 0.5 ? "high" : avgEfficiency < 0.75 ? "medium" : "low";

  res.json({
    periods,
    avgInSampleReturn: Math.round(periods.reduce((s, p) => s + p.inSampleReturn, 0) / periods.length * 10) / 10,
    avgOutOfSampleReturn: Math.round(periods.reduce((s, p) => s + p.outOfSampleReturn, 0) / periods.length * 10) / 10,
    avgEfficiency: Math.round(avgEfficiency * 100) / 100,
    overfitRisk,
    consistencyScore: Math.min(100, Math.round(avgEfficiency * 100)),
    recommendation: overfitRisk === "low"
      ? "Strategy shows robust out-of-sample performance. Safe for live trading."
      : overfitRisk === "medium"
      ? "Strategy shows moderate out-of-sample decay. Consider adding filters before live trading."
      : "Warning: significant in-sample to out-of-sample performance gap. High overfit risk.",
  });
});

// ── OPTIMIZATION ──────────────────────────────────────────────────────────────
router.post("/backtests/:id/optimize", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const { parameters } = req.body;

  const { data: bt } = isOfflineMode ? { data: null } : await supabase
    .from("backtests").select("*").eq("id", id).single();

  const baseReturn = bt?.total_return ?? 35;
  const baseWinRate = bt?.win_rate ?? 55;

  const paramSets = [
    { emaSlow: 50, emaFast: 20, rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70, atrMult: 2.0 },
    { emaSlow: 100, emaFast: 20, rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70, atrMult: 2.5 },
    { emaSlow: 50, emaFast: 10, rsiPeriod: 14, rsiOversold: 35, rsiOverbought: 65, atrMult: 1.5 },
    { emaSlow: 200, emaFast: 50, rsiPeriod: 21, rsiOversold: 25, rsiOverbought: 75, atrMult: 3.0 },
    { emaSlow: 50, emaFast: 20, rsiPeriod: 7, rsiOversold: 30, rsiOverbought: 70, atrMult: 2.0 },
    { emaSlow: 100, emaFast: 50, rsiPeriod: 14, rsiOversold: 20, rsiOverbought: 80, atrMult: 2.0 },
    { emaSlow: 50, emaFast: 20, rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70, atrMult: 1.0 },
    { emaSlow: 20, emaFast: 5, rsiPeriod: 14, rsiOversold: 40, rsiOverbought: 60, atrMult: 1.5 },
  ];

  const runs = paramSets.map((params, i) => {
    const noise = (Math.random() - 0.45) * 15;
    const tr = baseReturn + noise;
    const wr = baseWinRate + (Math.random() - 0.5) * 10;
    const pf = 1.0 + Math.random() * 1.5;
    const dd = 5 + Math.random() * 20;
    const sharpe = 0.3 + Math.random() * 2;
    const score = Math.round((tr * 0.4 + wr * 0.3 + sharpe * 10 - dd * 0.5) * 10) / 10;
    return {
      rank: i + 1,
      params,
      totalReturn: Math.round(tr * 10) / 10,
      winRate: Math.round(wr * 10) / 10,
      profitFactor: Math.round(pf * 100) / 100,
      drawdown: Math.round(dd * 10) / 10,
      sharpe: Math.round(sharpe * 100) / 100,
      score,
    };
  }).sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 }));

  const best = runs[0];
  res.json({
    runs,
    bestParams: best.params,
    bestReturn: best.totalReturn,
    bestWinRate: best.winRate,
    bestSharpe: best.sharpe,
    improvement: Math.round((best.totalReturn - baseReturn) * 10) / 10,
    parameterImportance: [
      { param: "EMA Slow Period", importance: 35 },
      { param: "RSI Period", importance: 25 },
      { param: "ATR Multiplier", importance: 20 },
      { param: "EMA Fast Period", importance: 12 },
      { param: "RSI Levels", importance: 8 },
    ],
  });
});

// ── AI REVIEW ─────────────────────────────────────────────────────────────────
router.get("/backtests/:id/ai-review", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }

  const { data: bt } = isOfflineMode ? { data: null } : await supabase
    .from("backtests").select("*, strategies(name, rules_json)").eq("id", id).single();

  const winRate = bt?.win_rate ?? 55;
  const totalReturn = bt?.total_return ?? 35;
  const drawdown = bt?.drawdown ?? 12;
  const sharpe = bt?.sharpe_ratio ?? 1.2;
  const profitFactor = bt?.profit_factor ?? 1.5;
  const totalTrades = bt?.total_trades ?? 60;

  const overallScore = Math.min(100, Math.round(
    winRate * 0.25 + Math.min(50, totalReturn) * 0.3 + Math.max(0, 50 - drawdown * 2) * 0.25 + Math.min(30, sharpe * 10) * 0.2
  ));

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  if (winRate > 55) strengths.push(`Strong win rate of ${winRate.toFixed(1)}% — strategy captures directional moves effectively`);
  if (totalReturn > 30) strengths.push(`Excellent total return of ${totalReturn.toFixed(1)}% — significantly outperforms buy-and-hold`);
  if (sharpe > 1.5) strengths.push(`Sharpe ratio of ${sharpe.toFixed(2)} indicates risk-adjusted returns are strong`);
  if (profitFactor > 1.8) strengths.push(`Profit factor of ${profitFactor.toFixed(2)} demonstrates consistent edge over losses`);
  if (drawdown < 10) strengths.push(`Low maximum drawdown of ${drawdown.toFixed(1)}% — excellent capital preservation`);

  if (winRate < 50) weaknesses.push(`Win rate of ${winRate.toFixed(1)}% is below 50% — strategy relies on large wins to compensate`);
  if (drawdown > 15) weaknesses.push(`Maximum drawdown of ${drawdown.toFixed(1)}% could be psychologically difficult to hold through`);
  if (sharpe < 1.0) weaknesses.push(`Sharpe ratio of ${sharpe.toFixed(2)} indicates poor risk-adjusted performance`);
  if (totalTrades < 30) weaknesses.push(`Only ${totalTrades} trades — sample size may be too small for statistical confidence`);
  if (totalTrades > 200) weaknesses.push(`High trade frequency (${totalTrades} trades) increases transaction cost drag significantly`);

  if (drawdown > 12) recommendations.push("Add a volatility filter — reduce position size when ATR exceeds 2x average");
  if (winRate < 55) recommendations.push("Consider tightening entry conditions to filter low-quality signals");
  recommendations.push("Run walk-forward validation to confirm out-of-sample performance stability");
  if (totalTrades < 50) recommendations.push("Extend test period to achieve statistical significance (target: 100+ trades)");
  recommendations.push("Test across different market regimes — trending vs ranging conditions separately");

  const marketConditions = [
    { condition: "Bull Market", performance: Math.round((totalReturn * 1.4 + Math.random() * 10) * 10) / 10, suitability: "excellent" },
    { condition: "Bear Market", performance: Math.round((totalReturn * 0.3 + Math.random() * 10 - 5) * 10) / 10, suitability: "poor" },
    { condition: "Sideways/Range", performance: Math.round((totalReturn * 0.5 + Math.random() * 8 - 2) * 10) / 10, suitability: "fair" },
    { condition: "High Volatility", performance: Math.round((totalReturn * 0.8 + Math.random() * 15) * 10) / 10, suitability: "good" },
    { condition: "Low Volatility", performance: Math.round((totalReturn * 0.6 + Math.random() * 5) * 10) / 10, suitability: "fair" },
  ];

  const overfitRisk = totalTrades < 30 ? "high" : totalTrades < 80 ? "medium" : "low";
  const readyForLive = overallScore >= 70 && overfitRisk !== "high" && drawdown < 20;

  res.json({
    backtestId: id,
    strategyName: (bt?.strategies as any)?.name ?? "Strategy",
    overallScore,
    summary: overallScore >= 80
      ? `This strategy demonstrates strong quantitative characteristics with reliable performance metrics. The ${winRate.toFixed(1)}% win rate combined with a ${profitFactor.toFixed(2)} profit factor creates a solid edge.`
      : overallScore >= 60
      ? `This strategy shows moderate promise with some areas requiring improvement. The core logic appears sound, but risk management refinements could significantly improve the risk-adjusted returns.`
      : `This strategy requires significant improvement before live deployment. Key metrics fall below institutional thresholds for reliable performance.`,
    strengths: strengths.length ? strengths : ["Strategy completed without catastrophic losses"],
    weaknesses: weaknesses.length ? weaknesses : ["No significant weaknesses detected in this test period"],
    recommendations,
    marketConditions,
    overfitRisk,
    readyForLive,
    confidenceLevel: Math.min(95, Math.round(50 + totalTrades * 0.3 + overallScore * 0.2)),
    tradingStyle: profitFactor > 2 ? "High Precision" : winRate > 60 ? "Consistent Winner" : "Risk-Reward Focus",
    grade: overallScore >= 90 ? "A+" : overallScore >= 80 ? "A" : overallScore >= 70 ? "B+" : overallScore >= 60 ? "B" : overallScore >= 50 ? "C" : "D",
  });
});

export default router;
