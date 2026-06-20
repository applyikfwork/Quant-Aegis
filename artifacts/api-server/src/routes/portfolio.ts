import { Router, type IRouter } from "express";
import { supabase, isOfflineMode } from "../lib/supabase";
import { computeAccount, computePositions, computePerformance, getClosedTrades, getLivePrice } from "../lib/paper-state";

const router: IRouter = Router();

// Helper: check if Supabase trades table exists
async function hasTradesTable(): Promise<boolean> {
  const { error } = await supabase.from("trades").select("id").limit(1);
  return !error || (!error.message?.includes("does not exist") && !error.message?.includes("schema cache"));
}

// Unified portfolio summary from paper-state (the single source of truth for the trading account)
function paperPortfolioSummary() {
  const acc = computeAccount();
  const perf = computePerformance();
  const pos = computePositions();
  const today = new Date().toDateString();
  const todayPnl = getClosedTrades()
    .filter(t => new Date(t.closeTime).toDateString() === today)
    .reduce((s, t) => s + t.pnl, 0);
  const totalExposure = pos.reduce((s, p) => s + p.entryPrice * p.quantity, 0);
  const riskLevel = totalExposure > acc.initialBalance * 0.8 ? "high"
    : totalExposure > acc.initialBalance * 0.5 ? "medium" : "low";
  const diversification = Math.min(100, new Set(pos.map(p => p.symbol)).size * 15);
  const healthScore = Math.min(100, Math.round(
    diversification * 0.25 +
    Math.min(100, perf.winRate) * 0.3 +
    (riskLevel === "low" ? 100 : riskLevel === "medium" ? 65 : 30) * 0.25 +
    (acc.freeMargin / acc.initialBalance) * 100 * 0.2
  ));
  return {
    totalValue: acc.equity,
    baseCapital: acc.initialBalance,
    realizedPnl: Math.round(acc.realizedPnl * 100) / 100,
    unrealizedPnl: acc.unrealizedPnl,
    totalPnl: Math.round((acc.realizedPnl + acc.unrealizedPnl) * 100) / 100,
    totalReturn: Math.round(((acc.equity - acc.initialBalance) / acc.initialBalance) * 10000) / 100,
    dailyPnl: Math.round(todayPnl * 100) / 100,
    freeCapital: acc.freeMargin,
    usedCapital: acc.usedMargin,
    openPositions: pos.length,
    closedTrades: perf.totalTrades,
    winRate: perf.winRate,
    healthScore,
    riskLevel,
  };
}

