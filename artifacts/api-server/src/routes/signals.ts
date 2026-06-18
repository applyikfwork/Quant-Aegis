import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { signalsTable, strategiesTable, activityEventsTable } from "@workspace/db";
import {
  CreateSignalBody,
  ListSignalsQueryParams,
  ListSignalsResponse,
} from "@workspace/api-zod";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/signals", async (req, res): Promise<void> => {
  const query = ListSignalsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.status) conditions.push(eq(signalsTable.status, query.data.status));
  if (query.data.symbol) conditions.push(eq(signalsTable.symbol, query.data.symbol));

  const signals = await db
    .select({
      id: signalsTable.id,
      symbol: signalsTable.symbol,
      strategyId: signalsTable.strategyId,
      signalType: signalsTable.signalType,
      confidence: signalsTable.confidence,
      reason: signalsTable.reason,
      status: signalsTable.status,
      createdAt: signalsTable.createdAt,
      strategyName: strategiesTable.name,
    })
    .from(signalsTable)
    .leftJoin(strategiesTable, eq(signalsTable.strategyId, strategiesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(signalsTable.createdAt))
    .limit(query.data.limit ?? 50);

  res.json(
    ListSignalsResponse.parse(
      signals.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        strategyName: s.strategyName ?? null,
      }))
    )
  );
});

router.post("/signals", async (req, res): Promise<void> => {
  const parsed = CreateSignalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [signal] = await db
    .insert(signalsTable)
    .values({
      symbol: parsed.data.symbol,
      strategyId: parsed.data.strategyId ?? null,
      signalType: parsed.data.signalType,
      confidence: parsed.data.confidence,
      reason: parsed.data.reason ?? null,
    })
    .returning();

  await db.insert(activityEventsTable).values({
    type: "signal_generated",
    title: `Signal: ${parsed.data.signalType.toUpperCase()} ${parsed.data.symbol}`,
    description: `${parsed.data.signalType.toUpperCase()} signal generated for ${parsed.data.symbol} with ${parsed.data.confidence}% confidence`,
    symbol: parsed.data.symbol,
    value: parsed.data.confidence,
  });

  let strategyName: string | null = null;
  if (signal.strategyId) {
    const [strat] = await db.select({ name: strategiesTable.name }).from(strategiesTable).where(eq(strategiesTable.id, signal.strategyId));
    strategyName = strat?.name ?? null;
  }

  res.status(201).json({
    ...signal,
    createdAt: signal.createdAt.toISOString(),
    strategyName,
  });
});

export default router;
