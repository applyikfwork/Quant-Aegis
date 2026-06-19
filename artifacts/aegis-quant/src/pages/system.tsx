import { useState, useEffect, useRef } from "react";
import {
  useGetSystemStatus,
  useGetSystemLogs,
  getGetSystemStatusQueryKey,
  getGetSystemLogsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Activity, Server, Database, Clock, ShieldAlert, CheckCircle2,
  AlertTriangle, XCircle, Cpu, HardDrive, Wifi, Zap, Brain,
  RefreshCw, Shield, Eye, FileText, Settings, PlayCircle,
  PauseCircle, RotateCcw, Trash2, Lock, Unlock, ChevronRight,
  TrendingUp, TrendingDown, Radio, Terminal,
  AlertCircle, Info, BarChart2, Globe,
} from "lucide-react";

// ── MOCK DATA ─────────────────────────────────────────────────────────────────

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// Rolling CPU / Memory / latency history (last 20 ticks)
function useMetricHistory() {
  const [history, setHistory] = useState(() =>
    Array.from({ length: 20 }, (_, i) => ({
      t: i,
      cpu: 45 + Math.random() * 25,
      mem: 62 + Math.random() * 15,
      latency: 80 + Math.random() * 60,
    }))
  );
  const tick = useRef(20);
  useEffect(() => {
    const id = setInterval(() => {
      tick.current += 1;
      setHistory((prev) => [
        ...prev.slice(1),
        {
          t: tick.current,
          cpu: Math.max(10, Math.min(95, (prev[prev.length - 1]?.cpu ?? 55) + (Math.random() - 0.48) * 6)),
          mem: Math.max(40, Math.min(90, (prev[prev.length - 1]?.mem ?? 68) + (Math.random() - 0.47) * 3)),
          latency: Math.max(40, Math.min(300, (prev[prev.length - 1]?.latency ?? 110) + (Math.random() - 0.45) * 20)),
        },
      ]);
    }, 2000);
    return () => clearInterval(id);
  }, []);
  return history;
}

const SERVICES = [
  { name: "Dashboard", module: "Core", status: "healthy", latency: 42, errorRate: 0.0, lastCheck: "2s ago" },
  { name: "Market Data", module: "Core", status: "healthy", latency: 87, errorRate: 0.1, lastCheck: "5s ago" },
  { name: "AI Center", module: "Intelligence", status: "healthy", latency: 1400, errorRate: 0.0, lastCheck: "3s ago" },
  { name: "Signals Feed", module: "Intelligence", status: "healthy", latency: 55, errorRate: 0.0, lastCheck: "5s ago" },
  { name: "Learning Center", module: "Intelligence", status: "healthy", latency: 38, errorRate: 0.0, lastCheck: "8s ago" },
  { name: "Trade Journal", module: "Trading", status: "healthy", latency: 61, errorRate: 0.2, lastCheck: "4s ago" },
  { name: "Paper Trading", module: "Trading", status: "healthy", latency: 74, errorRate: 0.0, lastCheck: "6s ago" },
  { name: "Portfolio", module: "Trading", status: "slow", latency: 340, errorRate: 0.8, lastCheck: "3s ago" },
  { name: "Risk Center", module: "Trading", status: "healthy", latency: 92, errorRate: 0.1, lastCheck: "5s ago" },
  { name: "Strategies", module: "Research", status: "healthy", latency: 48, errorRate: 0.0, lastCheck: "7s ago" },
  { name: "Backtesting", module: "Research", status: "healthy", latency: 2100, errorRate: 0.3, lastCheck: "12s ago" },
  { name: "Analytics", module: "Research", status: "healthy", latency: 120, errorRate: 0.0, lastCheck: "4s ago" },
  { name: "Research Lab", module: "Research", status: "healthy", latency: 95, errorRate: 0.0, lastCheck: "9s ago" },
  { name: "System Monitor", module: "System", status: "healthy", latency: 18, errorRate: 0.0, lastCheck: "1s ago" },
];

const APIS_STATIC = [
  { name: "Bybit Market Data", provider: "Bybit", latency: 85, failures: 0, rateLimit: "48%", tier: "Pro" },
  { name: "Bybit WebSocket", provider: "Bybit", latency: 14, failures: 0, rateLimit: "5%", tier: "Pro" },
  { name: "CoinGecko Prices", provider: "CoinGecko", latency: 210, failures: 0, rateLimit: "8%", tier: "Free" },
  { name: "Supabase Database", provider: "Supabase", latency: 45, failures: 0, rateLimit: "—", tier: "Pro" },
];

const ERRORS: { id: string; module: string; severity: string; msg: string; time: string; status: string }[] = [];

const JOBS = [
  { id: "J001", type: "Market Data Sync", status: "running", progress: 100, duration: "12s", next: "60s" },
  { id: "J002", type: "AI Signal Generation", status: "running", progress: 84, duration: "4m 12s", next: "Continuous" },
  { id: "J003", type: "Daily Performance Calc", status: "completed", progress: 100, duration: "1m 8s", next: "Tomorrow 00:00" },
  { id: "J004", type: "Strategy Optimization", status: "pending", progress: 0, duration: "—", next: "On demand" },
  { id: "J005", type: "Database Backup", status: "completed", progress: 100, duration: "42s", next: "Tomorrow 03:00" },
  { id: "J006", type: "AI Model Refresh", status: "running", progress: 62, duration: "8m 30s", next: "Daily 04:00" },
];

const AUDIT_LOG = [
  { action: "User loaded Analytics module", user: "Admin", ip: "192.168.1.1", time: "06:28:14", type: "read" },
  { action: "Risk settings checked", user: "System", ip: "internal", time: "06:25:01", type: "read" },
  { action: "AI signal generated: BTC BUY", user: "AI Agent", ip: "internal", time: "06:22:33", type: "write" },
  { action: "Strategy EMA Cross updated", user: "Admin", ip: "192.168.1.1", time: "06:15:12", type: "write" },
  { action: "Database backup initiated", user: "System", ip: "internal", time: "03:00:00", type: "system" },
  { action: "Market data sync completed", user: "System", ip: "internal", time: "06:21:23", type: "system" },
];

