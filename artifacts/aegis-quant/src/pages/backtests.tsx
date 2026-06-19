import { useState, useMemo } from "react";
import {
  useGetBacktestDashboard,
  useListBacktests,
  useCreateBacktest,
  useGetBacktestTrades,
  useGetBacktestEquityCurve,
  useRunMonteCarlo,
  useRunWalkForward,
  useRunBacktestOptimization,
  useGetBacktestAiReview,
  useCompareBacktests,
  useListStrategies,
  getGetBacktestDashboardQueryKey,
  getListBacktestsQueryKey,
  getGetBacktestTradesQueryKey,
  getGetBacktestEquityCurveQueryKey,
  getGetBacktestAiReviewQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useQueryClient } from "@tanstack/react-query";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import {
  FlaskConical, Play, TrendingUp, TrendingDown, Target, BarChart2,
  Brain, Shuffle, SlidersHorizontal, History, GitCompare, ArrowUpRight,
  ArrowDownRight, Shield, Zap, Star, AlertTriangle, CheckCircle2,
  ChevronRight, Trophy, Activity, Clock, Layers, RefreshCw, Download,
} from "lucide-react";
import { formatCurrency, formatPercent, formatNumber, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────
const StatCard = ({
  title, value, sub, icon: Icon, color = "primary", trend,
}: { title: string; value: string | number; sub?: string; icon: any; color?: string; trend?: "up" | "down" | "neutral" }) => (
  <Card>
    <CardContent className="pt-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold font-mono">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={cn("p-2 rounded-lg", `bg-${color}/10`)}>
          <Icon className={cn("w-5 h-5", `text-${color}`)} />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          {trend === "up" ? <ArrowUpRight className="w-3 h-3 text-green-500" /> : trend === "down" ? <ArrowDownRight className="w-3 h-3 text-red-500" /> : null}
        </div>
      )}
    </CardContent>
  </Card>
);

const GradeColors: Record<string, string> = {
  "A+": "text-green-500 border-green-500",
  "A": "text-green-400 border-green-400",
  "B+": "text-blue-500 border-blue-500",
  "B": "text-blue-400 border-blue-400",
  "C": "text-yellow-500 border-yellow-500",
  "D": "text-red-500 border-red-500",
};

