import { Router, type IRouter } from "express";
import { supabase, isOfflineMode } from "../lib/supabase";
import { GetDailyPerformanceQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

const OFFLINE_PERFORMANCE = {
  totalTrades: 0, openTrades: 0, closedTrades: 0, wins: 0, losses: 0,
  winRate: 0, totalPnl: 0, avgWin: 0, avgLoss: 0, profitFactor: 0,
  maxDrawdown: 0, sharpeRatio: 0, expectancy: 0,
};

router.get("/analytics/performance", async (_req, res): Promise<void> => {
  if (isOfflineMode) { res.json(OFFLINE_PERFORMANCE); return; }
  const [{ data: allTrades }, { data: openTrades }] = await Promise.all([
    supabase.from("trades").select("profit_loss, profit_percent, entry_time").eq("status", "closed").order("entry_time"),
    supabase.from("trades").select("id").eq("status", "open"),
  ]);

  const trades = allTrades ?? [];
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

  res.json({
    totalTrades: trades.length + (openTrades ?? []).length,
    openTrades: (openTrades ?? []).length, closedTrades: trades.length,
    wins: wins.length, losses: losses.length,
    winRate: Math.round(winRate * 100) / 100,
    totalPnl: Math.round(totalPnl * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100, avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 1000) / 1000,
    expectancy: Math.round(expectancy * 100) / 100,
  });
});

router.get("/analytics/daily", async (req, res): Promise<void> => {
  if (isOfflineMode) { res.json([]); return; }
  const query = GetDailyPerformanceQueryParams.safeParse(req.query);
  const days = query.success ? (query.data.days ?? 30) : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: trades } = await supabase
    .from("trades").select("profit_loss, exit_time, entry_time")
    .eq("status", "closed").gte("exit_time", since.toISOString());

  const byDay = new Map<string, { pnl: number; trades: number; wins: number; losses: number }>();
  for (const t of trades ?? []) {
    const day = (t.exit_time ?? t.entry_time).slice(0, 10);
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

router.get("/analytics/strategy-comparison", async (_req, res): Promise<void> => {
  if (isOfflineMode) { res.json([]); return; }
  const [{ data: strategies }, { data: trades }] = await Promise.all([
    supabase.from("strategies").select("*"),
    supabase.from("trades").select("strategy_id, profit_loss").eq("status", "closed"),
  ]);

  res.json((strategies ?? []).map(s => {
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
  }));
});

export default router;
