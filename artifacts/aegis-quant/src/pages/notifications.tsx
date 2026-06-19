import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Bell, BellOff, AlertTriangle, CheckCircle2, XCircle, Info,
  Zap, Shield, Brain, TrendingUp, TrendingDown, Activity,
  Database, Server, ChevronRight, Eye, EyeOff, Filter,
  Settings, Clock, BarChart2, Globe, Target, RefreshCw,
  Volume2, VolumeX, Trash2, Mail, Smartphone, Webhook,
} from "lucide-react";

// ── TYPES ─────────────────────────────────────────────────────────────────────

type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type NotifStatus = "unread" | "read" | "dismissed";
type AlertCategory =
  | "market" | "trade" | "ai" | "risk" | "portfolio"
  | "strategy" | "research" | "security" | "system";

interface Notif {
  id: number;
  title: string;
  message: string;
  priority: Priority;
  category: AlertCategory;
  status: NotifStatus;
  time: string;
  ts: number; // ms
  icon: React.ElementType;
  iconColor: string;
  action?: string;
}

// ── LIVE FEED ─────────────────────────────────────────────────────────────────

const BASE_NOTIFICATIONS: Notif[] = [
  { id: 1, title: "BTC Resistance Test", message: "Bitcoin approaching key resistance at $105,000. AI confidence 87%. Watch for rejection or breakout confirmation.", priority: "HIGH", category: "market", status: "unread", time: "just now", ts: Date.now(), icon: TrendingUp, iconColor: "text-orange-400", action: "View Market" },
  { id: 2, title: "AI Analysis Complete", message: "5-agent analysis finished for BTC/USDT 4H. Signal: BUY. Confidence: 84%. Entry zone: $102,400–$103,200.", priority: "MEDIUM", category: "ai", status: "unread", time: "1m ago", ts: Date.now() - 60000, icon: Brain, iconColor: "text-cyan-400", action: "View AI Center" },
  { id: 3, title: "Risk Exposure Warning", message: "BTC portfolio allocation at 68% — above recommended 50% limit. Consider reducing position size.", priority: "HIGH", category: "risk", status: "unread", time: "4m ago", ts: Date.now() - 240000, icon: AlertTriangle, iconColor: "text-orange-400", action: "View Risk Center" },
  { id: 4, title: "Database Offline", message: "Supabase connection not established. All persistent storage disabled — running in read-only mode.", priority: "CRITICAL", category: "system", status: "unread", time: "8m ago", ts: Date.now() - 480000, icon: Database, iconColor: "text-red-400", action: "View System Monitor" },
  { id: 5, title: "Market Volatility Spike", message: "BTC ATR elevated 34% above 20-day average. High volatility regime detected. AI recommends reduced position sizes.", priority: "MEDIUM", category: "market", status: "read", time: "12m ago", ts: Date.now() - 720000, icon: Activity, iconColor: "text-yellow-400" },
  { id: 6, title: "New Pattern Discovery", message: "Research Lab AI discovered: Volume expansion + RSI divergence precedes 78% of breakouts in 4H timeframe.", priority: "MEDIUM", category: "research", status: "read", time: "18m ago", ts: Date.now() - 1080000, icon: Zap, iconColor: "text-purple-400", action: "View Research" },
  { id: 7, title: "SOL Momentum Signal", message: "SOL/USDT momentum indicator turning bullish. Volume +42% above average. Strategy: EMA Cross generating BUY signal.", priority: "MEDIUM", category: "trade", status: "read", time: "24m ago", ts: Date.now() - 1440000, icon: TrendingUp, iconColor: "text-green-400", action: "View Signals" },
  { id: 8, title: "Failed Login Blocked", message: "Unusual login attempt detected from IP 203.0.113.42. Access blocked automatically. Review if unexpected.", priority: "HIGH", category: "security", status: "read", time: "1h ago", ts: Date.now() - 3600000, icon: Shield, iconColor: "text-red-400", action: "View Security" },
  { id: 9, title: "Strategy Win Rate Drop", message: "EMA Cross strategy win rate declined: 76% → 58% over last 30 trades. Review strategy parameters.", priority: "HIGH", category: "strategy", status: "read", time: "2h ago", ts: Date.now() - 7200000, icon: TrendingDown, iconColor: "text-orange-400", action: "View Strategies" },
  { id: 10, title: "Daily Report Ready", message: "AI-generated daily performance summary for June 19, 2025 is ready. Portfolio: Flat. Active strategies: 2.", priority: "LOW", category: "portfolio", status: "read", time: "3h ago", ts: Date.now() - 10800000, icon: BarChart2, iconColor: "text-blue-400", action: "View Analytics" },
  { id: 11, title: "Market Regime Change", message: "AI Regime Detector transitioned from Sideways → High Volatility Trend with 86% confidence.", priority: "MEDIUM", category: "ai", status: "read", time: "4h ago", ts: Date.now() - 14400000, icon: Brain, iconColor: "text-cyan-400" },
  { id: 12, title: "System Startup", message: "AEGIS QUANT AI initialized. API Server online. 14 modules loaded. Market data syncing from Bybit.", priority: "LOW", category: "system", status: "dismissed", time: "5h ago", ts: Date.now() - 18000000, icon: Server, iconColor: "text-green-400" },
];

