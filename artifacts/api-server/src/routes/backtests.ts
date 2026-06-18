import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { backtestsTable, strategiesTable, activityEventsTable } from "@workspace/db";
import {
  CreateBacktestBody,
  ListBacktestsResponse,
} from "@workspace/api-zod";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/backtests", async (_req, res): Promise<void> => {
  const backtests = await db
    .select({
      id: backtestsTable.id,
      strategyId: backtestsTable.strategyId,
      startDate: backtestsTable.startDate,
      endDate: backtestsTable.endDate,
      totalTrades: backtestsTable.totalTrades,
      wins: backtestsTable.wins,
      losses: backtestsTable.losses,
      winRate: backtestsTable.winRate,
      profitFactor: backtestsTable.profitFactor,
      drawdown: backtestsTable.drawdown,
      sharpeRatio: backtestsTable.sharpeRatio,
      totalReturn: backtestsTable.totalReturn,
      createdAt: backtestsTable.createdAt,
      strategyName: strategiesTable.name,
    })
    .from(backtestsTable)
    .leftJoin(strategiesTable, eq(backtestsTable.strategyId, strategiesTable.id))
    .orderBy(desc(backtestsTable.createdAt));

  res.json(
    ListBacktestsResponse.parse(
      backtests.map((b) => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
        strategyName: b.strategyName ?? null,
      }))
    )
  );
});

router.post("/backtests", async (req, res): Promise<void> => {
  const parsed = CreateBacktestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Simulate a backtest by generating plausible synthetic results
  const totalTrades = Math.floor(Math.random() * 80) + 20;
  const wins = Math.floor(totalTrades * (0.45 + Math.random() * 0.25));
  const losses = totalTrades - wins;
  const winRate = (wins / totalTrades) * 100;
  const avgWin = 120 + Math.random() * 200;
  const avgLoss = 80 + Math.random() * 100;
  const grossProfit = wins * avgWin;
  const grossLoss = losses * avgLoss;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 1;
  const totalReturn = (grossProfit - grossLoss) / 10000 * 100; // as % of 10k account
  const drawdown = 5 + Math.random() * 20;
  const sharpeRatio = 0.5 + Math.random() * 2;

  const [backtest] = await db
    .insert(backtestsTable)
    .values({
      strategyId: parsed.data.strategyId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      symbol: parsed.data.symbol ?? null,
      timeframe: parsed.data.timeframe ?? null,
      totalTrades,
      wins,
      losses,
      winRate: Math.round(winRate * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
    })
    .returning();

  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, parsed.data.strategyId));

  await db.insert(activityEventsTable).values({
    type: "backtest_complete",
    title: `Backtest complete: ${strategy?.name ?? "Strategy"}`,
    description: `Backtest finished — Win Rate: ${Math.round(winRate)}% | Profit Factor: ${Math.round(profitFactor * 100) / 100} | Drawdown: ${Math.round(drawdown)}%`,
  });

  res.status(201).json({
    ...backtest,
    createdAt: backtest.createdAt.toISOString(),
    strategyName: strategy?.name ?? null,
  });
});

export default router;
