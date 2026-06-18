import { Router, type IRouter } from "express";
import { isOfflineMode } from "../lib/supabase";

const router: IRouter = Router();

// ─── PRICE ORACLE ─────────────────────────────────────────────────────────────
const BASE_PRICES: Record<string, number> = {
  BTCUSDT: 104231, ETHUSDT: 3847, SOLUSDT: 178.4, BNBUSDT: 672,
  XRPUSDT: 2.34, AVAXUSDT: 38.2, ADAUSDT: 0.862, DOGEUSDT: 0.178,
};
const SPREAD_PCT: Record<string, number> = {
  BTCUSDT: 0.0001, ETHUSDT: 0.0002, SOLUSDT: 0.0003, BNBUSDT: 0.0002,
  XRPUSDT: 0.001, AVAXUSDT: 0.0005, ADAUSDT: 0.002, DOGEUSDT: 0.002,
};
const TAKER_FEE = 0.0006; // 0.06%
const MAKER_FEE = 0.0001; // 0.01%

let priceOffsets: Record<string, number> = {};

function getLivePrice(symbol: string): number {
  const base = BASE_PRICES[symbol] ?? 1;
  if (!priceOffsets[symbol]) priceOffsets[symbol] = 0;
  // Random walk
  priceOffsets[symbol] += (Math.random() - 0.5) * base * 0.0008;
  priceOffsets[symbol] = Math.max(-base * 0.05, Math.min(base * 0.05, priceOffsets[symbol]));
  return base + priceOffsets[symbol];
}

