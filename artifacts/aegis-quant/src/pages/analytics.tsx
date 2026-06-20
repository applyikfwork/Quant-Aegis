import { useState } from "react";
import {
  useGetPerformance,
  useGetDailyPerformance,
  useGetStrategyComparison,
  getGetPerformanceQueryKey,
  getGetDailyPerformanceQueryKey,
  getGetStrategyComparisonQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatPercent, formatNumber, cnValueColor } from "@/lib/format";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, Brain, ShieldCheck, Target, Zap,
  AlertTriangle, CheckCircle2, BarChart2, Activity, Wallet,
  Eye, Star, ArrowUpRight, ArrowDownRight, Lightbulb, FileText,
  Filter, RefreshCw, ChevronRight, Trophy, BookOpen,
  Cpu, Database, FlaskConical,
} from "lucide-react";

// ── MOCK DATA ────────────────────────────────────────────────────────────────

const DAILY_PERF = Array.from({ length: 30 }, (_, i) => {
  const base = 100000 + i * 420;
  const noise = (Math.random() - 0.4) * 1200;
  return {
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
    pnl: Math.round(noise),
    cumulative: Math.round(base + noise * 0.3),
    equity: Math.round(base),
  };
});

const MONTHLY_RETURNS = [
  { month: "Jan", return: 6.2, benchmark: 4.1 },
  { month: "Feb", return: -2.1, benchmark: -1.5 },
  { month: "Mar", return: 8.4, benchmark: 5.2 },
  { month: "Apr", return: 3.7, benchmark: 2.9 },
  { month: "May", return: 11.2, benchmark: 7.8 },
  { month: "Jun", return: -1.4, benchmark: -2.1 },
  { month: "Jul", return: 9.8, benchmark: 6.3 },
  { month: "Aug", return: 5.5, benchmark: 3.8 },
  { month: "Sep", return: -3.2, benchmark: -4.1 },
  { month: "Oct", return: 7.1, benchmark: 5.0 },
  { month: "Nov", return: 12.4, benchmark: 8.2 },
  { month: "Dec", return: 4.8, benchmark: 3.1 },
];

const TRADE_DIST = [
  { name: "Wins", value: 72, color: "#22c55e" },
  { name: "Losses", value: 28, color: "#ef4444" },
];

const ASSET_PERF = [
  { asset: "BTC", profit: 42, capital: 20, efficiency: 2.1, trades: 34 },
  { asset: "ETH", profit: 28, capital: 18, efficiency: 1.56, trades: 28 },
  { asset: "SOL", profit: 15, capital: 12, efficiency: 1.25, trades: 21 },
  { asset: "BNB", profit: 8, capital: 10, efficiency: 0.8, trades: 15 },
  { asset: "XRP", profit: 7, capital: 8, efficiency: 0.88, trades: 12 },
];

const STRATEGIES = [
  { name: "EMA Crossover", return: 30, drawdown: 8, sharpe: 2.4, winRate: 74, score: 92, trades: 48 },
  { name: "RSI Reversal", return: 40, drawdown: 35, sharpe: 1.1, winRate: 61, score: 70, trades: 36 },
  { name: "MACD Momentum", return: 25, drawdown: 12, sharpe: 2.1, winRate: 69, score: 85, trades: 52 },
  { name: "Volume Breakout", return: 18, drawdown: 9, sharpe: 1.9, winRate: 66, score: 80, trades: 29 },
];

const AI_ACCURACY = [
  { month: "Jan", buy: 78, sell: 72, overall: 75 },
  { month: "Feb", buy: 81, sell: 74, overall: 77 },
  { month: "Mar", buy: 83, sell: 76, overall: 80 },
  { month: "Apr", buy: 80, sell: 78, overall: 79 },
  { month: "May", buy: 85, sell: 80, overall: 82 },
  { month: "Jun", buy: 84, sell: 82, overall: 83 },
];

const AI_CONFIDENCE_CALIBRATION = [
  { confidence: "50-60%", actual: 54, count: 42 },
  { confidence: "60-70%", actual: 64, count: 68 },
  { confidence: "70-80%", actual: 76, count: 94 },
  { confidence: "80-90%", actual: 87, count: 72 },
  { confidence: "90-100%", actual: 91, count: 38 },
];

const BEHAVIOR_RADAR = [
  { subject: "Discipline", A: 82 },
  { subject: "Risk Mgmt", A: 88 },
  { subject: "Consistency", A: 71 },
  { subject: "Patience", A: 65 },
  { subject: "Execution", A: 90 },
  { subject: "Planning", A: 78 },
];

const INSIGHTS = [
  {
    id: 1,
    icon: TrendingUp,
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    title: "Win rate increases +12% in trending markets",
    desc: "Your strategy performs significantly better when ADX > 25, indicating strong trend conditions.",
    confidence: 94,
    type: "Performance",
  },
  {
    id: 2,
    icon: AlertTriangle,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    title: "Risk doubles when leverage exceeds 5x",
    desc: "Positions with leverage above 5x show 2.1x higher drawdown on average. Consider reducing to 3x maximum.",
    confidence: 91,
    type: "Risk",
  },
  {
    id: 3,
    icon: Brain,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    title: "BTC trades perform best on Tuesdays",
    desc: "Historical data shows 18% higher win rate for BTC setups opened on Tuesday vs other weekdays.",
    confidence: 78,
    type: "Pattern",
  },
  {
    id: 4,
    icon: ShieldCheck,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    title: "Performance declines after 3 consecutive losses",
    desc: "AI detected emotional trading pattern: trade quality drops 23% following 3+ consecutive losses. Consider taking a break.",
    confidence: 87,
    type: "Behavioral",
  },
  {
    id: 5,
    icon: Zap,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    title: "Volume breakouts outperform after news events",
    desc: "Breakout signals generated within 30 minutes of major news have 31% higher success rate.",
    confidence: 83,
    type: "Pattern",
  },
  {
    id: 6,
    icon: Star,
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    title: "EMA Crossover strategy showing signs of decay",
    desc: "Strategy win rate declined from 78% to 66% over last 3 months. Optimization recommended.",
    confidence: 89,
    type: "Strategy",
  },
];

