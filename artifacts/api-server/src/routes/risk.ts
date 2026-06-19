import { Router, type IRouter } from "express";
import { supabase, isOfflineMode } from "../lib/supabase";

const router: IRouter = Router();
const BASE_CAPITAL = 10000;

// ── HELPERS ───────────────────────────────────────────────────────────────────
function calcRiskScore(exposurePct: number, volatility: number, leverage: number, drawdown: number, concentrationRisk: number): number {
  const expScore = Math.min(40, (exposurePct / 100) * 40);
  const volScore = Math.min(20, volatility * 4);
  const levScore = Math.min(20, (leverage / 10) * 20);
  const ddScore = Math.min(15, (drawdown / 30) * 15);
  const concScore = Math.min(5, (concentrationRisk / 100) * 5);
  return Math.round(expScore + volScore + levScore + ddScore + concScore);
}

function accountSafety(score: number): string {
  if (score < 25) return "safe";
  if (score < 50) return "warning";
  if (score < 75) return "danger";
  return "critical";
}

// ── RISK DASHBOARD ────────────────────────────────────────────────────────────
router.get("/risk/dashboard", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    res.json({
      riskScore: 12,
      accountSafety: "safe",
      totalExposure: 0,
      exposurePct: 0,
      dailyPnl: 0,
      dailyLimitPct: 5,
      dailyUsedPct: 0,
      openPositions: 0,
      drawdown: 0,
      peakValue: BASE_CAPITAL,
      currentValue: BASE_CAPITAL,
      leverage: 0,
      liquidationBuffer: null,
      varAmount: 0,
      varConfidence: 95,
      stopLossRate: 100,
      concentrationRisk: 0,
      alertCount: 0,
    });
    return;
  }

  const { data: trades } = await supabase.from("trades").select("*");
  const all = trades ?? [];
  const open = all.filter(t => t.status === "open");
  const closed = all.filter(t => t.status === "closed");

  const totalExposure = open.reduce((s, t) => s + (t.entry_price ?? 0) * (t.quantity ?? 0), 0);
  const exposurePct = (totalExposure / BASE_CAPITAL) * 100;

  const today = new Date().toDateString();
  const todayPnl = closed
    .filter(t => t.exit_time && new Date(t.exit_time).toDateString() === today)
    .reduce((s, t) => s + (t.profit_loss ?? 0), 0);
  const dailyUsedPct = Math.abs(todayPnl / BASE_CAPITAL) * 100;

  const pnls = closed.map(t => t.profit_percent ?? 0);
  const avgPnl = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
  const variance = pnls.length > 1 ? pnls.reduce((s, p) => s + Math.pow(p - avgPnl, 2), 0) / (pnls.length - 1) : 0;
  const volatility = Math.sqrt(variance);

  const symMap = new Map<string, number>();
  for (const t of open) {
    symMap.set(t.symbol, (symMap.get(t.symbol) ?? 0) + (t.entry_price ?? 0) * (t.quantity ?? 0));
  }
  const largest = open.length > 0 ? Math.max(...Array.from(symMap.values())) : 0;
  const concentrationRisk = totalExposure > 0 ? (largest / totalExposure) * 100 : 0;

  const leverage = totalExposure > BASE_CAPITAL ? totalExposure / BASE_CAPITAL : 1;
  const maxLoss = closed.length > 0 ? Math.abs(Math.min(0, ...closed.map(t => t.profit_loss ?? 0))) : 0;
  const drawdown = (maxLoss / BASE_CAPITAL) * 100;

  const varAmount = totalExposure * (1.645 * (volatility / 100) * Math.sqrt(1));
  const riskScore = calcRiskScore(exposurePct, volatility, leverage, drawdown, concentrationRisk);

  const posWithStops = open.filter(t => t.stop_loss != null).length;
  const stopLossRate = open.length > 0 ? (posWithStops / open.length) * 100 : 100;

  const { data: events } = await supabase.from("risk_events").select("id").eq("resolved", false);
  const alertCount = (events ?? []).length;

  res.json({
    riskScore,
    accountSafety: accountSafety(riskScore),
    totalExposure: Math.round(totalExposure * 100) / 100,
    exposurePct: Math.round(exposurePct * 10) / 10,
    dailyPnl: Math.round(todayPnl * 100) / 100,
    dailyLimitPct: 5,
    dailyUsedPct: Math.round(dailyUsedPct * 10) / 10,
    openPositions: open.length,
    drawdown: Math.round(drawdown * 100) / 100,
    peakValue: BASE_CAPITAL,
    currentValue: BASE_CAPITAL + closed.reduce((s, t) => s + (t.profit_loss ?? 0), 0),
    leverage: Math.round(leverage * 100) / 100,
    liquidationBuffer: open.length > 0 ? 12.5 : null,
    varAmount: Math.round(varAmount * 100) / 100,
    varConfidence: 95,
    stopLossRate: Math.round(stopLossRate * 10) / 10,
    concentrationRisk: Math.round(concentrationRisk * 10) / 10,
    alertCount,
  });
});

