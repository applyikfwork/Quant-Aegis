import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";
import {
  CreateStrategyBody, GetStrategyParams, UpdateStrategyParams,
  UpdateStrategyBody, DeleteStrategyParams, GetStrategyBacktestsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const mapStrategy = (s: any) => ({
  id: s.id, name: s.name, version: s.version, description: s.description,
  rulesJson: s.rules_json, active: s.active, winRate: s.win_rate,
  totalTrades: s.total_trades, profitFactor: s.profit_factor, createdAt: s.created_at,
});

router.get("/strategies", async (_req, res): Promise<void> => {
  const { data, error } = await supabase.from("strategies").select("*").order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(mapStrategy));
});

router.post("/strategies", async (req, res): Promise<void> => {
  const parsed = CreateStrategyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: strategy, error } = await supabase.from("strategies").insert({
    name: parsed.data.name, description: parsed.data.description ?? null,
    rules_json: parsed.data.rulesJson ?? null, active: parsed.data.active ?? true,
  }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabase.from("activity_events").insert({
    type: "strategy_created",
    title: `Strategy created: ${strategy.name}`,
    description: `New strategy "${strategy.name}" added to the library`,
  });

  res.status(201).json(mapStrategy(strategy));
});

router.get("/strategies/:id", async (req, res): Promise<void> => {
  const params = GetStrategyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const { data, error } = await supabase.from("strategies").select("*").eq("id", params.data.id).single();
  if (error || !data) { res.status(404).json({ error: "Strategy not found" }); return; }
  res.json(mapStrategy(data));
});

router.patch("/strategies/:id", async (req, res): Promise<void> => {
  const params = UpdateStrategyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateStrategyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.rulesJson !== undefined) updates.rules_json = parsed.data.rulesJson;
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;

  const { data, error } = await supabase.from("strategies").update(updates).eq("id", params.data.id).select().single();
  if (error || !data) { res.status(404).json({ error: "Strategy not found" }); return; }
  res.json(mapStrategy(data));
});

router.delete("/strategies/:id", async (req, res): Promise<void> => {
  const params = DeleteStrategyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await supabase.from("strategies").delete().eq("id", params.data.id);
  res.sendStatus(204);
});

router.get("/strategies/:id/backtest", async (req, res): Promise<void> => {
  const params = GetStrategyBacktestsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const { data, error } = await supabase.from("backtests").select("*").eq("strategy_id", params.data.id).order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(b => ({
    id: b.id, strategyId: b.strategy_id, startDate: b.start_date, endDate: b.end_date,
    totalTrades: b.total_trades, wins: b.wins, losses: b.losses, winRate: b.win_rate,
    profitFactor: b.profit_factor, drawdown: b.drawdown, sharpeRatio: b.sharpe_ratio,
    totalReturn: b.total_return, createdAt: b.created_at, strategyName: null,
  })));
});

export default router;