// ── PORTFOLIO SUMMARY ─────────────────────────────────────────────────────────
router.get("/portfolio/summary", async (_req, res): Promise<void> => {
  if (isOfflineMode) { res.json(paperPortfolioSummary()); return; }

  const tablesExist = await hasTradesTable();
  if (!tablesExist) { res.json(paperPortfolioSummary()); return; }

  // DB exists — merge DB trades with live paper-state positions
  const { data: trades, error } = await supabase.from("trades").select("*");
  if (error) { res.json(paperPortfolioSummary()); return; }

  const acc = computeAccount();
  const perf = computePerformance();
  const pos = computePositions();

  const dbAll = trades ?? [];
  const dbClosed = dbAll.filter(t => t.status === "closed");
  const dbOpen = dbAll.filter(t => t.status === "open");

  const dbRealizedPnl = dbClosed.reduce((s, t) => s + (t.profit_loss ?? 0), 0);
  const dbUnrealizedPnl = pos.reduce((s, p) => s + p.unrealizedPnl, 0);

  // Combine DB + paper positions for open count
  const totalOpen = dbOpen.length + pos.length;
  const totalClosed = dbClosed.length + perf.totalTrades;

  const today = new Date().toDateString();
  const todayPnl = getClosedTrades().filter(t => new Date(t.closeTime).toDateString() === today).reduce((s, t) => s + t.pnl, 0)
    + dbClosed.filter(t => t.exit_time && new Date(t.exit_time).toDateString() === today).reduce((s, t) => s + (t.profit_loss ?? 0), 0);

  const allClosed = [...dbClosed.map(t => ({ pnl: t.profit_loss ?? 0 })), ...perf.pnlHistory.map(t => ({ pnl: t.pnl }))];
  const winners = allClosed.filter(t => t.pnl > 0);
  const winRate = allClosed.length > 0 ? (winners.length / allClosed.length) * 100 : perf.winRate;

  const totalValue = acc.equity + dbRealizedPnl;
  const totalRealizedPnl = acc.realizedPnl + dbRealizedPnl;
  const totalUnrealizedPnl = acc.unrealizedPnl;

  const openExposure = pos.reduce((s, p) => s + p.currentPrice * p.quantity, 0)
    + dbOpen.reduce((s, t) => s + (t.entry_price ?? 0) * (t.quantity ?? 0), 0);
  const riskLevel = openExposure > acc.initialBalance * 0.8 ? "high"
    : openExposure > acc.initialBalance * 0.5 ? "medium" : "low";
  const symbols = new Set([...pos.map(p => p.symbol), ...dbOpen.map(t => t.symbol)]);
  const diversification = Math.min(100, symbols.size * 15);
  const healthScore = Math.min(100, Math.round(
    diversification * 0.25 + Math.min(100, winRate) * 0.3 +
    (riskLevel === "low" ? 100 : riskLevel === "medium" ? 65 : 30) * 0.25 +
    (acc.freeMargin / acc.initialBalance) * 100 * 0.2
  ));

  res.json({
    totalValue: Math.round(totalValue * 100) / 100,
    baseCapital: acc.initialBalance,
    realizedPnl: Math.round(totalRealizedPnl * 100) / 100,
    unrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
    totalPnl: Math.round((totalRealizedPnl + totalUnrealizedPnl) * 100) / 100,
    totalReturn: Math.round(((totalValue - acc.initialBalance) / acc.initialBalance) * 10000) / 100,
    dailyPnl: Math.round(todayPnl * 100) / 100,
    freeCapital: Math.round(acc.freeMargin * 100) / 100,
    usedCapital: Math.round(acc.usedMargin * 100) / 100,
    openPositions: totalOpen,
    closedTrades: totalClosed,
    winRate: Math.round(winRate * 10) / 10,
    healthScore,
    riskLevel,
  });
});