// ── POSITION RISK ─────────────────────────────────────────────────────────────
router.get("/risk/positions", async (_req, res): Promise<void> => {
  if (isOfflineMode) { res.json([]); return; }

  const { data: trades } = await supabase.from("trades").select("*");
  const open = (trades ?? []).filter(t => t.status === "open");

  const positions = open.map(t => {
    const entryPrice = t.entry_price ?? 0;
    const stopLoss = t.stop_loss ?? entryPrice * 0.97;
    const stopDistance = Math.abs(entryPrice - stopLoss);
    const stopDistancePct = entryPrice > 0 ? (stopDistance / entryPrice) * 100 : 0;
    const qty = t.quantity ?? 0;
    const positionValue = entryPrice * qty;
    const maxLoss = stopDistance * qty;
    const riskPct = BASE_CAPITAL > 0 ? (maxLoss / BASE_CAPITAL) * 100 : 0;
    const liquidationPrice = t.side === "long" ? entryPrice * 0.8 : entryPrice * 1.2;
    const currentPrice = entryPrice * 1.01;
    const liquidationBuffer = t.side === "long"
      ? ((currentPrice - liquidationPrice) / currentPrice) * 100
      : ((liquidationPrice - currentPrice) / currentPrice) * 100;

    return {
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      entryPrice,
      currentPrice,
      stopLoss,
      stopDistance: Math.round(stopDistance * 100) / 100,
      stopDistancePct: Math.round(stopDistancePct * 100) / 100,
      quantity: qty,
      positionValue: Math.round(positionValue * 100) / 100,
      maxLoss: Math.round(maxLoss * 100) / 100,
      riskPct: Math.round(riskPct * 100) / 100,
      liquidationPrice: Math.round(liquidationPrice * 100) / 100,
      liquidationBuffer: Math.round(liquidationBuffer * 100) / 100,
      hasStopLoss: t.stop_loss != null,
    };
  });

  res.json(positions);
});

// ── VaR ENGINE ────────────────────────────────────────────────────────────────
router.get("/risk/var", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    res.json({
      historicalVar95: 0, historicalVar99: 0,
      simulationVar95: 0, simulationVar99: 0,
      expectedShortfall95: 0, expectedShortfall99: 0,
      portfolioVolatility: 0, dailyVar: 0,
      weeklyVar: 0, monthlyVar: 0,
    });
    return;
  }

  const { data: trades } = await supabase.from("trades").select("*");
  const all = trades ?? [];
  const open = all.filter(t => t.status === "open");
  const closed = all.filter(t => t.status === "closed");

  const totalExposure = open.reduce((s, t) => s + (t.entry_price ?? 0) * (t.quantity ?? 0), 0);
  const pnls = closed.map(t => t.profit_percent ?? 0);
  const avgPnl = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
  const variance = pnls.length > 1 ? pnls.reduce((s, p) => s + Math.pow(p - avgPnl, 2), 0) / (pnls.length - 1) : 3.5;
  const vol = Math.sqrt(variance) || 3.5;

  const historicalVar95 = totalExposure * (1.645 * (vol / 100));
  const historicalVar99 = totalExposure * (2.326 * (vol / 100));
  const simulationVar95 = historicalVar95 * 1.1;
  const simulationVar99 = historicalVar99 * 1.12;
  const es95 = historicalVar95 * 1.25;
  const es99 = historicalVar99 * 1.3;

  res.json({
    historicalVar95: Math.round(historicalVar95 * 100) / 100,
    historicalVar99: Math.round(historicalVar99 * 100) / 100,
    simulationVar95: Math.round(simulationVar95 * 100) / 100,
    simulationVar99: Math.round(simulationVar99 * 100) / 100,
    expectedShortfall95: Math.round(es95 * 100) / 100,
    expectedShortfall99: Math.round(es99 * 100) / 100,
    portfolioVolatility: Math.round(vol * 100) / 100,
    dailyVar: Math.round(historicalVar95 * 100) / 100,
    weeklyVar: Math.round(historicalVar95 * Math.sqrt(5) * 100) / 100,
    monthlyVar: Math.round(historicalVar95 * Math.sqrt(21) * 100) / 100,
  });
});