const PREDICTIVE = [
  { month: "Jan", actual: 6.2, predicted: null },
  { month: "Feb", actual: -2.1, predicted: null },
  { month: "Mar", actual: 8.4, predicted: null },
  { month: "Apr", actual: 3.7, predicted: null },
  { month: "May", actual: 11.2, predicted: null },
  { month: "Jun", actual: null, predicted: 6.0 },
  { month: "Jul", actual: null, predicted: 7.2 },
  { month: "Aug", actual: null, predicted: 5.8 },
];

const BENCHMARK_DATA = [
  { period: "1M", portfolio: 8.4, btc: 5.2, sp500: 2.1, spy: 1.8 },
  { period: "3M", portfolio: 22.1, btc: 14.3, sp500: 6.8, spy: 5.9 },
  { period: "6M", portfolio: 38.7, btc: 22.8, sp500: 11.4, spy: 9.7 },
  { period: "YTD", portfolio: 62.3, btc: 35.1, sp500: 18.2, spy: 15.4 },
];

const ALERTS = [
  { type: "warning", icon: TrendingDown, msg: "Win rate dropped 8% over last 14 days", time: "2h ago", color: "text-yellow-400" },
  { type: "info", icon: Brain, msg: "AI accuracy improved to new high: 87%", time: "6h ago", color: "text-cyan-400" },
  { type: "danger", icon: AlertTriangle, msg: "Max drawdown approaching 15% threshold", time: "1d ago", color: "text-red-400" },
  { type: "success", icon: CheckCircle2, msg: "EMA Crossover strategy hit 6-month return target", time: "2d ago", color: "text-green-400" },
];

// ── SHARED COMPONENTS ────────────────────────────────────────────────────────