// ── ALERT ANALYTICS DATA ───────────────────────────────────────────────────────

const ALERT_VOLUME = [
  { hour: "00:00", alerts: 4 }, { hour: "02:00", alerts: 2 }, { hour: "04:00", alerts: 3 },
  { hour: "06:00", alerts: 8 }, { hour: "08:00", alerts: 14 }, { hour: "10:00", alerts: 22 },
  { hour: "12:00", alerts: 18 }, { hour: "14:00", alerts: 31 }, { hour: "16:00", alerts: 26 },
  { hour: "18:00", alerts: 19 }, { hour: "20:00", alerts: 11 }, { hour: "22:00", alerts: 7 },
];

const CATEGORY_BREAKDOWN = [
  { cat: "Market", count: 42, color: "#3b82f6" },
  { cat: "AI", count: 31, color: "#06b6d4" },
  { cat: "Risk", count: 28, color: "#f59e0b" },
  { cat: "Trade", count: 24, color: "#22c55e" },
  { cat: "System", count: 18, color: "#8b5cf6" },
  { cat: "Security", count: 8, color: "#ef4444" },
];

const RESPONSE_TREND = [
  { day: "Mon", rate: 72 }, { day: "Tue", rate: 78 }, { day: "Wed", rate: 81 },
  { day: "Thu", rate: 75 }, { day: "Fri", rate: 84 }, { day: "Sat", rate: 68 },
  { day: "Sun", rate: 71 },
];

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "#0a0a0a", borderColor: "#1f2937", color: "#fff", fontSize: 11 },
  itemStyle: { color: "#fff" },
};

// ── TABS ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "feed", label: "Live Feed" },
  { id: "priority", label: "Priority Alerts" },
  { id: "market", label: "Market" },
  { id: "trade", label: "Trade" },
  { id: "ai", label: "AI Alerts" },
  { id: "risk", label: "Risk" },
  { id: "security", label: "Security" },
  { id: "system", label: "System" },
  { id: "summaries", label: "AI Summaries" },
  { id: "rules", label: "Rules" },
  { id: "preferences", label: "Preferences" },
  { id: "history", label: "History" },
  { id: "analytics", label: "Analytics" },
];

// ── SHARED ────────────────────────────────────────────────────────────────────

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