// ── DRAWDOWN ENGINE ───────────────────────────────────────────────────────────
router.get("/risk/drawdown", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    res.json({
      peakValue: BASE_CAPITAL, currentValue: BASE_CAPITAL,
      drawdownAmount: 0, drawdownPct: 0, maxDrawdownPct: 0,
      recoveryNeeded: 0, status: "safe",
      history: [],
    });
    return;
  }

  const { data: trades } = await supabase.from("trades").select("profit_loss, exit_time, status");
  const closed = (trades ?? []).filter(t => t.status === "closed" && t.exit_time);
  closed.sort((a, b) => new Date(a.exit_time!).getTime() - new Date(b.exit_time!).getTime());

  let runningValue = BASE_CAPITAL;
  let peak = BASE_CAPITAL;
  let maxDrawdownPct = 0;
  const history: { date: string; value: number; drawdownPct: number }[] = [];

  for (const t of closed) {
    runningValue += t.profit_loss ?? 0;
    if (runningValue > peak) peak = runningValue;
    const dd = peak > 0 ? ((peak - runningValue) / peak) * 100 : 0;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    history.push({
      date: new Date(t.exit_time!).toLocaleDateString(),
      value: Math.round(runningValue * 100) / 100,
      drawdownPct: Math.round(dd * 100) / 100,
    });
  }

  const currentDrawdown = peak > 0 ? ((peak - runningValue) / peak) * 100 : 0;
  const recoveryNeeded = runningValue < peak ? ((peak - runningValue) / runningValue) * 100 : 0;

  const status = currentDrawdown >= 20 ? "critical" : currentDrawdown >= 10 ? "danger" : currentDrawdown >= 5 ? "warning" : "safe";

  res.json({
    peakValue: Math.round(peak * 100) / 100,
    currentValue: Math.round(runningValue * 100) / 100,
    drawdownAmount: Math.round((peak - runningValue) * 100) / 100,
    drawdownPct: Math.round(currentDrawdown * 100) / 100,
    maxDrawdownPct: Math.round(maxDrawdownPct * 100) / 100,
    recoveryNeeded: Math.round(recoveryNeeded * 100) / 100,
    status,
    history: history.slice(-30),
  });
});

// ── LEVERAGE MONITOR ──────────────────────────────────────────────────────────
router.get("/risk/leverage", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    res.json({
      currentLeverage: 0, recommendedLeverage: 3, maxLeverage: 5,
      marginUsed: 0, marginAvailable: BASE_CAPITAL, marginUsedPct: 0,
      liquidationDistance: null, status: "safe",
    });
    return;
  }

  const { data: trades } = await supabase.from("trades").select("entry_price, quantity, status, stop_loss");
  const open = (trades ?? []).filter(t => t.status === "open");
  const totalExposure = open.reduce((s, t) => s + (t.entry_price ?? 0) * (t.quantity ?? 0), 0);
  const currentLeverage = totalExposure > BASE_CAPITAL ? totalExposure / BASE_CAPITAL : totalExposure > 0 ? totalExposure / BASE_CAPITAL : 0;
  const marginUsedPct = Math.min(100, (totalExposure / BASE_CAPITAL) * 100);
  const marginUsed = Math.min(BASE_CAPITAL, totalExposure);
  const liquidationDistance = open.length > 0 ? 12.5 : null;

  const status = currentLeverage > 8 ? "critical" : currentLeverage > 5 ? "danger" : currentLeverage > 3 ? "warning" : "safe";

  res.json({
    currentLeverage: Math.round(currentLeverage * 100) / 100,
    recommendedLeverage: 3,
    maxLeverage: 5,
    marginUsed: Math.round(marginUsed * 100) / 100,
    marginAvailable: Math.round((BASE_CAPITAL - marginUsed) * 100) / 100,
    marginUsedPct: Math.round(marginUsedPct * 10) / 10,
    liquidationDistance,
    status,
  });
});

