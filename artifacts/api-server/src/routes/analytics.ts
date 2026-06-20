import { Router, type IRouter } from "express";
import { supabase, isOfflineMode } from "../lib/supabase";
import { GetDailyPerformanceQueryParams } from "@workspace/api-zod";
import { computePerformance, computePositions, getClosedTrades } from "../lib/paper-state";

const router: IRouter = Router();

// Helper: check if Supabase trades table exists
async function hasTradesTable(): Promise<boolean> {
  const { error } = await supabase.from("trades").select("id").limit(1);
  return !error || (!error.message?.includes("does not exist") && !error.message?.includes("schema cache"));
}

router.get("/analytics/performance", async (req, res): Promise<void> => {
  if (isOfflineMode) {
    const perf = computePerformance();
    const pos = computePositions();
    res.json({
      totalTrades: perf.totalTrades + pos.length,
      openTrades: pos.length,
      closedTrades: perf.totalTrades,
      wins: perf.wins,
      losses: perf.losses,
      winRate: Math.round(perf.winRate * 100) / 100,
      totalPnl: Math.round(perf.totalPnl * 100) / 100,
      avgWin: Math.round(perf.avgWin * 100) / 100,
      avgLoss: Math.round(perf.avgLoss * 100) / 100,
      profitFactor: Math.round(perf.profitFactor * 100) / 100,
      maxDrawdown: Math.round(perf.maxDrawdownPct * 100) / 100,
      sharpeRatio: Math.round(perf.sharpe * 1000) / 1000,
      expectancy: Math.round(perf.expectancy * 100) / 100,
    });
    return;
  }

  // Always include paper-state data as the base
  const perf = computePerformance();
  const pos = computePositions();

  const tablesExist = await hasTradesTable();
  if (!tablesExist) {
    res.json({
      totalTrades: perf.totalTrades + pos.length,
      openTrades: pos.length,
      closedTrades: perf.totalTrades,
      wins: perf.wins,
      losses: perf.losses,
      winRate: Math.round(perf.winRate * 100) / 100,
      totalPnl: Math.round(perf.totalPnl * 100) / 100,
      avgWin: Math.round(perf.avgWin * 100) / 100,
      avgLoss: Math.round(perf.avgLoss * 100) / 100,
      profitFactor: Math.round(perf.profitFactor * 100) / 100,
      maxDrawdown: Math.round(perf.maxDrawdownPct * 100) / 100,
      sharpeRatio: Math.round(perf.sharpe * 1000) / 1000,
      expectancy: Math.round(perf.expectancy * 100) / 100,
    });
    return;
  }

  // Merge DB trades with paper-state
  const tradeTypeFilter = (req.query.tradeType as string) ?? "all";
  let q = supabase.from("trades").select("profit_loss, profit_percent, entry_time, trade_type").eq("status", "closed").order("entry_time");
  if (tradeTypeFilter !== "all") q = q.eq("trade_type", tradeTypeFilter);

  const [{ data: allTrades }, { data: openTrades }] = await Promise.all([
    q,
    supabase.from("trades").select("id, trade_type").eq("status", "open"),
  ]);

  // Merge DB closed trades + paper closed trades
  const paperClosed = getClosedTrades().map(t => ({ profit_loss: t.pnl, profit_percent: t.pnlPct, entry_time: t.openTime, trade_type: "paper" }));
  const dbClosed = allTrades ?? [];
  const trades = tradeTypeFilter === "all" ? [...dbClosed, ...paperClosed] : dbClosed;

  const wins = trades.filter(t => (t.profit_loss ?? 0) > 0);
  const losses = trades.filter(t => (t.profit_loss ?? 0) <= 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const totalPnl = trades.reduce((s, t) => s + (t.profit_loss ?? 0), 0);
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.profit_loss ?? 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.profit_loss ?? 0), 0) / losses.length) : 0;
  const grossProfit = wins.reduce((s, t) => s + (t.profit_loss ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.profit_loss ?? 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  const expectancy = trades.length > 0 ? (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss : 0;

  let peak = 0, cumPnl = 0, maxDrawdown = 0;
  for (const t of trades) {
    cumPnl += t.profit_loss ?? 0;
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak > 0 ? ((peak - cumPnl) / peak) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const pnls = trades.map(t => t.profit_loss ?? 0);
  const mean = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
  const variance = pnls.length > 1 ? pnls.reduce((s, v) => s + (v - mean) ** 2, 0) / (pnls.length - 1) : 1;
  const sharpeRatio = variance > 0 ? mean / Math.sqrt(variance) : 0;

  const totalOpen = (openTrades ?? []).length + pos.length;

  res.json({
    totalTrades: trades.length + totalOpen,
    openTrades: totalOpen,
    closedTrades: trades.length,
    wins: wins.length, losses: losses.length,
    winRate: Math.round(winRate * 100) / 100,
    totalPnl: Math.round(totalPnl * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 1000) / 1000,
    expectancy: Math.round(expectancy * 100) / 100,
  });
});

router.get("/analytics/daily", async (req, res): Promise<void> => {
  const query = GetDailyPerformanceQueryParams.safeParse(req.query);
  const days = query.success ? (query.data.days ?? 30) : 30;

  if (isOfflineMode) {
    res.json(buildDailyFromPaper(days));
    return;
  }

  const tablesExist = await hasTradesTable();
  if (!tablesExist) {
    res.json(buildDailyFromPaper(days));
    return;
  }

  const tradeTypeFilter = (req.query.tradeType as string) ?? "all";
  const since = new Date();
  since.setDate(since.getDate() - days);

  let q = supabase.from("trades").select("profit_loss, exit_time, entry_time, trade_type")
    .eq("status", "closed").gte("exit_time", since.toISOString());
  if (tradeTypeFilter !== "all") q = q.eq("trade_type", tradeTypeFilter);

  const { data: dbTrades } = await q;

  // Merge DB + paper trades
  const paperClosed = getClosedTrades()
    .filter(t => new Date(t.closeTime) >= since)
    .map(t => ({ profit_loss: t.pnl, exit_time: t.closeTime, entry_time: t.openTime, trade_type: "paper" }));

  const allTrades = tradeTypeFilter === "all"
    ? [...(dbTrades ?? []), ...paperClosed]
    : (dbTrades ?? []);

  const byDay = new Map<string, { pnl: number; trades: number; wins: number; losses: number }>();
  for (const t of allTrades) {
    const day = ((t.exit_time ?? t.entry_time) as string).slice(0, 10);
    const e = byDay.get(day) ?? { pnl: 0, trades: 0, wins: 0, losses: 0 };
    e.pnl += t.profit_loss ?? 0; e.trades += 1;
    if ((t.profit_loss ?? 0) > 0) e.wins += 1; else e.losses += 1;
    byDay.set(day, e);
  }

  const result = [];
  let cumPnl = 0, peak = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const data = byDay.get(day) ?? { pnl: 0, trades: 0, wins: 0, losses: 0 };
    cumPnl += data.pnl;
    if (cumPnl > peak) peak = cumPnl;
    const drawdown = peak > 0 ? ((peak - cumPnl) / peak) * 100 : 0;
    result.push({
      date: day, pnl: Math.round(data.pnl * 100) / 100, trades: data.trades,
      wins: data.wins, losses: data.losses,
      winRate: data.trades > 0 ? Math.round((data.wins / data.trades) * 10000) / 100 : 0,
      cumulativePnl: Math.round(cumPnl * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
    });
  }
  res.json(result);
});

function buildDailyFromPaper(days: number) {
  const closed = getClosedTrades();
  const byDay = new Map<string, { pnl: number; trades: number; wins: number; losses: number }>();
  for (const t of closed) {
    const day = new Date(t.closeTime).toISOString().slice(0, 10);
    const e = byDay.get(day) ?? { pnl: 0, trades: 0, wins: 0, losses: 0 };
    e.pnl += t.pnl; e.trades += 1;
    if (t.pnl > 0) e.wins += 1; else e.losses += 1;
    byDay.set(day, e);
  }
  const result = [];
  let cumPnl = 0, peak = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const data = byDay.get(day) ?? { pnl: 0, trades: 0, wins: 0, losses: 0 };
    cumPnl += data.pnl;
    if (cumPnl > peak) peak = cumPnl;
    const drawdown = peak > 0 ? ((peak - cumPnl) / peak) * 100 : 0;
    result.push({
      date: day, pnl: Math.round(data.pnl * 100) / 100, trades: data.trades,
      wins: data.wins, losses: data.losses,
      winRate: data.trades > 0 ? Math.round((data.wins / data.trades) * 10000) / 100 : 0,
      cumulativePnl: Math.round(cumPnl * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
    });
  }
  return result;
}

router.get("/analytics/strategy-comparison", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    const perf = computePerformance();
    res.json(Object.entries(perf.byStrategy).map(([name, s]) => ({
      strategyId: null, strategyName: name, totalTrades: s.trades,
      winRate: Math.round(s.trades > 0 ? (s.wins / s.trades) * 10000 : 0) / 100,
      totalPnl: Math.round(s.pnl * 100) / 100,
      avgPnl: Math.round((s.trades > 0 ? s.pnl / s.trades : 0) * 100) / 100,
      profitFactor: 0, maxDrawdown: 0,
    })));
    return;
  }

  const tablesExist = await hasTradesTable();

  // Always include paper-state strategy breakdown
  const perf = computePerformance();
  const paperByStrategy = Object.entries(perf.byStrategy).map(([name, s]) => ({
    strategyId: null, strategyName: name, totalTrades: s.trades,
    winRate: Math.round(s.trades > 0 ? (s.wins / s.trades) * 10000 : 0) / 100,
    totalPnl: Math.round(s.pnl * 100) / 100,
    avgPnl: Math.round((s.trades > 0 ? s.pnl / s.trades : 0) * 100) / 100,
    profitFactor: 0, maxDrawdown: 0,
  }));

  if (!tablesExist) { res.json(paperByStrategy); return; }

  const [{ data: strategies }, { data: trades }] = await Promise.all([
    supabase.from("strategies").select("*"),
    supabase.from("trades").select("strategy_id, profit_loss, trade_type").eq("status", "closed"),
  ]);

  const dbByStrategy = (strategies ?? []).map(s => {
    const st = (trades ?? []).filter(t => t.strategy_id === s.id);
    const wins = st.filter(t => (t.profit_loss ?? 0) > 0);
    const losses = st.filter(t => (t.profit_loss ?? 0) <= 0);
    const totalPnl = st.reduce((sum, t) => sum + (t.profit_loss ?? 0), 0);
    const grossProfit = wins.reduce((sum, t) => sum + (t.profit_loss ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.profit_loss ?? 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
    const winRate = st.length > 0 ? (wins.length / st.length) * 100 : 0;
    return {
      strategyId: s.id, strategyName: s.name, totalTrades: st.length,
      winRate: Math.round(winRate * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      avgPnl: st.length > 0 ? Math.round((totalPnl / st.length) * 100) / 100 : 0,
      profitFactor: Math.round(profitFactor * 100) / 100, maxDrawdown: 0,
    };
  });

  // Merge: DB strategies + paper strategies (deduplicate by name)
  const dbNames = new Set(dbByStrategy.map(s => s.strategyName));
  const uniquePaper = paperByStrategy.filter(s => !dbNames.has(s.strategyName));
  res.json([...dbByStrategy, ...uniquePaper].sort((a, b) => b.totalPnl - a.totalPnl));
});

export default router;
