import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tradesTable, signalsTable, strategiesTable, activityEventsTable } from "@workspace/db";
import {
  GetRecentActivityQueryParams,
  GetRecentActivityResponse,
} from "@workspace/api-zod";
import { eq, desc, gte, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [allTrades, openTrades, todayClosedTrades, activeStrategies, todaySignals] = await Promise.all([
    db.select().from(tradesTable).where(eq(tradesTable.status, "closed")),
    db.select().from(tradesTable).where(eq(tradesTable.status, "open")),
    db.select().from(tradesTable).where(and(eq(tradesTable.status, "closed"), gte(tradesTable.exitTime, startOfDay))),
    db.select({ id: strategiesTable.id }).from(strategiesTable).where(eq(strategiesTable.active, true)),
    db.select({ id: signalsTable.id }).from(signalsTable).where(gte(signalsTable.createdAt, startOfDay)),
  ]);

  const totalPnlToday = todayClosedTrades.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0);
  const wins = allTrades.filter((t) => (t.profitLoss ?? 0) > 0);
  const winRateAllTime = allTrades.length > 0 ? (wins.length / allTrades.length) * 100 : 0;
  const unrealizedPnl = openTrades.reduce((sum) => sum + 0, 0); // Would need current price to compute accurately

  const bestTrade = allTrades.reduce((best, t) => Math.max(best, t.profitLoss ?? 0), 0);
  const worstTrade = allTrades.reduce((worst, t) => Math.min(worst, t.profitLoss ?? 0), 0);

  res.json({
    openTrades: openTrades.length,
    totalPnlToday: Math.round(totalPnlToday * 100) / 100,
    winRateAllTime: Math.round(winRateAllTime * 100) / 100,
    activeStrategies: activeStrategies.length,
    totalSignalsToday: todaySignals.length,
    systemHealth: "healthy",
    accountBalance: 10000, // Would come from user settings in a real system
    unrealizedPnl,
    totalClosedTrades: allTrades.length,
    bestTrade: allTrades.length > 0 ? Math.round(bestTrade * 100) / 100 : null,
    worstTrade: allTrades.length > 0 ? Math.round(worstTrade * 100) / 100 : null,
  });
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const query = GetRecentActivityQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 20) : 20;

  const events = await db
    .select()
    .from(activityEventsTable)
    .orderBy(desc(activityEventsTable.timestamp))
    .limit(limit);

  res.json(
    GetRecentActivityResponse.parse(
      events.map((e) => ({
        ...e,
        timestamp: e.timestamp.toISOString(),
      }))
    )
  );
});

export default router;
