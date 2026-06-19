import { Router, type IRouter } from "express";
import {
  computeAccount, computePositions, computePerformance,
  simulateExecution, closePosition, resetAccount,
  getOrders, getClosedTrades, getLivePrice, SYMBOLS,
} from "../lib/paper-state";

const router: IRouter = Router();

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
  res.json(getOrders().slice(0, limit));
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
  const result = closePosition(id, exitReason);
  if (result.error) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.json({ trade: result.trade, message: "Position closed successfully" });
});

// GET /api/paper-trading/performance
router.get("/paper-trading/performance", (_req, res): void => {
  res.json(computePerformance());
});

// GET /api/paper-trading/trades (closed)
router.get("/paper-trading/trades", (req, res): void => {
  const limit = Number(req.query.limit) || 50;
  res.json(getClosedTrades().slice(-limit).reverse());
});

// POST /api/paper-trading/account/reset
router.post("/paper-trading/account/reset", (_req, res): void => {
  resetAccount();
  res.json({ message: "Account reset successfully", account: computeAccount() });
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
  const closed = getClosedTrades().slice(-20).map((t, i) => ({
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
  const { symbol, side, quantity, stopLoss, takeProfit, strategyId } = req.body;
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

router.patch("/paper-trades/:id", (_req, res): void => {
  res.json({ message: "Updated" });
});

export default router;
