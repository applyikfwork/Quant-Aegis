import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";
import { z } from "zod/v4";

const router: IRouter = Router();

const TradeEventInput = z.object({
  eventType: z.string(),
  description: z.string(),
  oldValue: z.string().optional(),
  newValue: z.string().optional(),
  timestamp: z.string().optional(),
});

const TradePsychologyInput = z.object({
  preConfidence: z.number().int().min(0).max(100).optional(),
  preFear: z.number().int().min(0).max(100).optional(),
  preStress: z.number().int().min(0).max(100).optional(),
  preFocus: z.number().int().min(0).max(100).optional(),
  preEmotion: z.string().optional(),
  preNotes: z.string().optional(),
  postSatisfaction: z.number().int().min(0).max(100).optional(),
  postRegret: z.number().int().min(0).max(100).optional(),
  postConfidenceChange: z.number().int().min(-100).max(100).optional(),
  postLearning: z.string().optional(),
  postNotes: z.string().optional(),
});

const TradeReviewInput = z.object({
  entryScore: z.number().int().min(0).max(100).optional(),
  riskScore: z.number().int().min(0).max(100).optional(),
  exitScore: z.number().int().min(0).max(100).optional(),
  timingScore: z.number().int().min(0).max(100).optional(),
  overallScore: z.number().int().min(0).max(100).optional(),
  strengths: z.string().optional(),
  weaknesses: z.string().optional(),
  recommendations: z.string().optional(),
  aiGenerated: z.boolean().optional(),
});

const TradeMistakeInput = z.object({
  mistakeType: z.string(),
  category: z.enum(["entry", "exit", "risk", "strategy", "psychology"]),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  description: z.string(),
  solution: z.string().optional(),
  aiDetected: z.boolean().optional(),
});

const TradeIdParam = z.object({ tradeId: z.coerce.number().int() });

// ── JOURNAL STATS ─────────────────────────────────────────────────────────────
router.get("/journal/stats", async (_req, res): Promise<void> => {
  const { data: trades, error } = await supabase
    .from("trades")
    .select("id, status, profit_loss, profit_percent, ai_confidence, entry_time");

  if (error) { res.status(500).json({ error: error.message }); return; }

  const closed = (trades ?? []).filter(t => t.status === "closed");
  const open = (trades ?? []).filter(t => t.status === "open");
  const winners = closed.filter(t => (t.profit_loss ?? 0) > 0);
  const losers = closed.filter(t => (t.profit_loss ?? 0) <= 0);
  const totalPnl = closed.reduce((s, t) => s + (t.profit_loss ?? 0), 0);
  const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;

  const avgWin = winners.length > 0
    ? winners.reduce((s, t) => s + (t.profit_loss ?? 0), 0) / winners.length
    : 0;
  const avgLoss = losers.length > 0
    ? Math.abs(losers.reduce((s, t) => s + (t.profit_loss ?? 0), 0) / losers.length)
    : 0;
  const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0;

  const avgAiConf = trades && trades.length > 0
    ? trades.filter(t => t.ai_confidence != null).reduce((s, t) => s + (t.ai_confidence ?? 0), 0) /
      Math.max(1, trades.filter(t => t.ai_confidence != null).length)
    : 0;

  const { data: mistakes } = await supabase.from("trade_mistakes").select("id");
  const { data: reviews } = await supabase.from("trade_reviews").select("overall_score");

  const avgReviewScore = reviews && reviews.length > 0
    ? reviews.reduce((s, r) => s + (r.overall_score ?? 0), 0) / reviews.length
    : null;

  const disciplineScore = Math.min(100, Math.round(
    winRate * 0.3 +
    Math.min(100, avgRR * 20) * 0.3 +
    (100 - Math.min(100, (mistakes?.length ?? 0) * 5)) * 0.4
  ));

  res.json({
    totalTrades: trades?.length ?? 0,
    openTrades: open.length,
    closedTrades: closed.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRate: Math.round(winRate * 10) / 10,
    avgRR: Math.round(avgRR * 100) / 100,
    totalPnl: Math.round(totalPnl * 100) / 100,
    avgAiConfidence: Math.round(avgAiConf * 10) / 10,
    totalMistakes: mistakes?.length ?? 0,
    avgReviewScore: avgReviewScore ? Math.round(avgReviewScore) : null,
    disciplineScore,
  });
});