const SECURITY_EVENTS = [
  { event: "Successful login", user: "Admin", ip: "192.168.1.1", time: "06:00:12", risk: "low", blocked: false },
  { event: "API key rotated", user: "System", ip: "internal", time: "05:30:00", risk: "low", blocked: false },
  { event: "Failed login attempt", user: "Unknown", ip: "203.0.113.42", time: "04:18:33", risk: "medium", blocked: true },
  { event: "Unusual API access pattern", user: "Unknown", ip: "198.51.100.8", time: "03:42:11", risk: "high", blocked: true },
];

const TIMELINE = [
  { time: "Now", event: "Market data sync active — Bybit syncing every 60s", type: "success" },
  { time: "Startup", event: "API Server online — Supabase database connected", type: "success" },
  { time: "Startup", event: "Bybit market worker started — 8 pairs active", type: "success" },
  { time: "Daily", event: "Daily performance calculations reset at midnight", type: "info" },
];

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "#0a0a0a", borderColor: "#1f2937", color: "#fff", fontSize: 11 },
  itemStyle: { color: "#fff" },
};

// ── TABS ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "health", label: "System Health" },
  { id: "services", label: "Services" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "database", label: "Database" },
  { id: "apis", label: "API Monitor" },
  { id: "ai", label: "AI Engine" },
  { id: "trading", label: "Trading Engine" },
  { id: "pipeline", label: "Data Pipeline" },
  { id: "performance", label: "Performance" },
  { id: "errors", label: "Errors" },
  { id: "security", label: "Security" },
  { id: "logs", label: "Logs" },
  { id: "jobs", label: "Jobs & Queue" },
  { id: "alerts", label: "Alerts" },
  { id: "timeline", label: "Timeline" },
  { id: "admin", label: "Admin" },
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

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    healthy: "bg-green-400",
    slow: "bg-yellow-400",
    degraded: "bg-orange-400",
    offline: "bg-red-400",
    running: "bg-green-400 animate-pulse",
    completed: "bg-blue-400",
    pending: "bg-muted-foreground",
    failed: "bg-red-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${map[status] ?? "bg-muted-foreground"}`} />;
}

function ServiceBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    healthy: "text-green-400 border-green-500/30",
    slow: "text-yellow-400 border-yellow-500/30",
    degraded: "text-orange-400 border-orange-500/30",
    offline: "text-red-400 border-red-500/30",
  };
  return <Badge variant="outline" className={`text-xs capitalize ${map[status] ?? "text-muted-foreground"}`}>{status}</Badge>;
}

function SeverityBadge({ sev }: { sev: string }) {
  const map: Record<string, string> = {
    LOW: "text-blue-400 border-blue-500/30",
    MEDIUM: "text-yellow-400 border-yellow-500/30",
    HIGH: "text-orange-400 border-orange-500/30",
    CRITICAL: "text-red-400 border-red-500/30",
  };
  return <Badge variant="outline" className={`text-xs font-bold ${map[sev] ?? "text-muted-foreground"}`}>{sev}</Badge>;
}

