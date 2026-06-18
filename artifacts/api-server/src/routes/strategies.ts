import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { strategiesTable, backtestsTable } from "@workspace/db";
import {
  CreateStrategyBody,
  GetStrategyParams,
  UpdateStrategyParams,
  UpdateStrategyBody,
  GetStrategyResponse,
  UpdateStrategyResponse,
  DeleteStrategyParams,
  GetStrategyBacktestsParams,
  ListStrategiesResponse,
  GetStrategyBacktestsResponse,
} from "@workspace/api-zod";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/strategies", async (_req, res): Promise<void> => {
  const strategies = await db
    .select()
    .from(strategiesTable)
    .orderBy(desc(strategiesTable.createdAt));

  res.json(
    ListStrategiesResponse.parse(
      strategies.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      }))
    )
  );
});

router.post("/strategies", async (req, res): Promise<void> => {
  const parsed = CreateStrategyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [strategy] = await db
    .insert(strategiesTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      rulesJson: parsed.data.rulesJson ?? null,
      active: parsed.data.active ?? true,
    })
    .returning();

  // Log activity
  await db.insert(
    (await import("@workspace/db")).activityEventsTable
  ).values({
    type: "strategy_created",
    title: `Strategy created: ${strategy.name}`,
    description: `New strategy "${strategy.name}" added to the library`,
  });

  res.status(201).json(
    GetStrategyResponse.parse({ ...strategy, createdAt: strategy.createdAt.toISOString() })
  );
});

router.get("/strategies/:id", async (req, res): Promise<void> => {
  const params = GetStrategyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [strategy] = await db
    .select()
    .from(strategiesTable)
    .where(eq(strategiesTable.id, params.data.id));

  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }

  res.json(GetStrategyResponse.parse({ ...strategy, createdAt: strategy.createdAt.toISOString() }));
});

router.patch("/strategies/:id", async (req, res): Promise<void> => {
  const params = UpdateStrategyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateStrategyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [strategy] = await db
    .update(strategiesTable)
    .set({
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.rulesJson !== undefined && { rulesJson: parsed.data.rulesJson }),
      ...(parsed.data.active !== undefined && { active: parsed.data.active }),
    })
    .where(eq(strategiesTable.id, params.data.id))
    .returning();

  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }

  res.json(UpdateStrategyResponse.parse({ ...strategy, createdAt: strategy.createdAt.toISOString() }));
});

router.delete("/strategies/:id", async (req, res): Promise<void> => {
  const params = DeleteStrategyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(strategiesTable).where(eq(strategiesTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/strategies/:id/backtest", async (req, res): Promise<void> => {
  const params = GetStrategyBacktestsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const backtests = await db
    .select()
    .from(backtestsTable)
    .where(eq(backtestsTable.strategyId, params.data.id))
    .orderBy(desc(backtestsTable.createdAt));

  res.json(
    GetStrategyBacktestsResponse.parse(
      backtests.map((b) => ({
        ...b,
        strategyName: null,
        startDate: b.startDate,
        endDate: b.endDate,
        createdAt: b.createdAt.toISOString(),
      }))
    )
  );
});

export default router;