// ── AI RISK ADVISOR ───────────────────────────────────────────────────────────
router.get("/risk/ai-advisor", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    res.json({
      overallAssessment: "System is in offline mode. No live positions to analyze. Connect your database to enable AI risk analysis.",
      riskLevel: "low",
      confidence: 45,
      alerts: [],
      recommendations: [
        "Connect SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable live risk analysis",
        "Start with small positions to calibrate the risk engine",
        "Always set stop losses on every position",
      ],
      positionAdvice: [],
      generatedAt: new Date().toISOString(),
    });
    return;
  }

  const { data: trades } = await supabase.from("trades").select("*");
  const all = trades ?? [];
  const open = all.filter(t => t.status === "open");
  const closed = all.filter(t => t.status === "closed");

  const totalExposure = open.reduce((s, t) => s + (t.entry_price ?? 0) * (t.quantity ?? 0), 0);
  const exposurePct = (totalExposure / BASE_CAPITAL) * 100;
  const posWithoutStops = open.filter(t => !t.stop_loss);
  const winRate = closed.length > 0 ? (closed.filter(t => (t.profit_loss ?? 0) > 0).length / closed.length) * 100 : 0;

  const symMap = new Map<string, number>();
  for (const t of open) symMap.set(t.symbol, (symMap.get(t.symbol) ?? 0) + 1);
  const highConcentration = Array.from(symMap.entries()).filter(([, c]) => c > 2);

  const alerts: { severity: string; message: string }[] = [];
  const recommendations: string[] = [];
  const positionAdvice: { symbol: string; advice: string; action: string }[] = [];

  if (posWithoutStops.length > 0) {
    alerts.push({ severity: "critical", message: `${posWithoutStops.length} position(s) have no stop loss — immediate risk to capital` });
    for (const p of posWithoutStops) {
      positionAdvice.push({ symbol: p.symbol, advice: "No stop loss set. Set a stop loss immediately to protect downside.", action: "set_stop" });
    }
  }
  if (exposurePct > 80) alerts.push({ severity: "danger", message: `Exposure at ${exposurePct.toFixed(1)}% of account — dangerously high` });
  else if (exposurePct > 60) alerts.push({ severity: "warning", message: `Exposure at ${exposurePct.toFixed(1)}% of account — approaching limit` });
  if (highConcentration.length > 0) {
    for (const [sym] of highConcentration) {
      alerts.push({ severity: "warning", message: `High concentration in ${sym} — consider reducing` });
      positionAdvice.push({ symbol: sym, advice: "Multiple positions in same asset increase correlation risk. Consider reducing size by 30-40%.", action: "reduce_size" });
    }
  }
  if (winRate < 40 && closed.length >= 5) {
    alerts.push({ severity: "warning", message: `Win rate at ${winRate.toFixed(0)}% — below optimal threshold` });
    recommendations.push("Win rate below 40% — review entry conditions and tighten AI confidence filters");
  }

  if (recommendations.length === 0) recommendations.push("Risk profile is healthy. Continue current position management.");
  if (open.length === 0) recommendations.push("No open positions. Market is awaiting entry opportunities with good risk/reward setups.");
  recommendations.push("Ensure every new trade has a minimum 1.5:1 risk-reward ratio before entry");
  recommendations.push("Monitor correlation between crypto positions — they often move together in market events");

  const riskLevel = alerts.some(a => a.severity === "critical") ? "critical"
    : alerts.some(a => a.severity === "danger") ? "high"
    : alerts.some(a => a.severity === "warning") ? "medium" : "low";

  let overallAssessment = "";
  if (open.length === 0) {
    overallAssessment = "Portfolio is in full cash. No active risk exposure. System is ready for new opportunities.";
  } else {
    const parts = [`${open.length} active position${open.length > 1 ? "s" : ""} with ${exposurePct.toFixed(0)}% account exposure.`];
    if (posWithoutStops.length > 0) parts.push(`${posWithoutStops.length} position${posWithoutStops.length > 1 ? "s" : ""} require immediate stop loss placement.`);
    if (riskLevel === "low") parts.push("Overall risk profile is well-managed.");
    else if (riskLevel === "medium") parts.push("Some risk areas require attention.");
    else parts.push("Immediate risk management action required.");
    overallAssessment = parts.join(" ");
  }

  res.json({
    overallAssessment,
    riskLevel,
    confidence: Math.min(90, 50 + closed.length * 2 + (open.length > 0 ? 10 : 0)),
    alerts,
    recommendations,
    positionAdvice,
    generatedAt: new Date().toISOString(),
  });
});

