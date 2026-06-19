import { Router } from "express";
import { isOfflineMode, supabase } from "../lib/supabase";
import { getLivePrice, getAllLivePrices } from "../lib/live-prices";
import {
  account, getClosedTrades, computePositions,
} from "../lib/paper-state";

const router = Router();

function relTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

router.get("/notifications", async (_req, res): Promise<void> => {
  const now = Date.now();
  const notifications: object[] = [];
  let id = 1;

  // ── 1. SYSTEM ──────────────────────────────────────────────────────────────
  if (isOfflineMode) {
    notifications.push({
      id: id++, title: "Paper Trading Mode Active",
      message: "Running in offline mode with in-memory paper trading data. Connect Supabase for persistent storage and real AI decisions.",
      priority: "MEDIUM", category: "system", status: "unread",
      time: "now", ts: now, action: "View System Monitor",
    });
  } else {
    notifications.push({
      id: id++, title: "Database Connected",
      message: "Supabase connection established. All trade history and AI decisions are being persisted.",
      priority: "LOW", category: "system", status: "read",
      time: "now", ts: now, action: "View System Monitor",
    });
  }

  // ── 2. OPEN POSITION RISK ALERTS ──────────────────────────────────────────
  const livePositions = computePositions();
  const equity = account.balance + livePositions.reduce((s, p) => s + p.unrealizedPnl, 0);
  for (const pos of livePositions) {
    const currentPrice = getLivePrice(pos.symbol);
    const pnlPct = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 * (pos.side === "long" ? 1 : -1);
    const exposurePct = (pos.quantity * currentPrice) / Math.max(equity, 1) * 100;

    // Near stop loss alert (within 1.5%)
    if (pos.stopLoss) {
      const distPct = Math.abs((currentPrice - pos.stopLoss) / currentPrice) * 100;
      if (distPct < 1.5) {
        notifications.push({
          id: id++, title: `⚠️ Stop Loss Near: ${pos.symbol}`,
          message: `${pos.symbol} ${pos.side.toUpperCase()} is ${distPct.toFixed(2)}% from stop loss at $${pos.stopLoss.toLocaleString()}. Entry: $${pos.entryPrice.toLocaleString()}.`,
          priority: "CRITICAL", category: "risk", status: "unread",
          time: "just now", ts: now, action: "View Portfolio",
        });
      }
    }

    // High exposure alert
    if (exposurePct > 35) {
      notifications.push({
        id: id++, title: `High Exposure: ${pos.symbol}`,
        message: `${pos.symbol} position is ${exposurePct.toFixed(1)}% of account equity — above 35% risk limit. Consider reducing.`,
        priority: "HIGH", category: "risk", status: "unread",
        time: "just now", ts: now, action: "View Risk Center",
      });
    }

    // Large unrealized loss
    if (pnlPct < -3) {
      notifications.push({
        id: id++, title: `Drawdown Warning: ${pos.symbol}`,
        message: `${pos.symbol} ${pos.side.toUpperCase()} position is down ${Math.abs(pnlPct).toFixed(2)}%. Review stop loss placement.`,
        priority: "HIGH", category: "risk", status: "unread",
        time: relTime(new Date(pos.openTime).getTime()), ts: new Date(pos.openTime).getTime() + 1000,
        action: "View Portfolio",
      });
    }
  }

  // ── 3. RECENT CLOSED TRADES (last 24h) ────────────────────────────────────
  const recentClosed = [...getClosedTrades()]
    .filter(t => now - new Date(t.closeTime).getTime() < 86_400_000)
    .sort((a, b) => new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime())
    .slice(0, 4);

  for (const t of recentClosed) {
    const ts = new Date(t.closeTime).getTime();
    const isWin = t.pnl > 0;
    notifications.push({
      id: id++,
      title: isWin ? `Trade Won: ${t.symbol}` : `Trade Closed: ${t.symbol}`,
      message: `${t.side.toUpperCase()} ${t.symbol} closed at $${t.exitPrice.toLocaleString()}. P&L: ${isWin ? "+" : ""}$${t.pnl.toFixed(2)} (${isWin ? "+" : ""}${t.pnlPct.toFixed(2)}%). Exit: ${t.exitReason.toUpperCase()}.`,
      priority: isWin ? "MEDIUM" : (t.exitReason === "sl" ? "HIGH" : "MEDIUM"),
      category: "trade", status: now - ts < 1_800_000 ? "unread" : "read",
      time: relTime(ts), ts, action: "View Trade Journal",
    });
  }

  // ── 4. LIVE PRICE ALERTS ──────────────────────────────────────────────────
  const prices = getAllLivePrices();
  const MAJOR_PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];

  // BTC specific alert
  const btcPrice = prices["BTCUSDT"] ?? 0;
  if (btcPrice > 100_000) {
    notifications.push({
      id: id++, title: "BTC Above $100K",
      message: `Bitcoin is trading at $${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}. AI monitoring for continuation signal.`,
      priority: "MEDIUM", category: "market", status: "read",
      time: "live", ts: now - 600_000, action: "View Market Data",
    });
  } else if (btcPrice < 90_000 && btcPrice > 0) {
    notifications.push({
      id: id++, title: "BTC Support Zone",
      message: `Bitcoin at $${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} — approaching major support. Watch for bounce or breakdown.`,
      priority: "MEDIUM", category: "market", status: "read",
      time: "live", ts: now - 300_000, action: "View Market Data",
    });
  }

  // ── 5. PERFORMANCE ALERTS ─────────────────────────────────────────────────
  const todayPnl = account.todayPnl;
  const dailyLossLimit = account.balance * 0.03;

  if (todayPnl < -dailyLossLimit) {
    notifications.push({
      id: id++, title: "Daily Loss Limit Reached",
      message: `Today's P&L: -$${Math.abs(todayPnl).toFixed(2)}. Daily loss limit exceeded. Consider stopping trading for today.`,
      priority: "CRITICAL", category: "risk", status: "unread",
      time: "today", ts: now - 1_800_000, action: "View Risk Center",
    });
  } else if (todayPnl > account.balance * 0.02) {
    notifications.push({
      id: id++, title: "Strong Daily Performance",
      message: `Today's P&L: +$${todayPnl.toFixed(2)} (+${((todayPnl / account.balance) * 100).toFixed(2)}%). Consider securing some profits.`,
      priority: "MEDIUM", category: "portfolio", status: "read",
      time: "today", ts: now - 3_600_000, action: "View Analytics",
    });
  }

  // ── 6. AI DECISIONS (online mode from Supabase, offline mode generates one) ─
  if (!isOfflineMode) {
    try {
      const { data: decisions } = await supabase
        .from("ai_decisions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);

      for (const d of (decisions ?? [])) {
        const ts = new Date(d.created_at).getTime();
        notifications.push({
          id: id++, title: `AI Signal: ${d.symbol}`,
          message: `${d.decision} on ${d.symbol} with ${d.confidence}% confidence. ${d.reasoning?.summary ?? ""}`,
          priority: d.confidence > 80 ? "HIGH" : "MEDIUM",
          category: "ai", status: now - ts < 300_000 ? "unread" : "read",
          time: relTime(ts), ts, action: "View AI Center",
        });
      }
    } catch {}
  } else {
    notifications.push({
      id: id++, title: "AI Analysis Available",
      message: "BTC/USDT 4H AI analysis ready. Run POST /ai/analyze to get the latest 14-agent market analysis.",
      priority: "MEDIUM", category: "ai", status: "read",
      time: "5m ago", ts: now - 300_000, action: "View AI Center",
    });
  }

  // ── 7. OPEN POSITIONS SUMMARY ─────────────────────────────────────────────
  if (livePositions.length > 0) {
    const totalUnrealizedPnl = livePositions.reduce((s, p) => s + p.unrealizedPnl, 0);
    const isProfit = totalUnrealizedPnl > 0;
    notifications.push({
      id: id++, title: `${livePositions.length} Open Position${livePositions.length > 1 ? "s" : ""}`,
      message: `${livePositions.length} active position${livePositions.length > 1 ? "s" : ""} with ${isProfit ? "+" : ""}$${totalUnrealizedPnl.toFixed(2)} unrealized P&L. Equity: $${equity.toFixed(2)}.`,
      priority: "LOW", category: "portfolio", status: "read",
      time: "live", ts: now - 60_000, action: "View Portfolio",
    });
  }

  // Sort by ts descending (newest first), then by priority weight
  const priorityWeight: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  notifications.sort((a: any, b: any) => {
    if (a.status === "unread" && b.status !== "unread") return -1;
    if (b.status === "unread" && a.status !== "unread") return 1;
    if (b.ts !== a.ts) return b.ts - a.ts;
    return (priorityWeight[b.priority] ?? 1) - (priorityWeight[a.priority] ?? 1);
  });

  res.json(notifications);
});

export default router;
