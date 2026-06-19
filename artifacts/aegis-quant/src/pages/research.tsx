import { useState } from "react";
import {
  useListExperiments,
  useCreateExperiment,
  useListStrategies,
  getListExperimentsQueryKey,
  getListStrategiesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/format";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine,
} from "recharts";
import {
  FlaskConical, Plus, CheckCircle2, XCircle, Clock, Brain, Activity,
  BarChart2, AlertTriangle, Zap, Target, Star, Eye, Database,
  TrendingUp, TrendingDown, Search, RefreshCw, Lightbulb,
  BookOpen, Shield, ChevronRight, Cpu, Globe, FileText,
  PlayCircle, PauseCircle, Layers, Filter,
} from "lucide-react";

// ── MOCK DATA ────────────────────────────────────────────────────────────────

const PROJECTS = [
  { id: "R001", name: "Volume Breakout Alpha Study", status: "active", owner: "AI Agent", created: "2025-05-12", progress: 78, score: 91 },
  { id: "R002", name: "EMA Cross Regime Analysis", status: "active", owner: "User", created: "2025-05-18", progress: 54, score: 84 },
  { id: "R003", name: "BTC Seasonal Pattern Discovery", status: "completed", owner: "AI Agent", created: "2025-04-22", progress: 100, score: 88 },
  { id: "R004", name: "Volatility Forecasting Model v2", status: "active", owner: "Quant Agent", created: "2025-06-01", progress: 32, score: 76 },
  { id: "R005", name: "Sentiment Factor Integration", status: "pending", owner: "User", created: "2025-06-10", progress: 8, score: null },
  { id: "R006", name: "Risk-Adjusted Entry Optimization", status: "completed", owner: "AI Agent", created: "2025-03-15", progress: 100, score: 95 },
];

const DISCOVERIES = [
  { id: 1, pattern: "Volume + ATR expansion precedes 70% of major breakouts", confidence: 89, market: "BTC", type: "Price Pattern", impact: "High", discovered: "2 days ago" },
  { id: 2, pattern: "Funding rate reversal predicts short-term trend reversal with 78% accuracy", confidence: 78, market: "Crypto", type: "Market Pattern", impact: "High", discovered: "4 days ago" },
  { id: 3, pattern: "EMA crossover signals 22% more accurate after open interest spike", confidence: 83, market: "ETH", type: "Indicator Pattern", impact: "Medium", discovered: "1 week ago" },
  { id: 4, pattern: "Tuesday & Thursday sessions outperform by 14% on average", confidence: 76, market: "All", type: "Seasonal", impact: "Medium", discovered: "1 week ago" },
  { id: 5, pattern: "AI confidence >85% correlates with 91% win rate historically", confidence: 91, market: "All", type: "AI Pattern", impact: "High", discovered: "2 weeks ago" },
  { id: 6, pattern: "Mean reversion plays fail 65% of time when ADX > 30", confidence: 85, market: "BTC/ETH", type: "Regime", impact: "High", discovered: "2 weeks ago" },
];

const REGIMES = [
  { period: "Jan", regime: "Bull", volatility: 32, returns: 8.4, color: "#22c55e" },
  { period: "Feb", regime: "Bear", volatility: 48, returns: -4.1, color: "#ef4444" },
  { period: "Mar", regime: "Trend", volatility: 38, returns: 11.2, color: "#3b82f6" },
  { period: "Apr", regime: "Sideways", volatility: 22, returns: 1.8, color: "#6b7280" },
  { period: "May", regime: "Bull", volatility: 29, returns: 9.7, color: "#22c55e" },
  { period: "Jun", regime: "High Vol", volatility: 61, returns: -2.3, color: "#f59e0b" },
];

const FACTORS = [
  { name: "Momentum", predictivePower: 78, stability: 82, impact: "+8.2%", type: "Return", active: true },
  { name: "Volume", predictivePower: 71, stability: 88, impact: "+6.4%", type: "Return", active: true },
  { name: "Volatility", predictivePower: 84, stability: 74, impact: "-12.1%", type: "Risk", active: true },
  { name: "Liquidity", predictivePower: 62, stability: 91, impact: "+4.1%", type: "Quality", active: true },
  { name: "Sentiment", predictivePower: 69, stability: 58, impact: "+5.8%", type: "Behavioral", active: false },
  { name: "Trend Strength", predictivePower: 88, stability: 79, impact: "+10.3%", type: "Return", active: true },
];

const SCANNER_RESULTS = [
  { asset: "BTC", signal: "Breakout Setup", probability: 87, direction: "Long", timeframe: "4H", strength: "Strong", color: "#22c55e" },
  { asset: "ETH", signal: "Support Hold", probability: 74, direction: "Long", timeframe: "1H", strength: "Medium", color: "#22c55e" },
  { asset: "SOL", signal: "Resistance Test", probability: 68, direction: "Short", timeframe: "1H", strength: "Medium", color: "#ef4444" },
  { asset: "BNB", signal: "Consolidation", probability: 52, direction: "Neutral", timeframe: "4H", strength: "Weak", color: "#6b7280" },
  { asset: "DOGE", signal: "Momentum Surge", probability: 79, direction: "Long", timeframe: "15M", strength: "Strong", color: "#22c55e" },
  { asset: "XRP", signal: "Pattern Breakdown", probability: 71, direction: "Short", timeframe: "1H", strength: "Medium", color: "#ef4444" },
];

