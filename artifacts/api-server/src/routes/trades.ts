import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tradesTable, tradeReasonsTable, strategiesTable, activityEventsTable } from "@workspace/db";
import {
  CreateTradeBody,
  UpdateTradeBody,
  GetTradeParams,
  UpdateTradeParams,
  UpdateTradeResponse,
  GetTradeResponse,
  DeleteTradeParams,
  GetTradeReasonsParams,
  ListTradesQueryParams,
  ListTradesResponse,
  GetTradeReasonsResponse,
} from "@workspace/api-zod";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/trades", async (req, res): Promise<void> => {
  const query = ListTradesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.status) conditions.push(eq(tradesTable.status, query.data.status));
  if (query.data.symbol) conditions.push(eq(tradesTable.symbol, query.data.symbol));

  const trades = await db
    .select({
      id: tradesTable.id,
      symbol: tradesTable.symbol,
      strategyId: tradesTable.strategyId,
      side: tradesTable.side,
      entryPrice: tradesTable.entryPrice,
      exitPrice: tradesTable.exitPrice,
      quantity: tradesTable.quantity,
      stopLoss: tradesTable.stopLoss,
      takeProfit: tradesTable.takeProfit,
      profitLoss: tradesTable.profitLoss,
      profitPercent: tradesTable.profitPercent,
      status: tradesTable.status,
      aiConfidence: tradesTable.aiConfidence,
      timeframe: tradesTable.timeframe,
      entryTime: tradesTable.entryTime,
      exitTime: tradesTable.exitTime,
      createdAt: tradesTable.createdAt,
      strategyName: strategiesTable.name,
    })
    .from(tradesTable)
    .leftJoin(strategiesTable, eq(tradesTable.strategyId, strategiesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tradesTable.createdAt))
    .limit(query.data.limit ?? 50);

  res.json(
    ListTradesResponse.parse(
      trades.map((t) => ({
        ...t,
        entryTime: t.entryTime.toISOString(),
        exitTime: t.exitTime ? t.exitTime.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
        strategyName: t.strategyName ?? null,
      }))
    )
  );
});

router.post("/trades", async (req, res): Promise<void> => {
  const parsed = CreateTradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [trade] = await db
    .insert(tradesTable)
    .values({
      symbol: parsed.data.symbol,
      strategyId: parsed.data.strategyId ?? null,
      side: parsed.data.side,
      entryPrice: parsed.data.entryPrice,
      quantity: parsed.data.quantity,
      stopLoss: parsed.data.stopLoss ?? null,
      takeProfit: parsed.data.takeProfit ?? null,
      aiConfidence: parsed.data.aiConfidence ?? null,
      timeframe: parsed.data.timeframe ?? null,
    })
    .returning();

  // Insert reasons if provided
  const reasons = (parsed.data as { reasons?: Array<{ reasonType: string; reasonText: string }> }).reasons;
  if (reasons && reasons.length > 0) {
    await db.insert(tradeReasonsTable).values(
      reasons.map((r) => ({ tradeId: trade.id, reasonType: r.reasonType, reasonText: r.reasonText }))
    );
  }

  await db.insert(activityEventsTable).values({
    type: "trade_opened",
    title: `Trade opened: ${parsed.data.side.toUpperCase()} ${parsed.data.symbol}`,
    description: `${parsed.data.side.toUpperCase()} position opened on ${parsed.data.symbol} at $${parsed.data.entryPrice}`,
    symbol: parsed.data.symbol,
    value: parsed.data.entryPrice,
  });

  let strategyName: string | null = null;
  if (trade.strategyId) {
    const [strat] = await db.select({ name: strategiesTable.name }).from(strategiesTable).where(eq(strategiesTable.id, trade.strategyId));
    strategyName = strat?.name ?? null;
  }

  res.status(201).json(
    GetTradeResponse.parse({
      ...trade,
      entryTime: trade.entryTime.toISOString(),
      exitTime: null,
      createdAt: trade.createdAt.toISOString(),
      strategyName,
    })
  );
});