// ── TRADE EVENTS ──────────────────────────────────────────────────────────────
router.get("/journal/events/:tradeId", async (req, res): Promise<void> => {
  const params = TradeIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data, error } = await supabase
    .from("trade_events")
    .select("*")
    .eq("trade_id", params.data.tradeId)
    .order("timestamp", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json((data ?? []).map(e => ({
    id: e.id, tradeId: e.trade_id, eventType: e.event_type,
    description: e.description, oldValue: e.old_value, newValue: e.new_value,
    timestamp: e.timestamp,
  })));
});

router.post("/journal/events/:tradeId", async (req, res): Promise<void> => {
  const params = TradeIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = TradeEventInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data, error } = await supabase.from("trade_events").insert({
    trade_id: params.data.tradeId,
    event_type: parsed.data.eventType,
    description: parsed.data.description,
    old_value: parsed.data.oldValue ?? null,
    new_value: parsed.data.newValue ?? null,
    timestamp: parsed.data.timestamp ?? new Date().toISOString(),
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(201).json({
    id: data.id, tradeId: data.trade_id, eventType: data.event_type,
    description: data.description, oldValue: data.old_value, newValue: data.new_value,
    timestamp: data.timestamp,
  });
});

// ── TRADE PSYCHOLOGY ──────────────────────────────────────────────────────────
router.get("/journal/psychology/:tradeId", async (req, res): Promise<void> => {
  const params = TradeIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data, error } = await supabase
    .from("trade_psychology")
    .select("*")
    .eq("trade_id", params.data.tradeId)
    .single();

  if (error || !data) { res.status(404).json({ error: "Psychology record not found" }); return; }

  res.json({
    id: data.id, tradeId: data.trade_id,
    preConfidence: data.pre_confidence, preFear: data.pre_fear,
    preStress: data.pre_stress, preFocus: data.pre_focus,
    preEmotion: data.pre_emotion, preNotes: data.pre_notes,
    postSatisfaction: data.post_satisfaction, postRegret: data.post_regret,
    postConfidenceChange: data.post_confidence_change,
    postLearning: data.post_learning, postNotes: data.post_notes,
    createdAt: data.created_at, updatedAt: data.updated_at,
  });
});

