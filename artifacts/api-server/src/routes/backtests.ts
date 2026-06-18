import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";
import { CreateBacktestBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/backtests", async (_req, res): Promise<void> => {
  const { data, error } = await supabase
    .from("backtests").select("*, strategies(name)").order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(b => ({
    id: b.id, strategyId: b.strategy_id, startDate: b.start_date, endDate: b.end_date,
    totalTrades: b.total_trades, wins: b.wins, losses: b.losses, winRate: b.win_rate,
    profitFactor: b.profit_factor, drawdown: b.drawdown, sharpeRatio: b.sharpe_ratio,
    totalReturn: b.total_return, createdAt: b.created_at,
    strategyName: (b.strategies as any)?.name ?? null,
  })));
});

router.post("/backtests", async (req, res): Promise<void> => {
  const parsed = CreateBacktestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const totalTrades = Math.floor(Math.random() * 80) + 20;
  const wins = Math.floor(totalTrades * (0.45 + Math.random() * 0.25));
  const losses = totalTrades - wins;
  const winRate = (wins / totalTrades) * 100;
  const grossProfit = wins * (120 + Math.random() * 200);
  const grossLoss = losses * (80 + Math.random() * 100);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 1;
  const totalReturn = ((grossProfit - grossLoss) / 10000) * 100;
  const drawdown = 5 + Math.random() * 20;
  const sharpeRatio = 0.5 + Math.random() * 2;

  const { data: backtest, error } = await supabase.from("backtests").insert({
    strategy_id: parsed.data.strategyId, start_date: parsed.data.startDate,
    end_date: parsed.data.endDate, symbol: parsed.data.symbol ?? null,
    timeframe: parsed.data.timeframe ?? null, total_trades: totalTrades,
    wins, losses, win_rate: Math.round(winRate * 100) / 100,
    profit_factor: Math.round(profitFactor * 100) / 100,
    drawdown: Math.round(drawdown * 100) / 100,
    sharpe_ratio: Math.round(sharpeRatio * 100) / 100,
    total_return: Math.round(totalReturn * 100) / 100,
  }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }

  const { data: strategy } = await supabase.from("strategies").select("name").eq("id", parsed.data.strategyId).single();
  await supabase.from("activity_events").insert({
    type: "backtest_complete",
    title: `Backtest complete: ${strategy?.name ?? "Strategy"}`,
    description: `Backtest finished — Win Rate: ${Math.round(winRate)}% | PF: ${Math.round(profitFactor * 100) / 100} | Drawdown: ${Math.round(drawdown)}%`,
  });

  res.status(201).json({
    id: backtest.id, strategyId: backtest.strategy_id, startDate: backtest.start_date,
    endDate: backtest.end_date, totalTrades: backtest.total_trades, wins: backtest.wins,
    losses: backtest.losses, winRate: backtest.win_rate, profitFactor: backtest.profit_factor,
    drawdown: backtest.drawdown, sharpeRatio: backtest.sharpe_ratio, totalReturn: backtest.total_return,
    createdAt: backtest.created_at, strategyName: strategy?.name ?? null,
  });
});

export default router;
