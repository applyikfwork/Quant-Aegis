import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  strategyId: integer("strategy_id"),
  side: text("side").notNull(), // long | short
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  quantity: real("quantity").notNull(),
  stopLoss: real("stop_loss"),
  takeProfit: real("take_profit"),
  profitLoss: real("profit_loss"),
  profitPercent: real("profit_percent"),
  status: text("status").notNull().default("open"), // open | closed | cancelled
  aiConfidence: real("ai_confidence"),
  timeframe: text("timeframe"),
  entryTime: timestamp("entry_time", { withTimezone: true }).notNull().defaultNow(),
  exitTime: timestamp("exit_time", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const tradeReasonsTable = pgTable("trade_reasons", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").notNull(),
  reasonType: text("reason_type").notNull(),
  reasonText: text("reason_text").notNull(),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;

export const insertTradeReasonSchema = createInsertSchema(tradeReasonsTable).omit({ id: true });
export type InsertTradeReason = z.infer<typeof insertTradeReasonSchema>;
export type TradeReason = typeof tradeReasonsTable.$inferSelect;
