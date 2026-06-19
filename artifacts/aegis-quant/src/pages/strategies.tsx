import { useState } from "react";
import {
  useListStrategies,
  useGetStrategy,
  useCreateStrategy,
  useUpdateStrategy,
  useDeleteStrategy,
  useGetStrategyBacktests,
  useGetStrategyComparison,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  Brain, Zap, TrendingUp, Activity, Target,
  CheckCircle2, XCircle, Play, Pause, Trash2, Plus, Edit3,
  ChevronRight, Cpu, BarChart2, FlaskConical, LineChart,
  BookOpen, Rocket, RefreshCw, AlertTriangle, Eye,
  GitBranch, Layers, Shield, Star, Clock, Package, Settings, Network,
} from "lucide-react";
import { STRATEGY_REGISTRY, type StrategyModuleDef } from "@/lib/strategy-registry";

// ── Helpers ────────────────────────────────────────────────────────────────────
function StatCard({ title, value, sub, icon: Icon, color, loading, trend }: {
  title: string; value?: string; sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string; loading?: boolean; trend?: "up" | "down" | "neutral";
}) {
  if (loading) return (
    <Card><CardContent className="pt-5 space-y-2">
      <Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-24" /><Skeleton className="h-3 w-16" />
    </CardContent></Card>
  );
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
        </div>
        <p className={cn("text-2xl font-bold tracking-tight", color ?? "")}>{value ?? "—"}</p>
        {sub && (
          <p className="text-xs text-muted-foreground mt-1">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

const LIFECYCLE_STAGES = [
  { key: "draft", label: "Draft", color: "text-muted-foreground", bg: "bg-muted/20" },
  { key: "backtesting", label: "Backtesting", color: "text-blue-400", bg: "bg-blue-500/10" },
  { key: "paperTesting", label: "Paper Testing", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  { key: "live", label: "Live", color: "text-success", bg: "bg-success/10" },
  { key: "archived", label: "Archived", color: "text-muted-foreground", bg: "bg-muted/10" },
];

// ── Strategy Card ──────────────────────────────────────────────────────────────
function StrategyCard({
  strategy, selected, onClick, onToggle, onDelete
}: {
  strategy: any; selected: boolean;
  onClick: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const winRateColor = (strategy.winRate ?? 0) >= 55 ? "text-success" : (strategy.winRate ?? 0) >= 45 ? "text-yellow-400" : "text-destructive";
  const pfColor = (strategy.profitFactor ?? 0) >= 1.5 ? "text-success" : (strategy.profitFactor ?? 0) >= 1.0 ? "text-yellow-400" : "text-destructive";

  return (
    <Card
      onClick={onClick}
      className={cn("cursor-pointer transition-all hover:border-primary/40", selected && "border-primary bg-primary/5")}
    >
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-semibold text-sm truncate">{strategy.name}</p>
              <span className="text-xs text-muted-foreground shrink-0">v{strategy.version}</span>
            </div>
            {strategy.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{strategy.description}</p>
            )}
          </div>
          <div className={cn("px-2 py-0.5 rounded-full text-xs font-semibold border shrink-0",
            strategy.active ? "bg-success/10 text-success border-success/30" : "bg-muted/20 text-muted-foreground border-border")}>
            {strategy.active ? "Live" : "Inactive"}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className={cn("text-base font-bold", winRateColor)}>
              {strategy.winRate != null ? `${strategy.winRate.toFixed(1)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Win Rate</p>
          </div>
          <div>
            <p className="text-base font-bold">{strategy.totalTrades ?? 0}</p>
            <p className="text-xs text-muted-foreground">Trades</p>
          </div>
          <div>
            <p className={cn("text-base font-bold", pfColor)}>
              {strategy.profitFactor != null ? strategy.profitFactor.toFixed(2) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">PF</p>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-3">
          <Button size="sm" variant="ghost" className="h-7 text-xs flex-1"
            onClick={e => { e.stopPropagation(); onClick(); }}>
            <Eye className="w-3 h-3 mr-1" /> View
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs flex-1"
            onClick={e => { e.stopPropagation(); onToggle(); }}>
            {strategy.active ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
            {strategy.active ? "Pause" : "Resume"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={e => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Rules Parser ───────────────────────────────────────────────────────────────
function RulesView({ rulesJson }: { rulesJson?: string | null }) {
  if (!rulesJson) return <p className="text-sm text-muted-foreground">No rules defined</p>;
  try {
    const rules = JSON.parse(rulesJson);
    if (typeof rules === "object" && rules !== null) {
      return (
        <div className="space-y-4">
          {rules.indicators && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Indicators</p>
              <div className="flex flex-wrap gap-2">
                {rules.indicators.map((ind: string, i: number) => (
                  <span key={i} className="px-2 py-1 rounded-md text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">{ind}</span>
                ))}
              </div>
            </div>
          )}
          {rules.entryConditions && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Entry Conditions</p>
              <div className="space-y-1">
                {rules.entryConditions.map((c: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" /> {c}
                  </div>
                ))}
              </div>
            </div>
          )}
          {rules.exitConditions && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Exit Conditions</p>
              <div className="space-y-1">
                {rules.exitConditions.map((c: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" /> {c}
                  </div>
                ))}
              </div>
            </div>
          )}
          {rules.riskRules && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Risk Rules</p>
              <div className="space-y-1">
                {rules.riskRules.map((c: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Shield className="w-3.5 h-3.5 text-primary shrink-0" /> {c}
                  </div>
                ))}
              </div>
            </div>
          )}
          {(rules.style || rules.market || rules.timeframe) && (
            <div className="flex gap-3 flex-wrap">
              {rules.style && <span className="px-2 py-1 rounded text-xs bg-muted/20 border border-border">{rules.style}</span>}
              {rules.market && <span className="px-2 py-1 rounded text-xs bg-muted/20 border border-border">{rules.market}</span>}
              {rules.timeframe && <span className="px-2 py-1 rounded text-xs bg-muted/20 border border-border">{rules.timeframe}</span>}
            </div>
          )}
        </div>
      );
    }
  } catch { /* fall through */ }
  return <pre className="text-xs bg-muted/10 p-3 rounded-lg border border-border whitespace-pre-wrap">{rulesJson}</pre>;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Strategies() {
  const [tab, setTab] = useState("library");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("trend following strategy for BTCUSDT using EMA and RSI with conservative risk management");
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiBuilding, setAiBuilding] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newRules, setNewRules] = useState("");
  const [deployEnv, setDeployEnv] = useState("paper");
  const [deployResult, setDeployResult] = useState<any>(null);
  const [deploying, setDeploying] = useState(false);
  const [optData, setOptData] = useState<any>(null);
  const [optLoading, setOptLoading] = useState(false);
  const [perfData, setPerfData] = useState<any>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [monitorData, setMonitorData] = useState<any>(null);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [dashData, setDashData] = useState<any>(null);
  const [dashLoaded, setDashLoaded] = useState(false);
  const [selectedModule, setSelectedModule] = useState<StrategyModuleDef | null>(null);
  const [moduleDetailTab, setModuleDetailTab] = useState("overview");
  const [moduleEvalResult, setModuleEvalResult] = useState<any>(null);
  const [moduleEvalLoading, setModuleEvalLoading] = useState(false);
  const [moduleEvalAsset, setModuleEvalAsset] = useState("BTCUSDT");

  const { data: strategies, isLoading, refetch } = useListStrategies();
  const { data: comparison, isLoading: compLoading } = useGetStrategyComparison();
  const { data: selectedStrategy, refetch: refetchSelected } = useGetStrategy(
    selectedId ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!selectedId } as any }
  );
  const { data: backtests } = useGetStrategyBacktests(
    selectedId ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!selectedId } as any }
  );

  const { mutate: createStrategy, isPending: creating } = useCreateStrategy();
  const { mutate: updateStrategy, isPending: updating } = useUpdateStrategy();
  const { mutate: deleteStrategy } = useDeleteStrategy();

  const runModuleEval = async (strategyId: string) => {
    setModuleEvalLoading(true);
    setModuleEvalResult(null);
    try {
      const r = await fetch("/api/strategies/engine/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyId, asset: moduleEvalAsset, timeframe: "1h", aiConfidence: 72, aiSentiment: "Bullish" }),
      });
      setModuleEvalResult(await r.json());
    } catch { } finally { setModuleEvalLoading(false); }
  };

  const fetchDash = async () => {
    try {
      const r = await fetch("/api/strategies/dashboard");
      setDashData(await r.json());
    } catch { } finally { setDashLoaded(true); }
  };

  const fetchOptimization = async (id: number) => {
    setOptLoading(true);
    try {
      const r = await fetch(`/api/strategies/${id}/optimize`);
      setOptData(await r.json());
    } catch { } finally { setOptLoading(false); }
  };

  const fetchPerformance = async (id: number) => {
    setPerfLoading(true);
    try {
      const r = await fetch(`/api/strategies/${id}/performance`);
      setPerfData(await r.json());
    } catch { } finally { setPerfLoading(false); }
  };

  const fetchMonitor = async (id: number) => {
    setMonitorLoading(true);
    try {
      const r = await fetch(`/api/strategies/${id}/monitor`);
      setMonitorData(await r.json());
    } catch { } finally { setMonitorLoading(false); }
  };

  const doDeploy = async (id: number) => {
    setDeploying(true);
    try {
      const r = await fetch(`/api/strategies/${id}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: deployEnv }),
      });
      setDeployResult(await r.json());
      refetch();
      refetchSelected();
    } catch { } finally { setDeploying(false); }
  };

  const runAiBuilder = async () => {
    setAiBuilding(true);
    setAiError(null);
    try {
      const r = await fetch("/api/strategies/ai-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiPrompt }),
      });
      if (!r.ok) throw new Error("AI builder failed");
      setAiResult(await r.json());
    } catch (e: any) {
      setAiError(e.message ?? "Unknown error");
    } finally { setAiBuilding(false); }
  };

  const saveAiStrategy = () => {
    if (!aiResult) return;
    createStrategy(
      { data: { name: aiResult.name, description: aiResult.description, rulesJson: aiResult.rulesJson, active: false } },
      { onSuccess: () => { refetch(); setAiResult(null); setTab("library"); } }
    );
  };

  const handleSelectStrategy = (id: number) => {
    setSelectedId(id);
    fetchPerformance(id);
    fetchMonitor(id);
    setDetailTab("overview");
    setDeployResult(null);
  };

  const handleToggleActive = (strategy: any) => {
    updateStrategy({ id: strategy.id, data: { active: !strategy.active } }, { onSuccess: () => refetch() });
  };

  const handleDelete = (id: number) => {
    deleteStrategy({ id }, { onSuccess: () => { refetch(); if (selectedId === id) setSelectedId(null); } });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            Strategy Center
          </h1>
          <p className="text-sm text-muted-foreground">Build, backtest, optimize and deploy AI trading strategies</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />Refresh
          </Button>
          <Button size="sm" onClick={() => { setShowCreate(true); setTab("library"); }}>
            <Plus className="w-4 h-4 mr-2" />New Strategy
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === "dashboard" && !dashLoaded) fetchDash(); }}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/30 p-1">
          {[
            { id: "library", label: "Strategy Library", icon: BookOpen },
            { id: "dashboard", label: "Dashboard", icon: Activity },
            { id: "ai-builder", label: "AI Builder", icon: Brain },
            { id: "comparison", label: "Comparison", icon: BarChart2 },
            { id: "lifecycle", label: "Lifecycle", icon: GitBranch },
            { id: "engine", label: "Strategy Engine", icon: Package },
          ].map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="flex items-center gap-1.5 text-xs px-3 py-1.5">
              <Icon className="w-3.5 h-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── LIBRARY ── */}
        <TabsContent value="library" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* Left Panel */}
            <div className="space-y-3">
              {showCreate && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-3"><CardTitle className="text-sm">New Strategy</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Name *</Label>
                      <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="My EMA Strategy" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Description</Label>
                      <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Brief description..." rows={2} className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Rules (JSON or text)</Label>
                      <Textarea value={newRules} onChange={e => setNewRules(e.target.value)} placeholder='{"indicators":["EMA 20","RSI"]}' rows={3} className="text-sm font-mono" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" disabled={!newName || creating}
                        onClick={() => {
                          createStrategy({ data: { name: newName, description: newDescription || undefined, rulesJson: newRules || undefined, active: true } }, {
                            onSuccess: (s) => {
                              refetch(); setShowCreate(false); setNewName(""); setNewDescription(""); setNewRules("");
                              if (s?.id) handleSelectStrategy(s.id);
                            }
                          });
                        }}>
                        {creating ? "Creating..." : "Create"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}><CardContent className="pt-4"><Skeleton className="h-28 w-full" /></CardContent></Card>
                ))
              ) : (strategies ?? []).length === 0 ? (
                <Card>
                  <CardContent className="pt-8 pb-8 text-center space-y-3">
                    <Brain className="w-10 h-10 mx-auto opacity-30" />
                    <p className="text-sm text-muted-foreground">No strategies yet</p>
                    <Button size="sm" onClick={() => setShowCreate(true)}>
                      <Plus className="w-4 h-4 mr-2" /> Create First Strategy
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                (strategies ?? []).map(s => (
                  <StrategyCard
                    key={s.id}
                    strategy={s}
                    selected={selectedId === s.id}
                    onClick={() => handleSelectStrategy(s.id)}
                    onToggle={() => handleToggleActive(s)}
                    onDelete={() => handleDelete(s.id)}
                  />
                ))
              )}
            </div>

            {/* Right Panel — Detail */}
            {selectedId && selectedStrategy ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{selectedStrategy.name}</h2>
                    <p className="text-sm text-muted-foreground">{selectedStrategy.description ?? "No description"}</p>
                  </div>
                  <Badge variant="outline" className={selectedStrategy.active ? "text-success border-success/30" : "text-muted-foreground"}>
                    {selectedStrategy.active ? "● Live" : "● Inactive"}
                  </Badge>
                </div>

                <Tabs value={detailTab} onValueChange={(v) => {
                  setDetailTab(v);
                  if (v === "optimize" && selectedId) fetchOptimization(selectedId);
                  if (v === "monitor" && selectedId) fetchMonitor(selectedId);
                }}>
                  <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/20 p-1">
                    {["overview", "performance", "rules", "backtest", "optimize", "deploy", "monitor"].map(id => (
                      <TabsTrigger key={id} value={id} className="text-xs px-3 py-1.5 capitalize">{id}</TabsTrigger>
                    ))}
                  </TabsList>

                  {/* Overview */}
                  <TabsContent value="overview" className="space-y-4 mt-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <StatCard title="Win Rate" value={selectedStrategy.winRate != null ? `${selectedStrategy.winRate.toFixed(1)}%` : "—"} sub="All time" icon={TrendingUp}
                        color={(selectedStrategy.winRate ?? 0) >= 55 ? "text-success" : (selectedStrategy.winRate ?? 0) >= 45 ? "text-yellow-400" : "text-destructive"} />
                      <StatCard title="Total Trades" value={String(selectedStrategy.totalTrades ?? 0)} sub="Closed trades" icon={Activity} />
                      <StatCard title="Profit Factor" value={selectedStrategy.profitFactor?.toFixed(2) ?? "—"} sub="Avg win ÷ Avg loss" icon={Target}
                        color={(selectedStrategy.profitFactor ?? 0) >= 1.5 ? "text-success" : (selectedStrategy.profitFactor ?? 0) >= 1 ? "text-yellow-400" : "text-destructive"} />
                      <StatCard title="Version" value={`v${selectedStrategy.version}`} sub={`Created ${new Date(selectedStrategy.createdAt).toLocaleDateString()}`} icon={GitBranch} />
                    </div>
                    {!perfLoading && perfData && (
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Card><CardContent className="pt-4 space-y-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total P&L</p>
                          <p className={cn("text-2xl font-bold", (perfData.totalPnl ?? 0) >= 0 ? "text-success" : "text-destructive")}>{formatCurrency(perfData.totalPnl ?? 0)}</p>
                          <p className="text-xs text-muted-foreground">{(perfData.totalReturnPct ?? 0).toFixed(1)}% return</p>
                        </CardContent></Card>
                        <Card><CardContent className="pt-4 space-y-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Sharpe Ratio</p>
                          <p className={cn("text-2xl font-bold", (perfData.sharpeRatio ?? 0) >= 1 ? "text-success" : (perfData.sharpeRatio ?? 0) >= 0.5 ? "text-yellow-400" : "text-destructive")}>{(perfData.sharpeRatio ?? 0).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">Risk-adjusted return</p>
                        </CardContent></Card>
                        <Card><CardContent className="pt-4 space-y-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Max Drawdown</p>
                          <p className={cn("text-2xl font-bold", (perfData.maxDrawdown ?? 0) > 20 ? "text-destructive" : (perfData.maxDrawdown ?? 0) > 10 ? "text-yellow-400" : "text-success")}>
                            {formatPercent(perfData.maxDrawdown ?? 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">Peak-to-trough</p>
                        </CardContent></Card>
                      </div>
                    )}
                  </TabsContent>

                  {/* Performance */}
                  <TabsContent value="performance" className="space-y-4 mt-4">
                    {perfLoading ? <Skeleton className="h-48 w-full" /> : !perfData ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">No performance data</p>
                    ) : (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {[
                            { l: "Winners", v: String(perfData.winners), c: "text-success" },
                            { l: "Losers", v: String(perfData.losers), c: "text-destructive" },
                            { l: "Avg Win", v: formatCurrency(perfData.avgWin), c: "text-success" },
                            { l: "Avg Loss", v: formatCurrency(perfData.avgLoss), c: "text-destructive" },
                            { l: "Best Trade", v: formatCurrency(perfData.bestTrade), c: "text-success" },
                            { l: "Worst Trade", v: formatCurrency(perfData.worstTrade), c: "text-destructive" },
                            { l: "Volatility", v: `${(perfData.volatility ?? 0).toFixed(2)}%`, c: "" },
                            { l: "Open Now", v: String(perfData.openTrades), c: "" },
                          ].map(({ l, v, c }) => (
                            <div key={l} className="p-3 rounded-lg border border-border bg-muted/5">
                              <p className="text-xs text-muted-foreground mb-1">{l}</p>
                              <p className={cn("text-lg font-bold", c)}>{v}</p>
                            </div>
                          ))}
                        </div>
                        {(perfData.monthlyPnl ?? []).length > 0 && (
                          <Card>
                            <CardHeader><CardTitle className="text-sm">Monthly P&L</CardTitle></CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={perfData.monthlyPnl}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
                                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                                  <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                                  <Bar dataKey="pnl" name="P&L" radius={[4, 4, 0, 0]}>
                                    {(perfData.monthlyPnl ?? []).map((entry: any, index: number) => (
                                      <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        )}
                      </>
                    )}
                  </TabsContent>

                  {/* Rules */}
                  <TabsContent value="rules" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Strategy Rules</CardTitle>
                          <Button size="sm" variant="outline" onClick={() => setShowEdit(e => !e)}>
                            <Edit3 className="w-3.5 h-3.5 mr-1.5" />{showEdit ? "Cancel" : "Edit"}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {showEdit ? (
                          <div className="space-y-3">
                            <Label className="text-xs">Rules JSON</Label>
                            <Textarea defaultValue={selectedStrategy.rulesJson ?? ""} rows={8} className="font-mono text-xs" id="edit-rules-ta" />
                            <Button size="sm" onClick={() => {
                              const el = document.getElementById("edit-rules-ta") as HTMLTextAreaElement;
                              updateStrategy({ id: selectedId!, data: { rulesJson: el.value } }, {
                                onSuccess: () => { refetchSelected(); setShowEdit(false); }
                              });
                            }} disabled={updating}>{updating ? "Saving..." : "Save Rules"}</Button>
                          </div>
                        ) : (
                          <RulesView rulesJson={selectedStrategy.rulesJson} />
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Backtests */}
                  <TabsContent value="backtest" className="space-y-4 mt-4">
                    {(backtests ?? []).length === 0 ? (
                      <Card><CardContent className="pt-8 pb-8 text-center space-y-3">
                        <FlaskConical className="w-10 h-10 mx-auto opacity-30" />
                        <p className="text-sm text-muted-foreground">No backtest runs yet</p>
                        <p className="text-xs text-muted-foreground">Run a backtest from the Backtest module</p>
                      </CardContent></Card>
                    ) : (
                      <Card><CardContent className="pt-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Period</TableHead>
                              <TableHead className="text-right">Trades</TableHead>
                              <TableHead className="text-right">Win Rate</TableHead>
                              <TableHead className="text-right">Return</TableHead>
                              <TableHead className="text-right">Profit Factor</TableHead>
                              <TableHead className="text-right">Drawdown</TableHead>
                              <TableHead className="text-right">Sharpe</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(backtests ?? []).map(b => (
                              <TableRow key={b.id}>
                                <TableCell className="text-xs">
                                  {b.startDate ? new Date(b.startDate).toLocaleDateString() : "—"} – {b.endDate ? new Date(b.endDate).toLocaleDateString() : "—"}
                                </TableCell>
                                <TableCell className="text-right">{b.totalTrades}</TableCell>
                                <TableCell className={cn("text-right font-semibold", (b.winRate ?? 0) >= 55 ? "text-success" : (b.winRate ?? 0) >= 45 ? "text-yellow-400" : "text-destructive")}>
                                  {(b.winRate ?? 0).toFixed(1)}%
                                </TableCell>
                                <TableCell className={cn("text-right font-semibold", (b.totalReturn ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                                  {formatPercent(b.totalReturn ?? 0)}
                                </TableCell>
                                <TableCell className={cn("text-right", (b.profitFactor ?? 0) >= 1.5 ? "text-success" : "text-yellow-400")}>
                                  {(b.profitFactor ?? 0).toFixed(2)}
                                </TableCell>
                                <TableCell className={cn("text-right", (b.drawdown ?? 0) > 20 ? "text-destructive" : "text-foreground")}>
                                  {formatPercent(b.drawdown ?? 0)}
                                </TableCell>
                                <TableCell className="text-right">{(b.sharpeRatio ?? 0).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent></Card>
                    )}
                  </TabsContent>

                  {/* Optimize */}
                  <TabsContent value="optimize" className="space-y-4 mt-4">
                    {optLoading ? <Skeleton className="h-64 w-full" /> : !optData ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Loading optimization data...</p>
                    ) : (
                      <>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Card><CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Optimization Score</p>
                            <p className={cn("text-2xl font-bold", (optData.optimizationScore ?? 0) >= 70 ? "text-success" : (optData.optimizationScore ?? 0) >= 50 ? "text-yellow-400" : "text-destructive")}>
                              {optData.optimizationScore ?? 0}/100
                            </p>
                          </CardContent></Card>
                          <Card><CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Overfitting Risk</p>
                            <p className={cn("text-2xl font-bold capitalize", optData.overfittingRisk === "low" ? "text-success" : optData.overfittingRisk === "medium" ? "text-yellow-400" : "text-destructive")}>
                              {optData.overfittingRisk}
                            </p>
                          </CardContent></Card>
                          <Card><CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Data Quality</p>
                            <p className={cn("text-2xl font-bold capitalize", optData.dataQuality === "adequate" ? "text-success" : optData.dataQuality === "limited" ? "text-yellow-400" : "text-destructive")}>
                              {optData.dataQuality}
                            </p>
                          </CardContent></Card>
                        </div>

                        <Card>
                          <CardHeader><CardTitle className="text-sm">Parameter Suggestions</CardTitle><CardDescription>AI-recommended improvements</CardDescription></CardHeader>
                          <CardContent className="space-y-2">
                            {(optData.suggestions ?? []).map((s: any, i: number) => (
                              <div key={i} className="p-3 rounded-lg border border-border bg-muted/5">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="font-semibold text-sm">{s.parameter}</p>
                                  <span className={cn("text-xs px-2 py-0.5 rounded-full border font-semibold",
                                    s.priority === "high" ? "bg-destructive/10 text-destructive border-destructive/30" :
                                    s.priority === "medium" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
                                    "bg-muted/20 text-muted-foreground border-border")}>
                                    {s.priority.toUpperCase()}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground mb-1">
                                  <span className="font-medium">Current: </span>{s.current}
                                  <ChevronRight className="w-3 h-3 inline mx-1" />
                                  <span className="font-medium text-primary">Suggested: </span>{s.suggested}
                                </div>
                                <p className="text-xs text-success font-semibold">{s.expectedImprovement}</p>
                              </div>
                            ))}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader><CardTitle className="text-sm">Optimization Methods</CardTitle></CardHeader>
                          <CardContent className="grid gap-3 sm:grid-cols-2">
                            {(optData.methods ?? []).map((m: any) => (
                              <div key={m.name} className={cn("p-3 rounded-lg border", m.status === "available" ? "border-border bg-muted/5" : "border-muted/20 bg-muted/5 opacity-60")}>
                                <p className="font-semibold text-sm mb-1">{m.name}</p>
                                <p className="text-xs text-muted-foreground mb-2">{m.description}</p>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground"><Clock className="w-3 h-3 inline mr-1" />{m.estimatedTime}</span>
                                  <Button size="sm" variant="outline" className="h-6 text-xs" disabled={m.status !== "available"}>
                                    {m.status === "available" ? "Run" : m.status}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </TabsContent>

                  {/* Deploy */}
                  <TabsContent value="deploy" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Rocket className="w-4 h-4" />Deploy Strategy</CardTitle>
                        <CardDescription>Send strategy to live, paper, or signal-only mode</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          {[
                            { env: "paper", label: "Paper Trading", desc: "Simulate — no real risk", icon: FlaskConical, color: "border-blue-500/30 bg-blue-500/5" },
                            { env: "signal", label: "Signal Only", desc: "Alerts — no auto-execution", icon: Activity, color: "border-yellow-500/30 bg-yellow-500/5" },
                            { env: "live", label: "Live Trading", desc: "Real capital execution", icon: Zap, color: "border-success/30 bg-success/5" },
                          ].map(({ env, label, desc, icon: Icon, color }) => (
                            <button key={env} onClick={() => setDeployEnv(env)}
                              className={cn("p-3 rounded-lg border text-left transition-all", color, deployEnv === env ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/30")}>
                              <Icon className="w-4 h-4 mb-2" />
                              <p className="font-semibold text-sm">{label}</p>
                              <p className="text-xs text-muted-foreground">{desc}</p>
                            </button>
                          ))}
                        </div>
                        <Button onClick={() => doDeploy(selectedId!)} disabled={deploying} className="w-full">
                          <Rocket className="w-4 h-4 mr-2" />
                          {deploying ? "Deploying..." : `Deploy to ${deployEnv === "paper" ? "Paper Trading" : deployEnv === "signal" ? "Signal Mode" : "Live Trading"}`}
                        </Button>
                        {deployResult && (
                          <div className={cn("p-4 rounded-lg border", deployResult.deployed ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
                            <div className="flex items-center gap-2 mb-3">
                              {deployResult.deployed ? <CheckCircle2 className="w-5 h-5 text-success" /> : <XCircle className="w-5 h-5 text-destructive" />}
                              <p className="font-semibold">{deployResult.deployed ? "Deployed Successfully" : "Deployment Failed"}</p>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{deployResult.message}</p>
                            <div className="space-y-1">
                              {(deployResult.checks ?? []).map((c: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  {c.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
                                  <span className="font-medium">{c.name}:</span>
                                  <span className="text-muted-foreground">{c.message}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Monitor */}
                  <TabsContent value="monitor" className="space-y-4 mt-4">
                    {monitorLoading ? <Skeleton className="h-48 w-full" /> : !monitorData ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">Loading monitor data...</p>
                    ) : (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <Card><CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Status</p>
                            <p className={cn("text-xl font-bold capitalize",
                              monitorData.status === "healthy" ? "text-success" :
                              monitorData.status === "degraded" ? "text-destructive" :
                              monitorData.status === "busy" ? "text-yellow-400" : "text-muted-foreground")}>
                              ● {monitorData.status}
                            </p>
                          </CardContent></Card>
                          <Card><CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Health Score</p>
                            <p className={cn("text-2xl font-bold", (monitorData.healthScore ?? 0) >= 70 ? "text-success" : (monitorData.healthScore ?? 0) >= 40 ? "text-yellow-400" : "text-destructive")}>
                              {monitorData.healthScore ?? 0}/100
                            </p>
                          </CardContent></Card>
                          <Card><CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Recent Win Rate</p>
                            <p className={cn("text-2xl font-bold", (monitorData.recentWinRate ?? 0) >= 55 ? "text-success" : (monitorData.recentWinRate ?? 0) >= 45 ? "text-yellow-400" : "text-destructive")}>
                              {(monitorData.recentWinRate ?? 0).toFixed(1)}%
                            </p>
                          </CardContent></Card>
                          <Card><CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Performance Decay</p>
                            <p className={cn("text-2xl font-bold", (monitorData.performanceDecay ?? 0) > 10 ? "text-destructive" : (monitorData.performanceDecay ?? 0) > 5 ? "text-yellow-400" : "text-success")}>
                              {(monitorData.performanceDecay ?? 0).toFixed(1)}%
                            </p>
                          </CardContent></Card>
                        </div>
                        <Card>
                          <CardHeader><CardTitle className="text-sm">Signal Alerts</CardTitle></CardHeader>
                          <CardContent className="space-y-2">
                            {(monitorData.signals ?? []).map((s: string, i: number) => (
                              <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/10 text-sm">
                                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" /> {s}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                        {(monitorData.actions ?? []).length > 0 && (
                          <Card>
                            <CardHeader><CardTitle className="text-sm">Recommended Actions</CardTitle></CardHeader>
                            <CardContent className="space-y-2">
                              {(monitorData.actions ?? []).map((a: string, i: number) => (
                                <div key={i} className="flex items-center gap-2 p-2 rounded bg-primary/5 text-sm">
                                  <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0" /> {a}
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        )}
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Brain className="w-12 h-12 opacity-20 mb-3" />
                <p className="text-sm">Select a strategy to view details</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── DASHBOARD ── */}
        <TabsContent value="dashboard" className="space-y-6 mt-4">
          {!dashLoaded ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <Card key={i}><CardContent className="pt-5"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
            </div>
          ) : dashData ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Strategies" value={String(dashData.totalStrategies ?? 0)} sub={`${dashData.activeStrategies ?? 0} active`} icon={Brain} />
                <StatCard title="Total Return" value={formatCurrency(dashData.totalReturn ?? 0)} sub={`${(dashData.totalReturnPct ?? 0).toFixed(1)}%`}
                  color={(dashData.totalReturn ?? 0) >= 0 ? "text-success" : "text-destructive"} icon={TrendingUp} />
                <StatCard title="Avg Win Rate" value={`${(dashData.avgWinRate ?? 0).toFixed(1)}%`} sub="Portfolio average"
                  color={(dashData.avgWinRate ?? 0) >= 55 ? "text-success" : (dashData.avgWinRate ?? 0) >= 45 ? "text-yellow-400" : "text-destructive"} icon={Target} />
                <StatCard title="System Health" value={`${dashData.healthScore ?? 0}/100`} sub="Overall score"
                  color={(dashData.healthScore ?? 0) >= 70 ? "text-success" : (dashData.healthScore ?? 0) >= 50 ? "text-yellow-400" : "text-destructive"} icon={Activity} />
              </div>

              {dashData.bestStrategy && (
                <Card className="border-success/30 bg-success/5">
                  <CardContent className="pt-4 pb-4 flex items-center gap-3">
                    <Star className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="font-semibold">Best Strategy: {dashData.bestStrategy.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(dashData.bestStrategy.pnl)} P&L · {dashData.bestStrategy.winRate?.toFixed(1) ?? 0}% win rate
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                {(dashData.styleDistribution ?? []).length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Style Distribution</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {(dashData.styleDistribution ?? []).map((s: any) => (
                        <div key={s.style}>
                          <div className="flex justify-between text-xs mb-1">
                            <span>{s.style}</span>
                            <span className="text-muted-foreground">{s.count}</span>
                          </div>
                          <Progress value={dashData.totalStrategies > 0 ? (s.count / dashData.totalStrategies) * 100 : 0} className="h-2" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {dashData.lifecycle && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Lifecycle Distribution</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {LIFECYCLE_STAGES.map(({ key, label, color, bg }) => (
                        <div key={key} className={cn("flex items-center justify-between p-3 rounded-lg border border-transparent", bg)}>
                          <span className={cn("text-sm font-medium", color)}>{label}</span>
                          <span className={cn("text-lg font-bold", color)}>{dashData.lifecycle[key] ?? 0}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={fetchDash}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Refresh Dashboard
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <Button size="sm" className="mt-3" onClick={fetchDash}>Load Dashboard</Button>
            </div>
          )}
        </TabsContent>

        {/* ── AI BUILDER ── */}
        <TabsContent value="ai-builder" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                AI Strategy Builder
              </CardTitle>
              <CardDescription>Describe your ideal strategy in plain English. The AI will generate a complete ruleset with indicators, entries, exits, and risk management.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Strategy Description</Label>
                <Textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                  placeholder="e.g. aggressive momentum scalping strategy for ETHUSDT on 5m timeframe using MACD and volume filter"
                  rows={4} className="resize-none" />
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  "trend following BTCUSDT EMA RSI conservative",
                  "mean reversion ETH Bollinger Bands daily",
                  "breakout SOLUSDT volume filter aggressive",
                  "swing trading BTCUSDT MACD momentum",
                  "scalping BTC 5m fast RSI low risk",
                ].map(ex => (
                  <button key={ex} onClick={() => setAiPrompt(ex)}
                    className="px-2 py-1 rounded bg-muted/20 border border-border hover:bg-muted/40 transition-colors text-muted-foreground">
                    "{ex}"
                  </button>
                ))}
              </div>

              <Button onClick={runAiBuilder} disabled={aiBuilding || !aiPrompt.trim()} className="w-full">
                <Brain className="w-4 h-4 mr-2" />
                {aiBuilding ? "AI is building your strategy..." : "Generate Strategy"}
              </Button>

              {aiError && (
                <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />{aiError}
                </div>
              )}
            </CardContent>
          </Card>

          {aiResult && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{aiResult.name}</CardTitle>
                    <CardDescription className="mt-1">{aiResult.description}</CardDescription>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-primary">{aiResult.confidence}%</p>
                    <p className="text-xs text-muted-foreground">AI Confidence</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex gap-3 flex-wrap">
                  {[aiResult.style, aiResult.market, aiResult.timeframe].filter(Boolean).map((tag: string) => (
                    <span key={tag} className="px-2 py-1 rounded text-xs bg-primary/10 text-primary border border-primary/20">{tag}</span>
                  ))}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Indicators</p>
                  <div className="flex flex-wrap gap-2">
                    {(aiResult.indicators ?? []).map((ind: string, i: number) => (
                      <span key={i} className="px-2 py-1 rounded-md text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">{ind}</span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Entry Conditions</p>
                    {(aiResult.entryConditions ?? []).map((c: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-sm mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />{c}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Exit Conditions</p>
                    {(aiResult.exitConditions ?? []).map((c: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-sm mb-1">
                        <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />{c}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Risk Rules</p>
                    {(aiResult.riskRules ?? []).map((c: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-sm mb-1">
                        <Shield className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />{c}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { l: "Est. Win Rate", v: `${aiResult.estimatedWinRate}%` },
                    { l: "Est. Risk:Reward", v: `1:${aiResult.estimatedRR?.toFixed(1)}` },
                    { l: "Risk per Trade", v: `${aiResult.riskPerTrade}%` },
                  ].map(({ l, v }) => (
                    <div key={l} className="p-3 rounded-lg border border-border bg-muted/10 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{l}</p>
                      <p className="text-xl font-bold">{v}</p>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="flex items-center gap-3">
                  <Button onClick={saveAiStrategy} disabled={creating} className="flex-1">
                    <Plus className="w-4 h-4 mr-2" />{creating ? "Saving..." : "Save Strategy to Library"}
                  </Button>
                  <Button variant="outline" onClick={() => setAiResult(null)}>Discard</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!aiResult && (
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { title: "Pattern Recognition", desc: "Detects style keywords: trend, breakout, mean reversion, scalping, swing", icon: Brain },
                { title: "Indicator Selection", desc: "Auto-selects: EMA, RSI, MACD, Bollinger, VWAP, ATR based on context", icon: LineChart },
                { title: "Risk Configuration", desc: "Sets risk rules based on style and risk tolerance keywords", icon: Shield },
              ].map(({ title, desc, icon: Icon }) => (
                <Card key={title} className="border-border bg-muted/5">
                  <CardContent className="pt-4">
                    <Icon className="w-5 h-5 text-primary mb-2" />
                    <p className="font-semibold text-sm mb-1">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── COMPARISON ── */}
        <TabsContent value="comparison" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Performance Comparison</CardTitle>
              <CardDescription>Side-by-side comparison of all strategies by key metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {compLoading ? <Skeleton className="h-64 w-full" /> : (comparison ?? []).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No comparison data — add strategies and trades first</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Strategy</TableHead>
                        <TableHead className="text-right">Trades</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                        <TableHead className="text-right">Total P&L</TableHead>
                        <TableHead className="text-right">Avg P&L</TableHead>
                        <TableHead className="text-right">Profit Factor</TableHead>
                        <TableHead className="text-right">Max DD</TableHead>
                        <TableHead className="text-center">Rank</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...(comparison ?? [])].sort((a, b) => (b.totalPnl ?? 0) - (a.totalPnl ?? 0)).map((s, idx) => (
                        <TableRow key={s.strategyId} className={idx === 0 ? "bg-success/5" : ""}>
                          <TableCell className="font-semibold">
                            {idx === 0 && <Star className="w-3.5 h-3.5 text-yellow-400 inline mr-1.5" />}
                            {s.strategyName}
                          </TableCell>
                          <TableCell className="text-right">{s.totalTrades}</TableCell>
                          <TableCell className={cn("text-right font-semibold", (s.winRate ?? 0) >= 55 ? "text-success" : (s.winRate ?? 0) >= 45 ? "text-yellow-400" : "text-destructive")}>
                            {(s.winRate ?? 0).toFixed(1)}%
                          </TableCell>
                          <TableCell className={cn("text-right font-semibold", (s.totalPnl ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                            {formatCurrency(s.totalPnl ?? 0)}
                          </TableCell>
                          <TableCell className={cn("text-right", (s.avgPnl ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                            {formatCurrency(s.avgPnl ?? 0)}
                          </TableCell>
                          <TableCell className={cn("text-right", (s.profitFactor ?? 0) >= 1.5 ? "text-success" : (s.profitFactor ?? 0) >= 1 ? "text-yellow-400" : "text-destructive")}>
                            {(s.profitFactor ?? 0).toFixed(2)}
                          </TableCell>
                          <TableCell className={cn("text-right", (s.maxDrawdown ?? 0) > 20 ? "text-destructive" : "text-foreground")}>
                            {formatPercent(s.maxDrawdown ?? 0)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={cn("text-sm font-bold", idx === 0 ? "text-yellow-400" : "text-muted-foreground")}>#{idx + 1}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="grid gap-6 lg:grid-cols-2 mt-6">
                    <div>
                      <p className="text-sm font-semibold mb-3">Win Rate by Strategy</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={comparison ?? []} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
                          <XAxis type="number" tick={{ fontSize: 10 }} unit="%" />
                          <YAxis type="category" dataKey="strategyName" tick={{ fontSize: 10 }} width={80} />
                          <RechartsTooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                          <Bar dataKey="winRate" name="Win Rate" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-3">Total P&L by Strategy</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={comparison ?? []} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                          <YAxis type="category" dataKey="strategyName" tick={{ fontSize: 10 }} width={80} />
                          <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="totalPnl" name="Total P&L" radius={[0, 4, 4, 0]}>
                            {(comparison ?? []).map((entry, idx) => (
                              <Cell key={idx} fill={(entry.totalPnl ?? 0) >= 0 ? "#22c55e" : "#ef4444"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── LIFECYCLE ── */}
        <TabsContent value="lifecycle" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><GitBranch className="w-4 h-4" />Strategy Lifecycle Pipeline</CardTitle>
              <CardDescription>Every strategy goes through staged validation before live deployment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {[
                  { stage: "Draft", desc: "Define rules and logic", icon: Edit3, color: "bg-muted/30 border-border text-muted-foreground" },
                  { stage: "Backtest", desc: "Validate on historical data", icon: FlaskConical, color: "bg-blue-500/10 border-blue-500/30 text-blue-400" },
                  { stage: "Paper Trade", desc: "Live simulation, no risk", icon: Activity, color: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" },
                  { stage: "Optimize", desc: "AI parameter tuning", icon: Cpu, color: "bg-purple-500/10 border-purple-500/30 text-purple-400" },
                  { stage: "Deploy Live", desc: "Real capital execution", icon: Rocket, color: "bg-success/10 border-success/30 text-success" },
                ].map(({ stage, desc, icon: Icon, color }, i, arr) => (
                  <div key={stage} className="flex items-center shrink-0">
                    <div className={cn("p-3 rounded-xl border text-center min-w-[120px]", color)}>
                      <Icon className="w-5 h-5 mx-auto mb-1" />
                      <p className="text-sm font-semibold">{stage}</p>
                      <p className="text-xs opacity-70">{desc}</p>
                    </div>
                    {i < arr.length - 1 && <ChevronRight className="w-5 h-5 text-muted-foreground mx-1 shrink-0" />}
                  </div>
                ))}
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { stage: "Backtest", reqs: ["Minimum 6 months of data", "≥100 trade signals", "Out-of-sample period reserved"], min: "Win Rate ≥45%, Max DD <25%" },
                  { stage: "Paper Trading", reqs: ["Minimum 4 weeks", "≥50 paper trades", "Slippage and fees applied"], min: "Live performance matches backtest ±10%" },
                  { stage: "Live Deployment", reqs: ["Risk rules validated", "Stop loss configured", "Position sizing set"], min: "Drawdown limit active, daily loss limit set" },
                ].map(({ stage, reqs, min }) => (
                  <Card key={stage}>
                    <CardContent className="pt-4">
                      <p className="font-semibold text-sm mb-3">{stage} Requirements</p>
                      <ul className="space-y-1 mb-3">
                        {reqs.map((r, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />{r}
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-primary font-medium border-t border-border pt-2">{min}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Layers className="w-4 h-4" />Version Control</CardTitle>
              <CardDescription>Strategies are versioned automatically on each update</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { action: "New strategy created", version: "v1", note: "Initial draft" },
                  { action: "Rules updated", version: "v2", note: "Minor rule changes" },
                  { action: "Major overhaul", version: "v3", note: "Complete strategy rebuild" },
                ].map(({ action, version, note }, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/10 border border-border">
                    <span className="font-mono text-xs bg-muted/30 px-2 py-0.5 rounded text-primary">{version}</span>
                    <p className="text-sm flex-1">{action}</p>
                    <p className="text-xs text-muted-foreground">{note}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">Version auto-increments on each PATCH. Compare versions to see parameter drift over time.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ENGINE ── */}
        <TabsContent value="engine" className="space-y-6 mt-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Strategy Engine — {STRATEGY_REGISTRY.length} Independent Modules
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">Each strategy is a self-contained module with its own scoring system, risk rules, and live evaluation engine</p>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20">
              <Cpu className="w-3 h-3 mr-1" />v1.0
            </Badge>
          </div>

          {/* Module Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {STRATEGY_REGISTRY.map(mod => {
              const isSelected = selectedModule?.id === mod.id;
              const layerColors: Record<string, string> = { blue: "bg-blue-500", purple: "bg-purple-500" };
              const cardBorder = mod.color === "blue" ? "border-blue-500/30" : "border-purple-500/30";
              const badgeBg = mod.color === "blue" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20";
              return (
                <Card
                  key={mod.id}
                  onClick={() => { setSelectedModule(mod); setModuleDetailTab("overview"); setModuleEvalResult(null); }}
                  className={cn("cursor-pointer transition-all hover:shadow-md hover:border-primary/40", isSelected ? "border-primary bg-primary/5 shadow-sm" : cardBorder)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", mod.color === "blue" ? "bg-blue-500/15" : "bg-purple-500/15")}>
                          {mod.icon === "TrendingUp" ? <TrendingUp className={cn("w-4 h-4", mod.color === "blue" ? "text-blue-400" : "text-purple-400")} /> : <Zap className={cn("w-4 h-4", mod.color === "blue" ? "text-blue-400" : "text-purple-400")} />}
                        </div>
                        <div>
                          <p className="font-bold text-sm leading-tight">{mod.shortName}</p>
                          <p className="text-xs text-muted-foreground">{mod.id.replace("_", " ").toUpperCase()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className={cn("text-xs font-medium", badgeBg)}>{mod.category}</Badge>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{mod.description}</p>

                    {/* Score system preview */}
                    <div className="space-y-1.5 mb-3">
                      {mod.scoreSystem.layers.map(layer => {
                        const pct = (layer.maxPoints / mod.scoreSystem.maxScore) * 100;
                        return (
                          <div key={layer.name} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-20 shrink-0">{layer.name}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-muted/30">
                              <div className={cn("h-full rounded-full", mod.color === "blue" ? "bg-blue-500/70" : "bg-purple-500/70")} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right">{layer.maxPoints}pt</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Win Rate</p>
                        <p className="text-sm font-bold">{mod.estimatedWinRate}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">R:R Ratio</p>
                        <p className="text-sm font-bold">1:{mod.estimatedRR}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Threshold</p>
                        <p className="text-sm font-bold">{mod.scoreSystem.threshold}/100</p>
                      </div>
                    </div>

                    {/* Connections */}
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border">
                      {mod.connections.slice(0, 4).map(c => (
                        <span key={c} className="text-xs bg-muted/30 px-1.5 py-0.5 rounded text-muted-foreground">{c}</span>
                      ))}
                      {mod.connections.length > 4 && <span className="text-xs text-muted-foreground">+{mod.connections.length - 4} more</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Module Detail Panel */}
          {selectedModule ? (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {selectedModule.icon === "TrendingUp" ? <TrendingUp className="w-5 h-5 text-blue-400" /> : <Zap className="w-5 h-5 text-purple-400" />}
                      {selectedModule.name}
                    </CardTitle>
                    <CardDescription className="mt-1">{selectedModule.subcategory} · v{selectedModule.version} · {selectedModule.complexity} complexity</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("text-xs", selectedModule.color === "blue" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20")}>{selectedModule.category}</Badge>
                    <Badge variant="outline" className="text-xs bg-muted/20">min ${selectedModule.minAccountSize.toLocaleString()}</Badge>
                    <Badge variant="outline" className="text-xs bg-muted/20">{selectedModule.primaryTimeframe} primary</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={moduleDetailTab} onValueChange={setModuleDetailTab}>
                  <TabsList className="h-8 mb-4">
                    {[
                      { id: "overview", label: "Overview", icon: Eye },
                      { id: "score", label: "Score System", icon: Target },
                      { id: "rules", label: "Entry / Exit", icon: GitBranch },
                      { id: "risk", label: "Risk Rules", icon: Shield },
                      { id: "evaluate", label: "Evaluate", icon: Play },
                    ].map(({ id, label, icon: Icon }) => (
                      <TabsTrigger key={id} value={id} className="text-xs px-3">
                        <Icon className="w-3 h-3 mr-1" />{label}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {/* OVERVIEW */}
                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: "Est. Win Rate", value: `${selectedModule.estimatedWinRate}%`, sub: "Historical" },
                        { label: "Risk:Reward", value: `1:${selectedModule.estimatedRR}`, sub: "Per trade" },
                        { label: "Sharpe Ratio", value: selectedModule.estimatedSharpe.toFixed(1), sub: "Estimated" },
                        { label: "Score Threshold", value: `${selectedModule.scoreSystem.threshold}/100`, sub: "Min to trade" },
                      ].map(({ label, value, sub }) => (
                        <div key={label} className="p-3 rounded-lg border border-border bg-muted/10 text-center">
                          <p className="text-xs text-muted-foreground mb-1">{label}</p>
                          <p className="text-xl font-bold">{value}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-success" />Best Conditions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedModule.bestMarketConditions.map(c => (
                            <span key={c} className="text-xs bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full">{c}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><XCircle className="w-4 h-4 text-destructive" />Avoid Conditions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedModule.avoidConditions.map(c => (
                            <span key={c} className="text-xs bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full">{c}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Network className="w-4 h-4 text-primary" />Module Connections</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedModule.connections.map(c => (
                          <div key={c} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-muted/10 text-xs font-medium">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            {c}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold mb-2">Indicators</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {selectedModule.indicators.map(ind => (
                          <div key={ind.name} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/5">
                            <div>
                              <p className="text-xs font-semibold">{ind.name}</p>
                              <p className="text-xs text-muted-foreground">{ind.description}</p>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <span className="text-xs bg-muted/30 px-1.5 py-0.5 rounded text-muted-foreground">{ind.layer}</span>
                              {ind.weight > 0 && <span className="ml-1 text-xs font-bold text-primary">{ind.weight}pt</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold mb-2">Supported Assets & Timeframes</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {selectedModule.supportedAssets.map(a => (
                          <span key={a} className={cn("text-xs px-2 py-0.5 rounded border font-mono", a === selectedModule.supportedAssets[0] ? "bg-primary/10 text-primary border-primary/20" : "bg-muted/20 text-muted-foreground border-border")}>{a}</span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedModule.supportedTimeframes.map(t => (
                          <span key={t} className={cn("text-xs px-2 py-0.5 rounded border font-mono", t === selectedModule.primaryTimeframe ? "bg-primary/10 text-primary border-primary/20" : "bg-muted/20 text-muted-foreground border-border")}>{t === selectedModule.primaryTimeframe ? `${t} (primary)` : t}</span>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* SCORE SYSTEM */}
                  <TabsContent value="score" className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-bold">5-Layer Scoring System</p>
                        <p className="text-xs text-muted-foreground">Trade executes only when total score ≥ {selectedModule.scoreSystem.threshold}/100</p>
                      </div>
                      <div className="text-center p-2 rounded-lg border border-border bg-muted/10">
                        <p className="text-2xl font-black text-primary">{selectedModule.scoreSystem.threshold}</p>
                        <p className="text-xs text-muted-foreground">threshold</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {selectedModule.scoreSystem.layers.map((layer, idx) => {
                        const pct = (layer.maxPoints / selectedModule.scoreSystem.maxScore) * 100;
                        const colors = ["bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-cyan-500", "bg-emerald-500"];
                        const textColors = ["text-blue-400", "text-indigo-400", "text-violet-400", "text-cyan-400", "text-emerald-400"];
                        return (
                          <div key={layer.name} className="p-3 rounded-lg border border-border bg-muted/5">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="text-xs font-mono text-muted-foreground mr-2">Layer {idx + 1}</span>
                                <span className="text-sm font-semibold">{layer.name}</span>
                                <span className="ml-2 text-xs text-muted-foreground">— {layer.indicator}</span>
                              </div>
                              <span className={cn("text-sm font-black", textColors[idx % textColors.length])}>{layer.maxPoints}pts</span>
                            </div>
                            <div className="w-full h-3 rounded-full bg-muted/30">
                              <div className={cn("h-full rounded-full transition-all", colors[idx % colors.length])} style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">{layer.description}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                      <p className="text-sm font-semibold mb-1">Score Interpretation</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { range: `0–${selectedModule.scoreSystem.threshold - 1}`, label: "No Trade", color: "text-muted-foreground" },
                          { range: `${selectedModule.scoreSystem.threshold}–84`, label: "Valid Entry", color: "text-yellow-400" },
                          { range: "85–100", label: "High Confidence", color: "text-success" },
                        ].map(({ range, label, color }) => (
                          <div key={range} className="text-center">
                            <p className={cn("text-sm font-bold", color)}>{range}</p>
                            <p className="text-xs text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold mb-2">Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedModule.tags.map(t => (
                          <span key={t} className="text-xs bg-muted/20 border border-border px-2 py-0.5 rounded-full text-muted-foreground">#{t}</span>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* RULES */}
                  <TabsContent value="rules" className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-success mb-2 flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4" />LONG Entry Rules
                        </p>
                        <div className="space-y-1.5">
                          {selectedModule.entryRules.long.map((rule, i) => (
                            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-success/5 border border-success/15">
                              <span className="text-xs font-bold text-success mt-0.5 shrink-0">{i + 1}</span>
                              <p className="text-xs">{rule}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-destructive mb-2 flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 rotate-180" />SHORT Entry Rules
                        </p>
                        <div className="space-y-1.5">
                          {selectedModule.entryRules.short.map((rule, i) => (
                            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/15">
                              <span className="text-xs font-bold text-destructive mt-0.5 shrink-0">{i + 1}</span>
                              <p className="text-xs">{rule}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <p className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Target className="w-4 h-4 text-primary" />Exit Rules</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[
                          { label: "Take Profit", value: selectedModule.exitRules.takeProfit, color: "text-success", bgColor: "bg-success/5 border-success/20" },
                          { label: "Stop Loss", value: selectedModule.exitRules.stopLoss, color: "text-destructive", bgColor: "bg-destructive/5 border-destructive/20" },
                          ...(selectedModule.exitRules.trailingStop ? [{ label: "Trailing Stop", value: "Enabled", color: "text-yellow-400", bgColor: "bg-yellow-500/5 border-yellow-500/20" }] : []),
                          ...(selectedModule.exitRules.trailingActivation ? [{ label: "Trail Activation", value: selectedModule.exitRules.trailingActivation, color: "text-yellow-400", bgColor: "bg-yellow-500/5 border-yellow-500/20" }] : []),
                          ...(selectedModule.exitRules.trailingDistance ? [{ label: "Trail Distance", value: selectedModule.exitRules.trailingDistance, color: "text-orange-400", bgColor: "bg-orange-500/5 border-orange-500/20" }] : []),
                        ].map(({ label, value, color, bgColor }) => (
                          <div key={label} className={cn("p-2.5 rounded-lg border", bgColor)}>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className={cn("text-sm font-semibold mt-0.5", color)}>{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* RISK */}
                  <TabsContent value="risk" className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        { label: "Risk Per Trade", value: `${selectedModule.riskRules.riskPerTrade}%`, sub: "of account balance", color: "text-primary" },
                        { label: "Max Positions", value: selectedModule.riskRules.maxPositions.toString(), sub: "simultaneous trades", color: "text-primary" },
                        { label: "Max Drawdown", value: `${selectedModule.riskRules.maxDrawdown}%`, sub: "auto-pause level", color: "text-yellow-400" },
                        { label: "Daily Loss Limit", value: `${selectedModule.riskRules.dailyLossLimit}%`, sub: "session halt", color: "text-destructive" },
                        { label: "Position Sizing", value: selectedModule.riskRules.positionSizing.split(" ")[0], sub: selectedModule.riskRules.positionSizing.split(" ").slice(1).join(" "), color: "text-foreground" },
                        { label: "Complexity", value: selectedModule.complexity, sub: "strategy level", color: "text-muted-foreground" },
                      ].map(({ label, value, sub, color }) => (
                        <div key={label} className="p-3 rounded-lg border border-border bg-muted/5">
                          <p className="text-xs text-muted-foreground mb-1">{label}</p>
                          <p className={cn("text-lg font-bold", color)}>{value}</p>
                          <p className="text-xs text-muted-foreground">{sub}</p>
                        </div>
                      ))}
                    </div>

                    <div>
                      <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Shield className="w-4 h-4 text-primary" />Risk Rules</p>
                      <div className="space-y-1.5">
                        {selectedModule.riskRulesList.map((rule, i) => (
                          <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border border-border bg-muted/5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <p className="text-xs">{rule}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* EVALUATE */}
                  <TabsContent value="evaluate" className="space-y-4">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div>
                        <p className="text-sm font-semibold">Live Strategy Evaluation</p>
                        <p className="text-xs text-muted-foreground">Fetches real Bybit candles and runs the full scoring engine</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={moduleEvalAsset}
                          onChange={e => setModuleEvalAsset(e.target.value)}
                          className="text-xs px-2 py-1.5 rounded-md border border-border bg-background text-foreground"
                        >
                          {selectedModule.supportedAssets.map(a => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                        <Button size="sm" onClick={() => runModuleEval(selectedModule.id)} disabled={moduleEvalLoading}>
                          {moduleEvalLoading ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
                          {moduleEvalLoading ? "Evaluating…" : "Run Evaluation"}
                        </Button>
                      </div>
                    </div>

                    {!moduleEvalResult && !moduleEvalLoading && (
                      <div className="rounded-lg border border-dashed border-border p-8 text-center">
                        <Cpu className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                        <p className="text-sm text-muted-foreground">Select an asset and click <strong>Run Evaluation</strong> to analyze live market conditions</p>
                        <p className="text-xs text-muted-foreground mt-1">Uses {selectedModule.primaryTimeframe} candles from Bybit</p>
                      </div>
                    )}

                    {moduleEvalResult && !moduleEvalResult.error && (
                      <div className="space-y-4">
                        {/* Result Header */}
                        <div className={cn("p-4 rounded-xl border", moduleEvalResult.action === "BUY" ? "bg-success/8 border-success/30" : moduleEvalResult.action === "SELL" ? "bg-destructive/8 border-destructive/30" : "bg-muted/10 border-border")}>
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                              <div className={cn("text-2xl font-black px-4 py-2 rounded-lg", moduleEvalResult.action === "BUY" ? "bg-success/15 text-success" : moduleEvalResult.action === "SELL" ? "bg-destructive/15 text-destructive" : "bg-muted/20 text-muted-foreground")}>
                                {moduleEvalResult.action}
                              </div>
                              <div>
                                <p className="font-semibold">{moduleEvalResult.asset}</p>
                                <p className="text-xs text-muted-foreground">{moduleEvalResult.timeframe} · AI: {moduleEvalResult.aiConfidence}% {moduleEvalResult.aiSentiment}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-black text-primary">{moduleEvalResult.totalScore}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                              <p className="text-xs text-muted-foreground">Total Score {moduleEvalResult.passesThreshold ? "✓ Threshold met" : "✗ Below threshold"}</p>
                            </div>
                          </div>
                        </div>

                        {/* Score Breakdown */}
                        <div>
                          <p className="text-sm font-semibold mb-2">Score Breakdown</p>
                          <div className="space-y-2">
                            {(moduleEvalResult.breakdown ?? []).map((layer: any) => (
                              <div key={layer.layer} className="p-2.5 rounded-lg border border-border bg-muted/5">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    {layer.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                                    <span className="text-xs font-semibold">{layer.layer}</span>
                                  </div>
                                  <span className={cn("text-xs font-bold", layer.passed ? "text-success" : "text-muted-foreground")}>{layer.score}/{layer.maxScore}</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-muted/30 mb-1">
                                  <div className={cn("h-full rounded-full", layer.passed ? "bg-success" : "bg-muted/40")} style={{ width: `${(layer.score / layer.maxScore) * 100}%` }} />
                                </div>
                                <p className="text-xs text-muted-foreground">{layer.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Exit Levels */}
                        {moduleEvalResult.exitLevels && (
                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-2.5 rounded-lg border border-destructive/20 bg-destructive/5 text-center">
                              <p className="text-xs text-muted-foreground">Stop Loss</p>
                              <p className="text-sm font-bold text-destructive">${moduleEvalResult.exitLevels.stopLoss?.toLocaleString()}</p>
                            </div>
                            <div className="p-2.5 rounded-lg border border-border bg-muted/10 text-center">
                              <p className="text-xs text-muted-foreground">Entry (Current)</p>
                              <p className="text-sm font-bold">${moduleEvalResult.indicators?.currentPrice?.toLocaleString() ?? "—"}</p>
                            </div>
                            <div className="p-2.5 rounded-lg border border-success/20 bg-success/5 text-center">
                              <p className="text-xs text-muted-foreground">Take Profit</p>
                              <p className="text-sm font-bold text-success">${moduleEvalResult.exitLevels.takeProfit?.toLocaleString()}</p>
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground text-center">Evaluated at {new Date(moduleEvalResult.timestamp).toLocaleTimeString()} · {moduleEvalResult.strategyName}</p>
                      </div>
                    )}

                    {moduleEvalResult?.error && (
                      <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 flex items-center gap-2 text-destructive text-sm">
                        <AlertTriangle className="w-4 h-4 shrink-0" />{moduleEvalResult.error}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-20" />
              <p className="text-muted-foreground font-medium">Select a strategy module above to view details</p>
              <p className="text-xs text-muted-foreground mt-1">Click any module card to explore its architecture, score system, rules and run live evaluation</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
