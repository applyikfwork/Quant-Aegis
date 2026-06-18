import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tradesTable, strategiesTable } from "@workspace/db";
import {
  GetDailyPerformanceQueryParams,
} from "@workspace/api-zod";
import { eq, and, gte, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/analytics/performance", async (_req, res): Promise<void> => {
  const allTrades = await db.select().from(tradesTable).where(eq(tradesTable.status, "closed"));
  const openTrades = await db.select({ id: tradesTable.id, profitLoss: tradesTable.profitLoss }).from(tradesTable).where(eq(tradesTable.status, "open"));
  const totalClosedTrades = allTrades.length;
  const wins = allTrades.filter((t) => (t.profitLoss ?? 0) > 0);
  const losses = allTrades.filter((t) => (t.profitLoss ?? 0) <= 0);
  const winRate = totalClosedTrades > 0 ? (wins.length / totalClosedTrades) * 100 : 0;
  const totalPnl = allTrades.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0);
  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0) / losses.length) : 0;
  const grossProfit = wins.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  const expectancy = totalClosedTrades > 0 ? (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss : 0;

  // Compute max drawdown from cumulative PnL
  let peak = 0;
  let cumPnl = 0;
  let maxDrawdown = 0;
  for (const t of allTrades.sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime())) {
    cumPnl += t.profitLoss ?? 0;
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak > 0 ? ((peak - cumPnl) / peak) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Simple Sharpe approximation
  const pnls = allTrades.map((t) => t.profitLoss ?? 0);
  const mean = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
  const variance = pnls.length > 1 ? pnls.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (pnls.length - 1) : 1;
  const sharpeRatio = variance > 0 ? mean / Math.sqrt(variance) : 0;

  res.json({
    totalTrades: totalClosedTrades + openTrades.length,
    openTrades: openTrades.length,
    closedTrades: totalClosedTrades,
    wins: wins.length,
    losses: losses.length,
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

  const since = new Date();
  since.setDate(since.getDate() - days);

  const trades = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.status, "closed"), gte(tradesTable.exitTime, since)));

  // Group by day
  const byDay = new Map<string, { pnl: number; trades: number; wins: number; losses: number }>();
  for (const t of trades) {
    const day = (t.exitTime ?? t.entryTime).toISOString().slice(0, 10);
    const existing = byDay.get(day) ?? { pnl: 0, trades: 0, wins: 0, losses: 0 };
    existing.pnl += t.profitLoss ?? 0;
    existing.trades += 1;
    if ((t.profitLoss ?? 0) > 0) existing.wins += 1;
    else existing.losses += 1;
    byDay.set(day, existing);
  }

  // Fill in missing days and build cumulative
  const result = [];
  let cumPnl = 0;
  let peak = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const data = byDay.get(day) ?? { pnl: 0, trades: 0, wins: 0, losses: 0 };
    cumPnl += data.pnl;
    if (cumPnl > peak) peak = cumPnl;
    const drawdown = peak > 0 ? ((peak - cumPnl) / peak) * 100 : 0;
    result.push({
      date: day,
      pnl: Math.round(data.pnl * 100) / 100,
      trades: data.trades,
      wins: data.wins,
      losses: data.losses,
      winRate: data.trades > 0 ? Math.round((data.wins / data.trades) * 10000) / 100 : 0,
      cumulativePnl: Math.round(cumPnl * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
    });
  }

  res.json(result);
});

router.get("/analytics/strategy-comparison", async (_req, res): Promise<void> => {
  const strategies = await db.select().from(strategiesTable);
  const trades = await db.select().from(tradesTable).where(eq(tradesTable.status, "closed"));

  const result = strategies.map((s) => {
    const st = trades.filter((t) => t.strategyId === s.id);
    const wins = st.filter((t) => (t.profitLoss ?? 0) > 0);
    const losses = st.filter((t) => (t.profitLoss ?? 0) <= 0);
    const totalPnl = st.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0);
    const avgPnl = st.length > 0 ? totalPnl / st.length : 0;
    const grossProfit = wins.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
    const winRate = st.length > 0 ? (wins.length / st.length) * 100 : 0;

    // Max drawdown
    let peak = 0;
    let cumPnl = 0;
    let maxDrawdown = 0;
    for (const t of st) {
      cumPnl += t.profitLoss ?? 0;
      if (cumPnl > peak) peak = cumPnl;
      const dd = peak > 0 ? ((peak - cumPnl) / peak) * 100 : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    return {
      strategyId: s.id,
      strategyName: s.name,
      totalTrades: st.length,
      winRate: Math.round(winRate * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      avgPnl: Math.round(avgPnl * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    };
  });

  res.json(result);
});

export default router;