// ── PORTFOLIO HOLDINGS ────────────────────────────────────────────────────────
router.get("/portfolio/holdings", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    const pos = computePositions();
    const acc = computeAccount();
    return res.json(buildHoldings(pos, acc)) as unknown as void;
  }

  const tablesExist = await hasTradesTable();
  if (!tablesExist) {
    const pos = computePositions();
    const acc = computeAccount();
    return res.json(buildHoldings(pos, acc)) as unknown as void;
  }

  // Merge DB open trades + paper positions
  const { data: dbTrades } = await supabase.from("trades").select("*").eq("status", "open");
  const pos = computePositions();
  const acc = computeAccount();

  const holdingMap = new Map<string, { symbol: string; side: string; quantity: number; totalCost: number; currentValue: number; stopLoss: number | null; takeProfit: number | null; trades: number }>();

  // Add paper positions
  for (const p of pos) {
    const e = holdingMap.get(p.symbol) ?? { symbol: p.symbol, side: p.side, quantity: 0, totalCost: 0, currentValue: 0, stopLoss: null, takeProfit: null, trades: 0 };
    e.quantity += p.quantity;
    e.totalCost += p.entryPrice * p.quantity;
    e.currentValue += p.currentPrice * p.quantity;
    e.trades++;
    if (p.stopLoss) e.stopLoss = p.stopLoss;
    if (p.takeProfit) e.takeProfit = p.takeProfit;
    holdingMap.set(p.symbol, e);
  }

  // Add DB open trades
  for (const t of dbTrades ?? []) {
    const livePrice = getLivePrice(t.symbol) || (t.entry_price ?? 0);
    const e = holdingMap.get(t.symbol) ?? { symbol: t.symbol, side: t.side ?? "long", quantity: 0, totalCost: 0, currentValue: 0, stopLoss: null, takeProfit: null, trades: 0 };
    e.quantity += t.quantity ?? 0;
    e.totalCost += (t.entry_price ?? 0) * (t.quantity ?? 0);
    e.currentValue += livePrice * (t.quantity ?? 0);
    e.trades++;
    if (t.stop_loss) e.stopLoss = t.stop_loss;
    if (t.take_profit) e.takeProfit = t.take_profit;
    holdingMap.set(t.symbol, e);
  }

  const totalExposure = Array.from(holdingMap.values()).reduce((s, h) => s + h.currentValue, 0) + acc.freeMargin * 0.15;
  const holdings = Array.from(holdingMap.values()).map(h => {
    const avgCost = h.quantity > 0 ? h.totalCost / h.quantity : 0;
    const currentPrice = h.quantity > 0 ? h.currentValue / h.quantity : avgCost;
    const pnl = h.currentValue - h.totalCost;
    const pnlPct = h.totalCost > 0 ? (pnl / h.totalCost) * 100 : 0;
    const allocationPct = totalExposure > 0 ? (h.currentValue / totalExposure) * 100 : 0;
    return {
      symbol: h.symbol, side: h.side,
      quantity: Math.round(h.quantity * 10000) / 10000,
      averageCost: Math.round(avgCost * 100) / 100,
      currentPrice: Math.round(currentPrice * 100) / 100,
      marketValue: Math.round(h.currentValue * 100) / 100,
      totalCost: Math.round(h.totalCost * 100) / 100,
      unrealizedPnl: Math.round(pnl * 100) / 100,
      unrealizedPnlPct: Math.round(pnlPct * 100) / 100,
      allocationPct: Math.round(allocationPct * 10) / 10,
      riskContrib: Math.round(allocationPct * 1.2 * 10) / 10,
      trades: h.trades, stopLoss: h.stopLoss, takeProfit: h.takeProfit,
    };
  });

  const cashValue = acc.freeMargin;
  const cashPct = totalExposure > 0 ? (cashValue / totalExposure) * 100 : 100;
  holdings.push({
    symbol: "CASH", side: "long", quantity: 1,
    averageCost: Math.round(cashValue * 100) / 100,
    currentPrice: Math.round(cashValue * 100) / 100,
    marketValue: Math.round(cashValue * 100) / 100,
    totalCost: Math.round(cashValue * 100) / 100,
    unrealizedPnl: 0, unrealizedPnlPct: 0,
    allocationPct: Math.round(cashPct * 10) / 10,
    riskContrib: 0, trades: 0, stopLoss: null, takeProfit: null,
  });

  res.json(holdings.sort((a, b) => b.marketValue - a.marketValue));
});