const PRIORITY_STYLES: Record<Priority, { badge: string; dot: string; border: string }> = {
  CRITICAL: { badge: "text-red-400 border-red-500/40 bg-red-500/10", dot: "bg-red-400", border: "border-l-red-400" },
  HIGH: { badge: "text-orange-400 border-orange-500/40 bg-orange-500/10", dot: "bg-orange-400", border: "border-l-orange-400" },
  MEDIUM: { badge: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10", dot: "bg-yellow-400", border: "border-l-yellow-400" },
  LOW: { badge: "text-blue-400 border-blue-500/40 bg-blue-500/10", dot: "bg-blue-400", border: "border-l-blue-400" },
};

const CATEGORY_LABELS: Record<AlertCategory, string> = {
  market: "Market", trade: "Trade", ai: "AI", risk: "Risk",
  portfolio: "Portfolio", strategy: "Strategy", research: "Research",
  security: "Security", system: "System",
};

function PriorityBadge({ p }: { p: Priority }) {
  return (
    <Badge variant="outline" className={`text-xs font-bold ${PRIORITY_STYLES[p].badge}`}>{p}</Badge>
  );
}

function StatCard({ title, value, sub, icon: Icon, iconColor }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; iconColor: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ── NOTIFICATION CARD ─────────────────────────────────────────────────────────

function NotifCard({
  n, onRead, onDismiss,
}: {
  n: Notif;
  onRead: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  const ps = PRIORITY_STYLES[n.priority];
  const Icon = n.icon;
  return (
    <div className={`p-4 rounded-lg border border-l-4 bg-card transition-colors ${ps.border} ${n.status === "unread" ? "bg-muted/20" : "opacity-70"}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${n.status === "unread" ? "bg-muted" : "bg-muted/40"}`}>
          <Icon className={`w-4 h-4 ${n.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-semibold ${n.status === "unread" ? "" : "text-muted-foreground"}`}>{n.title}</span>
              <PriorityBadge p={n.priority} />
              <Badge variant="outline" className="text-xs text-muted-foreground">{CATEGORY_LABELS[n.category]}</Badge>
              {n.status === "unread" && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />}
            </div>
            <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{n.time}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>
          <div className="flex items-center gap-2 mt-2">
            {n.action && (
              <button className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                {n.action} <ChevronRight className="w-3 h-3" />
              </button>
            )}
            <div className="ml-auto flex items-center gap-1">
              {n.status === "unread" && (
                <button onClick={() => onRead(n.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/40">
                  <Eye className="w-3 h-3" /> Mark read
                </button>
              )}
              <button onClick={() => onDismiss(n.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/40">
                <XCircle className="w-3 h-3" /> Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LIVE FEED ─────────────────────────────────────────────────────────────────

function LiveFeed({ notifications, onRead, onDismiss, onMarkAllRead }: any) {
  const visible = notifications.filter((n: Notif) => n.status !== "dismissed");
  const unread = visible.filter((n: Notif) => n.status === "unread");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="Live Event Feed" desc="Real-time stream of all platform events — AI decisions, market moves, trades, risk, and system events." />
        <div className="flex gap-2 shrink-0 -mt-5">
          {unread.length > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onMarkAllRead}>
              <CheckCircle2 className="w-3 h-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BellOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">All caught up — no notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((n: Notif) => (
            <NotifCard key={n.id} n={n} onRead={onRead} onDismiss={onDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── PRIORITY ALERTS ────────────────────────────────────────────────────────────

function PriorityAlerts({ notifications, onRead, onDismiss }: any) {
  const critical = notifications.filter((n: Notif) => n.priority === "CRITICAL" && n.status !== "dismissed");
  const high = notifications.filter((n: Notif) => n.priority === "HIGH" && n.status !== "dismissed");

  return (
    <div className="space-y-5">
      <SectionHeader title="Priority Alerts" desc="Critical and high-priority alerts requiring immediate attention." />

      {critical.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
            Critical — Immediate Action Required ({critical.length})
          </div>
          {critical.map((n: Notif) => <NotifCard key={n.id} n={n} onRead={onRead} onDismiss={onDismiss} />)}
        </div>
      )}

      {high.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-400">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
            High Priority ({high.length})
          </div>
          {high.map((n: Notif) => <NotifCard key={n.id} n={n} onRead={onRead} onDismiss={onDismiss} />)}
        </div>
      )}

      {critical.length === 0 && high.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30 text-green-400" />
          <p className="text-sm">No high-priority alerts — system stable</p>
        </div>
      )}
    </div>
  );
}

// ── CATEGORY SECTION ──────────────────────────────────────────────────────────

function CategoryFeed({ notifications, onRead, onDismiss, category, title, desc }: any) {
  const filtered = notifications.filter((n: Notif) => n.category === category && n.status !== "dismissed");
  return (
    <div className="space-y-4">
      <SectionHeader title={title} desc={desc} />
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BellOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No {title.toLowerCase()} alerts</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n: Notif) => <NotifCard key={n.id} n={n} onRead={onRead} onDismiss={onDismiss} />)}
        </div>
      )}
    </div>
  );
}

// ── AI SUMMARIES ──────────────────────────────────────────────────────────────

function AiSummaries() {
  const summaries = [
    {
      period: "Last 1 Hour",
      generated: "just now",
      icon: Clock,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10 border-cyan-500/20",
      headline: "Platform stable. One risk warning active.",
      bullets: [
        "BTC approaching $105K resistance — 87% AI confidence in setup quality",
        "Portfolio BTC exposure above recommended limit (68% vs 50% target)",
        "SOL bullish signal generated — volume surge +42% above average",
        "No trades executed — paper trading mode active",
      ],
      impact: "Neutral",
      actionable: "Review BTC exposure in Risk Center",
    },
    {
      period: "Today (June 19)",
      generated: "5m ago",
      icon: Activity,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
      headline: "12 AI analyses completed. 0 trades. Database offline.",
      bullets: [
        "12 AI market analyses completed across BTC, ETH, SOL, BNB, XRP, DOGE",
        "Database in offline mode — no trades, signals, or strategies persisted",
        "1 research discovery: Volume + RSI divergence pattern found",
        "Security: 1 login attempt blocked from unknown IP address",
        "System health score: 71/100 (reduced from 96 due to DB offline)",
      ],
      impact: "Neutral",
      actionable: "Add Supabase tables via SQL Editor to enable persistence",
    },
    {
      period: "This Week",
      generated: "1h ago",
      icon: TrendingUp,
      color: "text-green-400",
      bg: "bg-green-500/10 border-green-500/20",
      headline: "Platform fully deployed. All 15 modules active.",
      bullets: [
        "All 15 trading modules successfully built and deployed",
        "Supabase connection established — table creation pending",
        "AI 5-agent pipeline operational: Market, Quant, Strategy, Risk, Data agents",
        "Market data syncing from Bybit: 32 trading pairs, 5 timeframes",
        "Research Lab: 156 AI patterns discovered, 4 strategy ideas generated",
      ],
      impact: "Positive",
      actionable: "Create Supabase tables to enable full data persistence",
    },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader title="AI Notification Summaries" desc="AI condenses hundreds of events into concise, actionable summaries — cutting through the noise." />

      <div className="p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-xs text-cyan-400 flex items-center gap-2">
        <Brain className="w-4 h-4 shrink-0" />
        AI Summarizer active — converting raw events into human-readable intelligence briefings
      </div>

      <div className="space-y-4">
        {summaries.map((s, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <CardTitle className="text-sm">{s.period} Summary</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${s.impact === "Positive" ? "text-green-400 border-green-500/30" : s.impact === "Negative" ? "text-red-400 border-red-500/30" : "text-muted-foreground"}`}>
                    {s.impact}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Generated {s.generated}</span>
                </div>
              </div>
              <p className={`text-sm font-semibold mt-1 ${s.color}`}>{s.headline}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={`p-3 rounded-lg border ${s.bg}`}>
                <ul className="space-y-1.5">
                  {s.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs">
                      <span className={`mt-1 w-1 h-1 rounded-full shrink-0 ${s.color.replace("text-", "bg-")}`} />
                      <span className="text-muted-foreground leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <span className="text-yellow-400 font-medium">Recommended Action:</span>
                <span className="text-muted-foreground">{s.actionable}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── RULES ─────────────────────────────────────────────────────────────────────

function RulesSection() {
  const [rules, setRules] = useState([
    { id: 1, name: "BTC 5% Move Alert", condition: "BTC price changes > 5% in 1 hour", action: "Send HIGH priority alert", enabled: true, triggered: 3 },
    { id: 2, name: "Risk Exposure Guard", condition: "Any asset > 60% portfolio allocation", action: "Send CRITICAL alert + badge", enabled: true, triggered: 1 },
    { id: 3, name: "AI Confidence Drop", condition: "AI signal confidence drops below 70%", action: "Send MEDIUM alert", enabled: true, triggered: 0 },
    { id: 4, name: "Strategy Win Rate Alert", condition: "Strategy win rate drops below 55%", action: "Send HIGH priority alert", enabled: false, triggered: 2 },
    { id: 5, name: "Daily Summary", condition: "Every day at 23:00 UTC", action: "Generate AI daily summary", enabled: true, triggered: 14 },
  ]);

  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader title="Notification Rules Engine" desc="Define custom rules — IF condition THEN alert. Control exactly what triggers notifications." />
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Settings className="w-3.5 h-3.5 mr-1" /> New Rule
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">New Notification Rule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Rule Name</Label>
                <Input placeholder="e.g. ETH Breakout Alert" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priority</Label>
                <Select>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select priority" /></SelectTrigger>
                  <SelectContent>
                    {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Condition (IF)</Label>
                <Input placeholder="e.g. ETH price moves > 3%" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Action (THEN)</Label>
                <Select>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select action" /></SelectTrigger>
                  <SelectContent>
                    {["Send in-app alert", "Send email", "Log to history", "Generate AI summary"].map(a => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="text-xs">Save Rule</Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule.id} className="p-4 rounded-lg border border-border bg-card hover:bg-muted/10 transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-semibold">{rule.name}</span>
                  <Badge variant="outline" className={`text-xs ${rule.enabled ? "text-green-400 border-green-500/30" : "text-muted-foreground"}`}>
                    {rule.enabled ? "Active" : "Disabled"}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">Triggered {rule.triggered}×</span>
                </div>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="text-muted-foreground">IF</span>
                  <span className="px-2 py-0.5 rounded bg-muted/40 border border-border font-mono">{rule.condition}</span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">THEN</span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary">{rule.action}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setRules(r => r.map(x => x.id === rule.id ? { ...x, enabled: !x.enabled } : x))}
                  className={`p-1.5 rounded hover:bg-muted transition-colors ${rule.enabled ? "text-green-400" : "text-muted-foreground"}`}
                >
                  {rule.enabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setRules(r => r.filter(x => x.id !== rule.id))} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PREFERENCES ───────────────────────────────────────────────────────────────

function PreferencesSection() {
  const [prefs, setPrefs] = useState({
    inApp: true, email: false, push: false, webhook: false,
    quietEnabled: false, quietStart: "23:00", quietEnd: "07:00",
    minPriority: "LOW",
  });

  const channels = [
    { key: "inApp", label: "In-App Notifications", desc: "Real-time alerts in the dashboard", icon: Bell },
    { key: "email", label: "Email Alerts", desc: "Critical alerts via email (requires setup)", icon: Mail },
    { key: "push", label: "Push Notifications", desc: "Mobile device push (requires setup)", icon: Smartphone },
    { key: "webhook", label: "Webhook", desc: "Send to external URL (Slack, Discord, etc.)", icon: Webhook },
  ] as const;

  return (
    <div className="space-y-5">
      <SectionHeader title="Notification Preferences" desc="Control delivery channels, quiet hours, and minimum alert priority levels." />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Delivery Channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {channels.map((c) => (
            <div key={c.key} className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/10">
              <div className="flex items-center gap-3">
                <c.icon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-xs text-muted-foreground">{c.desc}</div>
                </div>
              </div>
              <button
                onClick={() => setPrefs(p => ({ ...p, [c.key]: !p[c.key as keyof typeof p] }))}
                className={`w-10 h-5 rounded-full transition-colors relative ${(prefs as any)[c.key] ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${(prefs as any)[c.key] ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <VolumeX className="w-4 h-4 text-muted-foreground" />
              Quiet Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/10">
              <span className="text-sm">Enable Quiet Hours</span>
              <button
                onClick={() => setPrefs(p => ({ ...p, quietEnabled: !p.quietEnabled }))}
                className={`w-10 h-5 rounded-full transition-colors relative ${prefs.quietEnabled ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${prefs.quietEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            {prefs.quietEnabled && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">From</Label>
                  <Input type="time" value={prefs.quietStart} onChange={e => setPrefs(p => ({ ...p, quietStart: e.target.value }))} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Until</Label>
                  <Input type="time" value={prefs.quietEnd} onChange={e => setPrefs(p => ({ ...p, quietEnd: e.target.value }))} className="h-8 text-xs" />
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">CRITICAL alerts always bypass quiet hours.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              Minimum Priority
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Only receive alerts at or above this priority level.</p>
            <div className="space-y-2">
              {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as Priority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPrefs(prev => ({ ...prev, minPriority: p }))}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${prefs.minPriority === p ? "bg-primary/10 border-primary/40 text-foreground" : "border-border text-muted-foreground hover:bg-muted/20"}`}
                >
                  <span>{p}</span>
                  {prefs.minPriority === p && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── HISTORY ───────────────────────────────────────────────────────────────────

function HistorySection({ notifications }: any) {
  const [search, setSearch] = useState("");
  const all = notifications.filter((n: Notif) =>
    search === "" || n.title.toLowerCase().includes(search.toLowerCase()) || n.message.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <SectionHeader title="Notification History" desc="Complete archive of all alerts and events — searchable, filterable." />

      <Input
        placeholder="Search notifications..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 text-xs"
      />

      <div className="space-y-1">
        {all.map((n: Notif) => (
          <div key={n.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-muted/20 text-xs">
            <n.icon className={`w-4 h-4 shrink-0 ${n.iconColor}`} />
            <span className="flex-1 font-medium truncate">{n.title}</span>
            <PriorityBadge p={n.priority} />
            <Badge variant="outline" className="text-xs text-muted-foreground">{CATEGORY_LABELS[n.category]}</Badge>
            <span className="text-muted-foreground w-16 text-right shrink-0">{n.time}</span>
            <span className={`w-16 text-right shrink-0 ${n.status === "unread" ? "text-blue-400" : n.status === "dismissed" ? "text-muted-foreground/50" : "text-muted-foreground"}`}>{n.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────────

function NotifAnalytics({ notifications }: any) {
  const total = notifications.length;
  const unread = notifications.filter((n: Notif) => n.status === "unread").length;
  const critical = notifications.filter((n: Notif) => n.priority === "CRITICAL").length;
  const readRate = total > 0 ? Math.round(((total - unread) / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <SectionHeader title="Notification Analytics" desc="Measure alert accuracy, response times, ignored alerts, and AI learning performance." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total Alerts" value={total} sub="All time" icon={Bell} iconColor="text-blue-400" />
        <StatCard title="Read Rate" value={`${readRate}%`} sub="User engagement" icon={Eye} iconColor="text-green-400" />
        <StatCard title="Critical Alerts" value={critical} sub="Highest priority" icon={AlertTriangle} iconColor="text-red-400" />
        <StatCard title="AI Filtered" value="88%" sub="Noise reduced" icon={Brain} iconColor="text-cyan-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Alert Volume — Today (by hour)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ALERT_VOLUME}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="hour" stroke="#6b7280" fontSize={10} />
                  <YAxis stroke="#6b7280" fontSize={11} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}`, "Alerts"]} />
                  <Bar dataKey="alerts" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Alerts by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mt-2">
              {CATEGORY_BREAKDOWN.map((c) => (
                <div key={c.cat} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{c.cat}</span>
                    <span className="font-medium">{c.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(c.count / 42) * 100}%`, background: c.color }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">User Response Rate — Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={RESPONSE_TREND}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="day" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} domain={[50, 100]} tickFormatter={(v) => `${v}%`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, "Response Rate"]} />
                  <Line dataKey="rate" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">AI Filter Performance</CardTitle>
            <CardDescription>Raw events vs delivered notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 mt-2">
            {[
              { label: "Raw Events Generated", value: 1540, bar: 100, color: "#6b7280" },
              { label: "After AI Priority Filter", value: 284, bar: 18.4, color: "#3b82f6" },
              { label: "After Deduplication", value: 156, bar: 10.1, color: "#8b5cf6" },
              { label: "Delivered to User", value: 23, bar: 1.5, color: "#22c55e" },
            ].map((r) => (
              <div key={r.label} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-medium">{r.value.toLocaleString()}</span>
                </div>
                <div className="h-1.5 rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${r.bar}%`, background: r.color }} />
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-1">AI reduced 1,540 raw events to 23 meaningful notifications (98.5% noise filtered).</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

export default function Notifications() {
  const [activeTab, setActiveTab] = useState("feed");
  const [notifications, setNotifications] = useState<Notif[]>(BASE_NOTIFICATIONS);

  // Simulate live events arriving
  const tickRef = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      if (tickRef.current % 30 !== 0) return; // every ~60s
      const live: Notif = {
        id: Date.now(),
        title: "Market Update",
        message: "BTC 4H candle closed. AI re-analyzing market structure.",
        priority: "LOW",
        category: "ai",
        status: "unread",
        time: "just now",
        ts: Date.now(),
        icon: Brain,
        iconColor: "text-cyan-400",
      };
      setNotifications((prev) => [live, ...prev].slice(0, 50));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const handleRead = (id: number) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: "read" } : n));
  const handleDismiss = (id: number) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: "dismissed" } : n));
  const handleMarkAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, status: n.status === "unread" ? "read" : n.status })));

  const unread = notifications.filter(n => n.status === "unread").length;
  const critical = notifications.filter(n => n.priority === "CRITICAL" && n.status !== "dismissed").length;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-5 rounded-xl border border-border/50 bg-gradient-to-r from-card to-card/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-blue-400" />
            <h1 className="text-2xl font-bold tracking-tight">Notification Center</h1>
            <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30 ml-1">Intelligence</Badge>
            {unread > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-primary text-primary-foreground rounded-full">{unread}</span>
            )}
            {critical > 0 && (
              <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">
                <AlertTriangle className="w-3 h-3 mr-1" />{critical} Critical
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time intelligence communication — AI-filtered alerts from all 15 platform modules.
          </p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={handleMarkAllRead}>
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Clear All
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Unread Alerts" value={unread} sub="Needs attention" icon={Bell} iconColor="text-blue-400" />
        <StatCard title="Critical" value={critical} sub="Immediate action" icon={AlertTriangle} iconColor="text-red-400" />
        <StatCard title="Today's Events" value="1,540" sub="All platform events" icon={Activity} iconColor="text-purple-400" />
        <StatCard title="AI Important" value="23" sub="Delivered to you" icon={Brain} iconColor="text-cyan-400" />
      </div>

      {/* Tab Bar */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
              {tab.id === "feed" && unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 text-[9px] font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === "feed" && <LiveFeed notifications={notifications} onRead={handleRead} onDismiss={handleDismiss} onMarkAllRead={handleMarkAllRead} />}
      {activeTab === "priority" && <PriorityAlerts notifications={notifications} onRead={handleRead} onDismiss={handleDismiss} />}
      {activeTab === "market" && <CategoryFeed notifications={notifications} onRead={handleRead} onDismiss={handleDismiss} category="market" title="Market Alerts" desc="Price movements, volume spikes, volatility changes, breakouts, and regime shifts." />}
      {activeTab === "trade" && <CategoryFeed notifications={notifications} onRead={handleRead} onDismiss={handleDismiss} category="trade" title="Trade Alerts" desc="Signal generation, order execution, trade closure, stop-loss hits, and target reached." />}
      {activeTab === "ai" && <CategoryFeed notifications={notifications} onRead={handleRead} onDismiss={handleDismiss} category="ai" title="AI Alerts" desc="AI analysis completions, confidence changes, model updates, and recommendation shifts." />}
      {activeTab === "risk" && <CategoryFeed notifications={notifications} onRead={handleRead} onDismiss={handleDismiss} category="risk" title="Risk Alerts" desc="Exposure warnings, drawdown alerts, leverage notifications, and portfolio risk events." />}
      {activeTab === "security" && <CategoryFeed notifications={notifications} onRead={handleRead} onDismiss={handleDismiss} category="security" title="Security Alerts" desc="Login attempts, suspicious activity, permission changes, and API access events." />}
      {activeTab === "system" && <CategoryFeed notifications={notifications} onRead={handleRead} onDismiss={handleDismiss} category="system" title="System Alerts" desc="API outages, database issues, high latency, service failures, and infrastructure events." />}
      {activeTab === "summaries" && <AiSummaries />}
      {activeTab === "rules" && <RulesSection />}
      {activeTab === "preferences" && <PreferencesSection />}
      {activeTab === "history" && <HistorySection notifications={notifications} />}
      {activeTab === "analytics" && <NotifAnalytics notifications={notifications} />}
    </div>
  );
}
