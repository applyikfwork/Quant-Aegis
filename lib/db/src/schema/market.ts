import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const marketCandlesTable = pgTable("market_candles", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  open: real("open").notNull(),
  high: real("high").notNull(),
  low: real("low").notNull(),
  close: real("close").notNull(),
  volume: real("volume").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const indicatorsTable = pgTable("indicators", {
  id: serial("id").primaryKey(),
  candleId: integer("candle_id"),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  ema20: real("ema20"),
  ema50: real("ema50"),
  ema200: real("ema200"),
  rsi: real("rsi"),
  macd: real("macd"),
  macdSignal: real("macd_signal"),
  atr: real("atr"),
  vwap: real("vwap"),
  bollingerUpper: real("bollinger_upper"),
  bollingerLower: real("bollinger_lower"),
  adx: real("adx"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMarketCandleSchema = createInsertSchema(marketCandlesTable).omit({ id: true, createdAt: true });
export type InsertMarketCandle = z.infer<typeof insertMarketCandleSchema>;
export type MarketCandle = typeof marketCandlesTable.$inferSelect;

export const insertIndicatorSchema = createInsertSchema(indicatorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIndicator = z.infer<typeof insertIndicatorSchema>;
export type Indicator = typeof indicatorsTable.$inferSelect;
