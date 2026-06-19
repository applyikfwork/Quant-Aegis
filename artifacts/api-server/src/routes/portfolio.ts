import { Router, type IRouter } from "express";
import { supabase, isOfflineMode } from "../lib/supabase";

const router: IRouter = Router();

const BASE_CAPITAL = 10000; // Default account capital

// ── PORTFOLIO SUMMARY ─────────────────────────────────────────────────────────
router.get("/portfolio/summary", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    res.json({
      totalValue: BASE_CAPITAL, baseCapital: BASE_CAPITAL, realizedPnl: 0, unrealizedPnl: 0,
      totalPnl: 0, totalReturn: 0, dailyPnl: 0, freeCapital: BASE_CAPITAL, usedCapital: 0,
      openPositions: 0, closedTrades: 0, winRate: 0, healthScore: 72, riskLevel: "low",
    });
    return;
  }
  const { data: trades, error } = await supabase.from("trades").select("*");
  if (error) { res.status(500).json({ error: error.message }); return; }

  const all = trades ?? [];
  const closed = all.filter(t => t.status === "closed");
  const open = all.filter(t => t.status === "open");

  const realizedPnl = closed.reduce((s, t) => s + (t.profit_loss ?? 0), 0);
  const unrealizedPnl = open.reduce((s, t) => {
    const entryVal = (t.entry_price ?? 0) * (t.quantity ?? 0);
    return s + entryVal * 0.02; // Mock: assume 2% unrealized for open positions
  }, 0);

  const openExposure = open.reduce((s, t) => s + (t.entry_price ?? 0) * (t.quantity ?? 0), 0);
  const usedCapital = Math.min(openExposure, BASE_CAPITAL);
  const freeCapital = Math.max(0, BASE_CAPITAL - usedCapital);

  const totalValue = BASE_CAPITAL + realizedPnl + unrealizedPnl;
  const totalReturn = ((totalValue - BASE_CAPITAL) / BASE_CAPITAL) * 100;

  const dayTrades = closed.filter(t => {
    if (!t.exit_time) return false;
    const d = new Date(t.exit_time);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const dayPnl = dayTrades.reduce((s, t) => s + (t.profit_loss ?? 0), 0);

  const winners = closed.filter(t => (t.profit_loss ?? 0) > 0);
  const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;

  const diversification = Math.min(100, new Set(open.map(t => t.symbol)).size * 15);
  const riskLevel = openExposure > BASE_CAPITAL * 0.8 ? "high" : openExposure > BASE_CAPITAL * 0.5 ? "medium" : "low";
  const healthScore = Math.min(100, Math.round(
    diversification * 0.25 +
    Math.min(100, winRate) * 0.3 +
    (riskLevel === "low" ? 100 : riskLevel === "medium" ? 65 : 30) * 0.25 +
    (freeCapital / BASE_CAPITAL) * 100 * 0.2
  ));

  res.json({
    totalValue: Math.round(totalValue * 100) / 100,
    baseCapital: BASE_CAPITAL,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
    totalPnl: Math.round((realizedPnl + unrealizedPnl) * 100) / 100,
    totalReturn: Math.round(totalReturn * 100) / 100,
    dailyPnl: Math.round(dayPnl * 100) / 100,
    freeCapital: Math.round(freeCapital * 100) / 100,
    usedCapital: Math.round(usedCapital * 100) / 100,
    openPositions: open.length,
    closedTrades: closed.length,
    winRate: Math.round(winRate * 10) / 10,
    healthScore,
    riskLevel,
  });
});

