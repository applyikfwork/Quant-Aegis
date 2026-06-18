import { pgTable, text, serial, timestamp, integer, real, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiMemoryTable = pgTable("ai_memory", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  marketCondition: jsonb("market_condition").notNull(),
  features: jsonb("features").notNull(),
  outcome: text("outcome"),
  outcomePct: real("outcome_pct"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiDecisionsTable = pgTable("ai_decisions", {
  id: serial("id").primaryKey(),
  signalId: integer("signal_id"),
  symbol: text("symbol").notNull(),
  decision: text("decision").notNull(),
  confidence: integer("confidence").notNull().default(0),
  reasoning: jsonb("reasoning").notNull(),
  agentVotes: jsonb("agent_votes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiFeedbackTable = pgTable("ai_feedback", {
  id: serial("id").primaryKey(),
  decisionId: integer("decision_id"),
  tradeId: integer("trade_id"),
  prediction: text("prediction").notNull(),
  actualResult: text("actual_result"),
  correct: boolean("correct"),
  lesson: text("lesson"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const strategyVersionsTable = pgTable("strategy_versions", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").notNull(),
  version: integer("version").notNull().default(1),
  entryRules: jsonb("entry_rules").notNull(),
  exitRules: jsonb("exit_rules").notNull(),
  parameters: jsonb("parameters"),
  changeReason: text("change_reason"),
  performanceBefore: jsonb("performance_before"),
  performanceAfter: jsonb("performance_after"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const experimentsTable = pgTable("experiments", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id"),
  hypothesis: text("hypothesis").notNull(),
  changeMade: jsonb("change_made"),
  testPeriod: text("test_period"),
  backtestResult: jsonb("backtest_result"),
  verdict: text("verdict").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paperTradesTable = pgTable("paper_trades", {
  id: serial("id").primaryKey(),
  signalId: integer("signal_id"),
  strategyId: integer("strategy_id"),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  quantity: real("quantity").notNull(),
  stopLoss: real("stop_loss"),
  takeProfit: real("take_profit"),
  profitLoss: real("profit_loss"),
  profitPercent: real("profit_percent"),
  status: text("status").notNull().default("open"),
  entryTime: timestamp("entry_time", { withTimezone: true }).notNull().defaultNow(),
  exitTime: timestamp("exit_time", { withTimezone: true }),
});

export const insertAiMemorySchema = createInsertSchema(aiMemoryTable).omit({ id: true, createdAt: true });
export type InsertAiMemory = z.infer<typeof insertAiMemorySchema>;
export type AiMemory = typeof aiMemoryTable.$inferSelect;

export const insertAiDecisionSchema = createInsertSchema(aiDecisionsTable).omit({ id: true, createdAt: true });
export type InsertAiDecision = z.infer<typeof insertAiDecisionSchema>;
export type AiDecision = typeof aiDecisionsTable.$inferSelect;

export const insertAiFeedbackSchema = createInsertSchema(aiFeedbackTable).omit({ id: true, createdAt: true });
export type InsertAiFeedback = z.infer<typeof insertAiFeedbackSchema>;
export type AiFeedback = typeof aiFeedbackTable.$inferSelect;

export const insertStrategyVersionSchema = createInsertSchema(strategyVersionsTable).omit({ id: true, createdAt: true });
export type InsertStrategyVersion = z.infer<typeof insertStrategyVersionSchema>;
export type StrategyVersion = typeof strategyVersionsTable.$inferSelect;

export const insertExperimentSchema = createInsertSchema(experimentsTable).omit({ id: true, createdAt: true });
export type InsertExperiment = z.infer<typeof insertExperimentSchema>;
export type Experiment = typeof experimentsTable.$inferSelect;

export const insertPaperTradeSchema = createInsertSchema(paperTradesTable).omit({ id: true });
export type InsertPaperTrade = z.infer<typeof insertPaperTradeSchema>;
export type PaperTrade = typeof paperTradesTable.$inferSelect;