router.get("/trades/:id", async (req, res): Promise<void> => {
  const params = GetTradeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [trade] = await db
    .select({
      id: tradesTable.id,
      symbol: tradesTable.symbol,
      strategyId: tradesTable.strategyId,
      side: tradesTable.side,
      entryPrice: tradesTable.entryPrice,
      exitPrice: tradesTable.exitPrice,
      quantity: tradesTable.quantity,
      stopLoss: tradesTable.stopLoss,
      takeProfit: tradesTable.takeProfit,
      profitLoss: tradesTable.profitLoss,
      profitPercent: tradesTable.profitPercent,
      status: tradesTable.status,
      aiConfidence: tradesTable.aiConfidence,
      timeframe: tradesTable.timeframe,
      entryTime: tradesTable.entryTime,
      exitTime: tradesTable.exitTime,
      createdAt: tradesTable.createdAt,
      strategyName: strategiesTable.name,
    })
    .from(tradesTable)
    .leftJoin(strategiesTable, eq(tradesTable.strategyId, strategiesTable.id))
    .where(eq(tradesTable.id, params.data.id));

  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  res.json(
    GetTradeResponse.parse({
      ...trade,
      entryTime: trade.entryTime.toISOString(),
      exitTime: trade.exitTime ? trade.exitTime.toISOString() : null,
      createdAt: trade.createdAt.toISOString(),
      strategyName: trade.strategyName ?? null,
    })
  );
});

router.patch("/trades/:id", async (req, res): Promise<void> => {
  const params = UpdateTradeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Get current trade to compute P&L if closing
  const [currentTrade] = await db.select().from(tradesTable).where(eq(tradesTable.id, params.data.id));
  if (!currentTrade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  const updates: Partial<typeof currentTrade> = {};
  if (parsed.data.exitPrice !== undefined) updates.exitPrice = parsed.data.exitPrice;
  if (parsed.data.stopLoss !== undefined) updates.stopLoss = parsed.data.stopLoss;
  if (parsed.data.takeProfit !== undefined) updates.takeProfit = parsed.data.takeProfit;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.exitTime !== undefined) updates.exitTime = new Date(parsed.data.exitTime);

  // Compute P&L when closing
  if (parsed.data.exitPrice !== undefined && parsed.data.status === "closed") {
    const exitPrice = parsed.data.exitPrice;
    const entryPrice = currentTrade.entryPrice;
    const quantity = currentTrade.quantity;
    const pnl =
      currentTrade.side === "long"
        ? (exitPrice - entryPrice) * quantity
        : (entryPrice - exitPrice) * quantity;
    const pnlPct =
      currentTrade.side === "long"
        ? ((exitPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - exitPrice) / entryPrice) * 100;

    updates.profitLoss = pnl;
    updates.profitPercent = pnlPct;
    if (!updates.exitTime) updates.exitTime = new Date();

    await db.insert(activityEventsTable).values({
      type: "trade_closed",
      title: `Trade closed: ${currentTrade.symbol}`,
      description: `${currentTrade.side.toUpperCase()} position on ${currentTrade.symbol} closed at $${exitPrice} | PnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`,
      symbol: currentTrade.symbol,
      value: pnl,
    });
  }

  const [trade] = await db
    .update(tradesTable)
    .set(updates)
    .where(eq(tradesTable.id, params.data.id))
    .returning();

  res.json(
    UpdateTradeResponse.parse({
      ...trade,
      entryTime: trade.entryTime.toISOString(),
      exitTime: trade.exitTime ? trade.exitTime.toISOString() : null,
      createdAt: trade.createdAt.toISOString(),
      strategyName: null,
    })
  );
});

router.delete("/trades/:id", async (req, res): Promise<void> => {
  const params = DeleteTradeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(tradeReasonsTable).where(eq(tradeReasonsTable.tradeId, params.data.id));
  await db.delete(tradesTable).where(eq(tradesTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/trades/:id/reasons", async (req, res): Promise<void> => {
  const params = GetTradeReasonsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const reasons = await db
    .select()
    .from(tradeReasonsTable)
    .where(eq(tradeReasonsTable.tradeId, params.data.id));

  res.json(GetTradeReasonsResponse.parse(reasons));
});

export default router;