// ── PORTFOLIO HOLDINGS ────────────────────────────────────────────────────────
router.get("/portfolio/holdings", async (_req, res): Promise<void> => {
  if (isOfflineMode) { res.json([]); return; }
  const { data: trades, error } = await supabase.from("trades").select("*");
  if (error) { res.status(500).json({ error: error.message }); return; }

  const all = trades ?? [];
  const open = all.filter(t => t.status === "open");

  // Aggregate by symbol
  const holdingMap = new Map<string, {
    symbol: string; quantity: number; totalCost: number; side: string;
    trades: number; stopLoss: number | null; takeProfit: number | null;
  }>();

  for (const t of open) {
    const existing = holdingMap.get(t.symbol) ?? {
      symbol: t.symbol, quantity: 0, totalCost: 0, side: t.side ?? "long", trades: 0, stopLoss: null, takeProfit: null,
    };
    existing.quantity += t.quantity ?? 0;
    existing.totalCost += (t.entry_price ?? 0) * (t.quantity ?? 0);
    existing.trades += 1;
    if (t.stop_loss && (!existing.stopLoss || t.stop_loss > existing.stopLoss)) existing.stopLoss = t.stop_loss;
    if (t.take_profit && (!existing.takeProfit || t.take_profit < existing.takeProfit)) existing.takeProfit = t.take_profit;
    holdingMap.set(t.symbol, existing);
  }

  const totalExposure = Array.from(holdingMap.values()).reduce((s, h) => s + h.totalCost, 0) + BASE_CAPITAL * 0.15; // +15% cash

  const holdings = Array.from(holdingMap.values()).map(h => {
    const avgCost = h.quantity > 0 ? h.totalCost / h.quantity : 0;
    const mockCurrentPrice = avgCost * (1 + (Math.random() * 0.06 - 0.03)); // ±3% mock fluctuation
    const currentValue = mockCurrentPrice * h.quantity;
    const pnl = currentValue - h.totalCost;
    const pnlPct = h.totalCost > 0 ? (pnl / h.totalCost) * 100 : 0;
    const allocationPct = totalExposure > 0 ? (h.totalCost / totalExposure) * 100 : 0;
    const riskContrib = Math.min(100, allocationPct * 1.2); // simplified risk contribution

    return {
      symbol: h.symbol, side: h.side, quantity: Math.round(h.quantity * 10000) / 10000,
      averageCost: Math.round(avgCost * 100) / 100,
      currentPrice: Math.round(mockCurrentPrice * 100) / 100,
      marketValue: Math.round(currentValue * 100) / 100,
      totalCost: Math.round(h.totalCost * 100) / 100,
      unrealizedPnl: Math.round(pnl * 100) / 100,
      unrealizedPnlPct: Math.round(pnlPct * 100) / 100,
      allocationPct: Math.round(allocationPct * 10) / 10,
      riskContrib: Math.round(riskContrib * 10) / 10,
      trades: h.trades,
      stopLoss: h.stopLoss,
      takeProfit: h.takeProfit,
    };
  });

  // Add cash holding
  const cashValue = BASE_CAPITAL * 0.15;
  const cashPct = totalExposure > 0 ? (cashValue / totalExposure) * 100 : 100;
  holdings.push({
    symbol: "CASH", side: "long", quantity: 1, averageCost: cashValue,
    currentPrice: cashValue, marketValue: cashValue, totalCost: cashValue,
    unrealizedPnl: 0, unrealizedPnlPct: 0,
    allocationPct: Math.round(cashPct * 10) / 10,
    riskContrib: 0, trades: 0, stopLoss: null, takeProfit: null,
  });

  res.json(holdings.sort((a, b) => b.marketValue - a.marketValue));
});

// ── PORTFOLIO ALLOCATION ──────────────────────────────────────────────────────
router.get("/portfolio/allocation", async (_req, res): Promise<void> => {
  if (isOfflineMode) { res.json([{ symbol: "CASH", value: BASE_CAPITAL, pct: 100, category: "Cash" }]); return; }
  const { data: trades } = await supabase.from("trades").select("symbol, entry_price, quantity, status");
  const open = (trades ?? []).filter(t => t.status === "open");

  const symbolMap = new Map<string, number>();
  let total = 0;
  for (const t of open) {
    const val = (t.entry_price ?? 0) * (t.quantity ?? 0);
    symbolMap.set(t.symbol, (symbolMap.get(t.symbol) ?? 0) + val);
    total += val;
  }
  const cashVal = BASE_CAPITAL * 0.15;
  total += cashVal;

  const items = [
    ...Array.from(symbolMap.entries()).map(([symbol, value]) => ({
      symbol, value: Math.round(value * 100) / 100,
      pct: Math.round((value / total) * 1000) / 10,
      category: getCrytoCategory(symbol),
    })),
    { symbol: "CASH", value: Math.round(cashVal * 100) / 100, pct: Math.round((cashVal / total) * 1000) / 10, category: "Cash" },
  ];

  res.json(items.sort((a, b) => b.value - a.value));
});