function StatCard({
  title, value, sub, icon: Icon, iconColor, trend, loading,
}: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; iconColor: string;
  trend?: { value: string; up: boolean };
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        </div>
        {loading ? (
          <Skeleton className="h-8 w-24 mb-1" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {trend && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${trend.up ? "text-green-400" : "text-red-400"}`}>
            {trend.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend.value}
          </div>
        )}
        {sub && !trend && (
          <div className="text-xs text-muted-foreground mt-1">{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "#111", borderColor: "#333", color: "#fff", fontSize: 12 },
  itemStyle: { color: "#fff" },
};

// ── TABS ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "performance", label: "Performance" },
  { id: "trades", label: "Trades" },
  { id: "portfolio", label: "Portfolio" },
  { id: "risk", label: "Risk" },
  { id: "ai", label: "AI Analytics" },
  { id: "strategies", label: "Strategies" },
  { id: "behavior", label: "Behavior" },
  { id: "predictive", label: "Predictive" },
  { id: "benchmark", label: "Benchmarks" },
  { id: "insights", label: "Insights" },
  { id: "reports", label: "Reports" },
  { id: "explorer", label: "Data Explorer" },
];

// ── SECTION: OVERVIEW ────────────────────────────────────────────────────────

function OverviewSection({ perf, loadingPerf }: { perf: any; loadingPerf: boolean }) {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Executive Overview"
        desc="CEO-level view of your entire trading system — performance, intelligence, and risk at a glance."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard title="Portfolio Value" value={perf ? formatCurrency(100000 + (perf.totalPnl ?? 0)) : "—"} icon={Wallet} iconColor="text-blue-400" loading={loadingPerf} />
        <StatCard title="AI Accuracy" value={perf ? `${perf.winRate?.toFixed(1)}%` : "—"} icon={Brain} iconColor="text-cyan-400" loading={loadingPerf} />
        <StatCard title="Active Strategies" value="—" sub="No strategies yet" icon={Target} iconColor="text-purple-400" />
        <StatCard title="Risk Score" value="—" sub="No trades yet" icon={ShieldCheck} iconColor="text-green-400" />
        <StatCard title="Win Rate" value={perf ? `${perf.winRate?.toFixed(1)}%` : "—"} icon={Trophy} iconColor="text-orange-400" loading={loadingPerf} />
        <StatCard title="Profit Factor" value={perf ? formatNumber(perf.profitFactor) : "—"} sub="Gross profit ÷ loss" icon={BookOpen} iconColor="text-emerald-400" loading={loadingPerf} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Portfolio Equity Curve — Last 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={DAILY_PERF}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={11}
                    tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    interval={6} />
                  <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v), "Equity"]}
                    labelFormatter={(l) => new Date(l).toLocaleDateString()} />
                  <Area dataKey="equity" stroke="#3b82f6" fill="url(#equityGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              Monthly Returns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MONTHLY_RETURNS.slice(-6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`]} />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Bar dataKey="return" radius={[3, 3, 0, 0]}
                    fill="#22c55e"
                    label={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {ALERTS.map((a, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
            <a.icon className={`w-4 h-4 mt-0.5 shrink-0 ${a.color}`} />
            <div className="min-w-0">
              <p className="text-xs font-medium leading-snug">{a.msg}</p>
              <p className="text-xs text-muted-foreground mt-1">{a.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SECTION: PERFORMANCE ─────────────────────────────────────────────────────

function PerformanceSection({ perf, loadingPerf, daily, loadingDaily }: any) {
  return (
    <div className="space-y-5">
      <SectionHeader title="Performance Analytics" desc="Professional return calculations, capital growth tracking, and risk-adjusted metrics." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total Return" value={perf ? `${perf.totalPnl >= 0 ? "+" : ""}${formatPercent(perf.totalPnl / 100000 * 100)}` : "—"} icon={TrendingUp} iconColor="text-green-400" loading={loadingPerf} />
        <StatCard title="Sharpe Ratio" value={perf ? formatNumber(perf.sharpeRatio) : "—"} sub="Risk-adjusted return" icon={Target} iconColor="text-blue-400" loading={loadingPerf} />
        <StatCard title="Max Drawdown" value={perf ? formatPercent(perf.maxDrawdown) : "—"} sub="Worst peak-to-trough" icon={TrendingDown} iconColor="text-red-400" loading={loadingPerf} />
        <StatCard title="Profit Factor" value={perf ? formatNumber(perf.profitFactor) : "—"} sub="Gross profit ÷ loss" icon={BarChart2} iconColor="text-purple-400" loading={loadingPerf} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Daily P&L — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily || DAILY_PERF}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={11}
                    tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    interval={6} />
                  <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `$${v}`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v), "P&L"]}
                    labelFormatter={(l) => new Date(l).toLocaleDateString()} />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Bar dataKey="pnl" radius={[2, 2, 0, 0]}
                    fill="#3b82f6"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly Returns vs Benchmark</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MONTHLY_RETURNS}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`]} />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Bar dataKey="return" name="Portfolio" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="benchmark" name="BTC" fill="#6b7280" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { period: "Daily", key: "daily" },
          { period: "Weekly", key: "weekly" },
          { period: "Monthly", key: "monthly" },
          { period: "Yearly", key: "yearly" },
        ].map((p) => (
          <Card key={p.period}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">{p.period} Return</div>
              <div className="text-xl font-bold text-muted-foreground">—</div>
              <div className="text-xs text-muted-foreground mt-0.5">No trades yet</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── SECTION: TRADES ──────────────────────────────────────────────────────────

function TradesSection({ perf, loadingPerf }: any) {
  return (
    <div className="space-y-5">
      <SectionHeader title="Trade Analytics" desc="Every trade analyzed — quality scores, distributions, win/loss patterns, and execution metrics." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Win Rate" value={perf ? formatPercent(perf.winRate) : "—"} icon={Trophy} iconColor="text-green-400" loading={loadingPerf} />
        <StatCard title="Avg Win" value={perf ? formatCurrency(perf.avgWin) : "—"} icon={TrendingUp} iconColor="text-green-400" loading={loadingPerf} />
        <StatCard title="Avg Loss" value={perf ? formatCurrency(Math.abs(perf.avgLoss)) : "—"} icon={TrendingDown} iconColor="text-red-400" loading={loadingPerf} />
        <StatCard title="Expectancy" value={perf ? formatCurrency((perf.avgWin * perf.winRate / 100) - (Math.abs(perf.avgLoss) * (1 - perf.winRate / 100))) : "—"} sub="Per trade average" icon={Target} iconColor="text-blue-400" loading={loadingPerf} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Profit Factor" value={perf ? formatNumber(perf.profitFactor) : "—"} icon={BarChart2} iconColor="text-purple-400" loading={loadingPerf} />
        <StatCard title="Avg Duration" value="—" sub="No trades yet" icon={Activity} iconColor="text-cyan-400" />
        <StatCard title="Avg Risk/Reward" value="—" sub="No trades yet" icon={Target} iconColor="text-orange-400" />
        <StatCard title="Total Trades" value={perf ? formatNumber(perf.totalTrades, 0) : "0"} sub="All time" icon={BarChart2} iconColor="text-muted-foreground" loading={loadingPerf} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Win / Loss Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <div className="h-[180px] w-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={TRADE_DIST} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      dataKey="value" paddingAngle={3}>
                      {TRADE_DIST.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="ml-4 space-y-3">
                {TRADE_DIST.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                    <div>
                      <div className="text-sm font-semibold" style={{ color: d.color }}>{d.value}%</div>
                      <div className="text-xs text-muted-foreground">{d.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {["Entry", "Risk Management", "Exit", "Execution", "Discipline"].map((c, i) => {
                const val = [88, 91, 74, 82, 78][i];
                return (
                  <div key={c} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{c}</span>
                      <span className="font-medium">{val}/100</span>
                    </div>
                    <Progress value={val} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Trade Size Distribution</CardTitle>
            <CardDescription>P&L by position size</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { size: "<$1K", wins: 14, losses: 8 },
                  { size: "$1-5K", wins: 38, losses: 16 },
                  { size: "$5-10K", wins: 52, losses: 19 },
                  { size: "$10-25K", wins: 41, losses: 14 },
                  { size: ">$25K", wins: 22, losses: 7 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="size" stroke="#6b7280" fontSize={10} />
                  <YAxis stroke="#6b7280" fontSize={11} />
                  <RTooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="wins" name="Wins" fill="#22c55e" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="losses" name="Losses" fill="#ef4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Win Rate by Weekday</CardTitle>
            <CardDescription>Pattern discovery</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { day: "Mon", rate: 68 },
                  { day: "Tue", rate: 79 },
                  { day: "Wed", rate: 72 },
                  { day: "Thu", rate: 74 },
                  { day: "Fri", rate: 64 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="day" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} domain={[50, 90]} tickFormatter={(v) => `${v}%`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, "Win Rate"]} />
                  <ReferenceLine y={72} stroke="#374151" strokeDasharray="4 4" />
                  <Bar dataKey="rate" radius={[3, 3, 0, 0]}
                    fill="#a78bfa"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── SECTION: PORTFOLIO ────────────────────────────────────────────────────────

function PortfolioSection() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Portfolio Analytics" desc="Asset performance, capital efficiency, allocation analysis, and sector exposure tracking." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total Assets" value="5" sub="Tracked positions" icon={Wallet} iconColor="text-blue-400" />
        <StatCard title="Best Performer" value="BTC" sub="42% of total profit" icon={Star} iconColor="text-yellow-400" />
        <StatCard title="Capital Efficiency" value="2.1x" sub="BTC avg return/capital" icon={Zap} iconColor="text-green-400" />
        <StatCard title="Diversification" value="Good" sub="Low correlation" icon={Target} iconColor="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Profit vs Capital Used by Asset</CardTitle>
            <CardDescription>Capital efficiency breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ASSET_PERF}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="asset" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`]} />
                  <Bar dataKey="profit" name="% of Profit" fill="#22c55e" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="capital" name="% of Capital" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Asset Allocation</CardTitle>
            <CardDescription>Capital distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-[200px] w-[200px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      { name: "BTC", value: 40 },
                      { name: "ETH", value: 25 },
                      { name: "SOL", value: 15 },
                      { name: "BNB", value: 12 },
                      { name: "XRP", value: 8 },
                    ]} cx="50%" cy="50%" outerRadius={80} dataKey="value" paddingAngle={2}>
                      {["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899"].map((c, i) => (
                        <Cell key={i} fill={c} />
                      ))}
                    </Pie>
                    <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {ASSET_PERF.map((a, i) => (
                  <div key={a.asset}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899"][i] }} />
                        <span className="font-medium">{a.asset}</span>
                      </div>
                      <span className="text-muted-foreground">{a.capital}%</span>
                    </div>
                    <Progress value={a.capital * 4} className="h-1" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Asset Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left pb-2 font-medium">Asset</th>
                  <th className="text-right pb-2 font-medium">% of Profit</th>
                  <th className="text-right pb-2 font-medium">% of Capital</th>
                  <th className="text-right pb-2 font-medium">Efficiency</th>
                  <th className="text-right pb-2 font-medium">Trades</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {ASSET_PERF.map((a) => (
                  <tr key={a.asset} className="hover:bg-muted/20">
                    <td className="py-2.5 font-semibold">{a.asset}</td>
                    <td className="py-2.5 text-right text-green-400">{a.profit}%</td>
                    <td className="py-2.5 text-right text-blue-400">{a.capital}%</td>
                    <td className={`py-2.5 text-right font-medium ${a.efficiency >= 1 ? "text-green-400" : "text-red-400"}`}>{a.efficiency.toFixed(2)}x</td>
                    <td className="py-2.5 text-right text-muted-foreground">{a.trades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── SECTION: RISK ─────────────────────────────────────────────────────────────

function RiskSection() {
  const drawdownData = DAILY_PERF.map((d, i) => ({
    date: d.date,
    drawdown: Math.max(0, Math.random() * 8 * (i < 10 ? 0.4 : i < 20 ? 0.7 : 1)),
  }));

  return (
    <div className="space-y-5">
      <SectionHeader title="Risk Analytics" desc="Portfolio risk, drawdown analysis, exposure tracking, and risk contribution by asset and strategy." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Current Risk" value="32/100" sub="Low · Safe zone" icon={ShieldCheck} iconColor="text-green-400" />
        <StatCard title="Max Drawdown" value={perf ? formatPercent(perf.maxDrawdown) : "—"} sub="Worst period" icon={TrendingDown} iconColor="text-red-400" loading={loadingPerf} />
        <StatCard title="Avg Recovery" value="4.2 days" sub="Avg drawdown recovery" icon={RefreshCw} iconColor="text-blue-400" />
        <StatCard title="Portfolio VaR" value="$2,840" sub="95% confidence (1-day)" icon={AlertTriangle} iconColor="text-yellow-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Drawdown History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={drawdownData}>
                  <defs>
                    <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={11}
                    tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    interval={6} />
                  <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `-${v.toFixed(1)}%`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`-${v.toFixed(2)}%`, "Drawdown"]} />
                  <Area dataKey="drawdown" stroke="#ef4444" fill="url(#ddGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risk Contribution by Asset</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mt-2">
              {[
                { name: "BTC", risk: 38, color: "#3b82f6" },
                { name: "ETH", risk: 27, color: "#8b5cf6" },
                { name: "SOL", risk: 18, color: "#06b6d4" },
                { name: "BNB", risk: 10, color: "#f59e0b" },
                { name: "XRP", risk: 7, color: "#ec4899" },
              ].map((a) => (
                <div key={a.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{a.name}</span>
                    <span className="font-medium" style={{ color: a.color }}>{a.risk}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${a.risk}%`, background: a.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {[
                { label: "Portfolio Risk", val: 32, color: "#22c55e" },
                { label: "Leverage Risk", val: 24, color: "#22c55e" },
                { label: "Liquidity Risk", val: 18, color: "#22c55e" },
                { label: "Correlation Risk", val: 41, color: "#facc15" },
              ].map((r) => (
                <div key={r.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-medium" style={{ color: r.color }}>{r.val}/100</span>
                  </div>
                  <Progress value={r.val} className="h-1.5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── SECTION: AI ANALYTICS ─────────────────────────────────────────────────────

function AiSection() {
  return (
    <div className="space-y-5">
      <SectionHeader title="AI Analytics Engine" desc="Prediction accuracy, confidence calibration, model performance, and learning metrics over time." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Overall Accuracy" value="84%" sub="All signals" icon={Brain} iconColor="text-cyan-400" trend={{ value: "+6% vs 6 months ago", up: true }} />
        <StatCard title="BUY Signal Rate" value="87%" sub="Success rate" icon={TrendingUp} iconColor="text-green-400" />
        <StatCard title="SELL Signal Rate" value="81%" sub="Success rate" icon={TrendingDown} iconColor="text-blue-400" />
        <StatCard title="Confidence Score" value="91%" sub="High confidence" icon={Zap} iconColor="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">AI Accuracy Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={AI_ACCURACY}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} domain={[65, 95]} tickFormatter={(v) => `${v}%`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`]} />
                  <Line dataKey="buy" name="BUY signals" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  <Line dataKey="sell" name="SELL signals" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line dataKey="overall" name="Overall" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Confidence Calibration</CardTitle>
            <CardDescription>Stated confidence vs actual success rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={AI_CONFIDENCE_CALIBRATION}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="confidence" stroke="#6b7280" fontSize={10} />
                  <YAxis stroke="#6b7280" fontSize={11} domain={[40, 100]} tickFormatter={(v) => `${v}%`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v}%`, n === "actual" ? "Actual Success" : "Stated Confidence"]} />
                  <Bar dataKey="actual" name="Actual accuracy" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <p className="text-xs text-cyan-400 font-medium">Well-calibrated AI</p>
              <p className="text-xs text-muted-foreground mt-0.5">Stated confidence closely matches actual success rates — trustworthy signals.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">AI Agent Performance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              { name: "Market Agent", accuracy: 88, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
              { name: "Strategy Agent", accuracy: 82, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
              { name: "Risk Agent", accuracy: 91, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
              { name: "Research Agent", accuracy: 79, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
              { name: "Decision Agent", accuracy: 84, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
            ].map((a) => (
              <div key={a.name} className={`p-3 rounded-lg border ${a.bg}`}>
                <div className="text-xs text-muted-foreground mb-1">{a.name}</div>
                <div className={`text-2xl font-bold ${a.color}`}>{a.accuracy}%</div>
                <Progress value={a.accuracy} className="h-1 mt-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── SECTION: STRATEGIES ───────────────────────────────────────────────────────

function StrategiesSection({ stratComparison, loadingStrat }: any) {
  return (
    <div className="space-y-5">
      <SectionHeader title="Strategy Analytics" desc="Every strategy analyzed — return, risk, stability, lifecycle tracking, and comparison matrix." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Active Strategies" value="12" sub="Currently deployed" icon={Target} iconColor="text-blue-400" />
        <StatCard title="Profitable" value="10" sub="83% success rate" icon={TrendingUp} iconColor="text-green-400" />
        <StatCard title="Best Strategy" value="EMA Cross" sub="Score: 92/100" icon={Star} iconColor="text-yellow-400" />
        <StatCard title="Avg Sharpe" value="1.94" sub="All strategies" icon={BarChart2} iconColor="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Strategy Comparison Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left pb-2 font-medium">Strategy</th>
                    <th className="text-right pb-2 font-medium">Return</th>
                    <th className="text-right pb-2 font-medium">Drawdown</th>
                    <th className="text-right pb-2 font-medium">Sharpe</th>
                    <th className="text-right pb-2 font-medium">Win%</th>
                    <th className="text-right pb-2 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {(stratComparison?.length ? stratComparison.map((s: any) => ({
                    name: s.strategyName, return: s.totalPnl / 1000, drawdown: 10, sharpe: 1.8, winRate: s.winRate, score: 80,
                  })) : STRATEGIES).map((s: any) => (
                    <tr key={s.name} className="hover:bg-muted/20">
                      <td className="py-2.5 font-medium">{s.name}</td>
                      <td className={`py-2.5 text-right ${s.return > 0 ? "text-green-400" : "text-red-400"}`}>
                        {s.return > 0 ? "+" : ""}{s.return.toFixed(1)}%
                      </td>
                      <td className="py-2.5 text-right text-red-400">-{s.drawdown}%</td>
                      <td className="py-2.5 text-right text-blue-400">{s.sharpe.toFixed(2)}</td>
                      <td className="py-2.5 text-right text-muted-foreground">{s.winRate.toFixed(1)}%</td>
                      <td className="py-2.5 text-right">
                        <span className={`font-bold ${s.score >= 85 ? "text-green-400" : s.score >= 70 ? "text-yellow-400" : "text-red-400"}`}>{s.score}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Strategy Return vs Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={STRATEGIES} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                  <XAxis type="number" stroke="#6b7280" fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" stroke="#6b7280" fontSize={11} width={100} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`]} />
                  <Bar dataKey="return" name="Return" fill="#22c55e" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="drawdown" name="Drawdown" fill="#ef4444" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── SECTION: BEHAVIOR ─────────────────────────────────────────────────────────

function BehaviorSection() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Behavioral Analytics" desc="Psychology scores, emotional trading patterns, discipline tracking, and improvement over time." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Psychology Score" value="82/100" sub="Above average" icon={Brain} iconColor="text-cyan-400" trend={{ value: "+9 pts this month", up: true }} />
        <StatCard title="Discipline Rating" value="A-" sub="Excellent" icon={CheckCircle2} iconColor="text-green-400" />
        <StatCard title="Emotional Trades" value="8%" sub="Below 10% target" icon={AlertTriangle} iconColor="text-yellow-400" />
        <StatCard title="Consistency Score" value="71/100" sub="Room to improve" icon={Activity} iconColor="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Trading Psychology Radar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={BEHAVIOR_RADAR}>
                  <PolarGrid stroke="#1f2937" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <Radar name="Score" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}/100`]} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Behavioral Patterns Detected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  title: "Performance drops after 3 consecutive losses",
                  desc: "Trade quality decreases 23% following 3+ consecutive losses.",
                  color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", severity: "High",
                },
                {
                  title: "Overtrading during volatile markets",
                  desc: "Trade frequency increases 41% during high-volatility sessions.",
                  color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", severity: "Medium",
                },
                {
                  title: "Strong morning session discipline",
                  desc: "Win rate 12% higher during 08:00–12:00 UTC trading hours.",
                  color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", severity: "Positive",
                },
                {
                  title: "Improves after reviewing losing trades",
                  desc: "Post-review sessions show 18% improvement in execution quality.",
                  color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", severity: "Positive",
                },
              ].map((p, i) => (
                <div key={i} className={`p-3 rounded-lg border ${p.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-xs font-semibold ${p.color}`}>{p.title}</p>
                    <Badge variant="outline" className={`text-xs ${p.color} border-current`}>{p.severity}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Learning Progress Analytics</CardTitle>
          <CardDescription>Connected to Learning Center — skill improvement tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { skill: "Risk Management", improvement: 32, icon: ShieldCheck, color: "text-green-400" },
              { skill: "Technical Analysis", improvement: 28, icon: BarChart2, color: "text-blue-400" },
              { skill: "Trade Execution", improvement: 19, icon: Zap, color: "text-yellow-400" },
              { skill: "Psychology", improvement: 24, icon: Brain, color: "text-purple-400" },
            ].map((s) => (
              <div key={s.skill} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
                <div className="text-xs text-muted-foreground mb-1">{s.skill}</div>
                <div className={`text-xl font-bold ${s.color}`}>+{s.improvement}%</div>
                <div className="text-xs text-muted-foreground">improvement</div>
                <Progress value={s.improvement * 2.5} className="h-1 mt-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── SECTION: PREDICTIVE ───────────────────────────────────────────────────────

function PredictiveSection() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Predictive Analytics" desc="Institutional-grade forecasting using AI models, historical patterns, and market conditions." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Expected Return" value="+6.0%" sub="Next 30 days (AI)" icon={TrendingUp} iconColor="text-green-400" />
        <StatCard title="Expected Drawdown" value="-4.2%" sub="Next 30 days (AI)" icon={TrendingDown} iconColor="text-yellow-400" />
        <StatCard title="Strategy Health" value="Good" sub="No decay detected" icon={CheckCircle2} iconColor="text-green-400" />
        <StatCard title="Risk Outlook" value="Low" sub="3-month forecast" icon={ShieldCheck} iconColor="text-green-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Return Forecast — Next 3 Months</CardTitle>
            <CardDescription>Actual vs AI-predicted performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={PREDICTIVE}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number, n: string) => [v !== null ? `${v}%` : "—", n === "actual" ? "Actual" : "AI Predicted"]} />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Bar dataKey="actual" name="actual" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="predicted" name="predicted" fill="#a78bfa" radius={[3, 3, 0, 0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-500" /> Actual</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-purple-400 opacity-70" /> AI Predicted</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pattern Discovery Engine</CardTitle>
            <CardDescription>Hidden patterns found by AI analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { pattern: "BTC trades best on Tuesdays", confidence: 78, impact: "+18% win rate", color: "text-blue-400" },
                { pattern: "Volume breakouts outperform after news", confidence: 83, impact: "+31% success rate", color: "text-green-400" },
                { pattern: "Losses increase in high volatility (VIX >30)", confidence: 91, impact: "-24% win rate", color: "text-red-400" },
                { pattern: "AI signals are 22% more accurate at market open", confidence: 76, impact: "+22% accuracy", color: "text-cyan-400" },
              ].map((p, i) => (
                <div key={i} className="p-3 rounded-lg border border-border/60 bg-card/40">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold">{p.pattern}</p>
                    <Badge variant="outline" className="text-xs">{p.confidence}% conf.</Badge>
                  </div>
                  <p className={`text-xs font-medium ${p.color}`}>{p.impact}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── SECTION: BENCHMARKING ─────────────────────────────────────────────────────

function BenchmarkSection() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Benchmarking Engine" desc="Compare your portfolio performance against BTC, S&P 500, SPY, and institutional benchmarks." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="1M Outperformance" value="+3.2%" sub="vs BTC benchmark" icon={TrendingUp} iconColor="text-green-400" trend={{ value: "Portfolio beats BTC", up: true }} />
        <StatCard title="YTD Alpha" value="+27.2%" sub="vs S&P 500" icon={Trophy} iconColor="text-yellow-400" trend={{ value: "Significant alpha", up: true }} />
        <StatCard title="Beta to BTC" value="0.68" sub="Lower volatility" icon={Activity} iconColor="text-blue-400" />
        <StatCard title="Information Ratio" value="1.42" sub="Risk-adjusted alpha" icon={Target} iconColor="text-purple-400" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Performance vs Benchmarks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={BENCHMARK_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="period" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `${v}%`} />
                <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`]} />
                <Bar dataKey="portfolio" name="My Portfolio" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="btc" name="BTC" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="sp500" name="S&P 500" fill="#6b7280" radius={[3, 3, 0, 0]} />
                <Bar dataKey="spy" name="SPY" fill="#4b5563" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
            {[
              { label: "My Portfolio", color: "#3b82f6" },
              { label: "BTC", color: "#f59e0b" },
              { label: "S&P 500", color: "#6b7280" },
              { label: "SPY", color: "#4b5563" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ background: l.color }} />
                <span className="text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {BENCHMARK_DATA.map((b) => (
          <Card key={b.period}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-2 font-medium">{b.period} Period</div>
              <div className="space-y-2">
                {[
                  { name: "My Portfolio", value: b.portfolio, color: "text-blue-400" },
                  { name: "BTC", value: b.btc, color: "text-yellow-400" },
                  { name: "S&P 500", value: b.sp500, color: "text-muted-foreground" },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                    <span className={`text-sm font-bold ${item.color}`}>+{item.value}%</span>
                  </div>
                ))}
                <div className="pt-1 border-t border-border flex items-center justify-between">
                  <span className="text-xs font-medium">Alpha vs BTC</span>
                  <span className="text-sm font-bold text-green-400">+{(b.portfolio - b.btc).toFixed(1)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── SECTION: INSIGHTS ─────────────────────────────────────────────────────────

function InsightsSection() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Insight Engine" desc="AI-generated intelligence continuously surfacing patterns, opportunities, and optimization recommendations." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total Insights" value="24" sub="Generated this month" icon={Lightbulb} iconColor="text-yellow-400" />
        <StatCard title="Actionable" value="18" sub="75% actionable" icon={CheckCircle2} iconColor="text-green-400" />
        <StatCard title="High Confidence" value="14" sub=">85% confidence" icon={Brain} iconColor="text-cyan-400" />
        <StatCard title="Implemented" value="11" sub="46% acted on" icon={Zap} iconColor="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INSIGHTS.map((insight) => (
          <div key={insight.id} className={`p-4 rounded-lg border ${insight.bg}`}>
            <div className="flex items-start gap-3">
              <insight.icon className={`w-4 h-4 mt-0.5 shrink-0 ${insight.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className={`text-sm font-semibold ${insight.color}`}>{insight.title}</p>
                  <Badge variant="outline" className="text-xs shrink-0">{insight.type}</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{insight.desc}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full bg-current opacity-60" style={{ width: `${insight.confidence}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{insight.confidence}% confidence</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SECTION: REPORTS ──────────────────────────────────────────────────────────

function ReportsSection() {
  const reports = [
    { type: "Daily Report", date: "Today, Jun 19", status: "Ready", icon: FileText, color: "text-blue-400" },
    { type: "Weekly Report", date: "Jun 10 – Jun 16", status: "Ready", icon: FileText, color: "text-green-400" },
    { type: "Monthly Report", date: "May 2025", status: "Ready", icon: FileText, color: "text-purple-400" },
    { type: "Quarterly Report", date: "Q1 2025", status: "Ready", icon: FileText, color: "text-cyan-400" },
    { type: "Annual Report", date: "2024", status: "Ready", icon: FileText, color: "text-orange-400" },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader title="Report Engine" desc="Automated report generation covering performance, risk, strategies, AI, behavior, and recommendations." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Available Reports</h3>
          {reports.map((r, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <r.icon className={`w-5 h-5 ${r.color}`} />
                <div>
                  <div className="text-sm font-medium">{r.type}</div>
                  <div className="text-xs text-muted-foreground">{r.date}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">{r.status}</Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Report Contents</h3>
            <div className="space-y-2">
              {[
                { label: "Performance Summary", included: true },
                { label: "Risk Analysis", included: true },
                { label: "Strategy Performance", included: true },
                { label: "AI Analytics", included: true },
                { label: "Behavioral Analysis", included: true },
                { label: "Learning Progress", included: true },
                { label: "Recommendations", included: true },
                { label: "Predictive Outlook", included: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${item.included ? "text-green-400" : "text-muted-foreground"}`} />
                  <span className={item.included ? "" : "text-muted-foreground"}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Alert Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ALERTS.map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <a.icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${a.color}`} />
                    <div>
                      <p className="text-xs">{a.msg}</p>
                      <p className="text-xs text-muted-foreground">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── SECTION: DATA EXPLORER ────────────────────────────────────────────────────

function ExplorerSection() {
  const [asset, setAsset] = useState("BTC");
  const [dateRange, setDateRange] = useState("last30");
  const [minConf, setMinConf] = useState("70");

  const filteredData = DAILY_PERF.slice(-parseInt(dateRange === "last7" ? "7" : dateRange === "last30" ? "30" : "30"));

  return (
    <div className="space-y-5">
      <SectionHeader title="Data Explorer" desc="Professional analysis workspace — filter, segment, and query your trading data with custom metrics." />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-400" />
            Query Builder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Asset</label>
              <select
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="h-8 px-2 text-xs rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {["BTC", "ETH", "SOL", "BNB", "XRP", "All"].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="h-8 px-2 text-xs rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="last7">Last 7 days</option>
                <option value="last30">Last 30 days</option>
                <option value="last90">Last 90 days</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Min AI Confidence</label>
              <select
                value={minConf}
                onChange={(e) => setMinConf(e.target.value)}
                className="h-8 px-2 text-xs rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="0">Any</option>
                <option value="70">70%+</option>
                <option value="80">80%+</option>
                <option value="90">90%+</option>
              </select>
            </div>
            <div className="flex items-end">
              <div className="h-8 px-4 flex items-center gap-2 text-xs rounded-md bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors">
                <Eye className="w-3.5 h-3.5" />
                Run Query
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-border/50 bg-muted/20 text-xs text-muted-foreground mb-4">
            <span className="text-foreground font-medium">Query: </span>
            Show all <span className="text-blue-400">{asset}</span> trades between{" "}
            <span className="text-green-400">{dateRange === "last7" ? "last 7 days" : dateRange === "last30" ? "last 30 days" : "last 90 days"}</span>{" "}
            with AI confidence above <span className="text-purple-400">{minConf}%</span>
          </div>

          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredData}>
                <defs>
                  <linearGradient id="explorerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={11}
                  tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  interval={Math.floor(filteredData.length / 6)} />
                <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v), "Equity"]}
                  labelFormatter={(l) => new Date(l).toLocaleDateString()} />
                <Area dataKey="equity" stroke="#8b5cf6" fill="url(#explorerGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {[
              { label: "Filtered Trades", value: filteredData.length * 3 },
              { label: "Avg Win Rate", value: "74%" },
              { label: "Total P&L", value: formatCurrency(filteredData.reduce((s, d) => s + d.pnl, 0)) },
              { label: "AI Accuracy", value: "86%" },
            ].map((r) => (
              <div key={r.label} className="p-2 rounded-lg bg-muted/30 border border-border/50">
                <div className="text-xs text-muted-foreground">{r.label}</div>
                <div className="text-sm font-bold mt-0.5">{r.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              Data Warehouse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { category: "Trading Data", records: "12,840", icon: BarChart2, color: "text-blue-400" },
                { category: "Portfolio Data", records: "4,210", icon: Wallet, color: "text-green-400" },
                { category: "Risk Data", records: "8,920", icon: ShieldCheck, color: "text-yellow-400" },
                { category: "AI Data", records: "31,450", icon: Brain, color: "text-cyan-400" },
                { category: "Behavior Data", records: "6,720", icon: Activity, color: "text-purple-400" },
              ].map((d) => (
                <div key={d.category} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-2">
                    <d.icon className={`w-3.5 h-3.5 ${d.color}`} />
                    <span className="text-xs">{d.category}</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{d.records} records</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-purple-400" />
              Custom Metric Builder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Pre-built custom metrics combining multiple data sources:</p>
              {[
                { name: "Quality-Adjusted Return", formula: "Return × Trade Quality Score", value: "+19.4%", color: "text-green-400" },
                { name: "Risk-Normalized Win Rate", formula: "Win Rate ÷ Avg Drawdown", value: "7.66", color: "text-blue-400" },
                { name: "AI Leverage Score", formula: "AI Accuracy × Confidence", value: "76.4", color: "text-cyan-400" },
                { name: "Discipline-Weighted P&L", formula: "P&L × Discipline Score", value: "$42,280", color: "text-purple-400" },
              ].map((m) => (
                <div key={m.name} className="p-2.5 rounded-lg border border-border/60 bg-muted/20 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{m.formula}</div>
                  </div>
                  <div className={`text-sm font-bold ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function Analytics() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: perf, isLoading: loadingPerf } = useGetPerformance({
    query: { queryKey: getGetPerformanceQueryKey() },
  });
  const { data: daily, isLoading: loadingDaily } = useGetDailyPerformance(
    { days: 30 },
    { query: { queryKey: getGetDailyPerformanceQueryKey({ days: 30 }) } }
  );
  const { data: stratComparison, isLoading: loadingStrat } = useGetStrategyComparison({
    query: { queryKey: getGetStrategyComparisonQueryKey() },
  });

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-5 rounded-xl border border-border/50 bg-gradient-to-r from-card to-card/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-5 h-5 text-blue-400" />
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30 ml-1">Enterprise Intelligence</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Central intelligence layer — every module feeds data in, AI transforms it into insights and predictions.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">Live</span>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
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

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewSection perf={perf} loadingPerf={loadingPerf} />}
      {activeTab === "performance" && <PerformanceSection perf={perf} loadingPerf={loadingPerf} daily={daily} loadingDaily={loadingDaily} />}
      {activeTab === "trades" && <TradesSection perf={perf} loadingPerf={loadingPerf} />}
      {activeTab === "portfolio" && <PortfolioSection />}
      {activeTab === "risk" && <RiskSection />}
      {activeTab === "ai" && <AiSection />}
      {activeTab === "strategies" && <StrategiesSection stratComparison={stratComparison} loadingStrat={loadingStrat} />}
      {activeTab === "behavior" && <BehaviorSection />}
      {activeTab === "predictive" && <PredictiveSection />}
      {activeTab === "benchmark" && <BenchmarkSection />}
      {activeTab === "insights" && <InsightsSection />}
      {activeTab === "reports" && <ReportsSection />}
      {activeTab === "explorer" && <ExplorerSection />}
    </div>
  );
}