router.post("/journal/psychology/:tradeId", async (req, res): Promise<void> => {
  const params = TradeIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = TradePsychologyInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const record = {
    trade_id: params.data.tradeId,
    pre_confidence: parsed.data.preConfidence ?? null,
    pre_fear: parsed.data.preFear ?? null,
    pre_stress: parsed.data.preStress ?? null,
    pre_focus: parsed.data.preFocus ?? null,
    pre_emotion: parsed.data.preEmotion ?? null,
    pre_notes: parsed.data.preNotes ?? null,
    post_satisfaction: parsed.data.postSatisfaction ?? null,
    post_regret: parsed.data.postRegret ?? null,
    post_confidence_change: parsed.data.postConfidenceChange ?? null,
    post_learning: parsed.data.postLearning ?? null,
    post_notes: parsed.data.postNotes ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("trade_psychology").select("id").eq("trade_id", params.data.tradeId).single();

  let data: Record<string, unknown> | null = null;
  let error: { message: string } | null = null;

  if (existing) {
    const result = await supabase.from("trade_psychology").update(record).eq("trade_id", params.data.tradeId).select().single();
    data = result.data as Record<string, unknown> | null;
    error = result.error;
  } else {
    const result = await supabase.from("trade_psychology").insert(record).select().single();
    data = result.data as Record<string, unknown> | null;
    error = result.error;
  }

  if (error || !data) { res.status(500).json({ error: error?.message ?? "Failed to save" }); return; }

  res.json({
    id: data.id, tradeId: data.trade_id,
    preConfidence: data.pre_confidence, preFear: data.pre_fear,
    preStress: data.pre_stress, preFocus: data.pre_focus,
    preEmotion: data.pre_emotion, preNotes: data.pre_notes,
    postSatisfaction: data.post_satisfaction, postRegret: data.post_regret,
    postConfidenceChange: data.post_confidence_change,
    postLearning: data.post_learning, postNotes: data.post_notes,
    createdAt: data.created_at, updatedAt: data.updated_at,
  });
});

// ── TRADE REVIEW ──────────────────────────────────────────────────────────────
router.get("/journal/review/:tradeId", async (req, res): Promise<void> => {
  const params = TradeIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data, error } = await supabase
    .from("trade_reviews")
    .select("*")
    .eq("trade_id", params.data.tradeId)
    .single();

  if (error || !data) { res.status(404).json({ error: "Review not found" }); return; }

  res.json({
    id: data.id, tradeId: data.trade_id,
    entryScore: data.entry_score, riskScore: data.risk_score,
    exitScore: data.exit_score, timingScore: data.timing_score,
    overallScore: data.overall_score, strengths: data.strengths,
    weaknesses: data.weaknesses, recommendations: data.recommendations,
    aiGenerated: data.ai_generated, createdAt: data.created_at,
  });
});