function getCrytoCategory(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.includes("USDT") || s.includes("USDC") || s.includes("BUSD") || s.includes("DAI")) return "Stablecoin";
  if (s.startsWith("BTC")) return "Store of Value";
  if (s.startsWith("ETH") || s.startsWith("SOL") || s.startsWith("ADA") || s.startsWith("DOT") || s.startsWith("AVAX")) return "Layer 1";
  if (s.startsWith("MATIC") || s.startsWith("ARB") || s.startsWith("OP")) return "Layer 2";
  if (s.startsWith("LINK") || s.startsWith("BAND") || s.startsWith("API3")) return "Oracle";
  return "Altcoin";
}

// ── PORTFOLIO RISK ────────────────────────────────────────────────────────────
router.get("/portfolio/risk", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    res.json({
      openExposure: 0, exposurePct: 0, concentrationRisk: 0, portfolioVolatility: 0,
      downsideVolatility: 0, valueAtRisk95: 0, leverageRisk: 0, stopLossRate: 100,
      maxDrawdown: 0, openPositions: 0, positionsWithoutStops: 0, riskScore: 85,
    });
    return;
  }
  const { data: trades } = await supabase.from("trades").select("*");
  const all = trades ?? [];
  const open = all.filter(t => t.status === "open");
  const closed = all.filter(t => t.status === "closed");

  const openExposure = open.reduce((s, t) => s + (t.entry_price ?? 0) * (t.quantity ?? 0), 0);
  const concentrationRisk = open.length > 0
    ? (() => {
        const symMap = new Map<string, number>();
        for (const t of open) symMap.set(t.symbol, (symMap.get(t.symbol) ?? 0) + (t.entry_price ?? 0) * (t.quantity ?? 0));
        const largest = Math.max(...Array.from(symMap.values()));
        return openExposure > 0 ? (largest / openExposure) * 100 : 0;
      })()
    : 0;

  const pnls = closed.map(t => t.profit_percent ?? 0);
  const avgPnl = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
  const variance = pnls.length > 1
    ? pnls.reduce((s, p) => s + Math.pow(p - avgPnl, 2), 0) / (pnls.length - 1) : 0;
  const volatility = Math.sqrt(variance);

  const negPnls = pnls.filter(p => p < 0);
  const downVar = negPnls.length > 1
    ? negPnls.reduce((s, p) => s + Math.pow(p, 2), 0) / negPnls.length : 0;
  const downsideVol = Math.sqrt(downVar);

  const var95 = openExposure * (2.33 * (volatility / 100) * Math.sqrt(1));
  const leverageRisk = openExposure > BASE_CAPITAL ? ((openExposure / BASE_CAPITAL - 1) * 100) : 0;

  const positionsWithStops = open.filter(t => t.stop_loss != null).length;
  const stopLossRate = open.length > 0 ? (positionsWithStops / open.length) * 100 : 100;

  const maxDrawdown = closed.length > 0
    ? Math.abs(Math.min(0, ...closed.map(t => t.profit_percent ?? 0))) : 0;

  res.json({
    openExposure: Math.round(openExposure * 100) / 100,
    exposurePct: Math.round((openExposure / BASE_CAPITAL) * 1000) / 10,
    concentrationRisk: Math.round(concentrationRisk * 10) / 10,
    portfolioVolatility: Math.round(volatility * 100) / 100,
    downsideVolatility: Math.round(downsideVol * 100) / 100,
    valueAtRisk95: Math.round(var95 * 100) / 100,
    leverageRisk: Math.round(leverageRisk * 10) / 10,
    stopLossRate: Math.round(stopLossRate * 10) / 10,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    openPositions: open.length,
    positionsWithoutStops: open.length - positionsWithStops,
    riskScore: Math.min(100, Math.round(
      (100 - concentrationRisk) * 0.3 +
      stopLossRate * 0.3 +
      Math.max(0, 100 - leverageRisk * 2) * 0.2 +
      Math.max(0, 100 - volatility * 5) * 0.2
    )),
  });
});

