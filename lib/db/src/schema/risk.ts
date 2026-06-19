import { pgTable, text, serial, timestamp, integer, real, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── RISK PROFILES ─────────────────────────────────────────────────────────────
export const riskProfilesTable = pgTable("risk_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("default"),
  maxDailyLossPct: real("max_daily_loss_pct").notNull().default(5),
  maxTradeLossPct: real("max_trade_loss_pct").notNull().default(2),
  maxExposurePct: real("max_exposure_pct").notNull().default(60),
  maxLeverage: real("max_leverage").notNull().default(3),
  maxPositions: integer("max_positions").notNull().default(10),
  minAiConfidence: real("min_ai_confidence").notNull().default(65),
  minRiskReward: real("min_risk_reward").notNull().default(1.5),
  emergencyModeActive: boolean("emergency_mode_active").notNull().default(false),
  stopNewTrades: boolean("stop_new_trades").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ── RISK EVENTS ───────────────────────────────────────────────────────────────
export const riskEventsTable = pgTable("risk_events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // exposure_spike | drawdown_warning | leverage_breach | volatility_spike | liquidation_risk | daily_limit | correlation_risk | margin_danger
  severity: text("severity").notNull().default("info"), // info | warning | danger | critical
  message: text("message").notNull(),
  detail: text("detail"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── EXPOSURE RECORDS ──────────────────────────────────────────────────────────
export const exposureRecordsTable = pgTable("exposure_records", {
  id: serial("id").primaryKey(),
  asset: text("asset").notNull(),
  value: real("value").notNull(),
  percentage: real("percentage").notNull(),
  riskContrib: real("risk_contrib"),
  snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── POSITION RISK ─────────────────────────────────────────────────────────────
export const positionRiskTable = pgTable("position_risk", {
  id: serial("id").primaryKey(),
  positionId: integer("position_id").notNull(),
  symbol: text("symbol").notNull(),
  riskPct: real("risk_pct"),
  stopDistance: real("stop_distance"),
  maxLoss: real("max_loss"),
  liquidationPrice: real("liquidation_price"),
  liquidationBuffer: real("liquidation_buffer"),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── STRESS TESTS ──────────────────────────────────────────────────────────────
export const stressTestsTable = pgTable("stress_tests", {
  id: serial("id").primaryKey(),
  scenario: text("scenario").notNull(),
  description: text("description"),
  marketMove: real("market_move").notNull(),
  portfolioMove: real("portfolio_move"),
  impact: real("impact"),
  newPortfolioValue: real("new_portfolio_value"),
  survivable: boolean("survivable"),
  severity: text("severity"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── RISK SNAPSHOTS ────────────────────────────────────────────────────────────
export const riskSnapshotsTable = pgTable("risk_snapshots", {
  id: serial("id").primaryKey(),
  riskScore: real("risk_score").notNull(),
  accountSafety: text("account_safety").notNull().default("safe"), // safe | warning | danger | critical
  totalExposure: real("total_exposure").notNull().default(0),
  exposurePct: real("exposure_pct").notNull().default(0),
  dailyPnl: real("daily_pnl").notNull().default(0),
  drawdown: real("drawdown").notNull().default(0),
  leverage: real("leverage").notNull().default(0),
  varAmount: real("var_amount").notNull().default(0),
  portfolioState: jsonb("portfolio_state"),
  snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── TRADE APPROVALS ───────────────────────────────────────────────────────────
export const approvalsTable = pgTable("approvals", {
  id: serial("id").primaryKey(),
  tradeId: text("trade_id"),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  requestedSize: real("requested_size"),
  approvedSize: real("approved_size"),
  decision: text("decision").notNull(), // approved | reduced | modified | rejected
  reason: text("reason"),
  riskScore: real("risk_score"),
  aiConfidence: real("ai_confidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── INSERT SCHEMAS ────────────────────────────────────────────────────────────
export const insertRiskProfileSchema = createInsertSchema(riskProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRiskProfile = z.infer<typeof insertRiskProfileSchema>;
export type RiskProfile = typeof riskProfilesTable.$inferSelect;

export const insertRiskEventSchema = createInsertSchema(riskEventsTable).omit({ id: true, createdAt: true });
export type InsertRiskEvent = z.infer<typeof insertRiskEventSchema>;
export type RiskEvent = typeof riskEventsTable.$inferSelect;

export const insertApprovalSchema = createInsertSchema(approvalsTable).omit({ id: true, createdAt: true });
export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type Approval = typeof approvalsTable.$inferSelect;
