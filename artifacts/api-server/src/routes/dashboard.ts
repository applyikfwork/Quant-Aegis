import { Router, type IRouter } from "express";
import { supabase, isOfflineMode } from "../lib/supabase";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    res.json({ openTrades: 0, totalPnlToday: 0, winRateAllTime: 0, activeStrategies: 0, totalSignalsToday: 0, systemHealth: "healthy", accountBalance: 10000, unrealizedPnl: 0, totalClosedTrades: 0, bestTrade: null, worstTrade: null });
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

  res.json({
    openTrades: (openTrades ?? []).length,
    totalPnlToday: Math.round(totalPnlToday * 100) / 100,
    winRateAllTime: Math.round(winRate * 100) / 100,
    activeStrategies: (activeStrategies ?? []).length,
    totalSignalsToday: (todaySignals ?? []).length,
    systemHealth: "healthy",
    accountBalance: 10000,
    unrealizedPnl: 0,
    totalClosedTrades: allTrades.length,
    bestTrade: bestTrade !== null ? Math.round(bestTrade * 100) / 100 : null,
    worstTrade: worstTrade !== null ? Math.round(worstTrade * 100) / 100 : null,
  });
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  if (isOfflineMode) { res.json([]); return; }
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