const AI_AGENTS = [
  { name: "Market Analyst Agent", icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", status: "Running", task: "Analyzing BTC 4H structure + volatility cycles", discoveries: 48, accuracy: 87 },
  { name: "Quant Agent", icon: BarChart2, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", status: "Running", task: "Building volatility forecasting model v2.3", discoveries: 31, accuracy: 82 },
  { name: "Strategy Scientist", icon: Target, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", status: "Idle", task: "Waiting for factor research results", discoveries: 24, accuracy: 79 },
  { name: "Risk Research Agent", icon: Shield, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", status: "Running", task: "Stress testing drawdown scenarios across 2018–2025", discoveries: 19, accuracy: 91 },
  { name: "Data Scientist Agent", icon: Database, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", status: "Idle", task: "Feature engineering pipeline — standby", discoveries: 34, accuracy: 85 },
];

const MODELS = [
  { name: "Breakout Classifier v3", type: "Classification", accuracy: 84, stability: 79, overfitting: "Low", status: "Deployed" },
  { name: "Volatility Forecaster v2", type: "Forecast", accuracy: 76, stability: 82, overfitting: "Medium", status: "Testing" },
  { name: "Regime Detector v1", type: "Classification", accuracy: 88, stability: 85, overfitting: "Low", status: "Deployed" },
  { name: "Return Predictor v4", type: "Prediction", accuracy: 71, stability: 68, overfitting: "High", status: "Research" },
  { name: "Sentiment Integrator v1", type: "Decision", accuracy: 69, stability: 61, overfitting: "Medium", status: "Research" },
];

const HYPOTHESIS_LIST = [
  { id: "H001", idea: "High volume breakouts perform better during high volatility regimes (ATR > 1.5x avg)", vars: "Volume, ATR, Volatility", expected: "+15% win rate", status: "validated", confidence: 88 },
  { id: "H002", idea: "EMA crossover + RSI filter reduces false signals by 30% in sideways markets", vars: "EMA, RSI, ADX", expected: "-30% false signals", status: "testing", confidence: null },
  { id: "H003", idea: "Funding rate extreme readings predict short-term reversals with 80%+ accuracy", vars: "Funding Rate, Price, OI", expected: "80% accuracy", status: "validated", confidence: 78 },
  { id: "H004", idea: "News sentiment score > 0.7 correlates with 3-day positive price move", vars: "Sentiment, Price, Volume", expected: "+12% 3-day return", status: "pending", confidence: null },
];

const DATASETS = [
  { name: "BTC OHLCV 2018–2025", source: "Bybit", records: "2.1M", quality: 98, version: "v4.2", updated: "Today" },
  { name: "Crypto Market Cap + Dominance", source: "CoinGecko", records: "840K", quality: 94, version: "v2.1", updated: "Today" },
  { name: "Funding Rates (All Pairs)", source: "Bybit", records: "620K", quality: 96, version: "v1.8", updated: "1h ago" },
  { name: "News Sentiment Scores", source: "Internal AI", records: "1.4M", quality: 87, version: "v3.0", updated: "6h ago" },
  { name: "On-Chain Metrics (BTC)", source: "Glassnode", records: "380K", quality: 91, version: "v2.4", updated: "1d ago" },
  { name: "Fear & Greed Index", source: "Internal", records: "2,800", quality: 99, version: "v1.0", updated: "Today" },
];

const FACTOR_CHART = [
  { factor: "Trend Strength", power: 88 },
  { factor: "Volatility", power: 84 },
  { factor: "Momentum", power: 78 },
  { factor: "Volume", power: 71 },
  { factor: "Sentiment", power: 69 },
  { factor: "Liquidity", power: 62 },
];

const RADAR_DATA = [
  { subject: "Accuracy", A: 84 },
  { subject: "Stability", A: 79 },
  { subject: "Speed", A: 91 },
  { subject: "Robustness", A: 76 },
  { subject: "Coverage", A: 88 },
  { subject: "Explainability", A: 72 },
];

const STRATEGY_IDEAS = [
  { id: "SI001", name: "EMA + Volume + ATR Filter", discovery: "AI discovered improved combination", expectedReturn: "+28%", expectedDD: "-8%", confidence: 86, status: "Ready to Backtest" },
  { id: "SI002", name: "Funding Rate Reversal System", discovery: "Extreme funding → mean reversion entry", expectedReturn: "+22%", expectedDD: "-6%", confidence: 79, status: "Validating" },
  { id: "SI003", name: "Regime-Adaptive Momentum", discovery: "Momentum adjusted by detected regime", expectedReturn: "+35%", expectedDD: "-11%", confidence: 74, status: "Research" },
  { id: "SI004", name: "Multi-Factor Ranking System", discovery: "5-factor combined signal scoring", expectedReturn: "+31%", expectedDD: "-9%", confidence: 82, status: "Ready to Backtest" },
];

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "#111", borderColor: "#333", color: "#fff", fontSize: 12 },
  itemStyle: { color: "#fff" },
};

// ── TABS ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "workspace", label: "Workspace" },
  { id: "agents", label: "AI Agents" },
  { id: "hypothesis", label: "Hypothesis" },
  { id: "experiments", label: "Experiments" },
  { id: "scanner", label: "Market Scanner" },
  { id: "factors", label: "Factor Research" },
  { id: "patterns", label: "Pattern Discovery" },
  { id: "regime", label: "Market Regime" },
  { id: "models", label: "AI Models" },
  { id: "strategy", label: "Strategy Discovery" },
  { id: "datasets", label: "Datasets" },
  { id: "reports", label: "Reports" },
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

function StatCard({
  title, value, sub, icon: Icon, iconColor,
}: { title: string; value: string | number; sub?: string; icon: React.ElementType; iconColor: string }) {
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "text-green-400 border-green-500/30",
    completed: "text-blue-400 border-blue-500/30",
    pending: "text-yellow-400 border-yellow-500/30",
    validated: "text-green-400 border-green-500/30",
    testing: "text-cyan-400 border-cyan-500/30",
    Running: "text-green-400 border-green-500/30",
    Idle: "text-muted-foreground border-border",
    Deployed: "text-green-400 border-green-500/30",
    Testing: "text-cyan-400 border-cyan-500/30",
    Research: "text-purple-400 border-purple-500/30",
  };
  return (
    <Badge variant="outline" className={`text-xs capitalize ${map[status] ?? "text-muted-foreground"}`}>
      {status}
    </Badge>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────

function DashboardSection() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Research Lab Dashboard" desc="Institutional quant research environment — AI discovery, hypothesis testing, and alpha generation." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Active Projects" value="24" sub="6 AI-driven" icon={FlaskConical} iconColor="text-purple-400" />
        <StatCard title="AI Discoveries" value="156" sub="Patterns found" icon={Lightbulb} iconColor="text-yellow-400" />
        <StatCard title="Experiments Running" value="8" sub="3 validating" icon={Activity} iconColor="text-cyan-400" />
        <StatCard title="Research Quality" value="94/100" sub="Alpha score" icon={Star} iconColor="text-orange-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Research Pipeline Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 flex-wrap">
              {[
                { label: "Data", count: 6, color: "bg-blue-500/20 border-blue-500/30 text-blue-400" },
                { label: "Discovery", count: 156, color: "bg-purple-500/20 border-purple-500/30 text-purple-400" },
                { label: "Hypothesis", count: 42, color: "bg-yellow-500/20 border-yellow-500/30 text-yellow-400" },
                { label: "Experiment", count: 18, color: "bg-cyan-500/20 border-cyan-500/30 text-cyan-400" },
                { label: "Validated", count: 11, color: "bg-green-500/20 border-green-500/30 text-green-400" },
                { label: "Strategy", count: 4, color: "bg-orange-500/20 border-orange-500/30 text-orange-400" },
              ].map((s, i) => (
                <div key={s.label} className="flex items-center gap-1">
                  <div className={`px-3 py-2 rounded-lg border text-center min-w-[80px] ${s.color}`}>
                    <div className="text-lg font-bold">{s.count}</div>
                    <div className="text-xs">{s.label}</div>
                  </div>
                  {i < 5 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2">
              <div className="text-xs text-muted-foreground font-medium mb-2">Active Projects</div>
              {PROJECTS.filter(p => p.status === "active").map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 bg-muted/20">
                  <div className="text-xs font-mono text-muted-foreground w-12 shrink-0">{p.id}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{p.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={p.progress} className="h-1 flex-1" />
                      <span className="text-xs text-muted-foreground shrink-0">{p.progress}%</span>
                    </div>
                  </div>
                  {p.score && <div className="text-xs font-bold text-green-400 shrink-0">{p.score}</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              AI Agents Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {AI_AGENTS.map((a) => (
              <div key={a.name} className={`p-2.5 rounded-lg border ${a.bg}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <a.icon className={`w-3.5 h-3.5 ${a.color}`} />
                    <span className="text-xs font-medium">{a.name}</span>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{a.task}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Discoveries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {DISCOVERIES.slice(0, 4).map((d) => (
              <div key={d.id} className="p-2 rounded-lg border border-border/50 bg-muted/20">
                <div className="flex items-center justify-between mb-0.5">
                  <Badge variant="outline" className="text-xs">{d.type}</Badge>
                  <span className="text-xs text-muted-foreground">{d.discovered}</span>
                </div>
                <p className="text-xs mt-1 leading-snug">{d.pattern}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Progress value={d.confidence} className="h-1 flex-1" />
                  <span className="text-xs text-muted-foreground">{d.confidence}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Discovery Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[
                    { name: "Price Pattern", value: 42, color: "#3b82f6" },
                    { name: "Market Pattern", value: 28, color: "#8b5cf6" },
                    { name: "AI Pattern", value: 31, color: "#06b6d4" },
                    { name: "Seasonal", value: 22, color: "#f59e0b" },
                    { name: "Regime", value: 33, color: "#22c55e" },
                  ]} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    dataKey="value" paddingAngle={2}>
                    {["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#22c55e"].map((c, i) => (
                      <Cell key={i} fill={c} />
                    ))}
                  </Pie>
                  <RTooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Research Output Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={RADAR_DATA}>
                  <PolarGrid stroke="#1f2937" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                  <Radar dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}/100`]} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── WORKSPACE ─────────────────────────────────────────────────────────────────

function WorkspaceSection() {
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader title="Research Workspace" desc="Create and manage research projects, experiments, models, and strategy ideas." />
        <Button size="sm" onClick={() => setShowNew(!showNew)} className="shrink-0">
          <Plus className="w-4 h-4 mr-1" /> New Project
        </Button>
      </div>

      {showNew && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">New Research Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Project Name</Label>
                <Input placeholder="e.g. Bitcoin Regime Analysis 2025" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Pattern Discovery", "Factor Research", "Strategy Development", "Model Research", "Market Analysis"].map(t => (
                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Research Objective</Label>
              <Textarea placeholder="Describe what you want to discover or prove..." rows={2} className="text-xs" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="text-xs">Create Project</Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowNew(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {PROJECTS.map((p) => (
          <div key={p.id} className="p-4 rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{p.id}</span>
                  <StatusBadge status={p.status} />
                </div>
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Owner: {p.owner} · Created: {p.created}</div>
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={p.progress} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground">{p.progress}%</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                {p.score && (
                  <>
                    <div className={`text-2xl font-bold ${p.score >= 90 ? "text-green-400" : p.score >= 75 ? "text-yellow-400" : "text-muted-foreground"}`}>{p.score}</div>
                    <div className="text-xs text-muted-foreground">Alpha Score</div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI AGENTS ─────────────────────────────────────────────────────────────────

function AgentsSection() {
  return (
    <div className="space-y-5">
      <SectionHeader title="AI Research Agents" desc="Five specialized agents collaborating to discover patterns, build models, and generate strategy ideas." />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {AI_AGENTS.map((a) => (
          <Card key={a.name}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm flex items-center gap-2 ${a.color}`}>
                <a.icon className="w-4 h-4" />
                {a.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={`p-2.5 rounded-lg border ${a.bg}`}>
                <div className="text-xs text-muted-foreground mb-1">Current Task</div>
                <p className="text-xs leading-snug">{a.task}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-muted/30 text-center">
                  <div className={`text-xl font-bold ${a.color}`}>{a.discoveries}</div>
                  <div className="text-xs text-muted-foreground">Discoveries</div>
                </div>
                <div className="p-2 rounded-lg bg-muted/30 text-center">
                  <div className={`text-xl font-bold ${a.color}`}>{a.accuracy}%</div>
                  <div className="text-xs text-muted-foreground">Accuracy</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <StatusBadge status={a.status} />
                <button className={`flex items-center gap-1 text-xs ${a.color}`}>
                  {a.status === "Running" ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                  {a.status === "Running" ? "Pause" : "Start"}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Agent Collaboration Pipeline</CardTitle>
          <CardDescription>How agents work together to produce research output</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { agent: "Market Agent", output: "Finds pattern", color: "bg-blue-500/20 border-blue-500/30 text-blue-400" },
              { agent: "Quant Agent", output: "Builds model", color: "bg-purple-500/20 border-purple-500/30 text-purple-400" },
              { agent: "Strategy Agent", output: "Creates rules", color: "bg-green-500/20 border-green-500/30 text-green-400" },
              { agent: "Risk Agent", output: "Validates safety", color: "bg-yellow-500/20 border-yellow-500/30 text-yellow-400" },
              { agent: "Data Agent", output: "Cleans features", color: "bg-cyan-500/20 border-cyan-500/30 text-cyan-400" },
            ].map((s, i) => (
              <div key={s.agent} className="flex items-center gap-2">
                <div className={`px-3 py-2 rounded-lg border text-center min-w-[100px] ${s.color}`}>
                  <div className="text-xs font-semibold">{s.agent}</div>
                  <div className="text-xs opacity-80 mt-0.5">{s.output}</div>
                </div>
                {i < 4 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── HYPOTHESIS ────────────────────────────────────────────────────────────────

function HypothesisSection() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader title="Hypothesis Engine" desc="Create and track research hypotheses — from idea to validated conclusion." />
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> New Hypothesis
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">New Research Hypothesis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Hypothesis Statement *</Label>
              <Textarea placeholder='e.g. "High volume breakouts perform better during high volatility regimes (ATR > 1.5x average)"' rows={2} className="text-xs" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Variables</Label>
                <Input placeholder="e.g. Volume, ATR, RSI" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expected Result</Label>
                <Input placeholder="e.g. +15% win rate" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data Period</Label>
                <Input placeholder="e.g. 2020–2025" className="h-8 text-xs" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="text-xs">Save Hypothesis</Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {HYPOTHESIS_LIST.map((h) => (
          <Card key={h.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-mono text-muted-foreground">{h.id}</span>
                    <StatusBadge status={h.status} />
                  </div>
                  <p className="text-sm font-medium leading-snug">"{h.idea}"</p>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                    <span><span className="text-foreground font-medium">Variables:</span> {h.vars}</span>
                    <span><span className="text-foreground font-medium">Expected:</span> {h.expected}</span>
                  </div>
                </div>
                {h.confidence && (
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-green-400">{h.confidence}%</div>
                    <div className="text-xs text-muted-foreground">Confidence</div>
                  </div>
                )}
              </div>
              {h.status === "validated" && (
                <div className="mt-3 p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Validated — hypothesis confirmed with statistical significance
                </div>
              )}
              {h.status === "testing" && (
                <div className="mt-3 p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                  Currently running controlled experiment...
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── EXPERIMENTS ───────────────────────────────────────────────────────────────

function ExperimentsSection({
  experiments, isLoading, strategies, creating,
  hypothesis, setHypothesis,
  strategyId, setStrategyId,
  testPeriod, setTestPeriod,
  notes, setNotes,
  onSubmit,
}: any) {
  const [showForm, setShowForm] = useState(false);
  const experimentList = experiments ?? [];
  const approved = experimentList.filter((e: any) => e.verdict === "approved").length;
  const rejected = experimentList.filter((e: any) => e.verdict === "rejected").length;
  const pending = experimentList.filter((e: any) => e.verdict === "pending").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader title="Experiment Builder" desc="Create controlled experiments to test hypotheses against historical data." />
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> New Experiment
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total Experiments" value={experimentList.length} sub="All time" icon={FlaskConical} iconColor="text-purple-400" />
        <StatCard title="Approved" value={approved} sub="Validated" icon={CheckCircle2} iconColor="text-green-400" />
        <StatCard title="Rejected" value={rejected} sub="Disproved" icon={XCircle} iconColor="text-red-400" />
        <StatCard title="Pending" value={pending} sub="Running" icon={Clock} iconColor="text-yellow-400" />
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">New Experiment</CardTitle>
            <CardDescription>Document a strategy improvement hypothesis to test</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Hypothesis *</Label>
              <Textarea value={hypothesis} onChange={(e: any) => setHypothesis(e.target.value)}
                placeholder="e.g. Adding an ATR volatility filter will reduce false breakout entries during low-volatility periods"
                rows={2} className="text-xs" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Strategy (optional)</Label>
                <Select value={strategyId} onValueChange={setStrategyId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select strategy" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">No specific strategy</SelectItem>
                    {(strategies ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)} className="text-xs">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Test Period</Label>
                <Input value={testPeriod} onChange={(e: any) => setTestPeriod(e.target.value)} placeholder="e.g. 2022–2024" className="h-8 text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={(e: any) => setNotes(e.target.value)} placeholder="Additional context or expected outcome" rows={2} className="text-xs" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="text-xs" onClick={() => { onSubmit(); setShowForm(false); }} disabled={creating || !hypothesis.trim()}>
                {creating ? "Saving…" : "Save Experiment"}
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Experiment Log</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : experimentList.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No experiments yet — add your first hypothesis above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {experimentList.map((e: any) => {
                const result = e.backtestResult as Record<string, unknown> | null;
                const stratName = (strategies ?? []).find((s: any) => s.id === e.strategyId)?.name;
                const verdict = e.verdict;
                return (
                  <div key={e.id} className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{e.hypothesis}</p>
                        {stratName && <p className="text-xs text-muted-foreground mt-0.5">Strategy: {stratName}</p>}
                        {e.testPeriod && <p className="text-xs text-muted-foreground">Period: {e.testPeriod}</p>}
                      </div>
                      {verdict === "approved" && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 shrink-0"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>}
                      {verdict === "rejected" && <Badge variant="destructive" className="shrink-0"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>}
                      {verdict === "pending" && <Badge variant="outline" className="shrink-0"><Clock className="w-3 h-3 mr-1" />Pending</Badge>}
                    </div>
                    {result && Object.keys(result).length > 0 && (
                      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                        {Object.entries(result).map(([k, v]) => (
                          <span key={k}><span className="capitalize">{k.replace(/_/g, " ")}</span>: <span className="font-medium text-foreground">{String(v)}</span></span>
                        ))}
                      </div>
                    )}
                    {e.notes && <p className="text-xs text-muted-foreground italic">{e.notes}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── MARKET SCANNER ────────────────────────────────────────────────────────────

function ScannerSection() {
  const [scanning, setScanning] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader title="Market Scanner" desc="Real-time AI scan of all assets — detecting breakout setups, pattern formations, and opportunities." />
        <Button size="sm" onClick={() => setScanning(!scanning)} className="gap-2">
          {scanning ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
          {scanning ? "Pause" : "Start Scan"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Assets Scanned" value="48" sub="Continuously" icon={Search} iconColor="text-blue-400" />
        <StatCard title="Opportunities" value="6" sub="High confidence" icon={Zap} iconColor="text-yellow-400" />
        <StatCard title="Patterns Found" value="14" sub="Last 24h" icon={Eye} iconColor="text-purple-400" />
        <StatCard title="Avg Confidence" value="74%" sub="Signal quality" icon={Star} iconColor="text-green-400" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-400" />
            Live Scan Results
            {scanning && <span className="ml-auto flex items-center gap-1 text-xs text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />Scanning</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {SCANNER_RESULTS.map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
                <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold">{r.asset}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">{r.signal}</span>
                    <Badge variant="outline" className="text-xs">{r.timeframe}</Badge>
                    <Badge variant="outline" className={`text-xs ${r.direction === "Long" ? "text-green-400 border-green-500/30" : r.direction === "Short" ? "text-red-400 border-red-500/30" : "text-muted-foreground"}`}>
                      {r.direction}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={r.probability} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground shrink-0">{r.probability}%</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-lg font-bold`} style={{ color: r.color }}>{r.probability}%</div>
                  <div className="text-xs text-muted-foreground">{r.strength}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Breakout Probabilities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SCANNER_RESULTS} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="#6b7280" fontSize={11} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="asset" stroke="#6b7280" fontSize={11} width={40} />
                <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, "Probability"]} />
                <ReferenceLine x={70} stroke="#22c55e" strokeDasharray="4 4" />
                <Bar dataKey="probability" radius={[0, 3, 3, 0]}
                  fill="#3b82f6"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── FACTOR RESEARCH ────────────────────────────────────────────────────────────

function FactorsSection() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Factor Research System" desc="Discover and measure hidden factors that predict market returns, risk, and quality." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Active Factors" value="6" sub="Being tracked" icon={Layers} iconColor="text-blue-400" />
        <StatCard title="Top Factor" value="Trend Strength" sub="88% predictive power" icon={Star} iconColor="text-yellow-400" />
        <StatCard title="Avg Stability" value="79%" sub="Across all factors" icon={Activity} iconColor="text-green-400" />
        <StatCard title="Combined Alpha" value="+14.2%" sub="Factor model yield" icon={TrendingUp} iconColor="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Factor Predictive Power</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={FACTOR_CHART} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="#6b7280" fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="factor" stroke="#6b7280" fontSize={11} width={95} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, "Predictive Power"]} />
                  <ReferenceLine x={70} stroke="#f59e0b" strokeDasharray="4 4" />
                  <Bar dataKey="power" radius={[0, 3, 3, 0]} fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Factor Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {FACTORS.map((f) => (
                <div key={f.name} className="p-2.5 rounded-lg border border-border/60 bg-muted/20">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{f.name}</span>
                      <Badge variant="outline" className="text-xs">{f.type}</Badge>
                      {!f.active && <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                    </div>
                    <span className={`text-sm font-bold ${f.impact.startsWith("+") ? "text-green-400" : "text-red-400"}`}>{f.impact}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Predictive</span>
                        <span>{f.predictivePower}%</span>
                      </div>
                      <Progress value={f.predictivePower} className="h-1" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Stability</span>
                        <span>{f.stability}%</span>
                      </div>
                      <Progress value={f.stability} className="h-1" />
                    </div>
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

// ── PATTERN DISCOVERY ─────────────────────────────────────────────────────────

function PatternsSection() {
  const [filter, setFilter] = useState("All");
  const types = ["All", "Price Pattern", "Market Pattern", "AI Pattern", "Seasonal", "Regime"];
  const filtered = filter === "All" ? DISCOVERIES : DISCOVERIES.filter(d => d.type === filter);

  return (
    <div className="space-y-5">
      <SectionHeader title="Pattern Discovery Engine" desc="AI continuously searches historical markets for hidden price, behavior, and strategy patterns." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Patterns Found" value="156" sub="All time" icon={Eye} iconColor="text-purple-400" />
        <StatCard title="High Confidence" value="48" sub="> 85% confidence" icon={Star} iconColor="text-yellow-400" />
        <StatCard title="Actionable" value="31" sub="Ready to test" icon={Zap} iconColor="text-green-400" />
        <StatCard title="Validated" value="19" sub="Confirmed true" icon={CheckCircle2} iconColor="text-cyan-400" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {types.map((t) => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${filter === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((d) => (
          <Card key={d.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{d.type}</Badge>
                  <Badge variant="outline" className={`text-xs ${d.impact === "High" ? "text-orange-400 border-orange-500/30" : "text-muted-foreground"}`}>{d.impact} Impact</Badge>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{d.discovered}</span>
              </div>
              <p className="text-sm font-medium leading-snug mb-2">"{d.pattern}"</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs text-muted-foreground">{d.market}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={d.confidence} className="h-1.5 w-24" />
                  <span className={`text-sm font-bold ${d.confidence >= 85 ? "text-green-400" : d.confidence >= 70 ? "text-yellow-400" : "text-muted-foreground"}`}>
                    {d.confidence}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── MARKET REGIME ─────────────────────────────────────────────────────────────

function RegimeSection() {
  const CURRENT_REGIME = "High Volatility Trend";

  return (
    <div className="space-y-5">
      <SectionHeader title="Market Regime Detection" desc="AI detects current market conditions to optimize strategy selection, risk, and position sizing." />

      <div className="p-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
          <div>
            <div className="text-xs text-muted-foreground">Current Detected Regime</div>
            <div className="text-2xl font-bold text-yellow-400">{CURRENT_REGIME}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-muted-foreground">Detection Confidence</div>
            <div className="text-2xl font-bold text-yellow-400">86%</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Recommendation: Reduce position sizes by 20%, prefer momentum strategies, increase stop distances.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { regime: "Bull Market", active: false, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", desc: "Strong uptrend + low vol" },
          { regime: "Bear Market", active: false, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", desc: "Downtrend + fear" },
          { regime: "Sideways", active: false, color: "text-muted-foreground", bg: "bg-muted/20 border-border", desc: "Range-bound + low vol" },
          { regime: "High Volatility", active: true, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", desc: "Active — uncertainty high" },
        ].map((r) => (
          <div key={r.regime} className={`p-3 rounded-lg border ${r.bg} ${r.active ? "ring-1 ring-yellow-500/50" : ""}`}>
            <div className={`text-sm font-semibold ${r.color}`}>{r.regime}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{r.desc}</div>
            {r.active && <Badge className="mt-2 bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Current</Badge>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Regime History — Last 6 Months</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={REGIMES}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="period" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`]} />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Bar dataKey="returns" name="Returns" radius={[3, 3, 0, 0]}
                    fill="#22c55e"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Regime → Strategy Performance</CardTitle>
            <CardDescription>Which strategies work best in each regime</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { regime: "Bull Market", best: "EMA Crossover", winRate: 82, avoid: "Mean Reversion", color: "text-green-400" },
                { regime: "Bear Market", best: "Short Breakout", winRate: 74, avoid: "Trend Following", color: "text-red-400" },
                { regime: "Sideways", best: "Mean Reversion", winRate: 77, avoid: "Momentum", color: "text-blue-400" },
                { regime: "High Volatility", best: "ATR-Scaled Entries", winRate: 68, avoid: "Tight Stops", color: "text-yellow-400" },
                { regime: "Crisis", best: "Cash / Hedged", winRate: 91, avoid: "Leveraged Long", color: "text-orange-400" },
              ].map((r) => (
                <div key={r.regime} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 bg-muted/20">
                  <div className={`text-xs font-semibold w-24 shrink-0 ${r.color}`}>{r.regime}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs"><span className="text-green-400">✓ Best:</span> {r.best}</div>
                    <div className="text-xs text-muted-foreground"><span className="text-red-400">✗ Avoid:</span> {r.avoid}</div>
                  </div>
                  <div className={`text-sm font-bold ${r.color} shrink-0`}>{r.winRate}%</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── AI MODELS ─────────────────────────────────────────────────────────────────

function ModelsSection() {
  return (
    <div className="space-y-5">
      <SectionHeader title="AI Model Research" desc="Track, test, and compare AI prediction models — accuracy, stability, overfitting, and deployment status." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total Models" value={MODELS.length} sub="All versions" icon={Brain} iconColor="text-purple-400" />
        <StatCard title="Deployed" value={MODELS.filter(m => m.status === "Deployed").length} sub="In production" icon={CheckCircle2} iconColor="text-green-400" />
        <StatCard title="Best Accuracy" value="88%" sub="Regime Detector v1" icon={Star} iconColor="text-yellow-400" />
        <StatCard title="Avg Stability" value="75%" sub="Across all models" icon={Activity} iconColor="text-blue-400" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Model Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left pb-2 font-medium">Model</th>
                  <th className="text-left pb-2 font-medium">Type</th>
                  <th className="text-right pb-2 font-medium">Accuracy</th>
                  <th className="text-right pb-2 font-medium">Stability</th>
                  <th className="text-right pb-2 font-medium">Overfitting</th>
                  <th className="text-right pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {MODELS.map((m) => (
                  <tr key={m.name} className="hover:bg-muted/20">
                    <td className="py-3 font-medium text-xs">{m.name}</td>
                    <td className="py-3 text-xs text-muted-foreground">{m.type}</td>
                    <td className="py-3 text-right">
                      <span className={`text-xs font-bold ${m.accuracy >= 85 ? "text-green-400" : m.accuracy >= 75 ? "text-yellow-400" : "text-red-400"}`}>{m.accuracy}%</span>
                    </td>
                    <td className="py-3 text-right text-xs">{m.stability}%</td>
                    <td className="py-3 text-right">
                      <span className={`text-xs ${m.overfitting === "Low" ? "text-green-400" : m.overfitting === "Medium" ? "text-yellow-400" : "text-red-400"}`}>{m.overfitting}</span>
                    </td>
                    <td className="py-3 text-right"><StatusBadge status={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Model Accuracy Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MODELS}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={9} angle={-15} textAnchor="end" height={40} />
                  <YAxis stroke="#6b7280" fontSize={11} domain={[60, 95]} tickFormatter={(v) => `${v}%`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`]} />
                  <Bar dataKey="accuracy" name="Accuracy" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="stability" name="Stability" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Validation Methods</CardTitle>
            <CardDescription>Overfitting prevention techniques applied</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { method: "Walk-Forward Testing", applied: true, desc: "Out-of-sample validation on rolling windows" },
              { method: "Out-of-Sample Testing", applied: true, desc: "Final test on unseen 20% data holdout" },
              { method: "Monte Carlo Simulation", applied: true, desc: "1,000 random path simulations per model" },
              { method: "Data Leakage Check", applied: true, desc: "Automated future-data contamination scan" },
              { method: "Curve-Fitting Detection", applied: false, desc: "Coming in v2 — Kolmogorov-Smirnov test" },
            ].map((v, i) => (
              <div key={i} className="flex items-start gap-2">
                {v.applied
                  ? <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  : <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
                <div>
                  <div className="text-xs font-medium">{v.method}</div>
                  <div className="text-xs text-muted-foreground">{v.desc}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── STRATEGY DISCOVERY ────────────────────────────────────────────────────────

function StrategyDiscoverySection() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Strategy Discovery Engine" desc="AI automatically finds and proposes new strategy ideas from market data and pattern analysis." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Ideas Generated" value="47" sub="All time" icon={Lightbulb} iconColor="text-yellow-400" />
        <StatCard title="Ready to Backtest" value="4" sub="High quality" icon={PlayCircle} iconColor="text-green-400" />
        <StatCard title="Avg Expected Return" value="+29%" sub="Projected" icon={TrendingUp} iconColor="text-blue-400" />
        <StatCard title="AI Confidence" value="80%" sub="Avg score" icon={Brain} iconColor="text-cyan-400" />
      </div>

      <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/10 text-xs text-blue-400 flex items-start gap-2">
        <Cpu className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold">Discovery Pipeline Active: </span>
          Market Data → Pattern Detection → Rule Creation → Backtest → Risk Check → Strategy Proposal
        </div>
      </div>

      <div className="space-y-3">
        {STRATEGY_IDEAS.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{s.id}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="text-sm font-semibold mb-1">{s.name}</div>
                  <p className="text-xs text-muted-foreground">{s.discovery}</p>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs">
                    <span className="text-green-400">Expected Return: <strong>{s.expectedReturn}</strong></span>
                    <span className="text-red-400">Max Drawdown: <strong>{s.expectedDD}</strong></span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-2xl font-bold ${s.confidence >= 85 ? "text-green-400" : s.confidence >= 75 ? "text-yellow-400" : "text-muted-foreground"}`}>{s.confidence}%</div>
                  <div className="text-xs text-muted-foreground">AI Confidence</div>
                  {s.status === "Ready to Backtest" && (
                    <Button size="sm" variant="outline" className="mt-2 h-7 text-xs">
                      <PlayCircle className="w-3 h-3 mr-1" /> Backtest
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── DATASETS ──────────────────────────────────────────────────────────────────

function DatasetsSection() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Dataset Manager" desc="Research data lake — historical prices, indicators, sentiment, on-chain metrics, and alternative data." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total Datasets" value={DATASETS.length} sub="Active sources" icon={Database} iconColor="text-blue-400" />
        <StatCard title="Total Records" value="5.3M" sub="Across all sets" icon={Layers} iconColor="text-purple-400" />
        <StatCard title="Avg Data Quality" value="94%" sub="Quality score" icon={Star} iconColor="text-green-400" />
        <StatCard title="Last Updated" value="Today" sub="Auto-sync enabled" icon={RefreshCw} iconColor="text-cyan-400" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Data Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {DATASETS.map((d, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
                <Database className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{d.name}</span>
                    <Badge variant="outline" className="text-xs">{d.source}</Badge>
                    <Badge variant="outline" className="text-xs text-muted-foreground">{d.version}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <Progress value={d.quality} className="h-1.5 w-24" />
                      <span className={`text-xs ${d.quality >= 95 ? "text-green-400" : d.quality >= 85 ? "text-yellow-400" : "text-orange-400"}`}>{d.quality}% quality</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{d.records} records</span>
                    <span className="text-xs text-muted-foreground">Updated: {d.updated}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Data Quality Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={DATASETS}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="source" stroke="#6b7280" fontSize={10} />
                  <YAxis stroke="#6b7280" fontSize={11} domain={[80, 100]} tickFormatter={(v) => `${v}%`} />
                  <RTooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, "Quality"]} />
                  <Bar dataKey="quality" fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Data Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { cat: "Historical OHLCV", items: ["BTC", "ETH", "SOL", "BNB", "XRP", "+43 more"], icon: BarChart2, color: "text-blue-400" },
                { cat: "Derivative Data", items: ["Funding Rates", "Open Interest", "Liquidations"], icon: Activity, color: "text-purple-400" },
                { cat: "On-Chain Metrics", items: ["UTXO Age", "Whale Movements", "Exchange Flows"], icon: Globe, color: "text-cyan-400" },
                { cat: "Alternative Data", items: ["News Sentiment", "Social Volume", "Fear & Greed"], icon: Brain, color: "text-yellow-400" },
              ].map((c) => (
                <div key={c.cat} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20">
                  <c.icon className={`w-4 h-4 mt-0.5 shrink-0 ${c.color}`} />
                  <div>
                    <div className="text-xs font-medium">{c.cat}</div>
                    <div className="text-xs text-muted-foreground">{c.items.join(" · ")}</div>
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

// ── REPORTS ───────────────────────────────────────────────────────────────────

function ReportsSection() {
  const reportTypes = [
    { name: "Strategy Research Report", date: "Jun 19, 2025", status: "Ready", icon: Target, color: "text-blue-400", pages: 14 },
    { name: "Market Intelligence Report", date: "Jun 16, 2025", status: "Ready", icon: Globe, color: "text-green-400", pages: 9 },
    { name: "AI Model Performance Report", date: "Jun 10, 2025", status: "Ready", icon: Brain, color: "text-purple-400", pages: 11 },
    { name: "Experiment Results Report", date: "Jun 7, 2025", status: "Ready", icon: FlaskConical, color: "text-cyan-400", pages: 7 },
    { name: "Factor Research Digest", date: "Jun 1, 2025", status: "Ready", icon: Layers, color: "text-orange-400", pages: 8 },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader title="Research Reports" desc="Automated research reports generated from experiments, models, patterns, and AI discoveries." />

      <div className="space-y-2">
        {reportTypes.map((r, i) => (
          <div key={i} className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors cursor-pointer group">
            <r.icon className={`w-5 h-5 ${r.color} shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground">{r.date} · {r.pages} pages</div>
            </div>
            <Badge variant="outline" className="text-xs text-green-400 border-green-500/30 shrink-0">{r.status}</Badge>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Report Contents (All Reports Include)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              "Methodology", "Data Sources", "Results & Metrics", "Conclusion",
              "Confidence Level", "Validation Tests", "AI Analysis", "Recommendations",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function Research() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Experiment state (kept for Experiments tab)
  const [hypothesis, setHypothesis] = useState("");
  const [strategyId, setStrategyId] = useState<string>("");
  const [testPeriod, setTestPeriod] = useState("");
  const [notes, setNotes] = useState("");

  const { data: experiments, isLoading } = useListExperiments({ query: { queryKey: getListExperimentsQueryKey() } });
  const { data: strategies } = useListStrategies({ query: { queryKey: getListStrategiesQueryKey() } });

  const { mutate: createExperiment, isPending: creating } = useCreateExperiment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExperimentsQueryKey() });
        setHypothesis("");
        setStrategyId("");
        setTestPeriod("");
        setNotes("");
      },
    },
  });

  const handleSubmit = () => {
    if (!hypothesis.trim()) return;
    createExperiment({
      data: {
        hypothesis,
        strategyId: strategyId && strategyId !== "none" ? parseInt(strategyId) : undefined,
        testPeriod: testPeriod || undefined,
        notes: notes || undefined,
        verdict: "pending",
      },
    });
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-5 rounded-xl border border-border/50 bg-gradient-to-r from-card to-card/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-5 h-5 text-purple-400" />
            <h1 className="text-2xl font-bold tracking-tight">Research Lab</h1>
            <Badge variant="outline" className="text-xs text-purple-400 border-purple-500/30 ml-1">Institutional Quant</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            AI-powered quantitative research — pattern discovery, hypothesis testing, model building, and alpha generation.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">5 Agents Active</span>
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
      {activeTab === "dashboard" && <DashboardSection />}
      {activeTab === "workspace" && <WorkspaceSection />}
      {activeTab === "agents" && <AgentsSection />}
      {activeTab === "hypothesis" && <HypothesisSection />}
      {activeTab === "experiments" && (
        <ExperimentsSection
          experiments={experiments}
          isLoading={isLoading}
          strategies={strategies}
          creating={creating}
          hypothesis={hypothesis} setHypothesis={setHypothesis}
          strategyId={strategyId} setStrategyId={setStrategyId}
          testPeriod={testPeriod} setTestPeriod={setTestPeriod}
          notes={notes} setNotes={setNotes}
          onSubmit={handleSubmit}
        />
      )}
      {activeTab === "scanner" && <ScannerSection />}
      {activeTab === "factors" && <FactorsSection />}
      {activeTab === "patterns" && <PatternsSection />}
      {activeTab === "regime" && <RegimeSection />}
      {activeTab === "models" && <ModelsSection />}
      {activeTab === "strategy" && <StrategyDiscoverySection />}
      {activeTab === "datasets" && <DatasetsSection />}
      {activeTab === "reports" && <ReportsSection />}
    </div>
  );
}