function buildHoldings(pos: ReturnType<typeof computePositions>, acc: ReturnType<typeof computeAccount>) {
  const holdingMap = new Map<string, { symbol: string; side: string; quantity: number; totalCost: number; currentValue: number; stopLoss: number | null; takeProfit: number | null; trades: number }>();
  for (const p of pos) {
    const existing = holdingMap.get(p.symbol) ?? { symbol: p.symbol, side: p.side, quantity: 0, totalCost: 0, currentValue: 0, stopLoss: null, takeProfit: null, trades: 0 };
    existing.quantity += p.quantity;
    existing.totalCost += p.entryPrice * p.quantity;
    existing.currentValue += p.currentPrice * p.quantity;
    existing.trades++;
    if (p.stopLoss) existing.stopLoss = p.stopLoss;
    if (p.takeProfit) existing.takeProfit = p.takeProfit;
    holdingMap.set(p.symbol, existing);
  }
  const totalExposure = Array.from(holdingMap.values()).reduce((s, h) => s + h.currentValue, 0) + acc.freeMargin * 0.15;
  const holdings = Array.from(holdingMap.values()).map(h => {
    const avgCost = h.quantity > 0 ? h.totalCost / h.quantity : 0;
    const currentPrice = h.quantity > 0 ? h.currentValue / h.quantity : avgCost;
    const pnl = h.currentValue - h.totalCost;
    const pnlPct = h.totalCost > 0 ? (pnl / h.totalCost) * 100 : 0;
    const allocationPct = totalExposure > 0 ? (h.currentValue / totalExposure) * 100 : 0;
    return {
      symbol: h.symbol, side: h.side,
      quantity: Math.round(h.quantity * 10000) / 10000,
      averageCost: Math.round(avgCost * 100) / 100,
      currentPrice: Math.round(currentPrice * 100) / 100,
      marketValue: Math.round(h.currentValue * 100) / 100,
      totalCost: Math.round(h.totalCost * 100) / 100,
      unrealizedPnl: Math.round(pnl * 100) / 100,
      unrealizedPnlPct: Math.round(pnlPct * 100) / 100,
      allocationPct: Math.round(allocationPct * 10) / 10,
      riskContrib: Math.round(allocationPct * 1.2 * 10) / 10,
      trades: h.trades, stopLoss: h.stopLoss, takeProfit: h.takeProfit,
    };
  });
  const cashValue = acc.freeMargin;
  const cashPct = totalExposure > 0 ? (cashValue / totalExposure) * 100 : 100;
  holdings.push({
    symbol: "CASH", side: "long", quantity: 1,
    averageCost: Math.round(cashValue * 100) / 100,
    currentPrice: Math.round(cashValue * 100) / 100,
    marketValue: Math.round(cashValue * 100) / 100,
    totalCost: Math.round(cashValue * 100) / 100,
    unrealizedPnl: 0, unrealizedPnlPct: 0,
    allocationPct: Math.round(cashPct * 10) / 10,
    riskContrib: 0, trades: 0, stopLoss: null, takeProfit: null,
  });
  return holdings.sort((a, b) => b.marketValue - a.marketValue);
}

// ── PORTFOLIO ALLOCATION ──────────────────────────────────────────────────────
router.get("/portfolio/allocation", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    const pos = computePositions();
    const acc = computeAccount();
    res.json(buildAllocation(pos, acc));
    return;
  }

  const tablesExist = await hasTradesTable();
  if (!tablesExist) {
    const pos = computePositions();
    const acc = computeAccount();
    res.json(buildAllocation(pos, acc));
    return;
  }

  const { data: dbTrades } = await supabase.from("trades").select("symbol, entry_price, quantity, status").eq("status", "open");
  const pos = computePositions();
  const acc = computeAccount();

  const symbolMap = new Map<string, number>();
  let total = 0;

  for (const p of pos) {
    const val = p.currentPrice * p.quantity;
    symbolMap.set(p.symbol, (symbolMap.get(p.symbol) ?? 0) + val);
    total += val;
  }
  for (const t of dbTrades ?? []) {
    const livePrice = getLivePrice(t.symbol) || (t.entry_price ?? 0);
    const val = livePrice * (t.quantity ?? 0);
    symbolMap.set(t.symbol, (symbolMap.get(t.symbol) ?? 0) + val);
    total += val;
  }

  const cashVal = acc.freeMargin;
  total += cashVal;

  const items = [
    ...Array.from(symbolMap.entries()).map(([symbol, value]) => ({
      symbol, value: Math.round(value * 100) / 100,
      pct: Math.round((value / total) * 1000) / 10,
      category: getCryptoCategory(symbol),
    })),
    { symbol: "CASH", value: Math.round(cashVal * 100) / 100, pct: Math.round((cashVal / total) * 1000) / 10, category: "Cash" },
  ];

  res.json(items.sort((a, b) => b.value - a.value));
});

function buildAllocation(pos: ReturnType<typeof computePositions>, acc: ReturnType<typeof computeAccount>) {
  const symbolMap = new Map<string, number>();
  let total = 0;
  for (const p of pos) {
    const val = p.currentPrice * p.quantity;
    symbolMap.set(p.symbol, (symbolMap.get(p.symbol) ?? 0) + val);
    total += val;
  }
  const cashVal = acc.freeMargin;
  total += cashVal;
  return [
    ...Array.from(symbolMap.entries()).map(([symbol, value]) => ({
      symbol, value: Math.round(value * 100) / 100,
      pct: Math.round((value / total) * 1000) / 10,
      category: getCryptoCategory(symbol),
    })),
    { symbol: "CASH", value: Math.round(cashVal * 100) / 100, pct: Math.round((cashVal / total) * 1000) / 10, category: "Cash" },
  ].sort((a, b) => b.value - a.value);
}