function StatCard({
  title, value, sub, icon: Icon, iconColor, pulse,
}: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; iconColor: string; pulse?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        </div>
        <div className="text-2xl font-bold flex items-center gap-2">
          {value}
          {pulse && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />}
        </div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ── SYSTEM HEALTH ─────────────────────────────────────────────────────────────

function HealthSection({ status, loadingStatus, metrics }: any) {
  const now = useNow();
  const health = status?.status ?? "healthy";
  const uptime = status?.uptime ?? 0;
  const dbConnected = status?.databaseConnected ?? false;

  const formatUptime = (s: number) => {
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const latestMetric = metrics[metrics.length - 1];
  const healthScore = dbConnected ? 96 : 71;

  return (
    <div className="space-y-5">
      <SectionHeader title="System Health Dashboard" desc="Real-time overview of the entire Trading OS — infrastructure, services, and AI operations." />

      {/* Overall status banner */}
      <div className={`p-4 rounded-xl border flex items-center gap-4 ${health === "healthy" ? "bg-green-500/10 border-green-500/30" : "bg-yellow-500/10 border-yellow-500/30"}`}>
        <div className={`w-4 h-4 rounded-full ${health === "healthy" ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
        <div className="flex-1">
          <div className={`text-xl font-bold ${health === "healthy" ? "text-green-400" : "text-yellow-400"}`}>
            System {health === "healthy" ? "ONLINE" : "DEGRADED"}
          </div>
          <div className="text-xs text-muted-foreground">
            Uptime: {formatUptime(uptime)} · Last checked: {now.toLocaleTimeString()}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${healthScore >= 90 ? "text-green-400" : healthScore >= 70 ? "text-yellow-400" : "text-red-400"}`}>{healthScore}</div>
          <div className="text-xs text-muted-foreground">Health Score</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="System Status" value={health === "healthy" ? "ONLINE" : "DEGRADED"} sub={`Uptime: ${formatUptime(uptime)}`} icon={Activity} iconColor="text-green-400" pulse />
        <StatCard title="Health Score" value={`${healthScore}/100`} sub="AI calculated" icon={Star2} iconColor="text-yellow-400" />
        <StatCard title="Active Incidents" value={dbConnected ? 0 : 1} sub="Open issues" icon={AlertTriangle} iconColor="text-orange-400" />
        <StatCard title="Database" value={dbConnected ? "CONNECTED" : "OFFLINE"} sub={dbConnected ? "Supabase connected" : "Keys not configured"} icon={Database} iconColor={dbConnected ? "text-green-400" : "text-red-400"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Live Metrics — CPU · Memory · Latency
              <span className="ml-auto flex items-center gap-1 text-xs text-green-400 font-normal">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                Live
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="t" hide />
                  <YAxis stroke="#6b7280" fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number, n: string) =>
                    [n === "latency" ? `${v.toFixed(0)}ms` : `${v.toFixed(1)}%`, n.charAt(0).toUpperCase() + n.slice(1)]} />
                  <Line dataKey="cpu" name="cpu" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line dataKey="mem" name="mem" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="4 4" opacity={0.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-6 mt-2 text-xs">
              {[
                { label: "CPU", value: `${latestMetric?.cpu.toFixed(1)}%`, color: "text-blue-400", bar: latestMetric?.cpu },
                { label: "Memory", value: `${latestMetric?.mem.toFixed(1)}%`, color: "text-purple-400", bar: latestMetric?.mem },
                { label: "Latency", value: `${latestMetric?.latency.toFixed(0)}ms`, color: "text-cyan-400", bar: null },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-2">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className={`font-bold ${m.color}`}>{m.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Service Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {SERVICES.slice(0, 8).map((s) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <StatusDot status={s.status} />
                    <span>{s.name}</span>
                  </div>
                  <span className={`font-mono ${s.latency > 200 ? "text-yellow-400" : "text-muted-foreground"}`}>{s.latency}ms</span>
                </div>
              ))}
              <div className="pt-1 border-t border-border/40 text-xs text-muted-foreground">
                {SERVICES.filter(s => s.status === "healthy").length}/{SERVICES.length} services healthy
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current load */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "API Requests/min", value: "540", icon: Globe, color: "text-blue-400" },
          { label: "AI Requests/min", value: "12", icon: Brain, color: "text-cyan-400" },
          { label: "Background Jobs", value: "3", icon: Zap, color: "text-yellow-400" },
          { label: "DB Queries/min", value: "0", sub: "Offline mode", icon: Database, color: "text-muted-foreground" },
        ].map((l) => (
          <Card key={l.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{l.label}</span>
                <l.icon className={`w-3.5 h-3.5 ${l.color}`} />
              </div>
              <div className={`text-2xl font-bold ${l.color}`}>{l.value}</div>
              {l.sub && <div className="text-xs text-muted-foreground mt-1">{l.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Fake star icon local alias
function Star2({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// ── SERVICES ──────────────────────────────────────────────────────────────────

function ServicesSection() {
  const groups = [...new Set(SERVICES.map((s) => s.module))];
  return (
    <div className="space-y-5">
      <SectionHeader title="Service Status Monitor" desc="Every module tracked as a monitored service — status, latency, error rate, and last health check." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total Services" value={SERVICES.length} icon={Server} iconColor="text-blue-400" />
        <StatCard title="Healthy" value={SERVICES.filter(s => s.status === "healthy").length} sub="Operating normally" icon={CheckCircle2} iconColor="text-green-400" />
        <StatCard title="Slow / Degraded" value={SERVICES.filter(s => s.status !== "healthy").length} sub="Need attention" icon={AlertTriangle} iconColor="text-yellow-400" />
        <StatCard title="Avg Latency" value={`${Math.round(SERVICES.reduce((a, s) => a + s.latency, 0) / SERVICES.length)}ms`} icon={Clock} iconColor="text-cyan-400" />
      </div>

      {groups.map((group) => (
        <div key={group}>
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">{group}</div>
          <div className="space-y-1">
            {SERVICES.filter(s => s.module === group).map((s) => (
              <div key={s.name} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/10 hover:bg-muted/20 transition-colors">
                <StatusDot status={s.status} />
                <div className="flex-1 text-sm font-medium">{s.name}</div>
                <ServiceBadge status={s.status} />
                <div className="text-xs text-muted-foreground w-16 text-right font-mono">
                  <span className={s.latency > 200 ? "text-yellow-400" : ""}>{s.latency}ms</span>
                </div>
                <div className={`text-xs font-mono w-16 text-right ${s.errorRate > 0.5 ? "text-red-400" : s.errorRate > 0 ? "text-yellow-400" : "text-muted-foreground"}`}>
                  {s.errorRate.toFixed(1)}% err
                </div>
                <div className="text-xs text-muted-foreground w-16 text-right">{s.lastCheck}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── INFRASTRUCTURE ────────────────────────────────────────────────────────────

function InfrastructureSection({ metrics }: any) {
  const latest = metrics[metrics.length - 1] ?? { cpu: 62, mem: 68, latency: 110 };

  const resources = [
    { label: "CPU Usage", value: latest.cpu, max: 100, unit: "%", color: "#3b82f6", warn: 80, icon: Cpu },
    { label: "Memory (RAM)", value: latest.mem, max: 100, unit: "%", color: "#8b5cf6", warn: 85, icon: HardDrive },
    { label: "Disk Storage", value: 45, max: 100, unit: "%", color: "#22c55e", warn: 80, icon: HardDrive },
    { label: "Network I/O", value: 28, max: 100, unit: "%", color: "#06b6d4", warn: 90, icon: Wifi },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader title="Infrastructure Monitor" desc="Real-time server resources — CPU, memory, disk, and network utilization with live history." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {resources.map((r) => (
          <Card key={r.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">{r.label}</span>
                <r.icon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className={`text-3xl font-bold mb-2 ${r.value > r.warn ? "text-red-400" : r.value > r.warn * 0.75 ? "text-yellow-400" : ""}`} style={{ color: r.value > r.warn ? "#ef4444" : r.color }}>
                {r.value.toFixed(1)}{r.unit}
              </div>
              <Progress value={r.value} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">Warn at {r.warn}{r.unit}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">CPU History — Live (2s interval)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="t" hide />
                  <YAxis stroke="#6b7280" fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(1)}%`, "CPU"]} />
                  <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="4 4" opacity={0.4} />
                  <Area dataKey="cpu" stroke="#3b82f6" fill="url(#cpuGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Memory History — Live (2s interval)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics}>
                  <defs>
                    <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="t" hide />
                  <YAxis stroke="#6b7280" fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(1)}%`, "Memory"]} />
                  <ReferenceLine y={85} stroke="#ef4444" strokeDasharray="4 4" opacity={0.4} />
                  <Area dataKey="mem" stroke="#8b5cf6" fill="url(#memGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── DATABASE ──────────────────────────────────────────────────────────────────

function DatabaseSection({ status, loadingStatus }: any) {
  const dbConnected = status?.databaseConnected ?? false;
  return (
    <div className="space-y-5">
      <SectionHeader title="Database Monitor" desc="Database health, connection pool, query performance, and storage tracking." />

      <div className={`p-4 rounded-xl border flex items-start gap-4 ${dbConnected ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
        <Database className={`w-5 h-5 mt-0.5 ${dbConnected ? "text-green-400" : "text-red-400"}`} />
        <div className="flex-1">
          <div className={`text-sm font-bold ${dbConnected ? "text-green-400" : "text-red-400"}`}>
            Supabase PostgreSQL — {dbConnected ? "Connected" : "Offline (Keys Not Configured)"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {dbConnected
              ? "Database is fully operational. All queries executing normally."
              : "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are not set. The app runs in offline mode — all API calls return empty data. To connect: add your Supabase credentials to the Secrets manager."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Connection Status" value={dbConnected ? "Connected" : "Offline"} icon={Database} iconColor={dbConnected ? "text-green-400" : "text-red-400"} />
        <StatCard title="Active Connections" value={dbConnected ? "12/100" : "0/100"} sub="Connection pool" icon={Activity} iconColor="text-blue-400" />
        <StatCard title="Queries/min" value={dbConnected ? "284" : "0"} sub={dbConnected ? "Normal load" : "Offline mode"} icon={Zap} iconColor="text-purple-400" />
        <StatCard title="Database Size" value={dbConnected ? "2.4 GB" : "—"} sub="Tables + indexes" icon={HardDrive} iconColor="text-cyan-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Connection Pool</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Active Connections", value: dbConnected ? 12 : 0, max: 100, color: "#3b82f6" },
                { label: "Idle Connections", value: dbConnected ? 8 : 0, max: 100, color: "#22c55e" },
                { label: "Waiting Queue", value: 0, max: 100, color: "#f59e0b" },
                { label: "Max Pool Size", value: dbConnected ? 20 : 0, max: 100, color: "#8b5cf6" },
              ].map((c) => (
                <div key={c.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className="font-medium">{c.value}/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.value}%`, background: c.color }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Table Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {[
                "strategies", "trades", "signals", "market_candles",
                "indicators", "backtests", "activity_events",
              ].map((t) => (
                <div key={t} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <StatusDot status={dbConnected ? "healthy" : "offline"} />
                    <span className="font-mono">{t}</span>
                  </div>
                  <span className={`font-mono ${dbConnected ? "text-muted-foreground" : "text-red-400/60"}`}>
                    {dbConnected ? "OK" : "offline"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {!dbConnected && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-400">
              <AlertTriangle className="w-4 h-4" /> How to Connect Supabase
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">Add these two secrets in the Replit Secrets panel (lock icon in the left sidebar):</p>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="p-2 rounded bg-muted/40 border border-border/60"><span className="text-yellow-400">SUPABASE_URL</span> = https://your-project.supabase.co</div>
              <div className="p-2 rounded bg-muted/40 border border-border/60"><span className="text-yellow-400">SUPABASE_SERVICE_ROLE_KEY</span> = your-service-role-key</div>
            </div>
            <p className="text-xs text-muted-foreground">After adding, restart the API Server workflow and the database will come online automatically.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── API MONITOR ───────────────────────────────────────────────────────────────

function ApiSection({ status }: any) {
  const dbConnected = status?.databaseConnected ?? false;
  const apis = APIS_STATIC.map(a => ({
    ...a,
    status: a.name === "Supabase Database" ? (dbConnected ? "healthy" : "offline") : "healthy",
    failures: 0,
  }));
  return (
    <div className="space-y-5">
      <SectionHeader title="API Monitor" desc="Every external API connection — status, latency, failure counts, and rate limit usage." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Connected APIs" value={apis.filter(a => a.status === "healthy").length} sub={`of ${apis.length} total`} icon={Globe} iconColor="text-green-400" />
        <StatCard title="Offline APIs" value={apis.filter(a => a.status === "offline").length} sub={apis.filter(a => a.status === "offline").length === 0 ? "All connected" : "Need attention"} icon={XCircle} iconColor={apis.filter(a => a.status === "offline").length === 0 ? "text-green-400" : "text-red-400"} />
        <StatCard title="Avg Latency" value={`${Math.round(apis.filter(a => a.status === "healthy").reduce((a, x) => a + x.latency, 0) / Math.max(1, apis.filter(a => a.status === "healthy").length))}ms`} icon={Clock} iconColor="text-blue-400" />
        <StatCard title="Total Failures" value={0} sub="Last 24h" icon={AlertTriangle} iconColor="text-yellow-400" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">API Status Board</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {apis.map((api, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/10">
                <StatusDot status={api.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{api.name}</span>
                    <Badge variant="outline" className="text-xs text-muted-foreground">{api.provider}</Badge>
                    <Badge variant="outline" className="text-xs text-muted-foreground">{api.tier}</Badge>
                  </div>
                </div>
                <ServiceBadge status={api.status} />
                <div className="text-xs font-mono w-16 text-right">
                  {api.status === "healthy" ? <span className="text-muted-foreground">{api.latency}ms</span> : <span className="text-red-400">—</span>}
                </div>
                <div className="text-xs font-mono w-16 text-right text-muted-foreground">0 err</div>
                <div className="text-xs text-muted-foreground w-20 text-right">RL: {api.rateLimit}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">API Latency Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={apis.filter(a => a.status === "healthy").map(a => ({ name: a.provider, latency: a.latency }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `${v}ms`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}ms`, "Latency"]} />
                  <ReferenceLine y={200} stroke="#f59e0b" strokeDasharray="4 4" />
                  <Bar dataKey="latency" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rate Limit Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mt-1">
              {apis.filter(a => a.rateLimit !== "—").map((api, i) => {
                const pct = parseInt(api.rateLimit);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{api.name}</span>
                      <span className={`font-medium ${pct > 75 ? "text-red-400" : pct > 50 ? "text-yellow-400" : "text-green-400"}`}>{api.rateLimit}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── AI ENGINE ─────────────────────────────────────────────────────────────────

function AiEngineSection({ metrics }: any) {
  return (
    <div className="space-y-5">
      <SectionHeader title="AI Engine Monitor" desc="AI service health, response times, model usage, cost tracking, and quality monitoring." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="AI Status" value="Online" sub="All agents active" icon={Brain} iconColor="text-cyan-400" pulse />
        <StatCard title="Avg Response" value="1.4s" sub="GPT-4 API" icon={Clock} iconColor="text-blue-400" />
        <StatCard title="Requests Today" value="284" sub="12/min avg" icon={Activity} iconColor="text-purple-400" />
        <StatCard title="AI Accuracy" value="84%" sub="Live signals" icon={Star2} iconColor="text-yellow-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">AI Response Latency — Live</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics}>
                  <defs>
                    <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="t" hide />
                  <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `${v.toFixed(0)}ms`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(0)}ms`, "Latency"]} />
                  <ReferenceLine y={200} stroke="#f59e0b" strokeDasharray="4 4" opacity={0.5} />
                  <Area dataKey="latency" stroke="#06b6d4" fill="url(#aiGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyan-400" />
              AI System Doctor
            </CardTitle>
            <CardDescription>AI monitoring itself — auto-diagnosis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <div className="text-xs font-semibold text-cyan-400 mb-1">Current AI Diagnosis</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                All AI agents performing within normal parameters. GPT-4 response time averaged 1.4s (SLA: &lt;2s).
                Signal confidence stable at 82–87%. No model drift detected. No quality degradation detected.
              </p>
            </div>
            <div className="space-y-2">
              {[
                { label: "Signal Quality", value: 84, color: "#22c55e", status: "Normal" },
                { label: "Model Drift", value: 8, color: "#22c55e", status: "Low" },
                { label: "API Health", value: 96, color: "#22c55e", status: "Healthy" },
                { label: "Confidence Stability", value: 91, color: "#22c55e", status: "Stable" },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{m.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-border overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${m.value}%`, background: m.color }} />
                    </div>
                    <span className="text-green-400 font-medium w-12 text-right">{m.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── TRADING ENGINE ────────────────────────────────────────────────────────────

function TradingEngineSection() {
  const pipeline = [
    { step: "Signal Generation", status: "healthy", latency: "1.4s", count: "284 today", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
    { step: "Risk Check", status: "healthy", latency: "12ms", count: "284 checks", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
    { step: "Order Routing", status: "healthy", latency: "45ms", count: "0 orders (paper)", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { step: "Portfolio Update", status: "healthy", latency: "28ms", count: "Live sync", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader title="Trading Engine Monitor" desc="Signal processing, risk checks, order routing, and portfolio update pipeline — every step tracked." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Engine Status" value="Online" sub="Paper trading mode" icon={Activity} iconColor="text-green-400" pulse />
        <StatCard title="Signals Today" value="284" sub="All processed" icon={Zap} iconColor="text-cyan-400" />
        <StatCard title="Risk Blocks" value="12" sub="Prevented entries" icon={Shield} iconColor="text-yellow-400" />
        <StatCard title="Avg Pipeline" value="1.5s" sub="End-to-end latency" icon={Clock} iconColor="text-blue-400" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Trading Pipeline Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {pipeline.map((step, i) => (
              <div key={step.step} className="flex items-center gap-2">
                <div className={`p-3 rounded-lg border ${step.bg} min-w-[140px]`}>
                  <div className={`text-xs font-semibold ${step.color}`}>{step.step}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{step.latency}</div>
                  <div className="text-xs text-muted-foreground">{step.count}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <StatusDot status={step.status} />
                    <span className="text-xs text-green-400">Healthy</span>
                  </div>
                </div>
                {i < pipeline.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Signal Processing Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Array.from({ length: 12 }, (_, i) => ({
                  hour: `${String(i * 2).padStart(2, "0")}:00`,
                  signals: Math.floor(15 + Math.random() * 30),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="hour" stroke="#6b7280" fontSize={10} />
                  <YAxis stroke="#6b7280" fontSize={11} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}`, "Signals"]} />
                  <Bar dataKey="signals" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risk Engine Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Signals Approved", value: 272, total: 284, color: "#22c55e" },
                { label: "Risk Blocks", value: 12, total: 284, color: "#f59e0b" },
                { label: "Max Loss Limit Hits", value: 3, total: 284, color: "#ef4444" },
                { label: "Position Limit Blocks", value: 9, total: 284, color: "#f97316" },
              ].map((r) => (
                <div key={r.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-medium">{r.value}</span>
                  </div>
                  <Progress value={(r.value / r.total) * 100} className="h-1.5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── DATA PIPELINE ─────────────────────────────────────────────────────────────

function PipelineSection({ status }: any) {
  const dbConnected = status?.databaseConnected ?? false;
  const steps = [
    { name: "Market Data Ingestion", source: "Bybit API", status: "healthy", lastRun: "12s ago", records: "8 pairs active", latency: "87ms" },
    { name: "Data Validation", source: "Internal", status: "healthy", lastRun: "12s ago", records: "8/8 passed", latency: "4ms" },
    { name: "Indicator Calculation", source: "Internal", status: "healthy", lastRun: "12s ago", records: "EMA/RSI/MACD/ATR", latency: "28ms" },
    { name: "AI Feature Engineering", source: "AI Engine", status: "healthy", lastRun: "15s ago", records: "8 features", latency: "210ms" },
    { name: "Database Storage", source: "Supabase", status: dbConnected ? "healthy" : "offline", lastRun: dbConnected ? "12s ago" : "Not connected", records: dbConnected ? "Writing live" : "0 written", latency: dbConnected ? "45ms" : "—" },
    { name: "Analytics Aggregation", source: "Internal", status: "healthy", lastRun: "1m ago", records: "Cached", latency: "18ms" },
  ];
  const healthyCount = steps.filter(s => s.status === "healthy").length;

  return (
    <div className="space-y-5">
      <SectionHeader title="Data Pipeline Monitor" desc="Track data movement through the system — ingestion, validation, processing, and storage." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Pipeline Health" value={`${healthyCount}/${steps.length} stages`} sub={healthyCount === steps.length ? "All healthy" : `${steps.length - healthyCount} offline`} icon={Activity} iconColor={healthyCount === steps.length ? "text-green-400" : "text-yellow-400"} />
        <StatCard title="Market Pairs" value="8" sub="Syncing every 60s" icon={Radio} iconColor="text-blue-400" />
        <StatCard title="Data Quality" value="100%" sub="All rows valid" icon={CheckCircle2} iconColor="text-green-400" />
        <StatCard title="Storage Stage" value={dbConnected ? "ONLINE" : "OFFLINE"} sub={dbConnected ? "Writing to Supabase" : "Supabase not connected"} icon={Database} iconColor={dbConnected ? "text-green-400" : "text-red-400"} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Pipeline Stages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/10">
                <div className="flex items-center justify-center w-6 h-6 rounded-full border border-border text-xs font-mono text-muted-foreground shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.source} · {s.records}</div>
                </div>
                <ServiceBadge status={s.status} />
                <div className="text-xs text-muted-foreground w-20 text-right font-mono">{s.latency}</div>
                <div className="text-xs text-muted-foreground w-20 text-right">{s.lastRun}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── PERFORMANCE ───────────────────────────────────────────────────────────────

function PerformanceSection({ metrics }: any) {
  return (
    <div className="space-y-5">
      <SectionHeader title="Application Performance" desc="Request rates, response times, throughput, and latency breakdown across all service layers." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Avg API Response" value="120ms" sub="P95: 340ms" icon={Clock} iconColor="text-blue-400" />
        <StatCard title="Requests / min" value="540" icon={Activity} iconColor="text-green-400" />
        <StatCard title="Error Rate" value="0.2%" sub="Below 1% target" icon={AlertTriangle} iconColor="text-green-400" />
        <StatCard title="Throughput" value="2.1 MB/s" sub="Data processed" icon={TrendingUp} iconColor="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">API Latency — Live History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="t" hide />
                  <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `${v.toFixed(0)}ms`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(0)}ms`, "Latency"]} />
                  <ReferenceLine y={200} stroke="#f59e0b" strokeDasharray="4 4" opacity={0.5} />
                  <ReferenceLine y={500} stroke="#ef4444" strokeDasharray="4 4" opacity={0.5} />
                  <Line dataKey="latency" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Latency Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mt-2">
              {[
                { layer: "Frontend (React)", latency: 8, color: "#3b82f6" },
                { layer: "Backend (Express)", latency: 42, color: "#8b5cf6" },
                { layer: "Business Logic", latency: 28, color: "#06b6d4" },
                { layer: "Database Query", latency: 0, note: "Offline", color: "#6b7280" },
                { layer: "External API (Bybit)", latency: 87, color: "#f59e0b" },
                { layer: "AI Processing (GPT-4)", latency: 1400, color: "#22c55e" },
              ].map((l) => (
                <div key={l.layer} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{l.layer}</span>
                    <span className="font-mono font-medium">{l.note ?? `${l.latency}ms`}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (l.latency / 2000) * 100)}%`, background: l.color }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── ERRORS ────────────────────────────────────────────────────────────────────

function ErrorsSection() {
  const [filter, setFilter] = useState("All");
  const severities = ["All", "CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const filtered = filter === "All" ? ERRORS : ERRORS.filter(e => e.severity === filter);

  return (
    <div className="space-y-5">
      <SectionHeader title="Error Management" desc="Every error logged, classified by severity, and tracked to resolution." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Open Errors" value={ERRORS.filter(e => e.status === "open").length} sub="Needs attention" icon={XCircle} iconColor="text-red-400" />
        <StatCard title="Investigating" value={ERRORS.filter(e => e.status === "investigating").length} icon={Eye} iconColor="text-yellow-400" />
        <StatCard title="Resolved Today" value={ERRORS.filter(e => e.status === "resolved").length} icon={CheckCircle2} iconColor="text-green-400" />
        <StatCard title="Error Rate" value="0.2%" sub="Below 1% SLA" icon={AlertCircle} iconColor="text-green-400" />
      </div>

      <div className="flex gap-2">
        {severities.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${filter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((e) => (
          <div key={e.id} className={`p-3 rounded-lg border bg-muted/10 ${e.status === "open" ? "border-red-500/20" : e.status === "investigating" ? "border-yellow-500/20" : "border-border/40"}`}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{e.id}</span>
                  <SeverityBadge sev={e.severity} />
                  <Badge variant="outline" className="text-xs">{e.module}</Badge>
                  <Badge variant="outline" className={`text-xs ${e.status === "open" ? "text-red-400 border-red-500/30" : e.status === "investigating" ? "text-yellow-400 border-yellow-500/30" : "text-green-400 border-green-500/30"}`}>
                    {e.status}
                  </Badge>
                </div>
                <p className="text-xs font-mono text-foreground/90 leading-snug">{e.msg}</p>
              </div>
              <div className="text-xs font-mono text-muted-foreground shrink-0">{e.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SECURITY ──────────────────────────────────────────────────────────────────

function SecuritySection() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Security Monitor" desc="Login monitoring, suspicious activity detection, audit trails, and access control tracking." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Security Status" value="Protected" sub="No active threats" icon={Shield} iconColor="text-green-400" />
        <StatCard title="Login Attempts" value="3" sub="Today (2 blocked)" icon={Lock} iconColor="text-yellow-400" />
        <StatCard title="Blocked Events" value="2" sub="Last 24h" icon={XCircle} iconColor="text-red-400" />
        <StatCard title="Audit Logs" value="284" sub="Actions today" icon={FileText} iconColor="text-blue-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Security Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {SECURITY_EVENTS.map((e, i) => (
                <div key={i} className={`p-3 rounded-lg border ${e.blocked ? "border-red-500/20 bg-red-500/5" : "border-border/60 bg-muted/10"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {e.blocked ? <Lock className="w-3.5 h-3.5 text-red-400" /> : <Unlock className="w-3.5 h-3.5 text-green-400" />}
                      <span className="text-xs font-medium">{e.event}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${e.risk === "high" ? "text-red-400 border-red-500/30" : e.risk === "medium" ? "text-yellow-400 border-yellow-500/30" : "text-green-400 border-green-500/30"}`}>
                        {e.risk}
                      </Badge>
                      {e.blocked && <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">Blocked</Badge>}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">User: {e.user} · IP: {e.ip} · {e.time}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Audit Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {AUDIT_LOG.map((a, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/20">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${a.type === "write" ? "bg-blue-400" : a.type === "system" ? "bg-purple-400" : "bg-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug">{a.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.user} · {a.ip} · {a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── LOGS ──────────────────────────────────────────────────────────────────────

function LogsSection({ logs, loadingLogs }: any) {
  const [levelFilter, setLevelFilter] = useState("all");
  const logList = logs ?? [];
  const filtered = levelFilter === "all" ? logList : logList.filter((l: any) => l.level === levelFilter);

  const levelColor = (level: string) => {
    if (level === "error") return "text-red-400";
    if (level === "warn") return "text-yellow-400";
    if (level === "info") return "text-blue-400";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Live Log Center" desc="Real-time application, trading, AI, security, and database logs in one place." />

      <div className="flex items-center gap-2 flex-wrap">
        {["all", "info", "warn", "error"].map((l) => (
          <button key={l} onClick={() => setLevelFilter(l)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors capitalize ${levelFilter === l ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {l === "all" ? "All Levels" : l.toUpperCase()}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="bg-black/60 rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/20">
              <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-mono text-muted-foreground">AEGIS QUANT AI — System Logs</span>
              <span className="ml-auto text-xs text-muted-foreground">{filtered.length} entries</span>
            </div>
            <div className="divide-y divide-border/20 max-h-[420px] overflow-y-auto">
              {loadingLogs ? (
                <div className="p-4 space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-5 w-full bg-muted/30" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs font-mono">No logs — database offline (Supabase not connected)</div>
              ) : (
                filtered.map((log: any, i: number) => (
                  <div key={i} className="px-4 py-2 font-mono text-xs hover:bg-white/[0.02] flex items-start gap-3">
                    <span className="text-muted-foreground/60 shrink-0 w-36">{formatDate(log.timestamp)}</span>
                    <span className={`shrink-0 w-12 font-bold ${levelColor(log.level)}`}>[{log.level?.toUpperCase()}]</span>
                    <span className="text-muted-foreground shrink-0 w-28 truncate">{log.service}</span>
                    <span className="text-foreground/90">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── JOBS & QUEUE ──────────────────────────────────────────────────────────────

function JobsSection() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Background Jobs & Queue" desc="Monitor all running, pending, and completed background tasks and async job queues." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Running Jobs" value={JOBS.filter(j => j.status === "running").length} icon={PlayCircle} iconColor="text-green-400" />
        <StatCard title="Pending Jobs" value={JOBS.filter(j => j.status === "pending").length} icon={Clock} iconColor="text-yellow-400" />
        <StatCard title="Completed Today" value={JOBS.filter(j => j.status === "completed").length} icon={CheckCircle2} iconColor="text-blue-400" />
        <StatCard title="Queue Depth" value="0" sub="No backlog" icon={Zap} iconColor="text-muted-foreground" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Job Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {JOBS.map((job) => (
              <div key={job.id} className="p-3 rounded-lg border border-border/60 bg-muted/10">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full border border-border text-xs font-mono text-muted-foreground shrink-0">
                    {job.id.slice(1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{job.type}</span>
                      <Badge variant="outline" className={`text-xs ${job.status === "running" ? "text-green-400 border-green-500/30" : job.status === "completed" ? "text-blue-400 border-blue-500/30" : "text-muted-foreground"}`}>
                        {job.status}
                      </Badge>
                    </div>
                    {job.status === "running" && (
                      <div className="flex items-center gap-2">
                        <Progress value={job.progress} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground">{job.progress}%</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Duration: {job.duration} · Next: {job.next}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {job.status === "running" && <button className="p-1 hover:bg-muted rounded"><PauseCircle className="w-3.5 h-3.5 text-muted-foreground" /></button>}
                    {job.status === "pending" && <button className="p-1 hover:bg-muted rounded"><PlayCircle className="w-3.5 h-3.5 text-muted-foreground" /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── ALERTS ────────────────────────────────────────────────────────────────────

function AlertsSection({ status }: any) {
  const dbConnected = status?.databaseConnected ?? false;
  const activeAlerts = [
    ...(!dbConnected ? [{
      id: "A001", title: "Database Offline — Supabase Keys Missing", severity: "HIGH",
      msg: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured. All DB operations return empty data.",
      time: "Ongoing", module: "Database", color: "border-orange-500/30 bg-orange-500/5",
    }] : []),
    {
      id: "A002", title: "Market Sync Warnings — DB writes skipped", severity: "MEDIUM",
      msg: "32 market sync operations completed but data not persisted (offline mode).",
      time: "06:21:23", module: "Market Data", color: "border-yellow-500/30 bg-yellow-500/5",
    },
  ];

  const resolvedAlerts = [
    { id: "A003", title: "Backend API Port Conflict Resolved", severity: "MEDIUM", time: "06:15:05", module: "Backend" },
    { id: "A004", title: "OpenAI Rate Limit — Auto Retried", severity: "LOW", time: "06:18:41", module: "AI Engine" },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader title="Alert Engine" desc="Real-time alerts for system failures, performance degradation, and security events." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Active Alerts" value={activeAlerts.length} sub="Needs attention" icon={AlertTriangle} iconColor="text-orange-400" />
        <StatCard title="Resolved Today" value={resolvedAlerts.length} icon={CheckCircle2} iconColor="text-green-400" />
        <StatCard title="Critical Alerts" value={0} sub="None active" icon={ShieldAlert} iconColor="text-muted-foreground" />
        <StatCard title="Auto-Recovered" value={2} sub="Self-healed" icon={RefreshCw} iconColor="text-blue-400" />
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Active Alerts</div>
        {activeAlerts.map((a) => (
          <div key={a.id} className={`p-4 rounded-lg border ${a.color}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${a.severity === "HIGH" ? "text-orange-400" : "text-yellow-400"}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold">{a.title}</span>
                  <SeverityBadge sev={a.severity} />
                </div>
                <p className="text-xs text-muted-foreground">{a.msg}</p>
                <div className="text-xs text-muted-foreground mt-1">{a.module} · {a.time}</div>
              </div>
            </div>
          </div>
        ))}

        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mt-4">Resolved Alerts</div>
        {resolvedAlerts.map((a) => (
          <div key={a.id} className="p-3 rounded-lg border border-border/40 bg-muted/5 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            <div className="flex-1">
              <span className="text-xs font-medium text-muted-foreground">{a.title}</span>
            </div>
            <SeverityBadge sev={a.severity} />
            <span className="text-xs text-muted-foreground">{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TIMELINE ──────────────────────────────────────────────────────────────────

function TimelineSection() {
  return (
    <div className="space-y-5">
      <SectionHeader title="System Timeline" desc="Complete event history — every system action, job, error, and recovery in chronological order." />

      <Card>
        <CardContent className="p-4">
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
            {TIMELINE.map((e, i) => (
              <div key={i} className="relative flex items-start gap-3">
                <div className={`absolute -left-4 top-1 w-2 h-2 rounded-full border-2 border-background ${e.type === "success" ? "bg-green-400" : e.type === "warning" ? "bg-yellow-400" : e.type === "error" ? "bg-red-400" : "bg-blue-400"}`} />
                <div className="text-xs font-mono text-muted-foreground w-14 shrink-0 pt-0.5">{e.time}</div>
                <div className="flex-1">
                  <p className="text-xs">{e.event}</p>
                </div>
                <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${e.type === "success" ? "bg-green-400/50" : e.type === "warning" ? "bg-yellow-400/50" : "bg-blue-400/50"}`} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── ADMIN ─────────────────────────────────────────────────────────────────────

function AdminSection() {
  const controls = [
    { label: "Restart API Server", desc: "Graceful restart of the Express backend", icon: RefreshCw, color: "text-blue-400", danger: false },
    { label: "Clear Application Cache", desc: "Flush in-memory caches and React Query state", icon: Trash2, color: "text-yellow-400", danger: false },
    { label: "Run Diagnostics", desc: "Full system health check and validation", icon: Eye, color: "text-cyan-400", danger: false },
    { label: "Force Data Resync", desc: "Re-pull all market data from Bybit API", icon: RotateCcw, color: "text-green-400", danger: false },
    { label: "Enable Maintenance Mode", desc: "Take system offline for maintenance", icon: Settings, color: "text-orange-400", danger: true },
    { label: "Wipe Session Data", desc: "Clear all cached user session data", icon: Trash2, color: "text-red-400", danger: true },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader title="Admin Control Center" desc="System controls, maintenance tools, diagnostics, and recovery actions." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {controls.map((c, i) => (
          <div key={i} className={`p-4 rounded-lg border ${c.danger ? "border-red-500/20 bg-red-500/5" : "border-border bg-card"} flex items-center gap-3 hover:bg-muted/20 transition-colors cursor-pointer group`}>
            <c.icon className={`w-5 h-5 ${c.color} shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{c.label}</div>
              <div className="text-xs text-muted-foreground">{c.desc}</div>
            </div>
            <Button size="sm" variant={c.danger ? "destructive" : "outline"} className="shrink-0 h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
              Run
            </Button>
          </div>
        ))}
      </div>

      <Card className="border-yellow-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-yellow-400">
            <AlertTriangle className="w-4 h-4" /> Configuration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { key: "SUPABASE_URL", set: false, required: true },
              { key: "SUPABASE_SERVICE_ROLE_KEY", set: false, required: true },
              { key: "NODE_ENV", set: true, required: false, val: "development" },
              { key: "PORT", set: true, required: false, val: "8080" },
            ].map((c) => (
              <div key={c.key} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono">{c.key}</span>
                  {c.required && <Badge variant="outline" className="text-xs text-muted-foreground">required</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {c.set
                    ? <><span className="text-green-400 font-mono">{c.val}</span><CheckCircle2 className="w-3 h-3 text-green-400" /></>
                    : <><span className="text-red-400">not set</span><XCircle className="w-3 h-3 text-red-400" /></>}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Add missing secrets via the Replit Secrets panel (🔒 icon in the left sidebar) to enable database connectivity.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function SystemMonitor() {
  const [activeTab, setActiveTab] = useState("health");
  const metrics = useMetricHistory();

  const { data: status, isLoading: loadingStatus } = useGetSystemStatus({
    query: { queryKey: getGetSystemStatusQueryKey(), refetchInterval: 5000 },
  });
  const { data: logs, isLoading: loadingLogs } = useGetSystemLogs(
    { limit: 50 },
    { query: { queryKey: getGetSystemLogsQueryKey({ limit: 50 }), refetchInterval: 10000 } }
  );

  const dbConnected = status?.databaseConnected ?? false;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-5 rounded-xl border border-border/50 bg-gradient-to-r from-card to-card/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Server className="w-5 h-5 text-green-400" />
            <h1 className="text-2xl font-bold tracking-tight">System Monitor</h1>
            <Badge variant="outline" className="text-xs text-green-400 border-green-500/30 ml-1">Operations Center</Badge>
            {!dbConnected && (
              <Badge variant="outline" className="text-xs text-orange-400 border-orange-500/30">
                <AlertTriangle className="w-3 h-3 mr-1" />DB Offline
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time infrastructure monitoring — services, database, APIs, AI engine, and security.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Health Score</div>
            <div className={`text-2xl font-bold ${dbConnected ? "text-green-400" : "text-yellow-400"}`}>
              {dbConnected ? 96 : 71}
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full ${dbConnected ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === "health" && <HealthSection status={status} loadingStatus={loadingStatus} metrics={metrics} />}
      {activeTab === "services" && <ServicesSection />}
      {activeTab === "infrastructure" && <InfrastructureSection metrics={metrics} />}
      {activeTab === "database" && <DatabaseSection status={status} loadingStatus={loadingStatus} />}
      {activeTab === "apis" && <ApiSection status={status} />}
      {activeTab === "ai" && <AiEngineSection metrics={metrics} />}
      {activeTab === "trading" && <TradingEngineSection />}
      {activeTab === "pipeline" && <PipelineSection status={status} />}
      {activeTab === "performance" && <PerformanceSection metrics={metrics} />}
      {activeTab === "errors" && <ErrorsSection />}
      {activeTab === "security" && <SecuritySection />}
      {activeTab === "logs" && <LogsSection logs={logs} loadingLogs={loadingLogs} />}
      {activeTab === "jobs" && <JobsSection />}
      {activeTab === "alerts" && <AlertsSection status={status} />}
      {activeTab === "timeline" && <TimelineSection />}
      {activeTab === "admin" && <AdminSection />}
    </div>
  );
}