// ── RISK RULES ────────────────────────────────────────────────────────────────
router.get("/risk/rules", async (_req, res): Promise<void> => {
  res.json([
    { id: 1, rule: "Max 2% account risk per trade", category: "position", active: true, phase: null },
    { id: 2, rule: "Daily loss limit: 5% of account — halt trading if hit", category: "daily", active: true, phase: null },
    { id: 3, rule: "Max open exposure: 60% of account", category: "exposure", active: true, phase: null },
    { id: 4, rule: "Stop loss required on every trade — no exceptions", category: "protection", active: true, phase: null },
    { id: 5, rule: "Maximum 3 highly correlated positions simultaneously", category: "correlation", active: true, phase: null },
    { id: 6, rule: "Minimum AI confidence: 65% before entering a trade", category: "ai", active: true, phase: null },
    { id: 7, rule: "Minimum Risk:Reward ratio 1.5:1 on every trade", category: "rr", active: true, phase: null },
    { id: 8, rule: "Maximum leverage: 3x recommended (5x hard limit)", category: "leverage", active: true, phase: null },
    { id: 9, rule: "No new trades during last 30 min before major news events", category: "timing", active: false, phase: "Phase 9" },
    { id: 10, rule: "Automatic position reduction when drawdown exceeds 10%", category: "drawdown", active: false, phase: "Phase 9" },
    { id: 11, rule: "Portfolio correlation check before every new entry", category: "correlation", active: false, phase: "Phase 10" },
    { id: 12, rule: "Automated hedging when VaR exceeds 5% of capital", category: "hedge", active: false, phase: "Phase 10" },
  ]);
});

// ── RISK ALERTS ───────────────────────────────────────────────────────────────
router.get("/risk/alerts", async (_req, res): Promise<void> => {
  if (isOfflineMode) { res.json([]); return; }

  const { data, error } = await supabase
    .from("risk_events")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(e => ({
    id: e.id, type: e.type, severity: e.severity, message: e.message,
    detail: e.detail, resolved: e.resolved, createdAt: e.created_at,
  })));
});

// ── RISK HISTORY ──────────────────────────────────────────────────────────────
router.get("/risk/history", async (_req, res): Promise<void> => {
  if (isOfflineMode) { res.json([]); return; }

  const { data, error } = await supabase
    .from("risk_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(e => ({
    id: e.id, type: e.type, severity: e.severity, message: e.message,
    detail: e.detail, resolved: e.resolved, createdAt: e.created_at,
  })));
});