// ── PORTFOLIO RISK ────────────────────────────────────────────────────────────
router.get("/portfolio/risk", async (_req, res): Promise<void> => {
  // Always derive risk from paper-state — it has the most complete position data
  const pos = computePositions();
  const perf = computePerformance();
  const acc = computeAccount();

  const openExposure = pos.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
  const concentrationRisk = pos.length > 0 ? (() => {
    const symMap = new Map<string, number>();
    for (const p of pos) symMap.set(p.symbol, (symMap.get(p.symbol) ?? 0) + p.currentPrice * p.quantity);
    const largest = Math.max(...Array.from(symMap.values()));
    return openExposure > 0 ? (largest / openExposure) * 100 : 0;
  })() : 0;

  const pnls = getClosedTrades().map(t => t.pnlPct);
  const avgPnl = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
  const variance = pnls.length > 1 ? pnls.reduce((s, p) => s + Math.pow(p - avgPnl, 2), 0) / (pnls.length - 1) : 0;
  const volatility = Math.sqrt(variance);
  const negPnls = pnls.filter(p => p < 0);
  const downVar = negPnls.length > 1 ? negPnls.reduce((s, p) => s + Math.pow(p, 2), 0) / negPnls.length : 0;
  const downsideVol = Math.sqrt(downVar);
  const var95 = openExposure * (2.33 * (volatility / 100) * Math.sqrt(1));
  const leverageRisk = openExposure > acc.initialBalance ? ((openExposure / acc.initialBalance - 1) * 100) : 0;
  const positionsWithStops = pos.filter(p => p.stopLoss != null).length;
  const stopLossRate = pos.length > 0 ? (positionsWithStops / pos.length) * 100 : 100;

  res.json({
    openExposure: Math.round(openExposure * 100) / 100,
    exposurePct: Math.round((openExposure / acc.initialBalance) * 1000) / 10,
    concentrationRisk: Math.round(concentrationRisk * 10) / 10,
    portfolioVolatility: Math.round(volatility * 100) / 100,
    downsideVolatility: Math.round(downsideVol * 100) / 100,
    valueAtRisk95: Math.round(var95 * 100) / 100,
    leverageRisk: Math.round(leverageRisk * 10) / 10,
    stopLossRate: Math.round(stopLossRate * 10) / 10,
    maxDrawdown: perf.maxDrawdownPct,
    openPositions: pos.length,
    positionsWithoutStops: pos.length - positionsWithStops,
    riskScore: Math.min(100, Math.round(
      (100 - concentrationRisk) * 0.3 + stopLossRate * 0.3 +
      Math.max(0, 100 - leverageRisk * 2) * 0.2 +
      Math.max(0, 100 - volatility * 5) * 0.2
    )),
  });
});

