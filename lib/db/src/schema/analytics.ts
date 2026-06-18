import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const backtestsTable = pgTable("backtests", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").notNull(),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(),
  symbol: text("symbol"),
  timeframe: text("timeframe"),
  totalTrades: integer("total_trades").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  winRate: real("win_rate").notNull().default(0),
  profitFactor: real("profit_factor").notNull().default(0),
  drawdown: real("drawdown").notNull().default(0),
  sharpeRatio: real("sharpe_ratio"),
  totalReturn: real("total_return"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityEventsTable = pgTable("activity_events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // trade_opened | trade_closed | signal_generated | backtest_complete | strategy_created | system_alert
  title: text("title").notNull(),
  description: text("description").notNull(),
  symbol: text("symbol"),
  value: real("value"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const systemLogsTable = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  service: text("service").notNull(),
  event: text("event").notNull(),
  message: text("message").notNull(),
  level: text("level").notNull().default("info"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBacktestSchema = createInsertSchema(backtestsTable).omit({ id: true, createdAt: true });
export type InsertBacktest = z.infer<typeof insertBacktestSchema>;
export type Backtest = typeof backtestsTable.$inferSelect;

export const insertActivityEventSchema = createInsertSchema(activityEventsTable).omit({ id: true });
export type InsertActivityEvent = z.infer<typeof insertActivityEventSchema>;
export type ActivityEvent = typeof activityEventsTable.$inferSelect;

export const insertSystemLogSchema = createInsertSchema(systemLogsTable).omit({ id: true });
export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;
export type SystemLog = typeof systemLogsTable.$inferSelect;
