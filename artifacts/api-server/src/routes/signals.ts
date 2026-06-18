import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";
import { CreateSignalBody, ListSignalsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/signals", async (req, res): Promise<void> => {
  const query = ListSignalsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  let q = supabase
    .from("signals")
    .select("*, strategies(name)")
    .order("created_at", { ascending: false })
    .limit(query.data.limit ?? 50);

  if (query.data.status) q = q.eq("status", query.data.status);
  if (query.data.symbol) q = q.eq("symbol", query.data.symbol);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json((data ?? []).map(s => ({
    id: s.id, symbol: s.symbol, strategyId: s.strategy_id, signalType: s.signal_type,
    confidence: s.confidence, reason: s.reason, status: s.status, createdAt: s.created_at,
    strategyName: (s.strategies as any)?.name ?? null,
  })));
});

router.post("/signals", async (req, res): Promise<void> => {
  const parsed = CreateSignalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: signal, error } = await supabase.from("signals").insert({
    symbol: parsed.data.symbol, strategy_id: parsed.data.strategyId ?? null,
    signal_type: parsed.data.signalType, confidence: parsed.data.confidence,
    reason: parsed.data.reason ?? null,
  }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabase.from("activity_events").insert({
    type: "signal_generated",
    title: `Signal: ${parsed.data.signalType.toUpperCase()} ${parsed.data.symbol}`,
    description: `${parsed.data.signalType.toUpperCase()} signal for ${parsed.data.symbol} with ${parsed.data.confidence}% confidence`,
    symbol: parsed.data.symbol, value: parsed.data.confidence,
  });

  let strategyName: string | null = null;
  if (signal.strategy_id) {
    const { data: strat } = await supabase.from("strategies").select("name").eq("id", signal.strategy_id).single();
    strategyName = strat?.name ?? null;
  }

  res.status(201).json({
    id: signal.id, symbol: signal.symbol, strategyId: signal.strategy_id,
    signalType: signal.signal_type, confidence: signal.confidence, reason: signal.reason,
    status: signal.status, createdAt: signal.created_at, strategyName,
  });
});

export default router;
