import { pgTable, text, serial, timestamp, integer, real, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradeEventsTable = pgTable("trade_events", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").notNull(),
  eventType: text("event_type").notNull(),
  description: text("description").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const tradePsychologyTable = pgTable("trade_psychology", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").notNull().unique(),
  preConfidence: integer("pre_confidence"),
  preFear: integer("pre_fear"),
  preStress: integer("pre_stress"),
  preFocus: integer("pre_focus"),
  preEmotion: text("pre_emotion"),
  preNotes: text("pre_notes"),
  postSatisfaction: integer("post_satisfaction"),
  postRegret: integer("post_regret"),
  postConfidenceChange: integer("post_confidence_change"),
  postLearning: text("post_learning"),
  postNotes: text("post_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeReviewsTable = pgTable("trade_reviews", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").notNull().unique(),
  entryScore: integer("entry_score"),
  riskScore: integer("risk_score"),
  exitScore: integer("exit_score"),
  timingScore: integer("timing_score"),
  overallScore: integer("overall_score"),
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  recommendations: text("recommendations"),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeMistakesTable = pgTable("trade_mistakes", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").notNull(),
  mistakeType: text("mistake_type").notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull().default("medium"),
  description: text("description").notNull(),
  solution: text("solution"),
  aiDetected: boolean("ai_detected").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTradeEventSchema = createInsertSchema(tradeEventsTable).omit({ id: true });
export type InsertTradeEvent = z.infer<typeof insertTradeEventSchema>;
export type TradeEvent = typeof tradeEventsTable.$inferSelect;

export const insertTradePsychologySchema = createInsertSchema(tradePsychologyTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTradePsychology = z.infer<typeof insertTradePsychologySchema>;
export type TradePsychology = typeof tradePsychologyTable.$inferSelect;

export const insertTradeReviewSchema = createInsertSchema(tradeReviewsTable).omit({ id: true, createdAt: true });
export type InsertTradeReview = z.infer<typeof insertTradeReviewSchema>;
export type TradeReview = typeof tradeReviewsTable.$inferSelect;

export const insertTradeMistakeSchema = createInsertSchema(tradeMistakesTable).omit({ id: true, createdAt: true });
export type InsertTradeMistake = z.infer<typeof insertTradeMistakeSchema>;
export type TradeMistake = typeof tradeMistakesTable.$inferSelect;