// ── TRADE APPROVAL ────────────────────────────────────────────────────────────
router.post("/risk/approve-trade", async (req, res): Promise<void> => {
  const { symbol, side, requestedSize, entry, stopLoss, aiConfidence, account } = req.body;

  const accountBalance = account ?? BASE_CAPITAL;
  const stopDistance = Math.abs((entry ?? 0) - (stopLoss ?? entry * 0.97));
  const riskAmount = requestedSize * stopDistance;
  const riskPct = (riskAmount / accountBalance) * 100;
  const positionValue = (entry ?? 0) * requestedSize;
  const exposurePct = (positionValue / accountBalance) * 100;
  const confidence = aiConfidence ?? 70;

  const issues: string[] = [];
  let decision = "approved";
  let approvedSize = requestedSize;
  let reason = "Trade meets all risk parameters.";

  if (riskPct > 2) {
    issues.push(`Risk per trade ${riskPct.toFixed(1)}% exceeds 2% limit`);
    approvedSize = approvedSize * (2 / riskPct);
    decision = "reduced";
  }
  if (confidence < 65) {
    issues.push(`AI confidence ${confidence}% below minimum 65% threshold`);
    if (confidence < 50) { decision = "rejected"; reason = "AI confidence too low to approve trade."; }
  }
  if (!stopLoss) {
    issues.push("No stop loss provided — required for all trades");
    decision = "rejected";
    reason = "Stop loss is required. Trade rejected.";
  }
  if (exposurePct > 60) {
    issues.push(`Position would create ${exposurePct.toFixed(0)}% exposure — above 60% limit`);
    approvedSize = approvedSize * (60 / exposurePct);
    if (decision === "approved") decision = "reduced";
  }

  const riskScore = calcRiskScore(exposurePct, 3, 1, 0, 0);

  if (decision === "approved" && issues.length > 0) {
    decision = "modified";
    reason = "Trade approved with modifications: " + issues.join("; ");
  } else if (decision === "approved") {
    reason = "All risk checks passed. Trade approved.";
  }

  if (!isOfflineMode) {
    await supabase.from("approvals").insert({
      symbol: symbol ?? "UNKNOWN",
      side: side ?? "long",
      requested_size: requestedSize,
      approved_size: Math.round(approvedSize * 10000) / 10000,
      decision,
      reason,
      risk_score: riskScore,
      ai_confidence: confidence,
    }).single();
  }

  res.json({
    decision,
    approvedSize: Math.round(approvedSize * 10000) / 10000,
    reason,
    issues,
    riskScore,
    riskPct: Math.round(riskPct * 100) / 100,
    positionValue: Math.round(positionValue * 100) / 100,
  });
});

// ── POSITION SIZE CALCULATOR ──────────────────────────────────────────────────
router.post("/risk/calculate", async (req, res): Promise<void> => {
  const { account, riskPercent, entry, stopLoss } = req.body;
  const riskAmount = account * (riskPercent / 100);
  const stopDistance = Math.abs(entry - stopLoss);
  const positionSize = stopDistance > 0 ? riskAmount / stopDistance : 0;
  const riskReward = stopDistance > 0 ? (entry * 0.05) / stopDistance : 0;
  res.json({
    positionSize: Math.round(positionSize * 10000) / 10000,
    riskAmount: Math.round(riskAmount * 100) / 100,
    stopDistance: Math.round(stopDistance * 100) / 100,
    riskReward: Math.round(riskReward * 100) / 100,
  });
});

// ── STRESS TEST ───────────────────────────────────────────────────────────────
router.get("/risk/stress-test", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    const base = [
      { name: "Market Crash", description: "Severe market selloff (-30%)", marketMove: -30, portfolioMove: -36, impact: 0, newPortfolioValue: BASE_CAPITAL, survivable: true, severity: "low" },
      { name: "Flash Crash", description: "Sudden liquidity crisis (-15%)", marketMove: -15, portfolioMove: -22.5, impact: 0, newPortfolioValue: BASE_CAPITAL, survivable: true, severity: "low" },
      { name: "Volatility Explosion", description: "ATR triples, spreads widen 3x", marketMove: -12, portfolioMove: -18, impact: 0, newPortfolioValue: BASE_CAPITAL, survivable: true, severity: "low" },
      { name: "Liquidity Crisis", description: "Low liquidity, high slippage (-8%)", marketMove: -8, portfolioMove: -12, impact: 0, newPortfolioValue: BASE_CAPITAL, survivable: true, severity: "low" },
      { name: "Bear Market", description: "Extended bear market (-40%)", marketMove: -40, portfolioMove: -44, impact: 0, newPortfolioValue: BASE_CAPITAL, survivable: true, severity: "low" },
      { name: "Bull Run", description: "Strong market rally (+30%)", marketMove: 30, portfolioMove: 36, impact: 0, newPortfolioValue: BASE_CAPITAL, survivable: true, severity: "positive" },
    ];
    res.json(base);
    return;
  }

  const { data: trades } = await supabase.from("trades").select("entry_price, quantity, status");
  const open = (trades ?? []).filter(t => t.status === "open");
  const openExposure = open.reduce((s, t) => s + (t.entry_price ?? 0) * (t.quantity ?? 0), 0);

  const scenarios = [
    { name: "Market Crash", description: "Severe market selloff (-30%)", marketMove: -30, assetBeta: 1.2 },
    { name: "Flash Crash", description: "Sudden liquidity crisis (-15%)", marketMove: -15, assetBeta: 1.5 },
    { name: "Volatility Explosion", description: "ATR triples, spreads widen 3x", marketMove: -12, assetBeta: 1.8 },
    { name: "Liquidity Crisis", description: "Low liquidity, high slippage (-8%)", marketMove: -8, assetBeta: 2.0 },
    { name: "Bear Market", description: "Extended bear market (-40%)", marketMove: -40, assetBeta: 1.1 },
    { name: "Bull Run", description: "Strong market rally (+30%)", marketMove: 30, assetBeta: 1.2 },
  ];

  const results = scenarios.map(s => {
    const portfolioMove = s.marketMove * s.assetBeta;
    const impact = openExposure * (portfolioMove / 100);
    const newValue = BASE_CAPITAL + impact;
    const survivable = newValue > BASE_CAPITAL * 0.5;
    const abs = Math.abs(portfolioMove);
    const severity = impact >= 0 ? "positive" : abs > 30 ? "critical" : abs > 15 ? "high" : abs > 8 ? "medium" : "low";
    return {
      name: s.name, description: s.description,
      marketMove: s.marketMove,
      portfolioMove: Math.round(portfolioMove * 10) / 10,
      impact: Math.round(impact * 100) / 100,
      newPortfolioValue: Math.round(newValue * 100) / 100,
      survivable, severity,
    };
  });

  res.json(results);
});

