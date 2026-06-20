import { Router, type IRouter } from "express";
import { supabase, isOfflineMode } from "../lib/supabase";
import { computePositions, getClosedTrades } from "../lib/paper-state";
import {
  CreateTradeBody,
  UpdateTradeBody,
  GetTradeParams,
  UpdateTradeParams,
  DeleteTradeParams,
  GetTradeReasonsParams,
  ListTradesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trades", async (req, res): Promise<void> => {
  if (isOfflineMode) {
    const query = ListTradesQueryParams.safeParse(req.query);
    const statusFilter = query.success ? query.data.status : undefined;
    const symbolFilter = query.success ? query.data.symbol : undefined;
    const limit = (query.success ? query.data.limit : undefined) ?? 50;

    const openPos = computePositions().map(p => ({
      id: p.id, symbol: p.symbol, strategyId: null, side: p.side,
      entryPrice: p.entryPrice, exitPrice: null, quantity: p.quantity,
      stopLoss: p.stopLoss ?? null, takeProfit: p.takeProfit ?? null,
      profitLoss: p.unrealizedPnl, profitPercent: p.unrealizedPnlPct,
      status: "open", aiConfidence: null, timeframe: "1h",
      entryTime: p.openTime, exitTime: null, createdAt: p.openTime,
      strategyName: p.strategy ?? null, tradeType: "journal", signalId: null, decisionId: null,
    }));

    const closedT = getClosedTrades().map(t => ({
      id: t.id, symbol: t.symbol, strategyId: null, side: t.side,
      entryPrice: t.entryPrice, exitPrice: t.exitPrice, quantity: t.quantity,
      stopLoss: null, takeProfit: null,
      profitLoss: t.pnl, profitPercent: t.pnlPct,
      status: "closed", aiConfidence: null, timeframe: "1h",
      entryTime: t.openTime, exitTime: t.closeTime, createdAt: t.openTime,
      strategyName: t.strategy ?? null, tradeType: "journal", signalId: null, decisionId: null,
    }));

    let all = statusFilter === "open" ? openPos
      : statusFilter === "closed" ? closedT
      : [...openPos, ...closedT];

    if (symbolFilter) all = all.filter(t => t.symbol === symbolFilter);
    res.json(all.slice(0, limit));
    return;
  }

  const query = ListTradesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  // Default: return journal trades only (trade_type='journal') for the Trade Journal module
  let q = supabase
    .from("trades")
    .select("*, strategies(name)")
    .eq("trade_type", "journal")
    .order("created_at", { ascending: false })
    .limit(query.data.limit ?? 50);

  if (query.data.status) q = q.eq("status", query.data.status);
  if (query.data.symbol) q = q.eq("symbol", query.data.symbol);

  const { data, error } = await q;
  // Gracefully handle missing table (tables not yet created in Supabase)
  if (error) {
    if (error.message?.includes("does not exist") || error.message?.includes("schema cache")) {
      res.json([]);
      return;
    }
    res.status(500).json({ error: error.message });
    return;
  }

  res.json((data ?? []).map(t => ({
    id: t.id, symbol: t.symbol, strategyId: t.strategy_id, side: t.side,
    entryPrice: t.entry_price, exitPrice: t.exit_price, quantity: t.quantity,
    stopLoss: t.stop_loss, takeProfit: t.take_profit, profitLoss: t.profit_loss,
    profitPercent: t.profit_percent, status: t.status, aiConfidence: t.ai_confidence,
    timeframe: t.timeframe, entryTime: t.entry_time, exitTime: t.exit_time,
    createdAt: t.created_at, strategyName: (t.strategies as any)?.name ?? null,
    tradeType: t.trade_type ?? "journal", signalId: t.signal_id ?? null, decisionId: t.decision_id ?? null,
  })));
});

