import { useState, useEffect, useRef } from "react";
import {
  useGetMarketPrices,
  useAnalyzeMarket,
  useListAiDecisions,
  getListAiDecisionsQueryKey,
  getGetMarketPricesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain, Activity, TrendingUp, TrendingDown, Minus, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, Shield, Zap, BarChart2,
  Globe, GitBranch, Cpu, Layers, Heart, Target, Clock, ChevronRight,
  Award, AlertTriangle, Info, BookOpen, Database, Gauge, PlayCircle,
  SquareStack, History, FlaskConical, Star, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "AVAXUSDT", "ADAUSDT", "DOGEUSDT"];
const TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1H", "4H", "1D", "1W"];
const RISK_PROFILES = ["conservative", "balanced", "aggressive"];
const STRATEGIES = ["scalping", "intraday", "swing", "long-term", "custom"];
const MARKET_TYPES = ["spot", "futures", "margin"];

// ─── TYPES ───────────────────────────────────────────────────────────────────
type AgentResult = {
  name: string; icon: string; direction: string; score: number; confidence: number;
  keyFindings: string[]; [key: string]: unknown;
};
type ConsensusVote = { agent: string; direction: string; confidence: number };
type ConfidenceItem = { factor: string; weight: number; score: number; contribution: number };
type Scenario = { id: string; name: string; probability: number; description: string; expectedMove: string; keyConditions: string[]; risk: string; opportunity: string; invalidation?: string };
type TimelineStep = { step: number; title: string; status: string; detail: string; duration: number };
type TradeProposal = { signal: string; entry: number; stopLoss: number | null; tp1: number | null; tp2: number | null; tp3: number | null; riskReward: number; winProbability: number; maxRisk: string; expectedDuration: string; invalidationCondition: string };
type AnalysisResult = {
  decision: string; confidence: number;
  consensus: { direction: string; bullishVotes: number; bearishVotes: number; neutralVotes: number; agreement: number; disagreementHigh: boolean; votes: ConsensusVote[] };
  confidenceBreakdown: ConfidenceItem[];
  agentResults: Record<string, AgentResult>;
  tradeProposal: TradeProposal;
  scenarios: Scenario[];
  reasoningTimeline: TimelineStep[];
  explainability: { whyGenerated: string; topFactors: { factor: string; influence: string; direction: string }[]; disagreements: string[]; invalidationConditions: string[] };
  reasoning: { summary: string; evidence: string[]; agreement: number; analysisTimeMs: number };
  performance: { totalDecisions: number; historicalWinRate: number; avgConfidence: number; avgReturn: number; totalTrades: number };
  meta: { symbol: string; timeframe: string; riskProfile: string; strategy: string; analysisTimeMs: number };
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function directionColor(dir: string) {
  if (dir === "bullish" || dir === "approved") return "text-emerald-400";
  if (dir === "bearish" || dir === "rejected") return "text-red-400";
  return "text-yellow-400";
}
function directionBg(dir: string) {
  if (dir === "bullish" || dir === "approved") return "bg-emerald-500/10 border-emerald-500/30";
  if (dir === "bearish" || dir === "rejected") return "bg-red-500/10 border-red-500/30";
  return "bg-yellow-500/10 border-yellow-500/30";
}
function decisionColor(d: string) {
  if (d === "BUY") return "text-emerald-400";
  if (d === "SELL") return "text-red-400";
  if (d === "NO TRADE") return "text-slate-400";
  return "text-yellow-400";
}
function confidenceColor(v: number) {
  return v >= 75 ? "text-emerald-400" : v >= 55 ? "text-yellow-400" : "text-red-400";
}
function scoreBar(v: number) {
  return v >= 70 ? "bg-emerald-500" : v >= 50 ? "bg-yellow-500" : "bg-red-500";
}
function agentIcon(icon: string) {
  const map: Record<string, React.ElementType> = {
    layers: Layers, "trending-up": TrendingUp, "building-2": Shield, "bar-chart-2": BarChart2,
    zap: Zap, activity: Activity, globe: Globe, "git-branch": GitBranch,
    cpu: Cpu, heart: Heart, shapes: SquareStack, shield: Shield,
  };
  return map[icon] ?? Brain;
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function StatusDot({ active }: { active: boolean }) {
  return <span className={cn("w-2 h-2 rounded-full shrink-0", active ? "bg-emerald-400 animate-pulse" : "bg-slate-500")} />;
}

function StatChip({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-3 rounded-xl bg-muted/30 border border-border min-w-[90px]">
      <span className="text-xs text-muted-foreground mb-0.5">{label}</span>
      <span className="text-lg font-bold tabular-nums">{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground mt-0.5">{sub}</span>}
    </div>
  );
}

function AgentCard({ agent, isRunning }: { agent: AgentResult; isRunning: boolean }) {
  const Icon = agentIcon(agent.icon);
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), Math.random() * 600); return () => clearTimeout(t); }, []);

  if (isRunning && !visible) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-muted/60" />
          <div className="w-24 h-3 rounded bg-muted/60" />
        </div>
        <div className="w-full h-2 rounded bg-muted/60" />
        <div className="w-3/4 h-2 rounded bg-muted/60" />
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border p-4 space-y-3 transition-all", directionBg(agent.direction))}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", directionBg(agent.direction))}>
            <Icon className={cn("w-3.5 h-3.5", directionColor(agent.direction))} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{agent.name}</span>
        </div>
        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border capitalize", directionColor(agent.direction), directionBg(agent.direction))}>
          {agent.direction}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Score</span>
          <span className={cn("font-bold tabular-nums", confidenceColor(agent.score))}>{agent.score}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-700", scoreBar(agent.score))} style={{ width: `${agent.score}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Confidence</span>
          <span className="text-muted-foreground tabular-nums">{agent.confidence}%</span>
        </div>
      </div>

      <ul className="space-y-1">
        {(agent.keyFindings as string[]).slice(0, 3).map((f, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn("mt-1.5 w-1 h-1 rounded-full shrink-0", directionColor(agent.direction))} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConsensusBar({ votes }: { votes: ConsensusVote[] }) {
  const bullish = votes.filter((v) => v.direction === "bullish" || v.direction === "approved").length;
  const bearish = votes.filter((v) => v.direction === "bearish" || v.direction === "rejected").length;
  const neutral = votes.filter((v) => v.direction === "neutral").length;
  const total = votes.length || 1;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 h-4 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-l-full transition-all duration-700" style={{ width: `${(bullish / total) * 100}%` }} />
        <div className="h-full bg-yellow-500 transition-all duration-700" style={{ width: `${(neutral / total) * 100}%` }} />
        <div className="h-full bg-red-500 rounded-r-full transition-all duration-700" style={{ width: `${(bearish / total) * 100}%` }} />
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500" />{bullish} Bullish</span>
        <span className="flex items-center gap-1 text-yellow-400"><span className="w-2 h-2 rounded-full bg-yellow-500" />{neutral} Neutral</span>
        <span className="flex items-center gap-1 text-red-400"><span className="w-2 h-2 rounded-full bg-red-500" />{bearish} Bearish</span>
      </div>
    </div>
  );
}

function TimelineView({ steps, running }: { steps: TimelineStep[]; running: boolean }) {
  const [revealed, setRevealed] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (running) { setRevealed(0); return; }
    if (steps.length === 0) return;
    setRevealed(0);
    let i = 0;
    function next() {
      i++;
      setRevealed(i);
      if (i < steps.length) { timer.current = setTimeout(next, 220); }
    }
    timer.current = setTimeout(next, 100);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [steps, running]);

  if (steps.length === 0) return null;
  return (
    <div className="relative pl-6 space-y-0">
      {steps.map((step, i) => (
        <div key={step.step} className={cn("relative flex gap-4 pb-4 transition-all duration-500", i < revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")}>
          <div className="flex flex-col items-center">
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0 z-10 text-[10px] font-bold", i < revealed ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground")}>
              {i < revealed ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.step}
            </div>
            {i < steps.length - 1 && <div className={cn("w-px flex-1 mt-1", i < revealed - 1 ? "bg-primary/40" : "bg-border")} style={{ minHeight: 20 }} />}
          </div>
          <div className="flex-1 pt-0.5 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{step.title}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{step.duration.toFixed(0)}ms</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScenarioCard({ s }: { s: Scenario }) {
  const color = s.id === "A" ? "border-emerald-500/40 bg-emerald-500/5" : s.id === "B" ? "border-yellow-500/40 bg-yellow-500/5" : "border-red-500/40 bg-red-500/5";
  const labelColor = s.id === "A" ? "text-emerald-400" : s.id === "B" ? "text-yellow-400" : "text-red-400";
  const riskColor = s.risk === "Low" ? "text-emerald-400" : s.risk === "Medium" ? "text-yellow-400" : "text-red-400";
  return (
    <div className={cn("rounded-xl border p-5 space-y-3", color)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-xs font-bold uppercase tracking-wider", labelColor)}>Scenario {s.id}</span>
            <Badge variant="outline" className={cn("text-[10px]", labelColor)}>{s.probability}% probable</Badge>
          </div>
          <h4 className="font-semibold text-sm">{s.name}</h4>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground">Expected Move</div>
          <div className={cn("text-sm font-bold", labelColor)}>{s.expectedMove}</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
      <div className="space-y-1">
        {s.keyConditions.map((c, i) => (
          <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ChevronRight className={cn("w-3 h-3 mt-0.5 shrink-0", labelColor)} />
            {c}
          </div>
        ))}
      </div>
      <div className="flex gap-3 pt-1">
        <div className="text-xs">
          <span className="text-muted-foreground">Risk: </span>
          <span className={cn("font-semibold", riskColor)}>{s.risk}</span>
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">Opportunity: </span>
          <span className="font-semibold text-primary">{s.opportunity}</span>
        </div>
      </div>
      {s.invalidation && (
        <div className="text-[11px] text-muted-foreground border-t border-border/50 pt-2">
          <span className="text-red-400 font-medium">Invalidation: </span>{s.invalidation}
        </div>
      )}
    </div>
  );
}

function DecisionHistoryCard({ d }: { d: { id: number; symbol: string; decision: string; confidence: number; reasoning: unknown; agent_votes: unknown; created_at: string } }) {
  const r = d.reasoning as Record<string, unknown> | null;
  const evidence = (r?.evidence ?? []) as string[];
  const decColor = d.decision === "BUY" ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/8" : d.decision === "SELL" ? "text-red-400 border-red-500/40 bg-red-500/8" : d.decision === "NO TRADE" ? "text-slate-400 border-slate-500/30 bg-slate-500/5" : "text-yellow-400 border-yellow-500/40 bg-yellow-500/8";
  return (
    <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-2 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{d.symbol}</span>
          <Badge variant="outline" className={cn("text-xs font-bold", decColor)}>{d.decision}</Badge>
          <span className={cn("text-sm font-bold tabular-nums", confidenceColor(d.confidence))}>{d.confidence}%</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
      </div>
      {evidence.length > 0 && (
        <ul className="space-y-1">
          {evidence.slice(0, 3).map((e, i) => (
            <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
              {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AiCenter() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("4H");
  const [marketType, setMarketType] = useState("spot");
  const [riskProfile, setRiskProfile] = useState("balanced");
  const [strategy, setStrategy] = useState("swing");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();

  const { data: prices } = useGetMarketPrices({ query: { queryKey: getGetMarketPricesQueryKey() } });
  const { data: decisions, isLoading: loadingDecisions } = useListAiDecisions({ query: { queryKey: getListAiDecisionsQueryKey() } });

  const { mutate: analyze, isPending: analyzing, data: rawResult } = useAnalyzeMarket({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAiDecisionsQueryKey() });
        if (timerRef.current) clearInterval(timerRef.current);
        setElapsedSec(0);
        setActiveTab("agents");
      },
    },
  });

  // Timer while analyzing
  useEffect(() => {
    if (analyzing) {
      setElapsedSec(0);
      timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [analyzing]);

  const result = rawResult as AnalysisResult | undefined;
  const livePrice = prices?.find((p) => p.symbol === symbol);

  const agents = result ? Object.values(result.agentResults) : [];
  const agentList = ["marketStructure", "priceAction", "smartMoney", "volume", "momentum", "volatility", "trend", "derivatives", "sentiment", "macro", "correlation", "pattern", "mlPrediction", "risk"];

  const statusLabel = analyzing ? "Analyzing" : result ? "Ready" : "Waiting";
  const statusColor = analyzing ? "text-yellow-400" : result ? "text-emerald-400" : "text-slate-400";

  function runAnalysis() {
    setActiveTab("dashboard");
    analyze({ data: { symbol, timeframe, riskProfile, strategy } as unknown as Parameters<typeof analyze>[0]["data"] });
  }

  // ── Perf stats
  const perf = result?.performance;
  const totalDec = (decisions?.length ?? 0);

  return (
    <div className="space-y-5">
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Brain className="w-4.5 h-4.5 text-primary" />
            </div>
            AI Center
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Institutional Multi-Agent Decision Engine — 14 specialized AI agents working in consensus</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border", analyzing ? "border-yellow-500/40 bg-yellow-500/10" : result ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-muted/30")}>
            <StatusDot active={!!result || analyzing} />
            <span className={statusColor}>{statusLabel}</span>
          </div>
          {analyzing && (
            <span className="text-xs text-muted-foreground tabular-nums">{elapsedSec}s</span>
          )}
        </div>
      </div>

      {/* ── MARKET SELECTION BAR ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Asset */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Asset</label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SYMBOLS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Timeframe */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Timeframe</label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEFRAMES.map((tf) => <SelectItem key={tf} value={tf}>{tf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Market Type */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Market</label>
              <Select value={marketType} onValueChange={setMarketType}>
                <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MARKET_TYPES.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Risk Profile */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Risk Profile</label>
              <Select value={riskProfile} onValueChange={setRiskProfile}>
                <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RISK_PROFILES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Strategy */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Strategy</label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Live price chip */}
            {livePrice && (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm h-9">
                <span className="text-muted-foreground text-xs">Live</span>
                <span className="font-bold tabular-nums">${livePrice.price.toLocaleString()}</span>
                <span className={cn("text-xs", (livePrice.change24h ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {(livePrice.change24h ?? 0) >= 0 ? "+" : ""}{livePrice.change24h?.toFixed(2)}%
                </span>
              </div>
            )}

            <Button onClick={runAnalysis} disabled={analyzing} className="h-9 gap-2 ml-auto bg-primary hover:bg-primary/90 font-semibold px-5">
              {analyzing
                ? <><RefreshCw className="w-4 h-4 animate-spin" />Analyzing {agentList.length} Agents…</>
                : <><PlayCircle className="w-4 h-4" />Run AI Analysis</>
              }
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── MAIN TABS ────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto bg-muted/30 p-1 rounded-xl">
          {[
            { id: "dashboard", label: "Dashboard", icon: Gauge },
            { id: "agents", label: "Agents", icon: Brain },
            { id: "consensus", label: "Consensus", icon: Award },
            { id: "proposal", label: "Trade Proposal", icon: Target },
            { id: "scenarios", label: "Scenarios", icon: FlaskConical },
            { id: "timeline", label: "Reasoning", icon: Clock },
            { id: "explain", label: "Explainability", icon: BookOpen },
            { id: "history", label: "History", icon: History },
            { id: "performance", label: "Performance", icon: BarChart2 },
          ].map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="text-xs gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Icon className="w-3.5 h-3.5" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: DASHBOARD
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {/* Status grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatChip label="AI Status" value={statusLabel} />
            <StatChip label="Active Agents" value={analyzing ? "14" : result ? "14" : "0"} sub="running" />
            <StatChip label="Decisions Today" value={totalDec} />
            <StatChip label="Avg Confidence" value={result ? `${result.consensus.agreement}%` : perf?.avgConfidence ? `${perf.avgConfidence}%` : "—"} />
            <StatChip label="Win Rate" value={perf?.historicalWinRate ? `${perf.historicalWinRate}%` : "—"} />
            <StatChip label="Signals" value={totalDec} sub="generated" />
            <StatChip label="Avg Return" value={perf?.avgReturn ? `${perf.avgReturn > 0 ? "+" : ""}${perf.avgReturn}%` : "—"} />
          </div>

          {/* System health */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" />System Status</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {[
                  { label: "AI Engine", status: true },
                  { label: "API Connection", status: true },
                  { label: "Market Feed", status: true },
                  { label: "Database", status: true },
                  { label: "Risk Engine", status: true },
                ].map(({ label, status }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <StatusDot active={status} />
                      <span className={status ? "text-emerald-400 text-xs" : "text-red-400 text-xs"}>{status ? "Online" : "Offline"}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2"><Database className="w-4 h-4 text-primary" />Platform Stats</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {[
                  { label: "Total Analyses", value: totalDec },
                  { label: "Historical Win Rate", value: perf?.historicalWinRate ? `${perf.historicalWinRate}%` : "—" },
                  { label: "Avg Decision Time", value: result ? `${result.meta.analysisTimeMs}ms` : "—" },
                  { label: "Model Response", value: "< 2s" },
                  { label: "Last Analysis", value: result ? `${symbol} ${timeframe}` : "None yet" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium tabular-nums">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2"><Star className="w-4 h-4 text-primary" />Last Decision</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {result ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className={cn("text-4xl font-black", decisionColor(result.decision))}>{result.decision}</span>
                      <div>
                        <div className="text-sm text-muted-foreground">{result.meta.symbol} · {result.meta.timeframe}</div>
                        <div className={cn("text-xl font-bold tabular-nums", confidenceColor(result.confidence))}>{result.confidence}% confidence</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{result.reasoning.summary}</div>
                    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setActiveTab("proposal")}>View Trade Proposal →</Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                    <Brain className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-xs text-center">Run an analysis to see the latest decision</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Live market prices */}
          {prices && prices.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" />Live Market Feed</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  {prices.map((p) => (
                    <div key={p.symbol} className="p-2.5 rounded-lg bg-muted/20 border border-border space-y-0.5">
                      <div className="text-xs text-muted-foreground font-medium">{p.symbol}</div>
                      <div className="text-sm font-bold tabular-nums">${p.price?.toLocaleString()}</div>
                      <div className={cn("text-[11px] tabular-nums font-medium", (p.change24h ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {(p.change24h ?? 0) >= 0 ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
                        {Math.abs(p.change24h ?? 0).toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: AGENTS
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="agents" className="mt-4 space-y-4">
          {!result && !analyzing ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Brain className="w-12 h-12 mb-3 opacity-20" />
                <h3 className="font-semibold mb-1">14 Specialized Agents Ready</h3>
                <p className="text-sm text-muted-foreground max-w-md">Configure your market parameters above and click <strong>Run AI Analysis</strong> to dispatch all agents simultaneously.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {analyzing && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
                  <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-400">14 agents analyzing {symbol} {timeframe} simultaneously…</p>
                    <p className="text-xs text-muted-foreground">Each agent works independently — no result sharing until consensus phase</p>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{elapsedSec}s</span>
                </div>
              )}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {analyzing
                  ? agentList.map((k) => (
                    <AgentCard key={k} agent={{ name: k, icon: "brain", direction: "neutral", score: 0, confidence: 0, keyFindings: [] }} isRunning />
                  ))
                  : result && Object.entries(result.agentResults).map(([k, agent]) => (
                    <AgentCard key={k} agent={agent as AgentResult} isRunning={false} />
                  ))
                }
              </div>
            </>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: CONSENSUS
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="consensus" className="mt-4 space-y-4">
          {!result ? (
            <Card><CardContent className="flex items-center justify-center py-16 text-muted-foreground"><Brain className="w-8 h-8 mr-3 opacity-20" /><p>No analysis yet</p></CardContent></Card>
          ) : (
            <>
              {/* Consensus hero */}
              <Card className="border-primary/20 bg-primary/3">
                <CardContent className="pt-6 pb-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="text-center">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Final Decision</div>
                      <div className={cn("text-6xl font-black", decisionColor(result.decision))}>{result.decision}</div>
                    </div>
                    <Separator orientation="vertical" className="hidden sm:block h-20" />
                    <div className="text-center">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Confidence</div>
                      <div className={cn("text-5xl font-black tabular-nums", confidenceColor(result.confidence))}>{result.confidence}%</div>
                    </div>
                    <Separator orientation="vertical" className="hidden sm:block h-20" />
                    <div className="text-center">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Agreement</div>
                      <div className="text-5xl font-black tabular-nums">{result.consensus.agreement}%</div>
                    </div>
                    <div className="flex-1 min-w-48 space-y-2">
                      <ConsensusBar votes={result.consensus.votes} />
                      {result.consensus.disagreementHigh && (
                        <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          High disagreement — NO TRADE recommended
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Vote table */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm">Agent Votes</CardTitle>
                  <CardDescription className="text-xs">Each agent voted independently — results compared after all completed</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {result.consensus.votes.map((v) => (
                      <div key={v.agent} className="flex items-center gap-3">
                        <span className="text-sm w-36 shrink-0">{v.agent}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-700", v.direction === "bullish" || v.direction === "approved" ? "bg-emerald-500" : v.direction === "bearish" || v.direction === "rejected" ? "bg-red-500" : "bg-yellow-500")} style={{ width: `${v.confidence}%` }} />
                        </div>
                        <span className={cn("text-xs font-semibold w-20 text-right capitalize", directionColor(v.direction))}>{v.direction}</span>
                        <span className={cn("text-xs tabular-nums w-10 text-right", confidenceColor(v.confidence))}>{v.confidence}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Confidence breakdown */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><Gauge className="w-4 h-4 text-primary" />Confidence Calculation</CardTitle>
                  <CardDescription className="text-xs">Weighted evidence formula — each factor contributes mathematically</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {result.confidenceBreakdown.map((item) => (
                    <div key={item.factor} className="flex items-center gap-3">
                      <span className="text-xs w-36 shrink-0">{item.factor}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                        <div className={cn("h-full rounded-full", scoreBar(item.score))} style={{ width: `${item.score}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(item.weight * 100)}%</span>
                      <span className={cn("text-xs font-bold tabular-nums w-10 text-right", confidenceColor(item.score))}>{item.score}%</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Weighted Confidence</span>
                    <span className={cn("text-2xl font-black tabular-nums", confidenceColor(result.confidence))}>{result.confidence}%</span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: TRADE PROPOSAL
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="proposal" className="mt-4 space-y-4">
          {!result ? (
            <Card><CardContent className="flex items-center justify-center py-16 text-muted-foreground"><Target className="w-8 h-8 mr-3 opacity-20" /><p>No trade proposal yet — run analysis first</p></CardContent></Card>
          ) : (
            <>
              <Card className={cn("border-2", result.decision === "BUY" ? "border-emerald-500/30" : result.decision === "SELL" ? "border-red-500/30" : "border-slate-500/20")}>
                <CardHeader className="pb-3 pt-5 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" />
                      Trade Proposal
                    </CardTitle>
                    <div className={cn("flex items-center gap-2 px-4 py-2 rounded-full border-2 text-sm font-bold", result.decision === "BUY" ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" : result.decision === "SELL" ? "border-red-500 text-red-400 bg-red-500/10" : "border-slate-500 text-slate-400 bg-slate-500/10")}>
                      {result.decision === "BUY" ? <TrendingUp className="w-4 h-4" /> : result.decision === "SELL" ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                      {result.tradeProposal.signal}
                    </div>
                  </div>
                  <CardDescription className="text-xs">{result.meta.symbol} · {result.meta.timeframe} · {result.meta.strategy} · {result.meta.riskProfile} risk</CardDescription>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-4">
                  {result.tradeProposal.stopLoss ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Entry</div>
                          <div className="text-lg font-bold tabular-nums">${result.tradeProposal.entry.toLocaleString()}</div>
                        </div>
                        <div className="p-3 rounded-xl bg-red-500/8 border border-red-500/30 space-y-1">
                          <div className="text-[10px] uppercase tracking-widest text-red-400">Stop Loss</div>
                          <div className="text-lg font-bold tabular-nums text-red-400">${result.tradeProposal.stopLoss?.toLocaleString()}</div>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/30 space-y-1">
                          <div className="text-[10px] uppercase tracking-widest text-emerald-400">TP1</div>
                          <div className="text-lg font-bold tabular-nums text-emerald-400">${result.tradeProposal.tp1?.toLocaleString()}</div>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/30 space-y-1">
                          <div className="text-[10px] uppercase tracking-widest text-emerald-400">TP2</div>
                          <div className="text-lg font-bold tabular-nums text-emerald-400">${result.tradeProposal.tp2?.toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-1">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">TP3 (Extended)</div>
                          <div className="text-sm font-bold tabular-nums text-emerald-400/70">${result.tradeProposal.tp3?.toLocaleString()}</div>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-1">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Risk : Reward</div>
                          <div className="text-sm font-bold">1 : {result.tradeProposal.riskReward}</div>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-1">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Win Probability</div>
                          <div className={cn("text-sm font-bold tabular-nums", confidenceColor(result.tradeProposal.winProbability))}>{result.tradeProposal.winProbability}%</div>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-1">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Max Risk</div>
                          <div className="text-sm font-bold text-red-400">{result.tradeProposal.maxRisk}</div>
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-1">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Expected Duration</div>
                          <div className="text-sm font-medium">{result.tradeProposal.expectedDuration}</div>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-1">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Confidence</div>
                          <div className={cn("text-sm font-bold tabular-nums", confidenceColor(result.confidence))}>{result.confidence}%</div>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                        <div className="text-[10px] uppercase tracking-widest text-red-400 mb-1">Invalidation Condition</div>
                        <div className="text-sm text-muted-foreground">{result.tradeProposal.invalidationCondition}</div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center py-8 text-center text-muted-foreground space-y-2">
                      <AlertTriangle className="w-8 h-8 text-yellow-400" />
                      <p className="font-semibold text-yellow-400">{result.decision}</p>
                      <p className="text-sm max-w-sm">{result.decision === "NO TRADE" ? "Market uncertainty exceeds acceptable threshold. Agent disagreement too high. Capital preservation prioritized." : "Conditions are being monitored. No directional trade recommended at this time."}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: SCENARIOS
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="scenarios" className="mt-4 space-y-4">
          {!result ? (
            <Card><CardContent className="flex items-center justify-center py-16 text-muted-foreground"><FlaskConical className="w-8 h-8 mr-3 opacity-20" /><p>No scenarios yet</p></CardContent></Card>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
                <Info className="w-4 h-4 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">The AI simulated 3 independent market scenarios before generating the final recommendation. The highest-probability scenario aligned with the final decision.</p>
              </div>
              <div className="grid lg:grid-cols-3 gap-4">
                {result.scenarios.map((s) => <ScenarioCard key={s.id} s={s} />)}
              </div>
            </>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: REASONING TIMELINE
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="timeline" className="mt-4">
          {!result ? (
            <Card><CardContent className="flex items-center justify-center py-16 text-muted-foreground"><Clock className="w-8 h-8 mr-3 opacity-20" /><p>No reasoning log yet</p></CardContent></Card>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-primary" />Decision Timeline</CardTitle>
                  <CardDescription className="text-xs">Every step recorded — total analysis time: {result.meta.analysisTimeMs}ms</CardDescription>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <TimelineView steps={result.reasoningTimeline} running={analyzing} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" />Evidence Log</CardTitle>
                  <CardDescription className="text-xs">Key factors that influenced the final decision</CardDescription>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-2">
                  {result.reasoning.evidence.map((e, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/20 border border-border">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <span className="text-sm">{e}</span>
                    </div>
                  ))}
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground">
                    Agent agreement: <strong>{result.reasoning.agreement}%</strong> · Analysis: <strong>{result.meta.analysisTimeMs}ms</strong>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: EXPLAINABILITY
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="explain" className="mt-4 space-y-4">
          {!result ? (
            <Card><CardContent className="flex items-center justify-center py-16 text-muted-foreground"><BookOpen className="w-8 h-8 mr-3 opacity-20" /><p>No explanation available yet</p></CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm flex items-center gap-2"><Info className="w-4 h-4 text-primary" />Why Was This Signal Generated?</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <p className="text-sm leading-relaxed text-muted-foreground">{result.explainability.whyGenerated}</p>
                </CardContent>
              </Card>

              <div className="grid sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm">Top Influencing Factors</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    {result.explainability.topFactors.map((f, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border">
                        <div className="w-1.5 h-8 rounded-full bg-primary/60" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{f.factor}</div>
                          <div className="text-xs text-muted-foreground">{f.direction}</div>
                        </div>
                        <Badge variant="outline" className={cn("text-xs", f.influence === "High" ? "border-primary/40 text-primary" : "border-border text-muted-foreground")}>{f.influence}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm">Disagreements & Conflicts</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    {result.explainability.disagreements.length > 0 ? (
                      result.explainability.disagreements.map((d, i) => (
                        <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                          <span className="text-sm text-muted-foreground">{d}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-sm text-muted-foreground">No significant agent conflicts detected</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><XCircle className="w-4 h-4 text-red-400" />Invalidation Conditions</CardTitle>
                  <CardDescription className="text-xs">Under what conditions does this recommendation become invalid?</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {result.explainability.invalidationConditions.map((c, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-red-500/5 border border-red-500/15">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                      <span className="text-sm text-muted-foreground">{c}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: DECISION HISTORY
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4 text-primary" />Decision History</CardTitle>
              <CardDescription className="text-xs">All AI decisions — permanently recorded with full reasoning chain</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loadingDecisions ? (
                <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
              ) : !decisions?.length ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <History className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm">No decisions recorded yet</p>
                  <p className="text-xs mt-1">Run your first analysis to build history</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {decisions.map((d) => <DecisionHistoryCard key={d.id} d={d as Parameters<typeof DecisionHistoryCard>[0]["d"]} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: PERFORMANCE
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="performance" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Analyses", value: totalDec, icon: Brain },
              { label: "Decisions Made", value: totalDec, icon: Target },
              { label: "Win Rate", value: perf?.historicalWinRate ? `${perf.historicalWinRate}%` : "—", icon: Award },
              { label: "Avg Confidence", value: perf?.avgConfidence ? `${perf.avgConfidence}%` : result ? `${result.confidence}%` : "—", icon: Gauge },
              { label: "Avg Return", value: perf?.avgReturn ? `${perf.avgReturn > 0 ? "+" : ""}${perf.avgReturn}%` : "—", icon: TrendingUp },
              { label: "Closed Trades", value: perf?.totalTrades ?? "—", icon: BarChart2 },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-4 text-center">
                  <Icon className="w-5 h-5 text-primary mx-auto mb-2 opacity-70" />
                  <div className="text-xs text-muted-foreground mb-1">{label}</div>
                  <div className="text-xl font-bold tabular-nums">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" />Continuous Learning Pipeline</CardTitle>
              <CardDescription className="text-xs">Evidence-based feedback — not automatic retraining</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { step: "1", title: "Record Market Conditions", desc: "All features at time of decision are logged — price, indicators, volume, structure" },
                  { step: "2", title: "Compare Prediction vs Reality", desc: "Outcome is matched against forecast after trade closes" },
                  { step: "3", title: "Measure Accuracy", desc: "Precision, recall, and directional accuracy computed per agent" },
                  { step: "4", title: "Identify Best Agents", desc: "Agents with highest long-term accuracy are weighted more heavily" },
                  { step: "5", title: "Update Agent Statistics", desc: "Performance stats updated — confidence weights adjusted by evidence" },
                  { step: "6", title: "Store for Future Evaluation", desc: "Complete case stored for strategy refinement and audit trail" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border">
                    <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-[11px] font-bold text-primary shrink-0 mt-0.5">{item.step}</div>
                    <div>
                      <div className="text-sm font-semibold">{item.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />AI Philosophy</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {[
                { icon: CheckCircle2, color: "text-emerald-400", title: "Transparent reasoning", desc: "Every recommendation is backed by measurable evidence — never a black box" },
                { icon: Shield, color: "text-primary", title: "Capital preservation first", desc: "When evidence is weak or conflicting, the system recommends NO TRADE rather than forcing a decision" },
                { icon: Gauge, color: "text-yellow-400", title: "Quantified confidence", desc: "Confidence is calculated via weighted evidence — not randomly assigned" },
                { icon: BookOpen, color: "text-blue-400", title: "Auditable decisions", desc: "All decisions are permanently logged with full reasoning chain for review and improvement" },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border">
                  <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", color)} />
                  <div>
                    <div className="text-sm font-semibold">{title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