// ── RISK REPORT ───────────────────────────────────────────────────────────────
router.get("/risk/report", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    res.json({
      period: "daily", generatedAt: new Date().toISOString(),
      summary: { riskScore: 12, totalTrades: 0, winRate: 0, maxDrawdown: 0, avgExposure: 0, totalPnl: 0 },
      topRisks: ["No database connected — all metrics are placeholders"],
      improvements: ["Connect database to generate full risk reports"],
    });
    return;
  }

  const { data: trades } = await supabase.from("trades").select("*");
  const all = trades ?? [];
  const closed = all.filter(t => t.status === "closed");
  const open = all.filter(t => t.status === "open");

  const totalPnl = closed.reduce((s, t) => s + (t.profit_loss ?? 0), 0);
  const winRate = closed.length > 0 ? (closed.filter(t => (t.profit_loss ?? 0) > 0).length / closed.length) * 100 : 0;
  const maxDrawdown = closed.length > 0 ? Math.abs(Math.min(0, ...closed.map(t => t.profit_loss ?? 0))) / BASE_CAPITAL * 100 : 0;
  const avgExposure = open.reduce((s, t) => s + (t.entry_price ?? 0) * (t.quantity ?? 0), 0) / BASE_CAPITAL * 100;
  const posWithoutStops = open.filter(t => !t.stop_loss).length;

  const topRisks: string[] = [];
  if (posWithoutStops > 0) topRisks.push(`${posWithoutStops} open position(s) without stop loss`);
  if (maxDrawdown > 10) topRisks.push(`Max drawdown reached ${maxDrawdown.toFixed(1)}% — review strategy`);
  if (avgExposure > 60) topRisks.push(`Average exposure ${avgExposure.toFixed(0)}% exceeds recommended 60%`);
  if (topRisks.length === 0) topRisks.push("No significant risks detected in current period");

  const improvements: string[] = [];
  if (winRate < 50 && closed.length >= 5) improvements.push("Improve entry timing — win rate below 50%");
  improvements.push("Maintain stop losses on all positions");
  improvements.push("Review position sizing to stay within 2% risk per trade");

  res.json({
    period: "daily",
    generatedAt: new Date().toISOString(),
    summary: {
      riskScore: calcRiskScore(avgExposure, 3, 1, maxDrawdown, 0),
      totalTrades: all.length,
      winRate: Math.round(winRate * 10) / 10,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      avgExposure: Math.round(avgExposure * 10) / 10,
      totalPnl: Math.round(totalPnl * 100) / 100,
    },
    topRisks,
    improvements,
  });
});

export default router;