// ── PORTFOLIO AI ANALYSIS ─────────────────────────────────────────────────────
router.get("/portfolio/ai-analysis", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    res.json({
      summary: "Portfolio is fully in cash. Connect your Supabase database to enable live portfolio analysis.",
      sentiment: "neutral",
      recommendations: [
        "Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable live data",
        "Once connected, open positions will be analyzed automatically",
        "Use the Paper Trading module to simulate trades first",
      ],
      confidence: 40,
      healthScore: 72,
      generatedAt: new Date().toISOString(),
      metrics: { openPositions: 0, symbolCount: 0, freeCapitalPct: 100, winRate: 0, realizedPnl: 0 },
    });
    return;
  }
  const { data: trades } = await supabase.from("trades").select("*");
  const all = trades ?? [];
  const open = all.filter(t => t.status === "open");
  const closed = all.filter(t => t.status === "closed");

  const openExposure = open.reduce((s, t) => s + (t.entry_price ?? 0) * (t.quantity ?? 0), 0);
  const realizedPnl = closed.reduce((s, t) => s + (t.profit_loss ?? 0), 0);
  const winRate = closed.length > 0 ? (closed.filter(t => (t.profit_loss ?? 0) > 0).length / closed.length) * 100 : 0;
  const symbols = [...new Set(open.map(t => t.symbol))];
  const freeCapitalPct = Math.max(0, 100 - (openExposure / BASE_CAPITAL) * 100);
  const positionsWithoutStops = open.filter(t => !t.stop_loss).length;

  const recommendations: string[] = [];
  let summary = "";
  let sentiment = "neutral";

  if (open.length === 0) {
    summary = "Portfolio is fully in cash. No active positions detected. Market is awaiting entry opportunities.";
    sentiment = "neutral";
    recommendations.push("Look for high-confidence AI signals to deploy capital");
    recommendations.push("Set up strategy alerts for trending markets");
  } else {
    const bullish = open.filter(t => t.side === "long").length > open.length / 2;
    sentiment = bullish ? "bullish" : "bearish";

    const parts: string[] = [];
    if (open.length === 1) parts.push(`Portfolio is concentrated in ${symbols[0]}`);
    else if (open.length <= 3) parts.push(`Portfolio has ${open.length} active positions (${symbols.join(", ")})`);
    else parts.push(`Portfolio is diversified across ${open.length} positions`);

    if (freeCapitalPct < 20) parts.push("Capital is heavily deployed — low cash reserve");
    else if (freeCapitalPct > 60) parts.push("Capital utilization is conservative with significant cash available");
    else parts.push(`Cash reserve is healthy at ${freeCapitalPct.toFixed(0)}%`);

    if (winRate >= 60) parts.push("Win rate is strong");
    else if (winRate > 0) parts.push("Win rate needs improvement");
    summary = parts.join(". ") + ".";

    if (positionsWithoutStops > 0)
      recommendations.push(`${positionsWithoutStops} position${positionsWithoutStops > 1 ? "s" : ""} without stop loss — set stops immediately to protect capital`);
    if (symbols.length < 3 && open.length > 0)
      recommendations.push("Diversify across more assets to reduce concentration risk");
    if (freeCapitalPct < 10)
      recommendations.push("Low cash reserve — consider closing weaker positions to free capital");
    if (freeCapitalPct > 70 && closed.length > 0)
      recommendations.push("Capital underutilized — deploy into high-confidence strategy signals");
    if (winRate < 50 && closed.length >= 5)
      recommendations.push("Win rate below 50% — review strategy entry conditions and filters");
    if (recommendations.length === 0)
      recommendations.push("Portfolio is well-managed. Continue following current strategy rules");
  }

  const confidence = Math.min(100, 50 + (closed.length * 3) + (open.length > 0 ? 10 : 0));

  res.json({
    summary,
    sentiment,
    recommendations,
    confidence: Math.round(confidence),
    healthScore: Math.min(100, Math.round(winRate * 0.4 + freeCapitalPct * 0.3 + (positionsWithoutStops === 0 ? 30 : 0))),
    generatedAt: new Date().toISOString(),
    metrics: {
      openPositions: open.length,
      symbolCount: symbols.length,
      freeCapitalPct: Math.round(freeCapitalPct * 10) / 10,
      winRate: Math.round(winRate * 10) / 10,
      realizedPnl: Math.round(realizedPnl * 100) / 100,
    }
  });
});

