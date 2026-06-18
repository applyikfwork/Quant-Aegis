import { useState, useEffect, useMemo } from "react";
import { useListSignals, getListSignalsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Signal as SignalIcon, TrendingUp, TrendingDown, Minus, RefreshCw,
  Clock, Shield, Zap, BarChart2, Activity, Target, ChevronDown,
  ChevronRight, CheckCircle2, XCircle, AlertCircle, AlertTriangle,
  Bell, Filter, Search, Eye, ArrowUpRight, ArrowDownRight,
  Brain, Layers, Globe, Heart, History, Star, Award, Gauge,
  CircleDot, Timer, BookOpen, Info, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type AgentVote = { score: number; direction: string };
type LifecycleEvent = { event: string; ts: string; detail: string };
type ConfItem = { factor: string; weight: number; score: number };
type MarketSnapshot = Record<string, number | string>;

type Sig = {
  id: number; uuid: string; symbol: string; timeframe: string;
  signalType: string; direction: string; status: string; priority: string;
  confidence: number; strategy: string; strategyName?: string;
  categories?: string[]; entry: number; stopLoss: number;
  tp1: number; tp2: number; tp3: number; riskReward: number;
  currentPrice: number; exchange: string; marketPhase?: string;
  winProbability?: number; maxRisk?: string; expectedDuration?: string;
  createdAt: string; expiresAt?: string;
  agentVotes?: Record<string, AgentVote>;
  evidence?: string[];
  marketSnapshot?: MarketSnapshot;
  confidenceBreakdown?: ConfItem[];
  lifecycle?: LifecycleEvent[];
  pnl?: number | null;
  reason?: string | null;
  atr?: number;
  volatilityRegime?: string;
  invalidationCondition?: string;
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function dirColor(dir: string) {
  const d = dir?.toLowerCase();
  if (d === "buy" || d === "long" || d === "bullish" || d === "approved") return "text-emerald-400";
  if (d === "sell" || d === "short" || d === "bearish" || d === "rejected") return "text-red-400";
  return "text-yellow-400";
}
function dirBg(dir: string) {
  const d = dir?.toLowerCase();
  if (d === "buy" || d === "long" || d === "bullish" || d === "approved") return "bg-emerald-500/10 border-emerald-500/30";
  if (d === "sell" || d === "short" || d === "bearish" || d === "rejected") return "bg-red-500/10 border-red-500/30";
  return "bg-yellow-500/10 border-yellow-500/30";
}
function statusColor(s: string) {
  if (s === "active" || s === "triggered") return "text-emerald-400 border-emerald-500/40 bg-emerald-500/8";
  if (s === "completed") return "text-blue-400 border-blue-500/40 bg-blue-500/8";
  if (s === "cancelled" || s === "expired" || s === "invalidated") return "text-slate-400 border-slate-500/30 bg-slate-500/5";
  if (s === "generated" || s === "waiting") return "text-yellow-400 border-yellow-500/40 bg-yellow-500/8";
  return "text-muted-foreground border-border";
}
function priorityColor(p: string) {
  if (p === "critical") return "text-red-400 border-red-500/40 bg-red-500/8";
  if (p === "high") return "text-orange-400 border-orange-500/40 bg-orange-500/8";
  if (p === "medium") return "text-yellow-400 border-yellow-500/30 bg-yellow-500/5";
  if (p === "low") return "text-blue-400 border-blue-500/30 bg-blue-500/5";
  return "text-slate-400 border-slate-500/20";
}
function confColor(v: number) {
  return v >= 80 ? "text-emerald-400" : v >= 65 ? "text-yellow-400" : "text-red-400";
}
function confBar(v: number) {
  return v >= 70 ? "bg-emerald-500" : v >= 55 ? "bg-yellow-500" : "bg-red-500";
}
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function formatPrice(n: number) {
  if (!n) return "—";
  return n > 1000 ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${n.toFixed(4).replace(/\.?0+$/, "")}`;
}

// ─── STAT CHIP ───────────────────────────────────────────────────────────────
function StatChip({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-3 rounded-xl bg-muted/25 border border-border">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">{label}</span>
      <span className={cn("text-xl font-bold tabular-nums", color ?? "")}>{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─── SIGNAL DETAIL PANEL ─────────────────────────────────────────────────────
function SignalDetail({ sig, onClose }: { sig: Sig; onClose: () => void }) {
  const isBuy = sig.signalType === "buy";
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">{sig.symbol}</span>
          <Badge variant="outline" className={cn("font-bold text-sm", dirColor(sig.signalType), dirBg(sig.signalType))}>
            {isBuy ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {sig.direction}
          </Badge>
          <Badge variant="outline" className={cn("text-xs", statusColor(sig.status))}>{sig.status}</Badge>
          <Badge variant="outline" className={cn("text-xs capitalize", priorityColor(sig.priority))}>{sig.priority}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">✕ Close</Button>
      </div>

      {/* Trade Levels */}
      {sig.entry > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: "Entry", val: sig.entry, color: "text-foreground" },
            { label: "Stop Loss", val: sig.stopLoss, color: "text-red-400" },
            { label: "TP1", val: sig.tp1, color: "text-emerald-400" },
            { label: "TP2", val: sig.tp2, color: "text-emerald-400" },
            { label: "TP3", val: sig.tp3, color: "text-emerald-400/60" },
          ].map(({ label, val, color }) => (
            <div key={label} className="p-2.5 rounded-lg bg-muted/30 border border-border text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
              <div className={cn("text-sm font-bold tabular-nums mt-0.5", color)}>{formatPrice(val)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Meta */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Confidence", val: `${sig.confidence}%`, color: confColor(sig.confidence) },
          { label: "Risk:Reward", val: sig.riskReward ? `1:${sig.riskReward}` : "—", color: "" },
          { label: "Win Probability", val: sig.winProbability ? `${sig.winProbability}%` : "—", color: "" },
          { label: "Max Risk", val: sig.maxRisk ?? "—", color: "text-red-400" },
          { label: "Timeframe", val: sig.timeframe, color: "" },
          { label: "Exchange", val: sig.exchange, color: "" },
          { label: "Duration", val: sig.expectedDuration ?? "—", color: "" },
          { label: "Volatility", val: sig.volatilityRegime ?? "—", color: "" },
        ].map(({ label, val, color }) => (
          <div key={label} className="p-2 rounded-lg bg-muted/20 border border-border">
            <div className="text-[10px] text-muted-foreground">{label}</div>
            <div className={cn("text-sm font-semibold mt-0.5", color)}>{val}</div>
          </div>
        ))}
      </div>

      {/* Confidence Breakdown */}
      {sig.confidenceBreakdown && sig.confidenceBreakdown.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confidence Breakdown</h4>
          {sig.confidenceBreakdown.map((c) => (
            <div key={c.factor} className="flex items-center gap-3">
              <span className="text-xs w-28 shrink-0">{c.factor}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", confBar(c.score))} style={{ width: `${c.score}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground w-6 text-right">{c.weight}%</span>
              <span className={cn("text-xs font-bold w-8 text-right tabular-nums", confColor(c.score))}>{c.score}%</span>
            </div>
          ))}
          <div className="flex justify-between items-center border-t border-border pt-2">
            <span className="text-xs font-semibold">Weighted Confidence</span>
            <span className={cn("text-lg font-black tabular-nums", confColor(sig.confidence))}>{sig.confidence}%</span>
          </div>
        </div>
      )}

      {/* Agent Votes */}
      {sig.agentVotes && Object.keys(sig.agentVotes).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent Votes</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(sig.agentVotes).map(([name, vote]) => (
              <div key={name} className={cn("p-2.5 rounded-lg border text-center", dirBg(vote.direction))}>
                <div className="text-[10px] text-muted-foreground mb-0.5">{name}</div>
                <div className={cn("text-xs font-bold capitalize", dirColor(vote.direction))}>{vote.direction}</div>
                <div className={cn("text-xs tabular-nums", confColor(vote.score))}>{vote.score}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence */}
      {sig.evidence && sig.evidence.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evidence</h4>
          {sig.evidence.map((e, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/20 border border-border text-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              {e}
            </div>
          ))}
        </div>
      )}

      {/* Market Snapshot */}
      {sig.marketSnapshot && Object.keys(sig.marketSnapshot).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Market Snapshot (at signal time)</h4>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Object.entries(sig.marketSnapshot).slice(0, 12).map(([k, v]) => (
              <div key={k} className="p-2 rounded-lg bg-muted/20 border border-border text-center">
                <div className="text-[10px] text-muted-foreground uppercase">{k}</div>
                <div className="text-xs font-semibold mt-0.5 tabular-nums">{typeof v === "number" ? (v > 1000 ? v.toLocaleString() : v.toString()) : v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signal Lifecycle */}
      {sig.lifecycle && sig.lifecycle.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Signal Lifecycle</h4>
          {sig.lifecycle.map((evt, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
                {i < sig.lifecycle!.length - 1 && <div className="w-px flex-1 bg-border mt-1" style={{ minHeight: 16 }} />}
              </div>
              <div className="pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold capitalize">{evt.event}</span>
                  <span className="text-[10px] text-muted-foreground">{relativeTime(evt.ts)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{evt.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invalidation */}
      {sig.invalidationCondition && (
        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
          <div className="text-[10px] uppercase tracking-wider text-red-400 mb-1">Invalidation Condition</div>
          <div className="text-sm text-muted-foreground">{sig.invalidationCondition}</div>
        </div>
      )}
    </div>
  );
}

// ─── SIGNAL CARD ─────────────────────────────────────────────────────────────
function SignalCard({ sig, onSelect, selected }: { sig: Sig; onSelect: () => void; selected: boolean }) {
  const isBuy = sig.signalType === "buy";
  const isActive = sig.status === "active" || sig.status === "triggered";

  return (
    <div
      onClick={onSelect}
      className={cn(
        "rounded-xl border cursor-pointer transition-all hover:border-primary/40 hover:shadow-md p-4 space-y-3",
        selected ? "border-primary/60 bg-primary/5 shadow-md" : "border-border bg-muted/10",
        isActive ? "ring-1 ring-emerald-500/20" : ""
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-base">{sig.symbol}</span>
          <span className="text-xs text-muted-foreground">{sig.timeframe}</span>
          <Badge variant="outline" className={cn("text-[10px] capitalize", priorityColor(sig.priority))}>{sig.priority}</Badge>
        </div>
        <Badge variant="outline" className={cn("text-[10px] capitalize shrink-0", statusColor(sig.status))}>
          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />}
          {sig.status}
        </Badge>
      </div>

      {/* Direction + Confidence */}
      <div className="flex items-center gap-3">
        <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-sm", dirBg(sig.signalType))}>
          {isBuy ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          <span className={dirColor(sig.signalType)}>{sig.direction}</span>
        </div>
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Confidence</span>
            <span className={cn("font-bold tabular-nums", confColor(sig.confidence))}>{sig.confidence}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
            <div className={cn("h-full rounded-full", confBar(sig.confidence))} style={{ width: `${sig.confidence}%` }} />
          </div>
        </div>
      </div>

      {/* Levels */}
      {sig.entry > 0 && (
        <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
          <div className="p-1.5 rounded bg-muted/30 border border-border">
            <div className="text-muted-foreground">Entry</div>
            <div className="font-semibold tabular-nums">{formatPrice(sig.entry)}</div>
          </div>
          <div className="p-1.5 rounded bg-red-500/5 border border-red-500/20">
            <div className="text-red-400">Stop</div>
            <div className="font-semibold tabular-nums text-red-400">{formatPrice(sig.stopLoss)}</div>
          </div>
          <div className="p-1.5 rounded bg-emerald-500/5 border border-emerald-500/20">
            <div className="text-emerald-400">TP1</div>
            <div className="font-semibold tabular-nums text-emerald-400">{formatPrice(sig.tp1)}</div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 pt-2">
        <div className="flex items-center gap-2">
          <Brain className="w-3 h-3" />
          <span>{sig.strategyName ?? sig.strategy}</span>
          {sig.riskReward > 0 && <span className="text-primary font-medium">1:{sig.riskReward} RR</span>}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {relativeTime(sig.createdAt)}
        </div>
      </div>

      {/* Categories */}
      {sig.categories && sig.categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sig.categories.map((c) => (
            <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-muted/30 text-muted-foreground border border-border">{c}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ANALYTICS VIEW ───────────────────────────────────────────────────────────
function AnalyticsView({ signals }: { signals: Sig[] }) {
  const completed = signals.filter((s) => s.status === "completed");
  const wins = completed.filter((s) => (s.pnl ?? 0) > 0);
  const losses = completed.filter((s) => (s.pnl ?? 0) <= 0);
  const winRate = completed.length > 0 ? Math.round((wins.length / completed.length) * 100) : 0;
  const avgConf = signals.length > 0 ? Math.round(signals.reduce((s, x) => s + x.confidence, 0) / signals.length) : 0;
  const avgRR = signals.filter((s) => s.riskReward > 0).length > 0
    ? Math.round(signals.filter((s) => s.riskReward > 0).reduce((s, x) => s + x.riskReward, 0) / signals.filter((s) => s.riskReward > 0).length * 10) / 10
    : 0;
  const active = signals.filter((s) => s.status === "active" || s.status === "triggered").length;
  const avgPnl = wins.length > 0 ? Math.round(wins.reduce((s, x) => s + (x.pnl ?? 0), 0) / wins.length * 10) / 10 : 0;
  const avgLoss = losses.length > 0 ? Math.round(Math.abs(losses.reduce((s, x) => s + (x.pnl ?? 0), 0) / losses.length) * 10) / 10 : 0;
  const profitFactor = avgLoss > 0 ? Math.round((avgPnl * wins.length / (avgLoss * losses.length || 1)) * 100) / 100 : 0;

  const bySymbol = useMemo(() => {
    const map: Record<string, { total: number; wins: number; conf: number[] }> = {};
    for (const s of signals) {
      if (!map[s.symbol]) map[s.symbol] = { total: 0, wins: 0, conf: [] };
      map[s.symbol].total++;
      if (s.status === "completed" && (s.pnl ?? 0) > 0) map[s.symbol].wins++;
      map[s.symbol].conf.push(s.confidence);
    }
    return Object.entries(map).map(([sym, d]) => ({
      sym, total: d.total, wins: d.wins,
      wr: d.total > 0 ? Math.round((d.wins / d.total) * 100) : 0,
      avgConf: Math.round(d.conf.reduce((a, b) => a + b, 0) / d.conf.length),
    })).sort((a, b) => b.total - a.total);
  }, [signals]);

  const byStrategy = useMemo(() => {
    const map: Record<string, { total: number; wins: number }> = {};
    for (const s of signals) {
      const k = s.strategyName ?? s.strategy;
      if (!map[k]) map[k] = { total: 0, wins: 0 };
      map[k].total++;
      if (s.status === "completed" && (s.pnl ?? 0) > 0) map[k].wins++;
    }
    return Object.entries(map).map(([strat, d]) => ({
      strat, total: d.total, wr: d.total > 0 ? Math.round((d.wins / d.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);
  }, [signals]);

  return (
    <div className="space-y-4">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <StatChip label="Total Signals" value={signals.length} />
        <StatChip label="Active" value={active} color="text-emerald-400" />
        <StatChip label="Completed" value={completed.length} />
        <StatChip label="Win Rate" value={`${winRate}%`} color={winRate >= 55 ? "text-emerald-400" : "text-red-400"} />
        <StatChip label="Avg Confidence" value={`${avgConf}%`} color={confColor(avgConf)} />
        <StatChip label="Avg R:R" value={`1:${avgRR}`} />
        <StatChip label="Profit Factor" value={profitFactor > 0 ? profitFactor : "—"} color={profitFactor >= 1.5 ? "text-emerald-400" : "text-yellow-400"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* By Symbol */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" />Performance by Asset</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {bySymbol.map(({ sym, total, wr, avgConf: ac }) => (
              <div key={sym} className="flex items-center gap-3">
                <span className="text-sm font-medium w-20 shrink-0">{sym}</span>
                <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div className={cn("h-full rounded-full", confBar(wr))} style={{ width: `${wr}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">{total} signals</span>
                <span className={cn("text-xs font-bold w-12 text-right tabular-nums", confColor(wr))}>{wr}% WR</span>
                <span className={cn("text-xs w-10 text-right tabular-nums", confColor(ac))}>{ac}%</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* By Strategy */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" />Performance by Strategy</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {byStrategy.map(({ strat, total, wr }) => (
              <div key={strat} className="flex items-center gap-3">
                <span className="text-xs w-36 shrink-0 truncate">{strat}</span>
                <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div className={cn("h-full rounded-full", confBar(wr))} style={{ width: `${wr}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-12 text-right">{total}</span>
                <span className={cn("text-xs font-bold w-10 text-right tabular-nums", confColor(wr))}>{wr}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Confidence distribution */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2"><Gauge className="w-4 h-4 text-primary" />Confidence Distribution</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-5 gap-2">
            {[
              { range: "90–100%", min: 90, label: "Exceptional" },
              { range: "80–90%", min: 80, label: "High" },
              { range: "70–80%", min: 70, label: "Good" },
              { range: "60–70%", min: 60, label: "Moderate" },
              { range: "<60%", min: 0, label: "Low" },
            ].map(({ range, min, label }) => {
              const count = signals.filter((s) => (min === 0 ? s.confidence < 60 : s.confidence >= min && s.confidence < min + 10)).length;
              const pct = signals.length > 0 ? Math.round((count / signals.length) * 100) : 0;
              return (
                <div key={range} className="text-center space-y-1">
                  <div className="h-16 flex items-end justify-center">
                    <div className={cn("w-full rounded-t", min >= 80 ? "bg-emerald-500" : min >= 60 ? "bg-yellow-500" : "bg-red-500")} style={{ height: `${pct}%`, minHeight: count > 0 ? 4 : 0 }} />
                  </div>
                  <div className="text-xs font-bold tabular-nums">{count}</div>
                  <div className="text-[10px] text-muted-foreground">{range}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Learning pipeline status */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2"><Brain className="w-4 h-4 text-primary" />AI Learning Pipeline</CardTitle>
          <CardDescription className="text-xs">Every completed signal feeds the AI improvement cycle</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { step: "Snapshot", count: signals.length, icon: Database },
              { step: "Outcomes Logged", count: completed.length, icon: CheckCircle2 },
              { step: "Win Analysis", count: wins.length, icon: Award },
              { step: "Loss Analysis", count: losses.length, icon: XCircle },
              { step: "Accuracy Scored", count: completed.length, icon: Gauge },
              { step: "Weights Updated", count: Math.floor(completed.length / 5), icon: RefreshCw },
            ].map(({ step, count, icon: Icon }) => (
              <div key={step} className="flex flex-col items-center p-3 rounded-lg bg-muted/20 border border-border text-center">
                <Icon className="w-4 h-4 text-primary mb-1 opacity-70" />
                <div className="text-sm font-bold tabular-nums">{count}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{step}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── NOTIFICATIONS VIEW ───────────────────────────────────────────────────────
function NotificationsView({ signals }: { signals: Sig[] }) {
  const events = useMemo(() => {
    const evts: { type: string; msg: string; ts: string; sym: string; priority: string }[] = [];
    for (const s of signals.slice(0, 20)) {
      if (s.status === "active") evts.push({ type: "entry", msg: `${s.symbol} ${s.direction} signal triggered at ${formatPrice(s.entry)}`, ts: s.createdAt, sym: s.symbol, priority: s.priority });
      if (s.status === "generated") evts.push({ type: "new", msg: `New ${s.confidence}% confidence ${s.direction} signal generated for ${s.symbol} ${s.timeframe}`, ts: s.createdAt, sym: s.symbol, priority: s.priority });
      if (s.status === "completed" && (s.pnl ?? 0) > 0) evts.push({ type: "win", msg: `${s.symbol} signal closed +${s.pnl}% — TP hit`, ts: s.expiresAt ?? s.createdAt, sym: s.symbol, priority: "low" });
      if (s.status === "expired") evts.push({ type: "expired", msg: `${s.symbol} signal expired without trigger`, ts: s.expiresAt ?? s.createdAt, sym: s.symbol, priority: "low" });
      if (s.status === "cancelled") evts.push({ type: "cancelled", msg: `${s.symbol} signal cancelled — verification failed`, ts: s.createdAt, sym: s.symbol, priority: "medium" });
    }
    return evts.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [signals]);

  const iconMap: Record<string, React.ElementType> = {
    entry: Zap, new: Bell, win: Award, expired: Timer, cancelled: XCircle,
  };
  const colorMap: Record<string, string> = {
    entry: "text-emerald-400", new: "text-primary", win: "text-emerald-400", expired: "text-slate-400", cancelled: "text-yellow-400",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{events.length} events from {signals.length} signals</p>
        <Button size="sm" variant="outline" className="text-xs gap-1"><CheckCircle2 className="w-3 h-3" />Mark All Read</Button>
      </div>
      {events.map((evt, i) => {
        const Icon = iconMap[evt.type] ?? Bell;
        return (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/10 hover:border-primary/30 transition-colors">
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center bg-muted/40 shrink-0 mt-0.5")}>
              <Icon className={cn("w-3.5 h-3.5", colorMap[evt.type] ?? "text-primary")} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{evt.msg}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{relativeTime(evt.ts)}</p>
            </div>
            <Badge variant="outline" className={cn("text-[10px] capitalize shrink-0", priorityColor(evt.priority))}>{evt.priority}</Badge>
          </div>
        );
      })}
      {events.length === 0 && (
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <Bell className="w-10 h-10 mb-2 opacity-20" />
          <p className="text-sm">No notifications yet</p>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function SignalsFeed() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("live");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDir, setFilterDir] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterSymbol, setFilterSymbol] = useState("all");
  const [filterTimeframe, setFilterTimeframe] = useState("all");
  const [sortBy, setSortBy] = useState("time");
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const { data: rawSignals, isLoading } = useListSignals(
    { limit: 50 },
    { query: { queryKey: getListSignalsQueryKey({ limit: 50 }), refetchInterval: 15000 } }
  );

  const signals = (rawSignals ?? []) as Sig[];

  // Auto-refresh indicator
  useEffect(() => {
    const t = setInterval(() => setLastRefresh(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: getListSignalsQueryKey({ limit: 50 }) });
    setLastRefresh(Date.now());
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const today = useMemo(() => {
    const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0);
    return signals.filter((s) => new Date(s.createdAt) >= cutoff);
  }, [signals]);

  const stats = useMemo(() => {
    const open = signals.filter((s) => ["generated", "waiting", "triggered"].includes(s.status)).length;
    const active = signals.filter((s) => s.status === "active").length;
    const completed = signals.filter((s) => s.status === "completed");
    const wins = completed.filter((s) => (s.pnl ?? 0) > 0);
    const winRate = completed.length > 0 ? Math.round((wins.length / completed.length) * 100) : 0;
    const avgConf = signals.length > 0 ? Math.round(signals.reduce((s, x) => s + x.confidence, 0) / signals.length) : 0;
    const rrs = signals.filter((s) => s.riskReward > 0);
    const avgRR = rrs.length > 0 ? Math.round(rrs.reduce((s, x) => s + x.riskReward, 0) / rrs.length * 10) / 10 : 0;
    const critical = signals.filter((s) => s.priority === "critical").length;
    return { open, active, completed: completed.length, winRate, avgConf, avgRR, critical, cancelled: signals.filter((s) => ["cancelled","expired","invalidated"].includes(s.status)).length };
  }, [signals]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...signals];
    if (search) list = list.filter((s) => s.symbol.toLowerCase().includes(search.toLowerCase()) || (s.strategyName ?? "").toLowerCase().includes(search.toLowerCase()));
    if (filterStatus !== "all") list = list.filter((s) => s.status === filterStatus);
    if (filterDir !== "all") list = list.filter((s) => s.signalType === filterDir);
    if (filterPriority !== "all") list = list.filter((s) => s.priority === filterPriority);
    if (filterSymbol !== "all") list = list.filter((s) => s.symbol === filterSymbol);
    if (filterTimeframe !== "all") list = list.filter((s) => s.timeframe === filterTimeframe);

    if (sortBy === "confidence") list.sort((a, b) => b.confidence - a.confidence);
    else if (sortBy === "priority") {
      const order = ["critical", "high", "medium", "low", "watch"];
      list.sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [signals, search, filterStatus, filterDir, filterPriority, filterSymbol, filterTimeframe, sortBy]);

  const symbols = useMemo(() => [...new Set(signals.map((s) => s.symbol))], [signals]);
  const timeframes = useMemo(() => [...new Set(signals.map((s) => s.timeframe))], [signals]);
  const selectedSig = selectedId != null ? signals.find((s) => s.id === selectedId) : null;

  return (
    <div className="space-y-4">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <SignalIcon className="w-4.5 h-4.5 text-primary" />
            </div>
            Signals Feed
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Institutional AI Signal Management — lifecycle tracked, every decision recorded</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Auto-refresh 15s</span>
          <Button size="sm" variant="outline" onClick={refresh} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </Button>
        </div>
      </div>

      {/* ── STATS BAR ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <StatChip label="Today" value={today.length} />
        <StatChip label="Active" value={stats.active} color="text-emerald-400" />
        <StatChip label="Open" value={stats.open} color="text-yellow-400" />
        <StatChip label="Completed" value={stats.completed} />
        <StatChip label="Critical" value={stats.critical} color={stats.critical > 0 ? "text-red-400" : ""} />
        <StatChip label="Cancelled" value={stats.cancelled} />
        <StatChip label="Avg Conf" value={`${stats.avgConf}%`} color={confColor(stats.avgConf)} />
        <StatChip label="Avg R:R" value={stats.avgRR > 0 ? `1:${stats.avgRR}` : "—"} />
      </div>

      {/* ── TABS ───────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedId(null); }}>
        <TabsList className="flex flex-wrap gap-1 h-auto bg-muted/30 p-1 rounded-xl">
          {[
            { id: "live", label: "Live Feed", icon: Activity },
            { id: "analytics", label: "Analytics", icon: BarChart2 },
            { id: "history", label: "History", icon: History },
            { id: "notifications", label: "Notifications", icon: Bell },
          ].map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="text-xs gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Icon className="w-3.5 h-3.5" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ══ LIVE FEED ══════════════════════════════════════════════════════ */}
        <TabsContent value="live" className="mt-4 space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search symbol or strategy…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 w-48 text-sm"
                  />
                </div>
                {[
                  { val: filterStatus, set: setFilterStatus, placeholder: "All Status", opts: ["all","generated","waiting","triggered","active","completed","cancelled","expired"] },
                  { val: filterDir, set: setFilterDir, placeholder: "Direction", opts: ["all","buy","sell"] },
                  { val: filterPriority, set: setFilterPriority, placeholder: "Priority", opts: ["all","critical","high","medium","low"] },
                  { val: filterSymbol, set: setFilterSymbol, placeholder: "Asset", opts: ["all", ...symbols] },
                  { val: filterTimeframe, set: setFilterTimeframe, placeholder: "Timeframe", opts: ["all", ...timeframes] },
                  { val: sortBy, set: setSortBy, placeholder: "Sort", opts: ["time","confidence","priority"] },
                ].map(({ val, set, placeholder, opts }, i) => (
                  <Select key={i} value={val} onValueChange={set}>
                    <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue placeholder={placeholder} /></SelectTrigger>
                    <SelectContent>
                      {opts.map((o) => <SelectItem key={o} value={o} className="text-xs capitalize">{o === "all" ? placeholder : o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ))}
                <span className="text-xs text-muted-foreground ml-auto">{filtered.length} signals</span>
              </div>
            </CardContent>
          </Card>

          {/* Main content: card grid + detail panel */}
          <div className={cn("grid gap-4", selectedSig ? "lg:grid-cols-2" : "")}>
            {/* Signal cards */}
            <div className="space-y-3">
              {isLoading ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground">
                  <SignalIcon className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm">No signals match your filters</p>
                  <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => { setFilterStatus("all"); setFilterDir("all"); setFilterPriority("all"); setSearch(""); }}>Clear Filters</Button>
                </div>
              ) : (
                <div className={cn("grid gap-3", selectedSig ? "" : "sm:grid-cols-2 xl:grid-cols-3")}>
                  {filtered.map((sig) => (
                    <SignalCard
                      key={sig.id}
                      sig={sig}
                      selected={selectedId === sig.id}
                      onSelect={() => setSelectedId(selectedId === sig.id ? null : sig.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Detail panel */}
            {selectedSig && (
              <div className="lg:sticky lg:top-4">
                <Card className="border-primary/30 shadow-lg">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="w-4 h-4 text-primary" />Signal Detail
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 max-h-[80vh] overflow-y-auto">
                    <SignalDetail sig={selectedSig} onClose={() => setSelectedId(null)} />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══ ANALYTICS ══════════════════════════════════════════════════════ */}
        <TabsContent value="analytics" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
          ) : (
            <AnalyticsView signals={signals} />
          )}
        </TabsContent>

        {/* ══ HISTORY ════════════════════════════════════════════════════════ */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4 text-primary" />Signal Archive</CardTitle>
              <CardDescription className="text-xs">Full immutable signal history — versioned, never deleted</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {isLoading ? (
                <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        {["Asset","TF","Dir","Status","Priority","Confidence","Entry","SL","TP1","RR","Strategy","Time","PnL"].map((h) => (
                          <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {signals.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => { setSelectedId(s.id); setActiveTab("live"); }}
                          className="border-b border-border/40 hover:bg-muted/20 cursor-pointer transition-colors"
                        >
                          <td className="py-2 px-2 font-semibold">{s.symbol}</td>
                          <td className="py-2 px-2 text-muted-foreground">{s.timeframe}</td>
                          <td className={cn("py-2 px-2 font-bold", dirColor(s.signalType))}>{s.direction}</td>
                          <td className={cn("py-2 px-2 capitalize", statusColor(s.status).split(" ")[0])}>{s.status}</td>
                          <td className={cn("py-2 px-2 capitalize", priorityColor(s.priority).split(" ")[0])}>{s.priority}</td>
                          <td className={cn("py-2 px-2 font-bold tabular-nums", confColor(s.confidence))}>{s.confidence}%</td>
                          <td className="py-2 px-2 tabular-nums text-muted-foreground">{formatPrice(s.entry)}</td>
                          <td className="py-2 px-2 tabular-nums text-red-400">{formatPrice(s.stopLoss)}</td>
                          <td className="py-2 px-2 tabular-nums text-emerald-400">{formatPrice(s.tp1)}</td>
                          <td className="py-2 px-2 tabular-nums">{s.riskReward > 0 ? `1:${s.riskReward}` : "—"}</td>
                          <td className="py-2 px-2 text-muted-foreground max-w-[100px] truncate">{s.strategyName ?? s.strategy}</td>
                          <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">{relativeTime(s.createdAt)}</td>
                          <td className={cn("py-2 px-2 font-bold tabular-nums", s.pnl != null ? (s.pnl > 0 ? "text-emerald-400" : "text-red-400") : "text-muted-foreground")}>
                            {s.pnl != null ? `${s.pnl > 0 ? "+" : ""}${s.pnl}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {signals.length === 0 && (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <History className="w-6 h-6 mr-2 opacity-30" />No signal history yet
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ NOTIFICATIONS ══════════════════════════════════════════════════ */}
        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-primary" />Notification Center</CardTitle>
              <CardDescription className="text-xs">Signal events, lifecycle updates, and alerts</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {isLoading ? (
                <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
              ) : (
                <NotificationsView signals={signals} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