// ── PORTFOLIO AI ANALYSIS ─────────────────────────────────────────────────────
router.get("/portfolio/ai-analysis", async (_req, res): Promise<void> => {
  const acc = computeAccount();
  const pos = computePositions();
  const perf = computePerformance();
  const symbols = [...new Set(pos.map(p => p.symbol))];
  const openExposure = pos.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
  const freeCapitalPct = Math.max(0, 100 - (openExposure / acc.initialBalance) * 100);
  const posWithoutStops = pos.filter(p => !p.stopLoss).length;

  const recommendations: string[] = [];
  let summary = "";
  let sentiment = "neutral";

  if (pos.length === 0) {
    summary = "Portfolio is fully in cash. No active positions.";
    recommendations.push("Look for high-confidence AI signals to deploy capital");
  } else {
    const bullish = pos.filter(p => p.side === "long").length > pos.length / 2;
    sentiment = bullish ? "bullish" : "bearish";
    const parts: string[] = [];
    if (pos.length === 1) parts.push(`Portfolio concentrated in ${symbols[0]}`);
    else parts.push(`Portfolio has ${pos.length} active positions (${symbols.join(", ")})`);
    if (freeCapitalPct < 20) parts.push("Capital heavily deployed — low cash reserve");
    else parts.push(`Cash reserve at ${freeCapitalPct.toFixed(0)}%`);
    if (perf.winRate >= 60) parts.push("Win rate is strong");
    else if (perf.winRate > 0) parts.push("Win rate needs improvement");
    summary = parts.join(". ") + ".";
    if (posWithoutStops > 0) recommendations.push(`${posWithoutStops} position(s) without stop loss — set stops immediately`);
    if (symbols.length < 3) recommendations.push("Diversify across more assets to reduce concentration risk");
    if (perf.winRate < 50 && perf.totalTrades >= 5) recommendations.push("Win rate below 50% — review strategy entry conditions");
    if (recommendations.length === 0) recommendations.push("Portfolio is well-managed. Continue following current strategy rules");
  }

  res.json({
    summary, sentiment, recommendations,
    confidence: Math.min(100, 50 + (perf.totalTrades * 3) + (pos.length > 0 ? 10 : 0)),
    healthScore: Math.min(100, Math.round(perf.winRate * 0.4 + freeCapitalPct * 0.3 + (posWithoutStops === 0 ? 30 : 0))),
    generatedAt: new Date().toISOString(),
    metrics: {
      openPositions: pos.length, symbolCount: symbols.length,
      freeCapitalPct: Math.round(freeCapitalPct * 10) / 10,
      winRate: perf.winRate, realizedPnl: acc.realizedPnl,
    },
  });
});

// ── PORTFOLIO STRESS TEST ─────────────────────────────────────────────────────
router.get("/portfolio/stress-test", async (_req, res): Promise<void> => {
  const scenarios = [
    { name: "Market Crash", description: "Severe market-wide selloff (-20%)", marketMove: -20, assetBeta: 1.3 },
    { name: "Flash Crash", description: "Sudden liquidity crisis (-12%)", marketMove: -12, assetBeta: 1.5 },
    { name: "High Volatility", description: "VIX spike, 3x volatility increase", marketMove: -8, assetBeta: 1.8 },
    { name: "Bear Market", description: "Extended bear market (-40% over 3 months)", marketMove: -40, assetBeta: 1.1 },
    { name: "Bull Run", description: "Strong market rally (+30%)", marketMove: 30, assetBeta: 1.2 },
    { name: "Stable Growth", description: "Gradual uptrend (+10%)", marketMove: 10, assetBeta: 0.9 },
  ];

  const pos = computePositions();
  const acc = computeAccount();
  const openExposure = pos.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
  const portfolioValue = acc.equity;

  const results = scenarios.map(s => {
    const portfolioMove = s.marketMove * s.assetBeta;
    const impact = openExposure * (portfolioMove / 100);
    const newValue = portfolioValue + impact;
    const survivable = newValue > portfolioValue * 0.5;
    const absMove = Math.abs(portfolioMove);
    const severity = absMove > 30 ? "critical" : absMove > 15 ? "high" : absMove > 8 ? "medium" : "low";
    return {
      name: s.name, description: s.description, marketMove: s.marketMove,
      portfolioMove: Math.round(portfolioMove * 10) / 10,
      impact: Math.round(impact * 100) / 100,
      newPortfolioValue: Math.round(newValue * 100) / 100,
      survivable, severity: impact >= 0 ? "positive" : severity,
    };
  });

  res.json(results);
});

function getCryptoCategory(symbol: string): string {
  if (symbol === "BTCUSDT") return "Store of Value";
  if (symbol === "ETHUSDT") return "Smart Contract";
  if (["SOLUSDT", "AVAXUSDT", "BNBUSDT"].includes(symbol)) return "Layer 1";
  if (["ADAUSDT"].includes(symbol)) return "Layer 1";
  if (["XRPUSDT"].includes(symbol)) return "Payments";
  if (["DOGEUSDT"].includes(symbol)) return "Meme";
  return "Altcoin";
}

export default router;