const RiskBadge = ({ risk }: { risk: string }) => (
  <Badge variant={risk === "low" ? "outline" : risk === "medium" ? "secondary" : "destructive"}
    className={risk === "low" ? "text-green-500 border-green-500" : ""}>
    {risk === "low" ? "Low Risk" : risk === "medium" ? "Moderate Risk" : "High Risk"}
  </Badge>
);

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "AVAXUSDT", "DOGEUSDT"];
const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Backtests() {
  const [tab, setTab] = useState("dashboard");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareResult, setCompareResult] = useState<any>(null);
  const [monteResult, setMonteResult] = useState<any>(null);
  const [walkResult, setWalkResult] = useState<any>(null);
  const [optResult, setOptResult] = useState<any>(null);
  const [runLoading, setRunLoading] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    strategyId: "", symbol: "BTCUSDT", timeframe: "1h",
    startDate: "2023-01-01", endDate: "2024-12-31",
    capital: "10000", fees: "0.1", slippage: "0.05",
  });

  const qc = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: dashboard, isLoading: dashLoading } = useGetBacktestDashboard({
    query: { queryKey: getGetBacktestDashboardQueryKey() },
  });
  const { data: backtests, isLoading: listLoading } = useListBacktests({
    query: { queryKey: getListBacktestsQueryKey() },
  });
  const { data: strategies } = useListStrategies();
  const { data: trades, isLoading: tradesLoading } = useGetBacktestTrades(
    selectedId ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!selectedId, queryKey: selectedId ? getGetBacktestTradesQueryKey(selectedId) : [] as any } }
  );
  const { data: equityCurve, isLoading: curveLoading } = useGetBacktestEquityCurve(
    selectedId ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!selectedId, queryKey: selectedId ? getGetBacktestEquityCurveQueryKey(selectedId) : [] as any } }
  );
  const { data: aiReview, isLoading: aiLoading } = useGetBacktestAiReview(
    selectedId ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!selectedId && tab === "ai-review", queryKey: selectedId ? getGetBacktestAiReviewQueryKey(selectedId) : [] as any } }
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const { mutate: createBacktest, isPending: creating } = useCreateBacktest({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBacktestsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetBacktestDashboardQueryKey() });
        setTab("history");
      },
    },
  });
  const { mutate: runMonteCarlo } = useRunMonteCarlo({
    mutation: {
      onSuccess: (d) => setMonteResult(d),
    },
  });
  const { mutate: runWalkForward } = useRunWalkForward({
    mutation: {
      onSuccess: (d) => setWalkResult(d),
    },
  });
  const { mutate: runOptimize } = useRunBacktestOptimization({
    mutation: {
      onSuccess: (d) => setOptResult(d),
    },
  });
  const { mutate: compareBacktests, isPending: comparing } = useCompareBacktests({
    mutation: {
      onSuccess: (d) => setCompareResult(d),
    },
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedBt = useMemo(
    () => backtests?.find(b => b.id === selectedId) ?? null,
    [backtests, selectedId]
  );

  const winTrades = trades?.filter(t => t.result === "win") ?? [];
  const lossTrades = trades?.filter(t => t.result === "loss") ?? [];
  const avgWin = winTrades.length ? winTrades.reduce((s, t) => s + (t.profitLoss ?? 0), 0) / winTrades.length : 0;
  const avgLoss = lossTrades.length ? Math.abs(lossTrades.reduce((s, t) => s + (t.profitLoss ?? 0), 0) / lossTrades.length) : 0;
  const bestTrade = trades?.reduce((b, t) => ((t.profitLoss ?? 0) > (b?.profitLoss ?? -Infinity) ? t : b), null as any) ?? null;
  const worstTrade = trades?.reduce((b, t) => ((t.profitLoss ?? 0) < (b?.profitLoss ?? Infinity) ? t : b), null as any) ?? null;

  const handleCreate = () => {
    if (!form.strategyId) return;
    createBacktest({
      data: {
        strategyId: parseInt(form.strategyId),
        startDate: form.startDate,
        endDate: form.endDate,
        symbol: form.symbol,
        timeframe: form.timeframe,
        capital: parseFloat(form.capital),
        fees: parseFloat(form.fees),
        slippage: parseFloat(form.slippage),
      },
    });
  };

  const selectForAnalysis = (id: number) => {
    setSelectedId(id);
    setMonteResult(null);
    setWalkResult(null);
    setOptResult(null);
  };

  const toggleCompare = (id: number) => {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(0, 5)
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-primary" />
            Backtesting Engine
          </h1>
          <p className="text-sm text-muted-foreground">Professional quantitative research, historical simulation & strategy validation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button size="sm" onClick={() => setTab("create")}>
            <Play className="w-4 h-4 mr-2" />
            Run Simulation
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-9 w-full">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="walk-forward">Walk Fwd</TabsTrigger>
          <TabsTrigger value="monte-carlo">Monte Carlo</TabsTrigger>
          <TabsTrigger value="optimize">Optimize</TabsTrigger>
          <TabsTrigger value="ai-review">AI Review</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ── TAB: Dashboard ───────────────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-6">
          {dashLoading ? (
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="Total Backtests Run" value={dashboard?.totalRuns ?? 0} icon={FlaskConical} sub="Historical simulations" />
                <StatCard title="Research Score" value={`${dashboard?.researchScore ?? 0}/100`} icon={Star} color="yellow-500" sub="AI-calculated reliability" />
                <StatCard title="Avg Win Rate" value={formatPercent(dashboard?.avgWinRate ?? 0)} icon={Target} color="green-500" sub="Across all backtests" />
                <StatCard title="Avg Return" value={formatPercent(dashboard?.avgReturn ?? 0)} icon={TrendingUp} color="blue-500" sub="Mean backtest return" />
                <StatCard title="Best Return" value={formatPercent(dashboard?.bestReturn ?? 0)} icon={Trophy} color="amber-500" sub="Top performing run" />
                <StatCard title="Avg Drawdown" value={formatPercent(dashboard?.avgDrawdown ?? 0)} icon={TrendingDown} color="red-500" sub="Average max DD" />
                <StatCard title="Avg Sharpe" value={formatNumber(dashboard?.avgSharpe ?? 0)} icon={Activity} sub="Risk-adjusted ratio" />
                <StatCard title="Successful Runs" value={`${dashboard?.successfulRuns ?? 0} / ${dashboard?.totalRuns ?? 0}`} icon={CheckCircle2} color="green-500" sub="Profitable backtests" />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Backtests by Month</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(dashboard?.runsByMonth?.length ?? 0) > 0 ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={dashboard?.runsByMonth ?? []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                        No backtest history yet. Run your first simulation.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Performance Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(dashboard?.performanceDistribution?.length ?? 0) > 0 ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={dashboard?.performanceDistribution ?? []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                        Run backtests to see return distribution.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {dashboard?.bestStrategy && (
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      Best Performing Backtest
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-6">
                    {(() => { const bs = dashboard.bestStrategy as any; return (<>
                    <div>
                      <p className="font-semibold">{bs.name}</p>
                      <p className="text-xs text-muted-foreground">Strategy #{bs.id}</p>
                    </div>
                    <Separator orientation="vertical" className="h-10" />
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-500 font-mono">{formatPercent(bs.return)}</p>
                      <p className="text-xs text-muted-foreground">Total Return</p>
                    </div>
                    <Separator orientation="vertical" className="h-10" />
                    <div className="text-center">
                      <p className="text-2xl font-bold font-mono">{formatPercent(bs.winRate)}</p>
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                    </div>
                    <Button variant="outline" size="sm" className="ml-auto"
                      onClick={() => { selectForAnalysis(bs.id); setTab("results"); }}>
                      View Results <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                    </>); })()}
                  </CardContent>
                </Card>
              )}

              {(dashboard?.totalRuns ?? 0) === 0 && (
                <Card className="border-dashed">
                  <CardContent className="py-16 text-center space-y-4">
                    <FlaskConical className="w-12 h-12 text-muted-foreground mx-auto" />
                    <div>
                      <p className="font-semibold">No backtests yet</p>
                      <p className="text-sm text-muted-foreground">Run your first historical simulation to validate a strategy.</p>
                    </div>
                    <Button onClick={() => setTab("create")}>
                      <Play className="w-4 h-4 mr-2" />
                      Run First Simulation
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── TAB: Create ──────────────────────────────────────────────────────── */}
        <TabsContent value="create" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                New Backtest Simulation
              </CardTitle>
              <CardDescription>Configure the historical simulation parameters and run the backtest engine.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Strategy</Label>
                    <Select value={form.strategyId} onValueChange={v => setForm(f => ({ ...f, strategyId: v }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select a strategy..." />
                      </SelectTrigger>
                      <SelectContent>
                        {strategies?.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name} {s.active ? "● Active" : "○ Inactive"}
                          </SelectItem>
                        ))}
                        {(!strategies || strategies.length === 0) && (
                          <SelectItem value="0" disabled>No strategies found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Symbol</Label>
                      <Select value={form.symbol} onValueChange={v => setForm(f => ({ ...f, symbol: v }))}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SYMBOLS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Timeframe</Label>
                      <Select value={form.timeframe} onValueChange={v => setForm(f => ({ ...f, timeframe: v }))}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEFRAMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Start Date</Label>
                      <Input type="date" className="mt-1 font-mono text-sm"
                        value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">End Date</Label>
                      <Input type="date" className="mt-1 font-mono text-sm"
                        value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Right Column — Execution Settings */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Starting Capital ($)</Label>
                    <Input type="number" className="mt-1 font-mono"
                      value={form.capital} onChange={e => setForm(f => ({ ...f, capital: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Trading Fees (%)</Label>
                    <Input type="number" step="0.01" className="mt-1 font-mono"
                      value={form.fees} onChange={e => setForm(f => ({ ...f, fees: e.target.value }))} />
                    <p className="text-xs text-muted-foreground mt-1">Realistic commission per trade (e.g. 0.1 = 0.1%)</p>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Slippage (%)</Label>
                    <Input type="number" step="0.01" className="mt-1 font-mono"
                      value={form.slippage} onChange={e => setForm(f => ({ ...f, slippage: e.target.value }))} />
                    <p className="text-xs text-muted-foreground mt-1">Execution price difference from signal price</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Simulation overview */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold">Simulation Overview</p>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Asset: </span><span className="font-mono font-medium">{form.symbol}</span></div>
                  <div><span className="text-muted-foreground">Timeframe: </span><span className="font-mono font-medium">{form.timeframe}</span></div>
                  <div><span className="text-muted-foreground">Capital: </span><span className="font-mono font-medium">${parseFloat(form.capital || "0").toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Period: </span><span className="font-mono font-medium">
                    {form.startDate && form.endDate ? `${Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30))}mo` : "—"}
                  </span></div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  <Shield className="w-3 h-3" />
                  Execution simulator applies realistic spread, slippage, and fee drag to all trades
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setTab("dashboard")}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating || !form.strategyId}>
                  {creating ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Running Simulation...</> : <><Play className="w-4 h-4 mr-2" />Run Backtest</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Engine Info */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Activity, title: "Candle-by-Candle Engine", desc: "Processes each historical candle individually — calculates indicators, evaluates rules, simulates execution." },
              { icon: Shield, title: "Realistic Execution Model", desc: "Applies spread, slippage, fees, latency, and partial fill simulation for accurate P&L results." },
              { icon: Layers, title: "Market Condition Detection", desc: "Analyzes trending, ranging, high-volatility and low-volatility regimes separately." },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="bg-muted/20">
                <CardContent className="pt-5 space-y-2">
                  <Icon className="w-5 h-5 text-primary" />
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── TAB: Results ─────────────────────────────────────────────────────── */}
        <TabsContent value="results" className="space-y-4">
          {/* Selector */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Select Backtest:</Label>
                <Select value={selectedId ? String(selectedId) : ""} onValueChange={v => selectForAnalysis(parseInt(v))}>
                  <SelectTrigger className="max-w-sm">
                    <SelectValue placeholder="Choose a backtest to analyze..." />
                  </SelectTrigger>
                  <SelectContent>
                    {backtests?.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        #{b.id} — {b.strategyName ?? `Strategy ${b.strategyId}`} ({b.symbol ?? "—"}) {new Date(b.startDate).getFullYear()}–{new Date(b.endDate).getFullYear()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBt && (
                  <div className="flex items-center gap-2 ml-auto text-sm">
                    <Badge variant="outline" className="text-green-500 border-green-500">{formatPercent(selectedBt.totalReturn ?? 0)} Return</Badge>
                    <Badge variant="outline">{formatPercent(selectedBt.winRate)} WR</Badge>
                    <Badge variant="destructive" className="bg-red-500/10 text-red-500">{formatPercent(selectedBt.drawdown)} DD</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {!selectedId ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground">Select a backtest above to view detailed results.</CardContent></Card>
          ) : (
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="equity">Equity Curve</TabsTrigger>
                <TabsTrigger value="trades">Trade List</TabsTrigger>
                <TabsTrigger value="metrics">Metrics</TabsTrigger>
              </TabsList>

              {/* Overview */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <StatCard title="Total Return" value={formatPercent(selectedBt?.totalReturn ?? 0)} icon={TrendingUp} color={((selectedBt?.totalReturn ?? 0) > 0) ? "green-500" : "red-500"} />
                  <StatCard title="Win Rate" value={formatPercent(selectedBt?.winRate ?? 0)} icon={Target} color="blue-500" />
                  <StatCard title="Max Drawdown" value={formatPercent(selectedBt?.drawdown ?? 0)} icon={TrendingDown} color="red-500" />
                  <StatCard title="Profit Factor" value={formatNumber(selectedBt?.profitFactor ?? 0)} icon={BarChart2} color="purple-500" />
                  <StatCard title="Sharpe Ratio" value={formatNumber(selectedBt?.sharpeRatio ?? 0)} icon={Activity} sub="Risk-adjusted returns" />
                  <StatCard title="Total Trades" value={selectedBt?.totalTrades ?? 0} icon={Layers} sub={`${selectedBt?.wins ?? 0}W / ${selectedBt?.losses ?? 0}L`} />
                  <StatCard title="Avg Win" value={formatCurrency(avgWin)} icon={ArrowUpRight} color="green-500" />
                  <StatCard title="Avg Loss" value={formatCurrency(avgLoss)} icon={ArrowDownRight} color="red-500" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Portfolio Summary</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { label: "Strategy", value: selectedBt?.strategyName ?? `Strategy ${selectedBt?.strategyId}` },
                        { label: "Symbol", value: selectedBt?.symbol ?? "—" },
                        { label: "Timeframe", value: selectedBt?.timeframe ?? "—" },
                        { label: "Test Period", value: `${formatDate(selectedBt?.startDate ?? "")} → ${formatDate(selectedBt?.endDate ?? "")}` },
                        { label: "Total Trades", value: selectedBt?.totalTrades?.toString() ?? "0" },
                        { label: "Winners", value: selectedBt?.wins?.toString() ?? "0" },
                        { label: "Losers", value: selectedBt?.losses?.toString() ?? "0" },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium font-mono">{value}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-sm">Trade Distribution</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-green-500">Winners</span>
                            <span className="font-mono">{selectedBt?.wins} ({formatPercent(selectedBt?.winRate ?? 0)})</span>
                          </div>
                          <Progress value={selectedBt?.winRate ?? 0} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-red-500">Losers</span>
                            <span className="font-mono">{selectedBt?.losses} ({formatPercent(100 - (selectedBt?.winRate ?? 0))})</span>
                          </div>
                          <Progress value={100 - (selectedBt?.winRate ?? 0)} className="h-2 [&>div]:bg-red-500" />
                        </div>
                        <Separator />
                        {bestTrade && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Best Trade</span>
                            <span className="font-mono text-green-500">{formatCurrency(bestTrade.profitLoss ?? 0)} ({formatPercent(bestTrade.profitLossPct ?? 0)})</span>
                          </div>
                        )}
                        {worstTrade && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Worst Trade</span>
                            <span className="font-mono text-red-500">{formatCurrency(worstTrade.profitLoss ?? 0)} ({formatPercent(worstTrade.profitLossPct ?? 0)})</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Avg Win</span>
                          <span className="font-mono text-green-500">{formatCurrency(avgWin)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Avg Loss</span>
                          <span className="font-mono text-red-500">{formatCurrency(avgLoss)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Expectancy</span>
                          <span className={cn("font-mono", (avgWin * (selectedBt?.winRate ?? 0) / 100 - avgLoss * (1 - (selectedBt?.winRate ?? 0) / 100)) > 0 ? "text-green-500" : "text-red-500")}>
                            {formatCurrency(avgWin * (selectedBt?.winRate ?? 0) / 100 - avgLoss * (1 - (selectedBt?.winRate ?? 0) / 100))} / trade
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Equity Curve */}
              <TabsContent value="equity" className="space-y-4">
                {curveLoading ? <Skeleton className="h-96 w-full" /> : (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Portfolio Equity Curve vs Benchmark (BTC Buy & Hold)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                          <AreaChart data={equityCurve ?? []}>
                            <defs>
                              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v: any) => formatCurrency(v)} />
                            <Legend />
                            <Area type="monotone" dataKey="equity" name="Strategy" stroke="hsl(var(--primary))" fill="url(#eqGrad)" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="peak" name="Peak" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" strokeWidth={1} dot={false} />
                            <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Drawdown Chart</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={160}>
                          <AreaChart data={equityCurve ?? []}>
                            <defs>
                              <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)}%`} />
                            <Area type="monotone" dataKey="drawdown" name="Drawdown" stroke="#ef4444" fill="url(#ddGrad)" strokeWidth={2} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              {/* Trade List */}
              <TabsContent value="trades">
                {tradesLoading ? <Skeleton className="h-64 w-full" /> : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Simulated Trades ({trades?.length ?? 0})</CardTitle>
                      <CardDescription>Every trade in the backtest simulation with full execution detail</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border max-h-[500px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Symbol</TableHead>
                              <TableHead>Side</TableHead>
                              <TableHead>Entry</TableHead>
                              <TableHead>Exit</TableHead>
                              <TableHead className="text-right">Size</TableHead>
                              <TableHead className="text-right">P&L</TableHead>
                              <TableHead className="text-right">P&L %</TableHead>
                              <TableHead className="text-right">Duration</TableHead>
                              <TableHead>Result</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {trades?.map(t => (
                              <TableRow key={t.id}>
                                <TableCell className="text-xs text-muted-foreground">{t.id}</TableCell>
                                <TableCell className="font-mono text-xs">{t.symbol}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={t.side === "long" ? "text-green-500 border-green-500" : "text-red-500 border-red-500"}>
                                    {(t.side ?? "").toUpperCase()}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{formatCurrency(t.entryPrice ?? 0, 0)}</TableCell>
                                <TableCell className="font-mono text-xs">{formatCurrency(t.exitPrice ?? 0, 0)}</TableCell>
                                <TableCell className="text-right font-mono text-xs">{formatCurrency(t.size ?? 0, 0)}</TableCell>
                                <TableCell className={cn("text-right font-mono text-xs", (t.profitLoss ?? 0) > 0 ? "text-green-500" : "text-red-500")}>
                                  {formatCurrency(t.profitLoss ?? 0)}
                                </TableCell>
                                <TableCell className={cn("text-right font-mono text-xs", (t.profitLossPct ?? 0) > 0 ? "text-green-500" : "text-red-500")}>
                                  {formatPercent(t.profitLossPct ?? 0)}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {(t.durationHours ?? 0) >= 24 ? `${Math.round((t.durationHours ?? 0) / 24)}d` : `${Math.round(t.durationHours ?? 0)}h`}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={t.result === "win" ? "outline" : "destructive"}
                                    className={t.result === "win" ? "text-green-500 border-green-500" : "bg-red-500/10 text-red-500"}>
                                    {t.result === "win" ? "WIN" : "LOSS"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Metrics */}
              <TabsContent value="metrics">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Return Metrics</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { label: "Total Return", value: formatPercent(selectedBt?.totalReturn ?? 0), positive: (selectedBt?.totalReturn ?? 0) > 0 },
                        { label: "Annual Return (est.)", value: formatPercent((selectedBt?.totalReturn ?? 0) / Math.max(1, (new Date(selectedBt?.endDate ?? "").getFullYear() - new Date(selectedBt?.startDate ?? "").getFullYear()))), positive: (selectedBt?.totalReturn ?? 0) > 0 },
                        { label: "Win Rate", value: formatPercent(selectedBt?.winRate ?? 0), positive: (selectedBt?.winRate ?? 0) > 50 },
                        { label: "Profit Factor", value: formatNumber(selectedBt?.profitFactor ?? 0), positive: (selectedBt?.profitFactor ?? 0) > 1 },
                        { label: "Expectancy", value: formatCurrency(avgWin * (selectedBt?.winRate ?? 0) / 100 - avgLoss * (1 - (selectedBt?.winRate ?? 0) / 100)), positive: avgWin * (selectedBt?.winRate ?? 0) / 100 > avgLoss * (1 - (selectedBt?.winRate ?? 0) / 100) },
                      ].map(({ label, value, positive }) => (
                        <div key={label} className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className={cn("font-mono font-medium", positive ? "text-green-500" : "text-red-500")}>{value}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-sm">Risk Metrics</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { label: "Max Drawdown", value: formatPercent(selectedBt?.drawdown ?? 0), positive: false },
                        { label: "Sharpe Ratio", value: formatNumber(selectedBt?.sharpeRatio ?? 0), positive: (selectedBt?.sharpeRatio ?? 0) > 1 },
                        { label: "Sortino Ratio (est.)", value: formatNumber((selectedBt?.sharpeRatio ?? 0) * 1.3), positive: (selectedBt?.sharpeRatio ?? 0) > 1 },
                        { label: "Calmar Ratio (est.)", value: formatNumber(((selectedBt?.totalReturn ?? 0)) / Math.max(0.1, selectedBt?.drawdown ?? 1)), positive: ((selectedBt?.totalReturn ?? 0) / Math.max(0.1, selectedBt?.drawdown ?? 1)) > 1 },
                        { label: "Avg Trade Duration", value: trades?.length ? `${Math.round(trades.reduce((s, t) => s + (t.durationHours ?? 0), 0) / trades.length)}h` : "—", positive: true },
                      ].map(({ label, value, positive }) => (
                        <div key={label} className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className={cn("font-mono font-medium", positive ? "text-green-500" : "text-red-500")}>{value}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        {/* ── TAB: Walk Forward ────────────────────────────────────────────────── */}
        <TabsContent value="walk-forward" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shuffle className="w-5 h-5" />Walk Forward Analysis</CardTitle>
              <CardDescription>Tests strategy robustness by training on one period and validating on the next. Detects overfitting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Select value={selectedId ? String(selectedId) : ""} onValueChange={v => selectForAnalysis(parseInt(v))}>
                  <SelectTrigger className="max-w-sm">
                    <SelectValue placeholder="Select a backtest..." />
                  </SelectTrigger>
                  <SelectContent>
                    {backtests?.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        #{b.id} — {b.strategyName ?? `Strategy ${b.strategyId}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button disabled={!selectedId || runLoading} onClick={() => {
                  if (!selectedId) return;
                  setRunLoading(true);
                  runWalkForward({ id: selectedId }, { onSettled: () => setRunLoading(false) });
                }}>
                  {runLoading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Running...</> : <><Play className="w-4 h-4 mr-2" />Run Analysis</>}
                </Button>
              </div>

              {!walkResult ? (
                <div className="border-dashed border rounded-lg p-12 text-center text-muted-foreground">
                  <Shuffle className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>Select a backtest and run walk-forward analysis to validate strategy robustness.</p>
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-4">
                    <StatCard title="In-Sample Avg Return" value={formatPercent(walkResult.avgInSampleReturn)} icon={TrendingUp} color="blue-500" />
                    <StatCard title="Out-of-Sample Avg" value={formatPercent(walkResult.avgOutOfSampleReturn)} icon={TrendingUp} color="green-500" />
                    <StatCard title="Efficiency Ratio" value={formatNumber(walkResult.avgEfficiency)} icon={Target} sub="Out / In sample" />
                    <StatCard title="Consistency Score" value={`${walkResult.consistencyScore}/100`} icon={Star} color="amber-500" />
                  </div>

                  <Card className={cn("border", walkResult.overfitRisk === "low" ? "border-green-500/30 bg-green-500/5" : walkResult.overfitRisk === "medium" ? "border-yellow-500/30 bg-yellow-500/5" : "border-red-500/30 bg-red-500/5")}>
                    <CardContent className="pt-4 flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {walkResult.overfitRisk === "low" ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                        <span className="font-semibold text-sm">Overfit Risk:</span>
                        <RiskBadge risk={walkResult.overfitRisk} />
                      </div>
                      <p className="text-sm text-muted-foreground">{walkResult.recommendation}</p>
                    </CardContent>
                  </Card>

                  {/* Period Table */}
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Walk Forward Periods</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Period</TableHead>
                            <TableHead>Train Period</TableHead>
                            <TableHead>Test Period</TableHead>
                            <TableHead className="text-right">In-Sample Return</TableHead>
                            <TableHead className="text-right">In-Sample WR</TableHead>
                            <TableHead className="text-right">Out-Sample Return</TableHead>
                            <TableHead className="text-right">Out-Sample WR</TableHead>
                            <TableHead className="text-right">Efficiency</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {walkResult.periods?.map((p: any) => (
                            <TableRow key={p.period}>
                              <TableCell className="font-mono">{p.period}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{p.trainStart} → {p.trainEnd}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{p.testStart} → {p.testEnd}</TableCell>
                              <TableCell className="text-right font-mono text-blue-500">{formatPercent(p.inSampleReturn)}</TableCell>
                              <TableCell className="text-right font-mono">{formatPercent(p.inSampleWinRate)}</TableCell>
                              <TableCell className={cn("text-right font-mono", p.outOfSampleReturn > 0 ? "text-green-500" : "text-red-500")}>{formatPercent(p.outOfSampleReturn)}</TableCell>
                              <TableCell className="text-right font-mono">{formatPercent(p.outOfSampleWinRate)}</TableCell>
                              <TableCell className={cn("text-right font-mono", p.efficiency >= 0.75 ? "text-green-500" : p.efficiency >= 0.5 ? "text-yellow-500" : "text-red-500")}>{formatNumber(p.efficiency)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Chart */}
                  <Card>
                    <CardHeader><CardTitle className="text-sm">In-Sample vs Out-of-Sample Returns</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={walkResult.periods ?? []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="period" tickFormatter={v => `P${v}`} />
                          <YAxis tickFormatter={v => `${v}%`} />
                          <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                          <Legend />
                          <Bar dataKey="inSampleReturn" name="In-Sample" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="outOfSampleReturn" name="Out-of-Sample" fill="#22c55e" radius={[4, 4, 0, 0]} />
                          <ReferenceLine y={0} stroke="hsl(var(--border))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Monte Carlo ─────────────────────────────────────────────────── */}
        <TabsContent value="monte-carlo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5" />Monte Carlo Simulation</CardTitle>
              <CardDescription>Randomizes trade order and returns across thousands of simulations to model the full range of possible outcomes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Select value={selectedId ? String(selectedId) : ""} onValueChange={v => selectForAnalysis(parseInt(v))}>
                  <SelectTrigger className="max-w-sm">
                    <SelectValue placeholder="Select a backtest..." />
                  </SelectTrigger>
                  <SelectContent>
                    {backtests?.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        #{b.id} — {b.strategyName ?? `Strategy ${b.strategyId}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button disabled={!selectedId || runLoading} onClick={() => {
                  if (!selectedId) return;
                  setRunLoading(true);
                  runMonteCarlo({ id: selectedId }, { onSettled: () => setRunLoading(false) });
                }}>
                  {runLoading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Simulating...</> : <><Zap className="w-4 h-4 mr-2" />Run Monte Carlo</>}
                </Button>
              </div>

              {!monteResult ? (
                <div className="border-dashed border rounded-lg p-12 text-center text-muted-foreground">
                  <Zap className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>Select a backtest and run Monte Carlo simulation to model outcome distribution.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-4">
                    <StatCard title="Simulations Run" value={monteResult.simulations?.toLocaleString()} icon={Layers} />
                    <StatCard title="Probability of Profit" value={`${monteResult.probProfit}%`} icon={Target} color="green-500" />
                    <StatCard title="Prob. Doubling Capital" value={`${monteResult.probDoubling}%`} icon={TrendingUp} color="blue-500" />
                    <StatCard title="Avg Max Drawdown" value={`${monteResult.avgMaxDrawdown}%`} icon={TrendingDown} color="red-500" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Outcome Percentiles (${monteResult.capital?.toLocaleString()} start)</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {[
                          { pct: "95th", value: monteResult.percentile95, label: "Best 5% scenarios", color: "text-green-500" },
                          { pct: "75th", value: monteResult.percentile75, label: "Upper quartile", color: "text-green-400" },
                          { pct: "50th", value: monteResult.percentile50, label: "Median outcome", color: "text-blue-500" },
                          { pct: "25th", value: monteResult.percentile25, label: "Lower quartile", color: "text-yellow-500" },
                          { pct: "5th", value: monteResult.percentile5, label: "Worst 5% scenarios", color: "text-red-500" },
                          { pct: "1st", value: monteResult.worstCase, label: "Worst case", color: "text-red-600" },
                          { pct: "99th", value: monteResult.bestCase, label: "Best case", color: "text-green-600" },
                        ].map(({ pct, value, label, color }) => (
                          <div key={pct} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">{pct} Percentile <span className="text-xs">({label})</span></span>
                            <span className={cn("font-mono font-medium", color)}>{formatCurrency(value)}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader><CardTitle className="text-sm">Outcome Distribution</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={monteResult.histogram ?? []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="range" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={45} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Bar dataKey="count" name="Simulations" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-blue-500/30 bg-blue-500/5">
                    <CardContent className="pt-4">
                      <p className="text-sm font-semibold mb-2">Interpretation</p>
                      <p className="text-sm text-muted-foreground">
                        Based on {monteResult.simulations?.toLocaleString()} simulations, there is a <strong className="text-foreground">{monteResult.probProfit}% probability</strong> of being profitable.
                        The median outcome is <strong className="text-foreground">{formatCurrency(monteResult.percentile50)}</strong> from a ${monteResult.capital?.toLocaleString()} starting capital.
                        In the worst 5% of scenarios, the portfolio reaches <strong className="text-foreground">{formatCurrency(monteResult.percentile5)}</strong>.
                        The 95th percentile drawdown risk is <strong className="text-foreground">{monteResult.drawdownP95}%</strong>.
                      </p>
                    </CardContent>
                  </Card>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Optimization ────────────────────────────────────────────────── */}
        <TabsContent value="optimize" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="w-5 h-5" />Parameter Optimization</CardTitle>
              <CardDescription>AI tests all parameter combinations to find the optimal strategy configuration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Select value={selectedId ? String(selectedId) : ""} onValueChange={v => selectForAnalysis(parseInt(v))}>
                  <SelectTrigger className="max-w-sm">
                    <SelectValue placeholder="Select a backtest..." />
                  </SelectTrigger>
                  <SelectContent>
                    {backtests?.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        #{b.id} — {b.strategyName ?? `Strategy ${b.strategyId}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button disabled={!selectedId || runLoading} onClick={() => {
                  if (!selectedId) return;
                  setRunLoading(true);
                  runOptimize({ id: selectedId }, { onSettled: () => setRunLoading(false) });
                }}>
                  {runLoading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Optimizing...</> : <><SlidersHorizontal className="w-4 h-4 mr-2" />Run Optimization</>}
                </Button>
              </div>

              {!optResult ? (
                <div className="border-dashed border rounded-lg p-12 text-center text-muted-foreground">
                  <SlidersHorizontal className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>Select a backtest and run optimization to find the best parameter set.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-4">
                    <StatCard title="Best Return Found" value={formatPercent(optResult.bestReturn)} icon={TrendingUp} color="green-500" />
                    <StatCard title="Best Win Rate" value={formatPercent(optResult.bestWinRate)} icon={Target} color="blue-500" />
                    <StatCard title="Best Sharpe" value={formatNumber(optResult.bestSharpe)} icon={Activity} />
                    <StatCard title="Improvement vs Base" value={formatPercent(optResult.improvement)} icon={ArrowUpRight} color={optResult.improvement > 0 ? "green-500" : "red-500"} />
                  </div>

                  {/* Best params */}
                  <Card className="border-green-500/30 bg-green-500/5">
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" />Optimal Parameters Found</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        {optResult.bestParams && Object.entries(optResult.bestParams).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}: </span>
                            <span className="font-mono font-medium">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Runs table */}
                    <Card>
                      <CardHeader><CardTitle className="text-sm">All Optimization Runs</CardTitle></CardHeader>
                      <CardContent>
                        <div className="max-h-64 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Rank</TableHead>
                                <TableHead className="text-right">Return</TableHead>
                                <TableHead className="text-right">Win Rate</TableHead>
                                <TableHead className="text-right">Sharpe</TableHead>
                                <TableHead className="text-right">DD</TableHead>
                                <TableHead className="text-right">Score</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {optResult.runs?.map((r: any) => (
                                <TableRow key={r.rank} className={r.rank === 1 ? "bg-green-500/5" : ""}>
                                  <TableCell className="font-mono text-xs">{r.rank === 1 ? "⭐" : r.rank}</TableCell>
                                  <TableCell className={cn("text-right font-mono text-xs", r.totalReturn > 0 ? "text-green-500" : "text-red-500")}>{formatPercent(r.totalReturn)}</TableCell>
                                  <TableCell className="text-right font-mono text-xs">{formatPercent(r.winRate)}</TableCell>
                                  <TableCell className="text-right font-mono text-xs">{formatNumber(r.sharpe)}</TableCell>
                                  <TableCell className="text-right font-mono text-xs text-red-500">{formatPercent(r.drawdown)}</TableCell>
                                  <TableCell className="text-right font-mono text-xs font-bold">{r.score}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Parameter importance */}
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Parameter Importance</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {optResult.parameterImportance?.map((p: any) => (
                          <div key={p.param}>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{p.param}</span>
                              <span className="font-mono text-muted-foreground">{p.importance}%</span>
                            </div>
                            <Progress value={p.importance} className="h-2" />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: AI Review ───────────────────────────────────────────────────── */}
        <TabsContent value="ai-review" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Brain className="w-5 h-5" />AI Backtest Review</CardTitle>
              <CardDescription>AI evaluates every metric, detects weaknesses, and provides institutional-grade strategy assessment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Select value={selectedId ? String(selectedId) : ""} onValueChange={v => { selectForAnalysis(parseInt(v)); setTab("ai-review"); }}>
                  <SelectTrigger className="max-w-sm">
                    <SelectValue placeholder="Select a backtest..." />
                  </SelectTrigger>
                  <SelectContent>
                    {backtests?.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        #{b.id} — {b.strategyName ?? `Strategy ${b.strategyId}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!selectedId ? (
                <div className="border-dashed border rounded-lg p-12 text-center text-muted-foreground">
                  <Brain className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>Select a backtest to generate the AI review.</p>
                </div>
              ) : aiLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : aiReview && (
                <>
                  {/* Header score */}
                  <div className="flex items-center gap-6 p-6 rounded-xl border bg-muted/20">
                    <div className="text-center">
                      <div className={cn("text-5xl font-bold border-4 rounded-full w-20 h-20 flex items-center justify-center", GradeColors[aiReview.grade ?? "B"] ?? "text-blue-500 border-blue-500")}>
                        {aiReview.grade}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Grade</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg">{aiReview.strategyName}</h3>
                        <Badge variant="outline">{aiReview.tradingStyle}</Badge>
                        <RiskBadge risk={aiReview.overfitRisk ?? "medium"} />
                        {aiReview.readyForLive ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500">Ready for Live</Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-red-500/10 text-red-500">Not Ready</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{aiReview.summary}</p>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary">{aiReview.overallScore}</div>
                      <p className="text-xs text-muted-foreground">/ 100</p>
                      <p className="text-xs text-muted-foreground mt-1">{aiReview.confidenceLevel}% conf.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Card className="border-green-500/20">
                      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" />Strengths</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {(aiReview.strengths ?? []).map((s: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                            <span>{s}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="border-red-500/20">
                      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" />Weaknesses</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {(aiReview.weaknesses ?? []).map((w: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                            <span>{w}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ChevronRight className="w-4 h-4" />AI Recommendations</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {(aiReview.recommendations ?? []).map((r: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-primary font-bold">{i + 1}.</span>
                          <span>{r}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-sm">Market Condition Performance</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Market Condition</TableHead>
                            <TableHead className="text-right">Est. Performance</TableHead>
                            <TableHead>Suitability</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(aiReview.marketConditions ?? []).map((mc: any) => (
                            <TableRow key={mc.condition}>
                              <TableCell>{mc.condition}</TableCell>
                              <TableCell className={cn("text-right font-mono", mc.performance > 0 ? "text-green-500" : "text-red-500")}>
                                {formatPercent(mc.performance)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={
                                  mc.suitability === "excellent" ? "text-green-500 border-green-500" :
                                  mc.suitability === "good" ? "text-blue-500 border-blue-500" :
                                  mc.suitability === "fair" ? "text-yellow-500 border-yellow-500" :
                                  "text-red-500 border-red-500"
                                }>
                                  {mc.suitability}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Compare ─────────────────────────────────────────────────────── */}
        <TabsContent value="compare" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><GitCompare className="w-5 h-5" />Strategy Comparison</CardTitle>
              <CardDescription>Select up to 5 backtests to compare side by side across all key metrics.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {backtests?.map(b => (
                  <button key={b.id}
                    onClick={() => toggleCompare(b.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm border transition-colors",
                      compareIds.includes(b.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}>
                    #{b.id} {b.strategyName ?? `Strategy ${b.strategyId}`}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button disabled={compareIds.length < 2 || comparing}
                  onClick={() => compareBacktests({ data: { ids: compareIds } })}>
                  {comparing ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Comparing...</> : <><GitCompare className="w-4 h-4 mr-2" />Compare Selected ({compareIds.length})</>}
                </Button>
                <Button variant="outline" onClick={() => { setCompareIds([]); setCompareResult(null); }}>Clear</Button>
              </div>

              {compareResult ? (
                <>
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Comparison Matrix</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Metric</TableHead>
                            {compareResult.backtests?.map((b: any) => (
                              <TableHead key={b.id} className="text-right">
                                <div className="text-xs">
                                  <div className="font-semibold">{b.strategyName ?? `Strategy ${b.strategyId}`}</div>
                                  <div className="text-muted-foreground">#{b.id}</div>
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[
                            { key: "totalReturn", label: "Total Return", fmt: (v: number) => formatPercent(v ?? 0), higher: true },
                            { key: "winRate", label: "Win Rate", fmt: (v: number) => formatPercent(v ?? 0), higher: true },
                            { key: "drawdown", label: "Max Drawdown", fmt: (v: number) => formatPercent(v ?? 0), higher: false },
                            { key: "sharpeRatio", label: "Sharpe Ratio", fmt: (v: number) => formatNumber(v ?? 0), higher: true },
                            { key: "profitFactor", label: "Profit Factor", fmt: (v: number) => formatNumber(v ?? 0), higher: true },
                            { key: "totalTrades", label: "Total Trades", fmt: (v: number) => formatNumber(v, 0), higher: false },
                          ].map(({ key, label, fmt, higher }) => {
                            const vals = compareResult.backtests?.map((b: any) => b[key] ?? 0) ?? [];
                            const best = higher ? Math.max(...vals) : Math.min(...vals);
                            return (
                              <TableRow key={key}>
                                <TableCell className="font-medium text-sm">{label}</TableCell>
                                {compareResult.backtests?.map((b: any) => {
                                  const v = b[key] ?? 0;
                                  const isBest = v === best;
                                  return (
                                    <TableCell key={b.id} className={cn("text-right font-mono text-sm", isBest ? "font-bold text-green-500" : "")}>
                                      {fmt(v)}
                                      {isBest && " ★"}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-sm">Return vs Drawdown</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={compareResult.backtests?.map((b: any) => ({ name: b.strategyName ?? `#${b.id}`, totalReturn: b.totalReturn ?? 0, drawdown: -(b.drawdown ?? 0) }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                          <Legend />
                          <Bar dataKey="totalReturn" name="Return" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="drawdown" name="Drawdown (neg)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          <ReferenceLine y={0} stroke="hsl(var(--border))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </>
              ) : compareIds.length < 2 ? (
                <div className="border-dashed border rounded-lg p-12 text-center text-muted-foreground">
                  <GitCompare className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>Select at least 2 backtests above to compare them.</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: History ─────────────────────────────────────────────────────── */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="w-5 h-5" />Backtest History</CardTitle>
              <CardDescription>All historical simulation runs with full performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Return</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                    <TableHead className="text-right">Trades</TableHead>
                    <TableHead className="text-right">Prof Factor</TableHead>
                    <TableHead className="text-right">Drawdown</TableHead>
                    <TableHead className="text-right">Sharpe</TableHead>
                    <TableHead className="text-right">Date Run</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 12 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : backtests?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                        <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No backtests yet. Run your first simulation.
                      </TableCell>
                    </TableRow>
                  ) : (
                    backtests?.map(b => (
                      <TableRow key={b.id} className="cursor-pointer hover:bg-muted/30"
                        onClick={() => { selectForAnalysis(b.id); setTab("results"); }}>
                        <TableCell className="text-xs text-muted-foreground font-mono">#{b.id}</TableCell>
                        <TableCell className="font-medium text-sm max-w-[140px] truncate">{b.strategyName ?? `Strategy ${b.strategyId}`}</TableCell>
                        <TableCell className="font-mono text-xs">{b.symbol ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(b.startDate).getFullYear()} – {new Date(b.endDate).getFullYear()}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono text-sm", (b.totalReturn ?? 0) > 0 ? "text-green-500" : "text-red-500")}>
                          {formatPercent(b.totalReturn ?? 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatPercent(b.winRate)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{b.totalTrades}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatNumber(b.profitFactor)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-500">{formatPercent(b.drawdown)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatNumber(b.sharpeRatio ?? 0)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">{formatDate(b.createdAt)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); selectForAnalysis(b.id); setTab("results"); }}>
                            View <ChevronRight className="w-3 h-3 ml-1" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