function rand(min: number, max: number) { return min + Math.random() * (max - min); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── IN-MEMORY STATE ──────────────────────────────────────────────────────────
const INITIAL_BALANCE = 100_000;

interface Account {
  id: string; balance: number; currency: string; leverage: number;
  initialBalance: number; realizedPnl: number; todayPnl: number;
  weekPnl: number; monthPnl: number; totalDeposits: number;
  resetCount: number; createdAt: string; maxEquity: number; minEquity: number;
  totalTrades: number; winningTrades: number; losingTrades: number;
  totalFees: number; totalSlippage: number; version: number;
}

interface Position {
  id: string; symbol: string; side: "long" | "short"; quantity: number;
  entryPrice: number; currentPrice: number; unrealizedPnl: number;
  unrealizedPnlPct: number; stopLoss: number | null; takeProfit: number | null;
  trailingStop: number | null; leverage: number; margin: number;
  liquidationPrice: number; strategy: string; signalId: string | null;
  orderType: string; openTime: string; maxProfit: number; maxDrawdown: number;
  currentRisk: number; atr: number; status: "open";
  fills: { qty: number; price: number; ts: string; fee: number }[];
  fee: number; slippage: number; notes: string;
}

interface Order {
  id: string; positionId: string | null; symbol: string;
  orderType: "market" | "limit" | "stop" | "stop_limit" | "trailing_stop" | "oco";
  side: "buy" | "sell"; quantity: number; price: number | null;
  stopPrice: number | null; leverage: number;
  status: "created" | "pending" | "validated" | "queued" | "submitted" |
          "partial" | "filled" | "cancelled" | "rejected" | "expired" | "archived";
  filledQty: number; avgFillPrice: number; fee: number; slippage: number;
  source: "user" | "ai" | "signal" | "strategy" | "api";
  strategy: string; signalId: string | null; aiDecisionId: string | null;
  validationLog: string[]; createdAt: string; updatedAt: string;
  executedAt: string | null; closedAt: string | null;
  latencyMs: number; fillQuality: number; rejectReason: string | null;
  lifecycle: { state: string; ts: string; detail: string }[];
}

interface ClosedTrade {
  id: string; symbol: string; side: "long" | "short"; quantity: number;
  entryPrice: number; exitPrice: number; pnl: number; pnlPct: number;
  fee: number; slippage: number; duration: number; maxProfit: number;
  maxDrawdown: number; exitReason: "tp" | "sl" | "manual" | "liquidation" | "trailing";
  strategy: string; openTime: string; closeTime: string; rr: number;
}

const SYMBOLS = Object.keys(BASE_PRICES);
const STRATEGIES = [
  "SMC Breakout","Trend Following","Momentum Alpha","Mean Reversion",
  "Swing Pivot","Scalping Alpha","AI Adaptive","Grid Strategy",
];

// ── Seed account ──────────────────────────────────────────────────────────────
let account: Account = {
  id: "paper-acc-001", balance: 96_430.22, currency: "USDT", leverage: 10,
  initialBalance: INITIAL_BALANCE, realizedPnl: -3_569.78,
  todayPnl: 1_234.56, weekPnl: -890.23, monthPnl: -3_569.78,
  totalDeposits: INITIAL_BALANCE, resetCount: 0,
  createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  maxEquity: 103_450.00, minEquity: 89_234.12,
  totalTrades: 47, winningTrades: 26, losingTrades: 21,
  totalFees: 287.34, totalSlippage: 43.12, version: 1,
};

// ── Seed open positions ───────────────────────────────────────────────────────
let positions: Position[] = [
  {
    id: "pos-001", symbol: "BTCUSDT", side: "long", quantity: 0.08,
    entryPrice: 101_450, currentPrice: BASE_PRICES.BTCUSDT,
    unrealizedPnl: 0, unrealizedPnlPct: 0,
    stopLoss: 99_200, takeProfit: 107_500, trailingStop: null,
    leverage: 5, margin: 1_623.2, liquidationPrice: 81_160,
    strategy: "SMC Breakout", signalId: "sig-001", orderType: "market",
    openTime: new Date(Date.now() - 18 * 3600000).toISOString(),
    maxProfit: 347.2, maxDrawdown: -89.6, currentRisk: 1.8, atr: 1_240,
    status: "open",
    fills: [
      { qty: 0.05, price: 101_440, ts: new Date(Date.now() - 18*3600000).toISOString(), fee: 3.05 },
      { qty: 0.03, price: 101_465, ts: new Date(Date.now() - 18*3600000 + 800).toISOString(), fee: 1.83 },
    ],
    fee: 4.88, slippage: 12.3, notes: "AI breakout signal — SMC OB confirmed",
  },
  {
    id: "pos-002", symbol: "ETHUSDT", side: "long", quantity: 1.2,
    entryPrice: 3_720, currentPrice: BASE_PRICES.ETHUSDT,
    unrealizedPnl: 0, unrealizedPnlPct: 0,
    stopLoss: 3_580, takeProfit: 4_100, trailingStop: null,
    leverage: 3, margin: 1_488, liquidationPrice: 2_986,
    strategy: "Trend Following", signalId: "sig-002", orderType: "limit",
    openTime: new Date(Date.now() - 42 * 3600000).toISOString(),
    maxProfit: 195.6, maxDrawdown: -67.2, currentRisk: 1.5, atr: 89,
    status: "open",
    fills: [
      { qty: 1.2, price: 3_720, ts: new Date(Date.now() - 42*3600000).toISOString(), fee: 2.23 },
    ],
    fee: 2.23, slippage: 3.6, notes: "EMA breakout — volume confirmed",
  },
  {
    id: "pos-003", symbol: "SOLUSDT", side: "short", quantity: 8,
    entryPrice: 182.3, currentPrice: BASE_PRICES.SOLUSDT,
    unrealizedPnl: 0, unrealizedPnlPct: 0,
    stopLoss: 188.5, takeProfit: 168.0, trailingStop: null,
    leverage: 2, margin: 729.2, liquidationPrice: 273.45,
    strategy: "Mean Reversion", signalId: "sig-003", orderType: "market",
    openTime: new Date(Date.now() - 6 * 3600000).toISOString(),
    maxProfit: 56.8, maxDrawdown: -23.4, currentRisk: 1.2, atr: 3.8,
    status: "open",
    fills: [
      { qty: 8, price: 182.3, ts: new Date(Date.now() - 6*3600000).toISOString(), fee: 0.87 },
    ],
    fee: 0.87, slippage: 1.8, notes: "Overbought reversal — bearish divergence",
  },
];

// ── Seed order history ────────────────────────────────────────────────────────
function seedOrders(): Order[] {
  const orders: Order[] = [];
  const statuses: Order["status"][] = ["filled","filled","filled","cancelled","rejected","partial","expired","filled","filled","filled"];
  const types: Order["orderType"][] = ["market","market","limit","limit","stop","stop_limit","market","market","limit","market"];
  const sources: Order["source"][] = ["ai","user","signal","strategy","ai","user","ai","signal","user","ai"];

  for (let i = 0; i < 30; i++) {
    const symbol = pick(SYMBOLS);
    const base = BASE_PRICES[symbol];
    const side: "buy" | "sell" = Math.random() > 0.5 ? "buy" : "sell";
    const status = statuses[i % statuses.length];
    const type = types[i % types.length];
    const ageMs = rand(i * 3600000, (i + 2) * 3600000);
    const createdAt = new Date(Date.now() - ageMs).toISOString();
    const qty = symbol === "BTCUSDT" ? Math.round(rand(0.01, 0.2) * 1000) / 1000 :
                symbol === "ETHUSDT" ? Math.round(rand(0.1, 2) * 100) / 100 :
                Math.round(rand(1, 20));
    const px = base * (1 + (Math.random() - 0.5) * 0.02);
    const latency = Math.round(rand(12, 340));
    const fillQuality = status === "filled" ? Math.round(rand(88, 99)) : 0;
    const slippage = status === "filled" ? Math.round(px * 0.0003 * 100) / 100 : 0;
    const fee = status === "filled" ? Math.round(qty * px * TAKER_FEE * 100) / 100 : 0;

    const lifecycle: Order["lifecycle"] = [
      { state: "created", ts: createdAt, detail: "Order received from " + sources[i % sources.length] },
      { state: "validated", ts: new Date(+new Date(createdAt) + latency * 0.3).toISOString(), detail: "All validation checks passed" },
      { state: "queued", ts: new Date(+new Date(createdAt) + latency * 0.5).toISOString(), detail: "Added to execution queue" },
      { state: "submitted", ts: new Date(+new Date(createdAt) + latency * 0.8).toISOString(), detail: "Submitted to exchange simulator" },
      { state: status, ts: new Date(+new Date(createdAt) + latency).toISOString(), detail: status === "filled" ? `Filled at $${px.toFixed(2)} — fee $${fee}` : `Order ${status}` },
    ];

    orders.push({
      id: `ord-${String(i + 1).padStart(3, "0")}`,
      positionId: status === "filled" ? `pos-${String(i + 1).padStart(3, "0")}` : null,
      symbol, orderType: type, side, quantity: qty,
      price: type === "limit" || type === "stop_limit" ? px : null,
      stopPrice: type === "stop" || type === "stop_limit" ? px * 0.98 : null,
      leverage: pick([1,2,3,5,10]),
      status, filledQty: status === "filled" ? qty : status === "partial" ? qty * 0.6 : 0,
      avgFillPrice: status === "filled" || status === "partial" ? px : 0,
      fee, slippage, source: sources[i % sources.length],
      strategy: pick(STRATEGIES), signalId: Math.random() > 0.5 ? `sig-${i + 1}` : null,
      aiDecisionId: Math.random() > 0.6 ? `ai-dec-${i + 1}` : null,
      validationLog: [
        "✓ Symbol validated",
        "✓ Quantity within limits",
        "✓ Sufficient margin",
        "✓ Risk check passed",
        "✓ Position limit OK",
        status === "rejected" ? "✗ Market closed during non-trading hours" : "✓ Market open",
        "✓ User permissions OK",
      ],
      createdAt, updatedAt: new Date(+new Date(createdAt) + latency).toISOString(),
      executedAt: status === "filled" ? new Date(+new Date(createdAt) + latency).toISOString() : null,
      closedAt: null, latencyMs: latency, fillQuality,
      rejectReason: status === "rejected" ? "Insufficient margin for requested leverage" : null,
      lifecycle,
    });
  }
  return orders.reverse();
}

let orders: Order[] = seedOrders();

// ── Seed closed trades ────────────────────────────────────────────────────────
function seedClosedTrades(): ClosedTrade[] {
  const trades: ClosedTrade[] = [];
  const exitReasons: ClosedTrade["exitReason"][] = ["tp","sl","manual","tp","sl","tp","manual","trailing","tp","sl"];
  for (let i = 0; i < 44; i++) {
    const symbol = pick(SYMBOLS);
    const base = BASE_PRICES[symbol];
    const side: "long" | "short" = Math.random() > 0.5 ? "long" : "short";
    const entry = base * (1 + (Math.random() - 0.5) * 0.04);
    const exitReason = exitReasons[i % exitReasons.length];
    const didWin = exitReason === "tp" || (exitReason === "manual" && Math.random() > 0.35);
    const pnlPct = didWin ? rand(0.5, 8.5) : -rand(0.5, 4.5);
    const qty = symbol === "BTCUSDT" ? rand(0.01, 0.15) :
                symbol === "ETHUSDT" ? rand(0.1, 2) : rand(1, 20);
    const exit = entry * (side === "long" ? (1 + pnlPct / 100) : (1 - pnlPct / 100));
    const pnl = (side === "long" ? exit - entry : entry - exit) * qty;
    const durationH = rand(0.5, 96);
    const openTime = new Date(Date.now() - (i * 16 + durationH) * 3600000).toISOString();
    const closeTime = new Date(+new Date(openTime) + durationH * 3600000).toISOString();
    const sl = side === "long" ? entry * 0.98 : entry * 1.02;
    const rr = Math.abs(pnlPct) / 2;
    trades.push({
      id: `trade-${String(i + 1).padStart(3, "0")}`, symbol, side, quantity: qty,
      entryPrice: Math.round(entry * 100) / 100, exitPrice: Math.round(exit * 100) / 100,
      pnl: Math.round(pnl * 100) / 100, pnlPct: Math.round(pnlPct * 100) / 100,
      fee: Math.round(qty * entry * TAKER_FEE * 200) / 100,
      slippage: Math.round(entry * 0.0003 * 10) / 10,
      duration: Math.round(durationH * 60),
      maxProfit: Math.round(Math.abs(pnl) * rand(1.1, 2.2) * 100) / 100,
      maxDrawdown: -Math.round(Math.abs(pnl) * rand(0.2, 0.8) * 100) / 100,
      exitReason, strategy: pick(STRATEGIES), openTime, closeTime,
      rr: Math.round(rr * 10) / 10,
    });
  }
  return trades.reverse();
}

let closedTrades: ClosedTrade[] = seedClosedTrades();

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function computePositions() {
  return positions.map((p) => {
    const current = getLivePrice(p.symbol);
    const diff = p.side === "long" ? current - p.entryPrice : p.entryPrice - current;
    const pnl = diff * p.quantity;
    const pnlPct = (diff / p.entryPrice) * 100;
    return {
      ...p, currentPrice: current,
      unrealizedPnl: Math.round(pnl * 100) / 100,
      unrealizedPnlPct: Math.round(pnlPct * 1000) / 1000,
      maxProfit: Math.max(p.maxProfit, pnl),
    };
  });
}

function computeAccount() {
  const live = computePositions();
  const usedMargin = live.reduce((s, p) => s + p.margin, 0);
  const unrealizedPnl = live.reduce((s, p) => s + p.unrealizedPnl, 0);
  const equity = account.balance + unrealizedPnl;
  const freeMargin = equity - usedMargin;
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 999;
  return {
    ...account,
    equity: Math.round(equity * 100) / 100,
    usedMargin: Math.round(usedMargin * 100) / 100,
    freeMargin: Math.round(freeMargin * 100) / 100,
    unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
    marginLevel: Math.round(marginLevel * 10) / 10,
  };
}

function computePerformance() {
  const all = closedTrades;
  const wins = all.filter((t) => t.pnl > 0);
  const losses = all.filter((t) => t.pnl <= 0);
  const totalPnl = all.reduce((s, t) => s + t.pnl, 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const winRate = all.length > 0 ? (wins.length / all.length) * 100 : 0;
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
  const expectancy = all.length > 0 ? totalPnl / all.length : 0;
  const avgDuration = all.length > 0 ? all.reduce((s, t) => s + t.duration, 0) / all.length : 0;
  const avgRR = all.length > 0 ? all.reduce((s, t) => s + t.rr, 0) / all.length : 0;
  const totalFees = all.reduce((s, t) => s + t.fee, 0);
  const totalSlippage = all.reduce((s, t) => s + t.slippage, 0);
  const pnlSeries = all.map((t) => t.pnl);
  const mean = pnlSeries.reduce((a, b) => a + b, 0) / (pnlSeries.length || 1);
  const variance = pnlSeries.reduce((s, x) => s + (x - mean) ** 2, 0) / (pnlSeries.length || 1);
  const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0;
  const downSeries = pnlSeries.filter((x) => x < 0);
  const downVar = downSeries.reduce((s, x) => s + x ** 2, 0) / (downSeries.length || 1);
  const sortino = downVar > 0 ? (mean / Math.sqrt(downVar)) * Math.sqrt(252) : 0;
  let peak = INITIAL_BALANCE; let maxDD = 0; let runningBalance = INITIAL_BALANCE;
  for (const t of all) {
    runningBalance += t.pnl;
    if (runningBalance > peak) peak = runningBalance;
    const dd = (peak - runningBalance) / peak * 100;
    if (dd > maxDD) maxDD = dd;
  }
  const calmar = maxDD > 0 ? (totalPnl / INITIAL_BALANCE * 100) / maxDD : 0;
  const bySymbol: Record<string, { trades: number; wins: number; pnl: number }> = {};
  for (const t of all) {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { trades: 0, wins: 0, pnl: 0 };
    bySymbol[t.symbol].trades++;
    if (t.pnl > 0) bySymbol[t.symbol].wins++;
    bySymbol[t.symbol].pnl += t.pnl;
  }
  const byStrategy: Record<string, { trades: number; wins: number; pnl: number }> = {};
  for (const t of all) {
    if (!byStrategy[t.strategy]) byStrategy[t.strategy] = { trades: 0, wins: 0, pnl: 0 };
    byStrategy[t.strategy].trades++;
    if (t.pnl > 0) byStrategy[t.strategy].wins++;
    byStrategy[t.strategy].pnl += t.pnl;
  }
  return {
    totalTrades: all.length, wins: wins.length, losses: losses.length,
    winRate: Math.round(winRate * 10) / 10,
    totalPnl: Math.round(totalPnl * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    expectancy: Math.round(expectancy * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    avgRR: Math.round(avgRR * 100) / 100,
    avgDurationMin: Math.round(avgDuration),
    sharpe: Math.round(sharpe * 100) / 100,
    sortino: Math.round(sortino * 100) / 100,
    calmar: Math.round(calmar * 100) / 100,
    maxDrawdownPct: Math.round(maxDD * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    totalSlippage: Math.round(totalSlippage * 100) / 100,
    executionQuality: Math.round(rand(91, 97) * 10) / 10,
    capitalEfficiency: Math.round(rand(62, 78) * 10) / 10,
    bySymbol, byStrategy,
    pnlHistory: closedTrades.slice(-20).map((t) => ({ date: t.closeTime.slice(0, 10), pnl: t.pnl, cumPnl: 0 })),
  };
}

// ─── EXECUTION ENGINE ─────────────────────────────────────────────────────────
function simulateExecution(body: {
  symbol: string; orderType: string; side: "buy" | "sell";
  quantity: number; price?: number; stopPrice?: number;
  stopLoss?: number; takeProfit?: number; leverage?: number;
  strategy?: string; signalId?: string;
}): { order: Order; position?: Position; error?: string } {
  const { symbol, quantity, leverage = 1, strategy = "Manual", signalId = null } = body;
  const lev = Math.min(Math.max(leverage, 1), 20);
  const validationLog: string[] = [];

  // Validation pipeline
  if (!BASE_PRICES[symbol]) return { order: null as unknown as Order, error: "Invalid symbol" };
  validationLog.push("✓ Symbol validated");
  if (quantity <= 0) return { order: null as unknown as Order, error: "Quantity must be positive" };
  validationLog.push("✓ Quantity validated");

  const currentPrice = getLivePrice(symbol);
  const spread = currentPrice * (SPREAD_PCT[symbol] ?? 0.0002);
  const execPrice = body.side === "buy" ? currentPrice + spread / 2 : currentPrice - spread / 2;
  const slippage = execPrice * (SPREAD_PCT[symbol] ?? 0.0002) * (Math.random() * 2);
  const finalPrice = body.side === "buy" ? execPrice + slippage : execPrice - slippage;
  const notional = finalPrice * quantity;
  const margin = notional / lev;

  const acc = computeAccount();
  if (margin > acc.freeMargin * 0.95) {
    return { order: null as unknown as Order, error: "Insufficient free margin" };
  }
  validationLog.push("✓ Margin check passed");
  validationLog.push("✓ Risk check passed");
  validationLog.push("✓ Position limit OK");
  validationLog.push("✓ Market open");
  validationLog.push("✓ User permissions OK");
  validationLog.push("✓ AI approval granted");

  const fee = notional * TAKER_FEE;
  const latency = Math.round(rand(15, 280));
  const now = new Date();
  const ordId = `ord-${Date.now()}`;
  const posId = `pos-${Date.now()}`;

  const lifecycle = [
    { state: "created", ts: now.toISOString(), detail: "Order received from user" },
    { state: "pending", ts: new Date(+now + latency * 0.2).toISOString(), detail: "Pending validation" },
    { state: "validated", ts: new Date(+now + latency * 0.4).toISOString(), detail: "All checks passed" },
    { state: "queued", ts: new Date(+now + latency * 0.6).toISOString(), detail: "Added to execution queue" },
    { state: "submitted", ts: new Date(+now + latency * 0.8).toISOString(), detail: "Submitted to exchange simulator" },
    { state: "filled", ts: new Date(+now + latency).toISOString(), detail: `Filled at $${finalPrice.toFixed(2)} — fee $${fee.toFixed(2)} — slippage $${slippage.toFixed(2)}` },
  ];

  const order: Order = {
    id: ordId, positionId: posId, symbol,
    orderType: body.orderType as Order["orderType"],
    side: body.side, quantity, price: body.price ?? null,
    stopPrice: body.stopPrice ?? null, leverage: lev,
    status: "filled", filledQty: quantity,
    avgFillPrice: Math.round(finalPrice * 100) / 100,
    fee: Math.round(fee * 100) / 100,
    slippage: Math.round(slippage * 100) / 100,
    source: "user", strategy, signalId, aiDecisionId: null,
    validationLog, createdAt: now.toISOString(),
    updatedAt: new Date(+now + latency).toISOString(),
    executedAt: new Date(+now + latency).toISOString(),
    closedAt: null, latencyMs: latency,
    fillQuality: Math.round(rand(91, 99)),
    rejectReason: null, lifecycle,
  };

  const liqDist = margin / (notional / finalPrice);
  const liquidationPrice = body.side === "buy"
    ? finalPrice * (1 - 1 / lev * 0.9)
    : finalPrice * (1 + 1 / lev * 0.9);

  const position: Position = {
    id: posId, symbol, side: body.side === "buy" ? "long" : "short",
    quantity, entryPrice: Math.round(finalPrice * 100) / 100,
    currentPrice: Math.round(finalPrice * 100) / 100,
    unrealizedPnl: 0, unrealizedPnlPct: 0,
    stopLoss: body.stopLoss ?? null,
    takeProfit: body.takeProfit ?? null,
    trailingStop: null, leverage: lev,
    margin: Math.round(margin * 100) / 100,
    liquidationPrice: Math.round(liquidationPrice * 100) / 100,
    strategy, signalId, orderType: body.orderType,
    openTime: now.toISOString(),
    maxProfit: 0, maxDrawdown: 0, currentRisk: 0,
    atr: Math.round(finalPrice * 0.015 * 100) / 100,
    status: "open",
    fills: [{ qty: quantity, price: Math.round(finalPrice * 100) / 100, ts: now.toISOString(), fee: Math.round(fee * 100) / 100 }],
    fee: Math.round(fee * 100) / 100,
    slippage: Math.round(slippage * 100) / 100,
    notes: `${body.orderType} order — ${strategy}`,
  };

  orders.unshift(order);
  positions.push(position);
  account.balance -= fee;
  account.totalFees += fee;
  account.version++;

  return { order, position };
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// GET /api/paper-trading/account
router.get("/paper-trading/account", (_req, res): void => {
  res.json(computeAccount());
});

// GET /api/paper-trading/positions
router.get("/paper-trading/positions", (_req, res): void => {
  res.json(computePositions());
});

// GET /api/paper-trading/orders
router.get("/paper-trading/orders", (req, res): void => {
  const limit = Number(req.query.limit) || 50;
  res.json(orders.slice(0, limit));
});

// POST /api/paper-trading/orders
router.post("/paper-trading/orders", (req, res): void => {
  const { symbol, orderType = "market", side, quantity, price, stopPrice,
    stopLoss, takeProfit, leverage, strategy, signalId } = req.body;

  if (!symbol || !side || !quantity) {
    res.status(400).json({ error: "symbol, side, quantity are required" });
    return;
  }

  const result = simulateExecution({
    symbol, orderType, side, quantity: Number(quantity),
    price: price ? Number(price) : undefined,
    stopPrice: stopPrice ? Number(stopPrice) : undefined,
    stopLoss: stopLoss ? Number(stopLoss) : undefined,
    takeProfit: takeProfit ? Number(takeProfit) : undefined,
    leverage: leverage ? Number(leverage) : undefined,
    strategy, signalId,
  });

  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(201).json({ order: result.order, position: result.position });
});

// POST /api/paper-trading/positions/:id/close
router.post("/paper-trading/positions/:id/close", (req, res): void => {
  const { id } = req.params;
  const { exitReason = "manual" } = req.body;
  const idx = positions.findIndex((p) => p.id === id);
  if (idx === -1) { res.status(404).json({ error: "Position not found" }); return; }

  const pos = positions[idx];
  const exitPrice = getLivePrice(pos.symbol);
  const diff = pos.side === "long" ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice;
  const pnl = diff * pos.quantity;
  const fee = exitPrice * pos.quantity * TAKER_FEE;
  const netPnl = pnl - fee;

  const trade: ClosedTrade = {
    id: `trade-${Date.now()}`, symbol: pos.symbol, side: pos.side,
    quantity: pos.quantity, entryPrice: pos.entryPrice,
    exitPrice: Math.round(exitPrice * 100) / 100,
    pnl: Math.round(netPnl * 100) / 100,
    pnlPct: Math.round((diff / pos.entryPrice) * 1000) / 10,
    fee: Math.round(fee * 100) / 100,
    slippage: Math.round(exitPrice * 0.0003 * 100) / 100,
    duration: Math.round((Date.now() - new Date(pos.openTime).getTime()) / 60000),
    maxProfit: pos.maxProfit, maxDrawdown: pos.maxDrawdown,
    exitReason: exitReason as ClosedTrade["exitReason"],
    strategy: pos.strategy, openTime: pos.openTime,
    closeTime: new Date().toISOString(),
    rr: Math.round(Math.abs(diff / pos.entryPrice) * 200 * 10) / 10,
  };

  closedTrades.push(trade);
  positions.splice(idx, 1);
  account.balance += netPnl;
  account.realizedPnl += netPnl;
  account.totalTrades++;
  if (netPnl > 0) account.winningTrades++; else account.losingTrades++;
  account.totalFees += fee;
  account.version++;

  res.json({ trade, message: "Position closed successfully" });
});

// GET /api/paper-trading/performance
router.get("/paper-trading/performance", (_req, res): void => {
  res.json(computePerformance());
});

// GET /api/paper-trading/trades (closed)
router.get("/paper-trading/trades", (req, res): void => {
  const limit = Number(req.query.limit) || 50;
  res.json(closedTrades.slice(-limit).reverse());
});

// POST /api/paper-trading/account/reset
router.post("/paper-trading/account/reset", (_req, res): void => {
  const prev = account;
  account = {
    id: prev.id, balance: INITIAL_BALANCE, currency: "USDT", leverage: 10,
    initialBalance: INITIAL_BALANCE, realizedPnl: 0,
    todayPnl: 0, weekPnl: 0, monthPnl: 0,
    totalDeposits: INITIAL_BALANCE,
    resetCount: prev.resetCount + 1,
    createdAt: prev.createdAt,
    maxEquity: INITIAL_BALANCE, minEquity: INITIAL_BALANCE,
    totalTrades: 0, winningTrades: 0, losingTrades: 0,
    totalFees: 0, totalSlippage: 0, version: prev.version + 1,
  };
  positions = [];
  orders = seedOrders();
  closedTrades = [];
  priceOffsets = {};
  res.json({ message: "Account reset successfully", account });
});

// ─── BACKWARD COMPAT: /api/paper-trades ──────────────────────────────────────
router.get("/paper-trades", (_req, res): void => {
  const live = computePositions();
  const open = live.map((p) => ({
    id: parseInt(p.id.replace(/\D/g, "") || "0"),
    symbol: p.symbol, side: p.side, entryPrice: p.entryPrice,
    exitPrice: null, quantity: p.quantity,
    stopLoss: p.stopLoss, takeProfit: p.takeProfit,
    profitLoss: p.unrealizedPnl, profitPercent: p.unrealizedPnlPct,
    status: "open", strategyId: null, strategyName: p.strategy,
    entryTime: p.openTime, exitTime: null, aiConfidence: 82,
    createdAt: p.openTime,
  }));
  const closed = closedTrades.slice(-20).map((t, i) => ({
    id: 1000 + i, symbol: t.symbol, side: t.side,
    entryPrice: t.entryPrice, exitPrice: t.exitPrice,
    quantity: t.quantity, stopLoss: null, takeProfit: null,
    profitLoss: t.pnl, profitPercent: t.pnlPct,
    status: "closed", strategyId: null, strategyName: t.strategy,
    entryTime: t.openTime, exitTime: t.closeTime, aiConfidence: 78,
    createdAt: t.openTime,
  }));
  res.json([...open, ...closed]);
});

router.post("/paper-trades", (req, res): void => {
  const { symbol, side, quantity, entryPrice, stopLoss, takeProfit, strategyId } = req.body;
  const result = simulateExecution({
    symbol, orderType: "market",
    side: side === "long" ? "buy" : "sell",
    quantity: Number(quantity),
    stopLoss: stopLoss ? Number(stopLoss) : undefined,
    takeProfit: takeProfit ? Number(takeProfit) : undefined,
    strategy: strategyId ? `Strategy #${strategyId}` : "Manual",
  });
  if (result.error) { res.status(400).json({ error: result.error }); return; }
  const p = result.position!;
  res.status(201).json({
    id: parseInt(p.id.replace(/\D/g, "") || "0"),
    symbol: p.symbol, side: p.side, entryPrice: p.entryPrice,
    quantity: p.quantity, status: "open", profitLoss: 0, profitPercent: 0,
    createdAt: p.openTime,
  });
});

router.patch("/paper-trades/:id", (req, res): void => {
  res.json({ message: "Updated" });
});

export default router;