router.post("/trades", async (req, res): Promise<void> => {
  const parsed = CreateTradeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: trade, error } = await supabase.from("trades").insert({
    symbol: parsed.data.symbol, strategy_id: parsed.data.strategyId ?? null,
    side: parsed.data.side, entry_price: parsed.data.entryPrice,
    quantity: parsed.data.quantity, stop_loss: parsed.data.stopLoss ?? null,
    take_profit: parsed.data.takeProfit ?? null, ai_confidence: parsed.data.aiConfidence ?? null,
    timeframe: parsed.data.timeframe ?? null,
    trade_type: "journal",
    signal_id: (parsed.data as any).signalId ?? null,
    decision_id: (parsed.data as any).decisionId ?? null,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  const reasons = (parsed.data as any).reasons as Array<{ reasonType: string; reasonText: string }> | undefined;
  if (reasons?.length) {
    await supabase.from("trade_reasons").insert(
      reasons.map(r => ({ trade_id: trade.id, reason_type: r.reasonType, reason_text: r.reasonText }))
    );
  }

  // If linked to a signal, mark signal as active
  if (trade.signal_id) {
    await supabase.from("signals").update({ status: "active" }).eq("id", trade.signal_id);
  }

  await supabase.from("activity_events").insert({
    type: "trade_opened",
    title: `Trade opened: ${parsed.data.side.toUpperCase()} ${parsed.data.symbol}`,
    description: `${parsed.data.side.toUpperCase()} position opened on ${parsed.data.symbol} at $${parsed.data.entryPrice}`,
    symbol: parsed.data.symbol, value: parsed.data.entryPrice,
  });

  let strategyName: string | null = null;
  if (trade.strategy_id) {
    const { data: strat } = await supabase.from("strategies").select("name").eq("id", trade.strategy_id).single();
    strategyName = strat?.name ?? null;
  }

  res.status(201).json({
    id: trade.id, symbol: trade.symbol, strategyId: trade.strategy_id, side: trade.side,
    entryPrice: trade.entry_price, exitPrice: trade.exit_price, quantity: trade.quantity,
    stopLoss: trade.stop_loss, takeProfit: trade.take_profit, profitLoss: trade.profit_loss,
    profitPercent: trade.profit_percent, status: trade.status, aiConfidence: trade.ai_confidence,
    timeframe: trade.timeframe, entryTime: trade.entry_time, exitTime: null,
    createdAt: trade.created_at, strategyName,
    tradeType: "journal", signalId: trade.signal_id, decisionId: trade.decision_id,
  });
});

router.get("/trades/:id", async (req, res): Promise<void> => {
  const params = GetTradeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data: trade, error } = await supabase
    .from("trades").select("*, strategies(name)").eq("id", params.data.id).single();
  if (error || !trade) { res.status(404).json({ error: "Trade not found" }); return; }

  res.json({
    id: trade.id, symbol: trade.symbol, strategyId: trade.strategy_id, side: trade.side,
    entryPrice: trade.entry_price, exitPrice: trade.exit_price, quantity: trade.quantity,
    stopLoss: trade.stop_loss, takeProfit: trade.take_profit, profitLoss: trade.profit_loss,
    profitPercent: trade.profit_percent, status: trade.status, aiConfidence: trade.ai_confidence,
    timeframe: trade.timeframe, entryTime: trade.entry_time, exitTime: trade.exit_time,
    createdAt: trade.created_at, strategyName: (trade.strategies as any)?.name ?? null,
    tradeType: trade.trade_type ?? "journal", signalId: trade.signal_id ?? null, decisionId: trade.decision_id ?? null,
  });
});

