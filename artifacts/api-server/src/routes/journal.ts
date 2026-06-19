import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";

const router: IRouter = Router();

const toInt = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toStr = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

const toBool = (v: unknown): boolean | null =>
  typeof v === "boolean" ? v : null;

const parseTradeId = (params: Record<string, string>): number | null => {
  const id = parseInt(params.tradeId ?? "", 10);
  return Number.isFinite(id) ? id : null;
};

// ── JOURNAL STATS ─────────────────────────────────────────────────────────────
router.get("/journal/stats", async (_req, res): Promise<void> => {
  const { data: trades, error } = await supabase
    .from("trades")
    .select("id, status, profit_loss, profit_percent, ai_confidence");

  if (error) { res.status(500).json({ error: error.message }); return; }

  const all = trades ?? [];
  const closed = all.filter(t => t.status === "closed");
  const open = all.filter(t => t.status === "open");
  const winners = closed.filter(t => (t.profit_loss ?? 0) > 0);
  const losers = closed.filter(t => (t.profit_loss ?? 0) <= 0);
  const totalPnl = closed.reduce((s, t) => s + (t.profit_loss ?? 0), 0);
  const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;

  const avgWin = winners.length > 0
    ? winners.reduce((s, t) => s + (t.profit_loss ?? 0), 0) / winners.length : 0;
  const avgLoss = losers.length > 0
    ? Math.abs(losers.reduce((s, t) => s + (t.profit_loss ?? 0), 0) / losers.length) : 0;
  const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0;

  const confTrades = all.filter(t => t.ai_confidence != null);
  const avgAiConf = confTrades.length > 0
    ? confTrades.reduce((s, t) => s + (t.ai_confidence ?? 0), 0) / confTrades.length : 0;

  const { data: mistakes } = await supabase.from("trade_mistakes").select("id");
  const { data: reviews } = await supabase.from("trade_reviews").select("overall_score");

  const avgReviewScore = reviews && reviews.length > 0
    ? Math.round(reviews.reduce((s, r) => s + (r.overall_score ?? 0), 0) / reviews.length) : null;

  const disciplineScore = Math.min(100, Math.round(
    winRate * 0.3 +
    Math.min(100, avgRR * 20) * 0.3 +
    (100 - Math.min(100, (mistakes?.length ?? 0) * 5)) * 0.4
  ));

  res.json({
    totalTrades: all.length, openTrades: open.length, closedTrades: closed.length,
    winningTrades: winners.length, losingTrades: losers.length,
    winRate: Math.round(winRate * 10) / 10,
    avgRR: Math.round(avgRR * 100) / 100,
    totalPnl: Math.round(totalPnl * 100) / 100,
    avgAiConfidence: Math.round(avgAiConf * 10) / 10,
    totalMistakes: mistakes?.length ?? 0,
    avgReviewScore,
    disciplineScore,
  });
});

// ── TRADE EVENTS ──────────────────────────────────────────────────────────────
router.get("/journal/events/:tradeId", async (req, res): Promise<void> => {
  const tradeId = parseTradeId(req.params);
  if (!tradeId) { res.status(400).json({ error: "Invalid tradeId" }); return; }

  const { data, error } = await supabase
    .from("trade_events").select("*").eq("trade_id", tradeId).order("timestamp", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(e => ({
    id: e.id, tradeId: e.trade_id, eventType: e.event_type,
    description: e.description, oldValue: e.old_value, newValue: e.new_value, timestamp: e.timestamp,
  })));
});