router.post("/journal/review/:tradeId", async (req, res): Promise<void> => {
  const params = TradeIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = TradeReviewInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: trade } = await supabase.from("trades").select("*").eq("id", params.data.tradeId).single();

  let entryScore = parsed.data.entryScore;
  let riskScore = parsed.data.riskScore;
  let exitScore = parsed.data.exitScore;
  let timingScore = parsed.data.timingScore;
  let overallScore = parsed.data.overallScore;
  let strengths = parsed.data.strengths ?? null;
  let weaknesses = parsed.data.weaknesses ?? null;
  let recommendations = parsed.data.recommendations ?? null;
  const aiGenerated = parsed.data.aiGenerated ?? true;

  if (trade && aiGenerated) {
    const pnlPct = trade.profit_percent ?? 0;
    const hasStopLoss = trade.stop_loss != null;
    const hasTakeProfit = trade.take_profit != null;
    const aiConf = trade.ai_confidence ?? 70;

    entryScore = entryScore ?? Math.min(100, Math.round(60 + aiConf * 0.3 + (hasStopLoss ? 10 : 0)));
    riskScore = riskScore ?? Math.min(100, Math.round((hasStopLoss ? 40 : 0) + (hasTakeProfit ? 30 : 0) + 30));
    exitScore = exitScore ?? Math.min(100, Math.round(50 + pnlPct * 2));
    timingScore = timingScore ?? Math.min(100, Math.round(65 + aiConf * 0.2));
    overallScore = overallScore ?? Math.round(
      (entryScore ?? 70) * 0.25 +
      (riskScore ?? 70) * 0.25 +
      (exitScore ?? 70) * 0.20 +
      (timingScore ?? 70) * 0.15 +
      Math.min(100, aiConf + 10) * 0.15
    );

    const strengthsList: string[] = [];
    const weaknessesList: string[] = [];
    const recList: string[] = [];

    if (hasStopLoss) strengthsList.push("Stop loss was set, protecting downside risk");
    if (hasTakeProfit) strengthsList.push("Take profit target defined before entry");
    if (aiConf > 80) strengthsList.push(`High AI confidence (${aiConf.toFixed(0)}%) supported the decision`);
    if (pnlPct > 0) strengthsList.push(`Profitable outcome: +${pnlPct.toFixed(2)}%`);
    if (!hasStopLoss) { weaknessesList.push("No stop loss set — unlimited downside risk"); recList.push("Always set a stop loss before entering a trade"); }
    if (!hasTakeProfit) { weaknessesList.push("No take profit defined — exit was discretionary"); recList.push("Define take profit targets to remove emotion from exit decisions"); }
    if (aiConf < 70) { weaknessesList.push("Below-average AI confidence at entry"); recList.push("Consider waiting for higher AI confidence signals (>75%)"); }
    if (pnlPct < 0) { weaknessesList.push(`Loss of ${pnlPct.toFixed(2)}% — review entry conditions`); recList.push("Analyze market conditions at entry — did they match strategy criteria?"); }

    strengths = strengthsList.length > 0 ? strengthsList.join(". ") : "Followed basic trade execution process";
    weaknesses = weaknessesList.length > 0 ? weaknessesList.join(". ") : "No major weaknesses detected";
    recommendations = recList.length > 0 ? recList.join(". ") : "Continue following current strategy rules consistently";
  }

  const { data: existing } = await supabase.from("trade_reviews").select("id").eq("trade_id", params.data.tradeId).single();

  const record = {
    trade_id: params.data.tradeId,
    entry_score: entryScore ?? null,
    risk_score: riskScore ?? null,
    exit_score: exitScore ?? null,
    timing_score: timingScore ?? null,
    overall_score: overallScore ?? null,
    strengths, weaknesses, recommendations,
    ai_generated: aiGenerated,
  };

  let data: Record<string, unknown> | null = null;
  let saveError: { message: string } | null = null;

  if (existing) {
    const result = await supabase.from("trade_reviews").update(record).eq("trade_id", params.data.tradeId).select().single();
    data = result.data as Record<string, unknown> | null;
    saveError = result.error;
  } else {
    const result = await supabase.from("trade_reviews").insert(record).select().single();
    data = result.data as Record<string, unknown> | null;
    saveError = result.error;
  }

  if (saveError || !data) { res.status(500).json({ error: saveError?.message ?? "Failed to save review" }); return; }

  res.json({
    id: data.id, tradeId: data.trade_id,
    entryScore: data.entry_score, riskScore: data.risk_score,
    exitScore: data.exit_score, timingScore: data.timing_score,
    overallScore: data.overall_score, strengths: data.strengths,
    weaknesses: data.weaknesses, recommendations: data.recommendations,
    aiGenerated: data.ai_generated, createdAt: data.created_at,
  });
});

// ── TRADE MISTAKES ────────────────────────────────────────────────────────────
router.get("/journal/mistakes/:tradeId", async (req, res): Promise<void> => {
  const params = TradeIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data, error } = await supabase
    .from("trade_mistakes")
    .select("*")
    .eq("trade_id", params.data.tradeId)
    .order("created_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json((data ?? []).map(m => ({
    id: m.id, tradeId: m.trade_id, mistakeType: m.mistake_type,
    category: m.category, severity: m.severity, description: m.description,
    solution: m.solution, aiDetected: m.ai_detected, createdAt: m.created_at,
  })));
});

router.post("/journal/mistakes/:tradeId", async (req, res): Promise<void> => {
  const params = TradeIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = TradeMistakeInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data, error } = await supabase.from("trade_mistakes").insert({
    trade_id: params.data.tradeId,
    mistake_type: parsed.data.mistakeType,
    category: parsed.data.category,
    severity: parsed.data.severity ?? "medium",
    description: parsed.data.description,
    solution: parsed.data.solution ?? null,
    ai_detected: parsed.data.aiDetected ?? false,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(201).json({
    id: data.id, tradeId: data.trade_id, mistakeType: data.mistake_type,
    category: data.category, severity: data.severity, description: data.description,
    solution: data.solution, aiDetected: data.ai_detected, createdAt: data.created_at,
  });
});

export default router;