router.patch("/trades/:id", async (req, res): Promise<void> => {
  const params = UpdateTradeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateTradeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: current, error: fetchErr } = await supabase.from("trades").select("*").eq("id", params.data.id).single();
  if (fetchErr || !current) { res.status(404).json({ error: "Trade not found" }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.exitPrice !== undefined) updates.exit_price = parsed.data.exitPrice;
  if (parsed.data.stopLoss !== undefined) updates.stop_loss = parsed.data.stopLoss;
  if (parsed.data.takeProfit !== undefined) updates.take_profit = parsed.data.takeProfit;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.exitTime !== undefined) updates.exit_time = parsed.data.exitTime;

  let pnl: number | undefined;
  if (parsed.data.exitPrice !== undefined && parsed.data.status === "closed") {
    const exitPrice = parsed.data.exitPrice;
    pnl = current.side === "long"
      ? (exitPrice - current.entry_price) * current.quantity
      : (current.entry_price - exitPrice) * current.quantity;
    const pnlPct = current.side === "long"
      ? ((exitPrice - current.entry_price) / current.entry_price) * 100
      : ((current.entry_price - exitPrice) / current.entry_price) * 100;
    updates.profit_loss = pnl;
    updates.profit_percent = pnlPct;
    if (!updates.exit_time) updates.exit_time = new Date().toISOString();

    await supabase.from("activity_events").insert({
      type: "trade_closed",
      title: `Trade closed: ${current.symbol}`,
      description: `${current.side.toUpperCase()} on ${current.symbol} closed at $${exitPrice} | PnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`,
      symbol: current.symbol, value: pnl,
    });

    // Auto-create AI feedback if trade was linked to a signal/decision
    if (current.signal_id || current.decision_id) {
      const isWin = pnl > 0;
      await supabase.from("ai_feedback").insert({
        decision_id: current.decision_id ?? null,
        trade_id: current.id,
        prediction: current.side === "long" ? "BUY" : "SELL",
        actual_result: isWin ? "profit" : "loss",
        correct: isWin,
        lesson: isWin
          ? `Trade closed profitably at ${pnl.toFixed(2)} USD. Signal was correct.`
          : `Trade closed at a loss of ${Math.abs(pnl).toFixed(2)} USD. Review entry conditions.`,
      });
    }

    // If linked to signal, mark it completed
    if (current.signal_id) {
      await supabase.from("signals").update({ status: "completed" }).eq("id", current.signal_id);
    }

    // Update strategy win stats if strategy linked
    if (current.strategy_id) {
      const { data: stratTrades } = await supabase
        .from("trades")
        .select("profit_loss")
        .eq("strategy_id", current.strategy_id)
        .eq("status", "closed");
      const allStratTrades = [...(stratTrades ?? []), { profit_loss: pnl }];
      const wins = allStratTrades.filter(t => (t.profit_loss ?? 0) > 0);
      const winRate = allStratTrades.length > 0 ? (wins.length / allStratTrades.length) * 100 : 0;
      const grossProfit = wins.reduce((s, t) => s + (t.profit_loss ?? 0), 0);
      const grossLoss = Math.abs(allStratTrades.filter(t => (t.profit_loss ?? 0) <= 0).reduce((s, t) => s + (t.profit_loss ?? 0), 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
      await supabase.from("strategies").update({
        win_rate: Math.round(winRate * 10) / 10,
        total_trades: allStratTrades.length,
        profit_factor: Math.round(profitFactor * 100) / 100,
      }).eq("id", current.strategy_id);
    }
  }

  const { data: trade, error } = await supabase.from("trades").update(updates).eq("id", params.data.id).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({
    id: trade.id, symbol: trade.symbol, strategyId: trade.strategy_id, side: trade.side,
    entryPrice: trade.entry_price, exitPrice: trade.exit_price, quantity: trade.quantity,
    stopLoss: trade.stop_loss, takeProfit: trade.take_profit, profitLoss: trade.profit_loss,
    profitPercent: trade.profit_percent, status: trade.status, aiConfidence: trade.ai_confidence,
    timeframe: trade.timeframe, entryTime: trade.entry_time, exitTime: trade.exit_time,
    createdAt: trade.created_at, strategyName: null,
    tradeType: trade.trade_type ?? "journal", signalId: trade.signal_id ?? null, decisionId: trade.decision_id ?? null,
  });
});

router.delete("/trades/:id", async (req, res): Promise<void> => {
  const params = DeleteTradeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await supabase.from("trade_reasons").delete().eq("trade_id", params.data.id);
  await supabase.from("trades").delete().eq("id", params.data.id);
  res.sendStatus(204);
});

router.get("/trades/:id/reasons", async (req, res): Promise<void> => {
  const params = GetTradeReasonsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const { data, error } = await supabase.from("trade_reasons").select("*").eq("trade_id", params.data.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(r => ({ id: r.id, tradeId: r.trade_id, reasonType: r.reason_type, reasonText: r.reason_text })));
});

export default router;
