import { Router, type IRouter } from "express";
import { supabase, isOfflineMode } from "../lib/supabase";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";
import { computeAccount, computePositions, computePerformance, getClosedTrades } from "../lib/paper-state";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    const acc = computeAccount();
    const perf = computePerformance();
    const pos = computePositions();
    const today = new Date().toDateString();
    const todayTrades = getClosedTrades().filter(t => new Date(t.closeTime).toDateString() === today);
    const todayPnl = todayTrades.reduce((s, t) => s + t.pnl, 0);

    res.json({
      openTrades: pos.length,
      totalPnlToday: Math.round(todayPnl * 100) / 100,
      winRateAllTime: perf.winRate,
      activeStrategies: Object.keys(perf.byStrategy).length,
      totalSignalsToday: 14,
      systemHealth: "healthy",
      accountBalance: acc.equity,
      unrealizedPnl: acc.unrealizedPnl,
      totalClosedTrades: perf.totalTrades,
      bestTrade: perf.totalTrades > 0 ? perf.bestTrade : null,
      worstTrade: perf.totalTrades > 0 ? perf.worstTrade : null,
    });
    return;
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    { data: allClosed },
    { data: openTrades },
    { data: todayClosed },
    { data: activeStrategies },
    { data: todaySignals },
  ] = await Promise.all([
    supabase.from("trades").select("profit_loss").eq("status", "closed"),
    supabase.from("trades").select("id").eq("status", "open"),
    supabase.from("trades").select("profit_loss").eq("status", "closed").gte("exit_time", startOfDay.toISOString()),
    supabase.from("strategies").select("id").eq("active", true),
    supabase.from("signals").select("id").gte("created_at", startOfDay.toISOString()),
  ]);

  const allTrades = allClosed ?? [];
  const totalPnlToday = (todayClosed ?? []).reduce((s, t) => s + (t.profit_loss ?? 0), 0);
  const wins = allTrades.filter(t => (t.profit_loss ?? 0) > 0);
  const winRate = allTrades.length > 0 ? (wins.length / allTrades.length) * 100 : 0;
  const bestTrade = allTrades.length > 0 ? Math.max(...allTrades.map(t => t.profit_loss ?? 0)) : null;
  const worstTrade = allTrades.length > 0 ? Math.min(...allTrades.map(t => t.profit_loss ?? 0)) : null;
  const totalValue = allTrades.reduce((s, t) => s + (t.profit_loss ?? 0), 0) + 10000;

  res.json({
    openTrades: (openTrades ?? []).length,
    totalPnlToday: Math.round(totalPnlToday * 100) / 100,
    winRateAllTime: Math.round(winRate * 100) / 100,
    activeStrategies: (activeStrategies ?? []).length,
    totalSignalsToday: (todaySignals ?? []).length,
    systemHealth: "healthy",
    accountBalance: Math.round(totalValue * 100) / 100,
    unrealizedPnl: 0,
    totalClosedTrades: allTrades.length,
    bestTrade: bestTrade !== null ? Math.round(bestTrade * 100) / 100 : null,
    worstTrade: worstTrade !== null ? Math.round(worstTrade * 100) / 100 : null,
  });
});

router.get("/dashboard/recent-activity", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    // Generate activity from paper trading state
    const pos = computePositions();
    const closed = getClosedTrades().slice(-10).reverse();

    const activity = [
      ...pos.map(p => ({
        id: p.id,
        type: "position_open",
        title: `Position Opened: ${p.symbol}`,
        description: `${p.side.toUpperCase()} ${p.quantity} ${p.symbol} at $${p.entryPrice.toLocaleString()} via ${p.strategy}`,
        symbol: p.symbol,
        value: p.unrealizedPnl,
        timestamp: p.openTime,
      })),
      ...closed.map(t => ({
        id: t.id,
        type: t.pnl > 0 ? "trade_win" : "trade_loss",
        title: `Trade Closed: ${t.symbol}`,
        description: `${t.side.toUpperCase()} ${t.quantity} ${t.symbol} — ${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)} (${t.exitReason.toUpperCase()})`,
        symbol: t.symbol,
        value: t.pnl,
        timestamp: t.closeTime,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20);

    res.json(activity);
    return;
  }

  const query = GetRecentActivityQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 20) : 20;
  const { data, error } = await supabase.from("activity_events").select("*").order("timestamp", { ascending: false }).limit(limit);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(e => ({
    id: e.id, type: e.type, title: e.title, description: e.description,
    symbol: e.symbol, value: e.value, timestamp: e.timestamp,
  })));
});

export default router;
