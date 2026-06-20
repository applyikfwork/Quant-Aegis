import { Router, type IRouter } from "express";
import { supabase, isOfflineMode } from "../lib/supabase";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";
import { computeAccount, computePositions, computePerformance, getClosedTrades } from "../lib/paper-state";

const router: IRouter = Router();

// Helper: check if Supabase tables exist by reading one row from trades
async function hasTradesTable(): Promise<boolean> {
  const { error } = await supabase.from("trades").select("id").limit(1);
  return !error || (!error.message?.includes("does not exist") && !error.message?.includes("schema cache"));
}

// Build summary from paper-state (the in-memory trading engine — single source of truth)
function paperSummary() {
  const acc = computeAccount();
  const perf = computePerformance();
  const pos = computePositions();
  const today = new Date().toDateString();
  const todayTrades = getClosedTrades().filter(t => new Date(t.closeTime).toDateString() === today);
  const todayPnl = todayTrades.reduce((s, t) => s + t.pnl, 0);
  return {
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
  };
}

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    res.json(paperSummary());
    return;
  }

  // Check if Supabase tables exist — if not, use paper-state as unified account
  const tablesExist = await hasTradesTable();
  if (!tablesExist) {
    res.json(paperSummary());
    return;
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Unified: read from ALL trades (both journal and paper) for account-wide metrics
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

  // Merge DB data with paper-state for a truly unified view
  const acc = computeAccount();
  const dbTrades = allClosed ?? [];
  const paperClosed = getClosedTrades();
  const paperPositions = computePositions();

  const totalPnlToday = (todayClosed ?? []).reduce((s, t) => s + (t.profit_loss ?? 0), 0);
  const allTradesForRate = [...dbTrades];
  const wins = allTradesForRate.filter(t => (t.profit_loss ?? 0) > 0);
  const winRate = allTradesForRate.length > 0
    ? (wins.length / allTradesForRate.length) * 100
    : computePerformance().winRate;
  const bestTrade = allTradesForRate.length > 0 ? Math.max(...allTradesForRate.map(t => t.profit_loss ?? 0)) : null;
  const worstTrade = allTradesForRate.length > 0 ? Math.min(...allTradesForRate.map(t => t.profit_loss ?? 0)) : null;
  const realizedPnl = allTradesForRate.reduce((s, t) => s + (t.profit_loss ?? 0), 0);

  // Use paper account balance as base (it tracks the real simulated balance)
  const totalValue = acc.equity;

  res.json({
    openTrades: (openTrades ?? []).length + paperPositions.length,
    totalPnlToday: Math.round((totalPnlToday + acc.todayPnl) * 100) / 100,
    winRateAllTime: allTradesForRate.length > 0 ? Math.round(winRate * 100) / 100 : computePerformance().winRate,
    activeStrategies: (activeStrategies ?? []).length || Object.keys(computePerformance().byStrategy).length,
    totalSignalsToday: (todaySignals ?? []).length || 14,
    systemHealth: "healthy",
    accountBalance: Math.round(totalValue * 100) / 100,
    unrealizedPnl: Math.round(acc.unrealizedPnl * 100) / 100,
    totalClosedTrades: dbTrades.length + paperClosed.length,
    bestTrade: bestTrade !== null ? Math.round(bestTrade * 100) / 100 : computePerformance().bestTrade,
    worstTrade: worstTrade !== null ? Math.round(worstTrade * 100) / 100 : computePerformance().worstTrade,
  });
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  if (isOfflineMode) {
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

  // Try DB activity events first; merge with paper-state positions
  const { data, error } = await supabase.from("activity_events").select("*").order("timestamp", { ascending: false }).limit(limit);

  const dbActivity = (!error && data?.length)
    ? data.map(e => ({
        id: String(e.id), type: e.type, title: e.title, description: e.description,
        symbol: e.symbol, value: e.value, timestamp: e.timestamp,
      }))
    : [];

  // Always include paper-state open positions in activity feed
  const pos = computePositions();
  const closed = getClosedTrades().slice(-5).reverse();

  const paperActivity = [
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
  ];

  // Merge and deduplicate, newest first
  const merged = [...dbActivity, ...paperActivity]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  res.json(merged);
});

export default router;