router.post("/journal/events/:tradeId", async (req, res): Promise<void> => {
  const tradeId = parseTradeId(req.params);
  if (!tradeId) { res.status(400).json({ error: "Invalid tradeId" }); return; }
  const body = req.body as Record<string, unknown>;
  const eventType = toStr(body.eventType);
  const description = toStr(body.description);
  if (!eventType || !description) { res.status(400).json({ error: "eventType and description required" }); return; }

  const { data, error } = await supabase.from("trade_events").insert({
    trade_id: tradeId, event_type: eventType, description,
    old_value: toStr(body.oldValue), new_value: toStr(body.newValue),
    timestamp: toStr(body.timestamp) ?? new Date().toISOString(),
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({
    id: data.id, tradeId: data.trade_id, eventType: data.event_type,
    description: data.description, oldValue: data.old_value, newValue: data.new_value, timestamp: data.timestamp,
  });
});

// ── TRADE PSYCHOLOGY ──────────────────────────────────────────────────────────
router.get("/journal/psychology/:tradeId", async (req, res): Promise<void> => {
  const tradeId = parseTradeId(req.params);
  if (!tradeId) { res.status(400).json({ error: "Invalid tradeId" }); return; }

  const { data, error } = await supabase.from("trade_psychology").select("*").eq("trade_id", tradeId).single();
  if (error || !data) { res.status(404).json({ error: "Not found" }); return; }

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
  const tradeId = parseTradeId(req.params);
  if (!tradeId) { res.status(400).json({ error: "Invalid tradeId" }); return; }
  const b = req.body as Record<string, unknown>;

  const record: Record<string, unknown> = {
    trade_id: tradeId,
    pre_confidence: toInt(b.preConfidence), pre_fear: toInt(b.preFear),
    pre_stress: toInt(b.preStress), pre_focus: toInt(b.preFocus),
    pre_emotion: toStr(b.preEmotion), pre_notes: toStr(b.preNotes),
    post_satisfaction: toInt(b.postSatisfaction), post_regret: toInt(b.postRegret),
    post_confidence_change: toInt(b.postConfidenceChange),
    post_learning: toStr(b.postLearning), post_notes: toStr(b.postNotes),
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase.from("trade_psychology").select("id").eq("trade_id", tradeId).single();
  const q = existing
    ? supabase.from("trade_psychology").update(record).eq("trade_id", tradeId).select().single()
    : supabase.from("trade_psychology").insert(record).select().single();

  const { data, error } = await q;
  if (error || !data) { res.status(500).json({ error: error?.message ?? "Failed" }); return; }

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
  const tradeId = parseTradeId(req.params);
  if (!tradeId) { res.status(400).json({ error: "Invalid tradeId" }); return; }

  const { data, error } = await supabase.from("trade_reviews").select("*").eq("trade_id", tradeId).single();
  if (error || !data) { res.status(404).json({ error: "Not found" }); return; }

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
  const tradeId = parseTradeId(req.params);
  if (!tradeId) { res.status(400).json({ error: "Invalid tradeId" }); return; }
  const b = req.body as Record<string, unknown>;

  const { data: trade } = await supabase.from("trades").select("*").eq("id", tradeId).single();
  const aiGenerated = toBool(b.aiGenerated) ?? true;

  let entryScore = toInt(b.entryScore);
  let riskScore = toInt(b.riskScore);
  let exitScore = toInt(b.exitScore);
  let timingScore = toInt(b.timingScore);
  let overallScore = toInt(b.overallScore);
  let strengths = toStr(b.strengths);
  let weaknesses = toStr(b.weaknesses);
  let recommendations = toStr(b.recommendations);

  if (trade && aiGenerated) {
    const pnlPct = trade.profit_percent ?? 0;
    const hasStop = trade.stop_loss != null;
    const hasTP = trade.take_profit != null;
    const conf = trade.ai_confidence ?? 70;

    entryScore = entryScore ?? Math.min(100, Math.round(60 + conf * 0.3 + (hasStop ? 10 : 0)));
    riskScore = riskScore ?? Math.min(100, (hasStop ? 40 : 0) + (hasTP ? 30 : 0) + 30);
    exitScore = exitScore ?? Math.min(100, Math.round(50 + pnlPct * 2));
    timingScore = timingScore ?? Math.min(100, Math.round(65 + conf * 0.2));
    overallScore = overallScore ?? Math.round(
      entryScore * 0.25 + riskScore * 0.25 + exitScore * 0.20 + timingScore * 0.15 + Math.min(100, conf + 10) * 0.15
    );

    const s: string[] = [], w: string[] = [], r: string[] = [];
    if (hasStop) s.push("Stop loss was set, protecting downside risk");
    if (hasTP) s.push("Take profit target defined before entry");
    if (conf > 80) s.push(`High AI confidence (${conf.toFixed(0)}%) supported the decision`);
    if (pnlPct > 0) s.push(`Profitable outcome: +${pnlPct.toFixed(2)}%`);
    if (!hasStop) { w.push("No stop loss set — unlimited downside risk"); r.push("Always set a stop loss before entering a trade"); }
    if (!hasTP) { w.push("No take profit defined"); r.push("Define take profit targets to remove emotion from exit decisions"); }
    if (conf < 70) { w.push("Below-average AI confidence at entry"); r.push("Wait for AI confidence >75% before entering"); }
    if (pnlPct < 0) { w.push(`Loss of ${pnlPct.toFixed(2)}%`); r.push("Review entry conditions against strategy criteria"); }

    strengths = s.length > 0 ? s.join(". ") : "Followed basic trade execution process";
    weaknesses = w.length > 0 ? w.join(". ") : "No major weaknesses detected";
    recommendations = r.length > 0 ? r.join(". ") : "Continue following current strategy rules consistently";
  }

  const record: Record<string, unknown> = {
    trade_id: tradeId, entry_score: entryScore, risk_score: riskScore,
    exit_score: exitScore, timing_score: timingScore, overall_score: overallScore,
    strengths, weaknesses, recommendations, ai_generated: aiGenerated,
  };

  const { data: existing } = await supabase.from("trade_reviews").select("id").eq("trade_id", tradeId).single();
  const q = existing
    ? supabase.from("trade_reviews").update(record).eq("trade_id", tradeId).select().single()
    : supabase.from("trade_reviews").insert(record).select().single();

  const { data, error } = await q;
  if (error || !data) { res.status(500).json({ error: error?.message ?? "Failed" }); return; }

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
  const tradeId = parseTradeId(req.params);
  if (!tradeId) { res.status(400).json({ error: "Invalid tradeId" }); return; }

  const { data, error } = await supabase.from("trade_mistakes").select("*")
    .eq("trade_id", tradeId).order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json((data ?? []).map(m => ({
    id: m.id, tradeId: m.trade_id, mistakeType: m.mistake_type,
    category: m.category, severity: m.severity, description: m.description,
    solution: m.solution, aiDetected: m.ai_detected, createdAt: m.created_at,
  })));
});

router.post("/journal/mistakes/:tradeId", async (req, res): Promise<void> => {
  const tradeId = parseTradeId(req.params);
  if (!tradeId) { res.status(400).json({ error: "Invalid tradeId" }); return; }
  const b = req.body as Record<string, unknown>;
  const mistakeType = toStr(b.mistakeType);
  const description = toStr(b.description);
  if (!mistakeType || !description) { res.status(400).json({ error: "mistakeType and description required" }); return; }

  const { data, error } = await supabase.from("trade_mistakes").insert({
    trade_id: tradeId,
    mistake_type: mistakeType,
    category: toStr(b.category) ?? "entry",
    severity: toStr(b.severity) ?? "medium",
    description,
    solution: toStr(b.solution),
    ai_detected: toBool(b.aiDetected) ?? false,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({
    id: data.id, tradeId: data.trade_id, mistakeType: data.mistake_type,
    category: data.category, severity: data.severity, description: data.description,
    solution: data.solution, aiDetected: data.ai_detected, createdAt: data.created_at,
  });
});

export default router;