// ── PORTFOLIO STRESS TEST ─────────────────────────────────────────────────────
router.get("/portfolio/stress-test", async (_req, res): Promise<void> => {
  if (isOfflineMode) {
    const scenarios = [
      { name: "Market Crash", description: "Severe market-wide selloff (-20%)", marketMove: -20, portfolioMove: -26, impact: 0, newPortfolioValue: BASE_CAPITAL, survivable: true, severity: "low" },
      { name: "Flash Crash", description: "Sudden liquidity crisis (-12%)", marketMove: -12, portfolioMove: -18, impact: 0, newPortfolioValue: BASE_CAPITAL, survivable: true, severity: "low" },
      { name: "High Volatility", description: "VIX spike, 3x volatility increase", marketMove: -8, portfolioMove: -14.4, impact: 0, newPortfolioValue: BASE_CAPITAL, survivable: true, severity: "low" },
      { name: "Bear Market", description: "Extended bear market (-40% over 3 months)", marketMove: -40, portfolioMove: -44, impact: 0, newPortfolioValue: BASE_CAPITAL, survivable: true, severity: "low" },
      { name: "Bull Run", description: "Strong market rally (+30%)", marketMove: 30, portfolioMove: 36, impact: 0, newPortfolioValue: BASE_CAPITAL, survivable: true, severity: "positive" },
      { name: "Stable Growth", description: "Gradual uptrend (+10%)", marketMove: 10, portfolioMove: 9, impact: 0, newPortfolioValue: BASE_CAPITAL, survivable: true, severity: "positive" },
    ];
    res.json(scenarios);
    return;
  }
  const { data: trades } = await supabase.from("trades").select("entry_price, quantity, status");
  const open = (trades ?? []).filter(t => t.status === "open");
  const openExposure = open.reduce((s, t) => s + (t.entry_price ?? 0) * (t.quantity ?? 0), 0);

  const scenarios = [
    { name: "Market Crash", description: "Severe market-wide selloff (-20%)", marketMove: -20, assetBeta: 1.3 },
    { name: "Flash Crash", description: "Sudden liquidity crisis (-12%)", marketMove: -12, assetBeta: 1.5 },
    { name: "High Volatility", description: "VIX spike, 3x volatility increase", marketMove: -8, assetBeta: 1.8 },
    { name: "Bear Market", description: "Extended bear market (-40% over 3 months)", marketMove: -40, assetBeta: 1.1 },
    { name: "Bull Run", description: "Strong market rally (+30%)", marketMove: 30, assetBeta: 1.2 },
    { name: "Stable Growth", description: "Gradual uptrend (+10%)", marketMove: 10, assetBeta: 0.9 },
  ];

  const results = scenarios.map(s => {
    const portfolioMove = s.marketMove * s.assetBeta;
    const impact = openExposure * (portfolioMove / 100);
    const newValue = BASE_CAPITAL + impact;
    const survivable = newValue > BASE_CAPITAL * 0.5;
    const severity = Math.abs(portfolioMove) > 30 ? "critical" : Math.abs(portfolioMove) > 15 ? "high" : Math.abs(portfolioMove) > 8 ? "medium" : "low";

    return {
      name: s.name,
      description: s.description,
      marketMove: s.marketMove,
      portfolioMove: Math.round(portfolioMove * 10) / 10,
      impact: Math.round(impact * 100) / 100,
      newPortfolioValue: Math.round(newValue * 100) / 100,
      survivable,
      severity: impact >= 0 ? "positive" : severity,
    };
  });

  res.json(results);
});

export default router;
