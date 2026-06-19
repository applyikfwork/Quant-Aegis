import { useState } from "react";
import {
  useGetRiskDashboard,
  useGetRiskPositions,
  useGetRiskVar,
  useGetRiskDrawdown,
  useGetRiskLeverage,
  useGetRiskAiAdvisor,
  useListRiskRules,
  useListRiskAlerts,
  useListRiskHistory,
  useGetRiskStressTest,
  useApproveTradeRisk,
  useGetRiskReport,
  useCalculateRisk,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar,
} from "recharts";
import {
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Shield,
  TrendingDown, TrendingUp, Activity, Calculator, Brain,
  Zap, CheckCircle2, XCircle, Clock, BarChart2, FileText,
  Gauge, Target, RefreshCw, Bell, History, ClipboardCheck,
  ChevronRight, Info,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function safetyColor(safety: string) {
  if (safety === "critical") return "text-destructive";
  if (safety === "danger") return "text-orange-400";
  if (safety === "warning") return "text-yellow-400";
  return "text-success";
}

function safetyBg(safety: string) {
  if (safety === "critical") return "bg-destructive/10 border-destructive";
  if (safety === "danger") return "bg-orange-500/10 border-orange-500";
  if (safety === "warning") return "bg-yellow-500/10 border-yellow-500";
  return "bg-success/10 border-success";
}

function severityColor(s: string) {
  if (s === "critical") return "text-destructive";
  if (s === "danger" || s === "high") return "text-orange-400";
  if (s === "warning" || s === "medium") return "text-yellow-400";
  if (s === "positive") return "text-success";
  return "text-muted-foreground";
}

function severityBadge(s: string) {
  if (s === "critical") return "bg-destructive/20 text-destructive border-destructive/30";
  if (s === "danger" || s === "high") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (s === "warning" || s === "medium") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  if (s === "positive") return "bg-success/20 text-success border-success/30";
  return "bg-muted/30 text-muted-foreground border-border";
}

function RiskScoreGauge({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const offset = circ - (pct / 100) * circ;
  const color = pct < 25 ? "#22c55e" : pct < 50 ? "#f59e0b" : pct < 75 ? "#f97316" : "#ef4444";
  const label = pct < 25 ? "Low Risk" : pct < 50 ? "Moderate" : pct < 75 ? "High Risk" : "Critical";
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={120} height={120} className="-rotate-90">
        <circle cx={60} cy={60} r={r} stroke="currentColor" strokeWidth="10" fill="none" className="text-muted/20" />
        <circle cx={60} cy={60} r={r} stroke={color} strokeWidth="10" fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s ease" }} />
      </svg>
      <div className="text-center -mt-14 rotate-0">
        <p className="text-3xl font-bold" style={{ color }}>{score}</p>
        <p className="text-xs text-muted-foreground">/ 100</p>
      </div>
      <p className="text-sm font-semibold" style={{ color }}>{label}</p>
    </div>
  );
}

function StatCard({ title, value, sub, icon: Icon, color, loading, badge }: {
  title: string; value?: string; sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string; loading?: boolean; badge?: string;
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
        <div className="flex items-center gap-2 mt-1">
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          {badge && <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded-full border", severityBadge(badge))}>{badge}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Risk() {
  const [tab, setTab] = useState("dashboard");
  const [calcAccount, setCalcAccount] = useState("10000");
  const [calcRiskPct, setCalcRiskPct] = useState("2");
  const [calcEntry, setCalcEntry] = useState("103500");
  const [calcStop, setCalcStop] = useState("100800");
  const [approvalSymbol, setApprovalSymbol] = useState("BTCUSDT");
  const [approvalSide, setApprovalSide] = useState("long");
  const [approvalSize, setApprovalSize] = useState("0.1");
  const [approvalEntry, setApprovalEntry] = useState("103500");
  const [approvalStopLoss, setApprovalStopLoss] = useState("100800");
  const [approvalConfidence, setApprovalConfidence] = useState("75");

  const { data: dash, isLoading: dashLoading } = useGetRiskDashboard();
  const { data: positions, isLoading: posLoading } = useGetRiskPositions();
  const { data: varData, isLoading: varLoading } = useGetRiskVar();
  const { data: drawdown, isLoading: ddLoading } = useGetRiskDrawdown();
  const { data: leverage, isLoading: levLoading } = useGetRiskLeverage();
  const { data: aiAdvisor, isLoading: aiLoading } = useGetRiskAiAdvisor();
  const { data: rules } = useListRiskRules();
  const { data: alerts } = useListRiskAlerts();
  const { data: history } = useListRiskHistory();
  const { data: stressTests, isLoading: stressLoading } = useGetRiskStressTest();
  const { data: report, isLoading: reportLoading } = useGetRiskReport();

  const { mutate: approveRisk, data: approvalResult, isPending: approvePending, reset: resetApproval } = useApproveTradeRisk();
  const { mutate: calcRisk, data: calcResult, isPending: calcPending } = useCalculateRisk();

  const safety = dash?.accountSafety ?? "safe";
  const SafetyIcon = safety === "critical" ? ShieldX : safety === "danger" ? ShieldAlert : safety === "warning" ? ShieldAlert : ShieldCheck;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Risk Center
          </h1>
          <p className="text-sm text-muted-foreground">Institutional risk management, capital protection & AI safety layer</p>
        </div>
        {dash && (
          <div className={cn("flex items-center gap-2 px-4 py-2 rounded-lg border", safetyBg(safety))}>
            <SafetyIcon className={cn("w-4 h-4", safetyColor(safety))} />
            <span className={cn("text-sm font-semibold capitalize", safetyColor(safety))}>{safety}</span>
          </div>
        )}
      </div>

      {/* Critical Alert Banner */}
      {dash && (dash.dailyUsedPct >= dash.dailyLimitPct) && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive bg-destructive/10 text-destructive">
          <ShieldX className="w-5 h-5 shrink-0" />
          <p className="font-semibold">Daily loss limit reached — new trades are blocked for today</p>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/30 p-1">
          {[
            { id: "dashboard", label: "Dashboard", icon: Activity },
            { id: "positions", label: "Positions", icon: Target },
            { id: "var", label: "VaR Engine", icon: BarChart2 },
            { id: "drawdown", label: "Drawdown", icon: TrendingDown },
            { id: "leverage", label: "Leverage", icon: Gauge },
            { id: "stress", label: "Stress Test", icon: Zap },
            { id: "ai", label: "AI Advisor", icon: Brain },
            { id: "approval", label: "Trade Approval", icon: ClipboardCheck },
            { id: "calculator", label: "Calculator", icon: Calculator },
            { id: "rules", label: "Rules", icon: CheckCircle2 },
            { id: "alerts", label: "Alerts", icon: Bell },
            { id: "history", label: "History", icon: History },
            { id: "report", label: "Report", icon: FileText },
          ].map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="flex items-center gap-1.5 text-xs px-3 py-1.5">
              <Icon className="w-3.5 h-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── DASHBOARD ── */}
        <TabsContent value="dashboard" className="space-y-6 mt-4">
          <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
            {/* Risk Score Gauge */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Overall Risk Score</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center pt-2">
                {dashLoading ? <Skeleton className="h-32 w-32 rounded-full" /> : <RiskScoreGauge score={dash?.riskScore ?? 0} />}
              </CardContent>
            </Card>

            {/* Top Metrics */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Total Exposure"
                value={formatCurrency(dash?.totalExposure ?? 0)}
                sub={`${dash?.exposurePct?.toFixed(1) ?? 0}% of account`}
                icon={Activity}
                color={((dash?.exposurePct ?? 0) > 60) ? "text-destructive" : (dash?.exposurePct ?? 0) > 40 ? "text-yellow-400" : "text-foreground"}
                loading={dashLoading}
              />
              <StatCard
                title="Daily P&L"
                value={formatCurrency(dash?.dailyPnl ?? 0)}
                sub={`${dash?.dailyUsedPct?.toFixed(1) ?? 0}% of ${dash?.dailyLimitPct ?? 5}% limit used`}
                icon={(dash?.dailyPnl ?? 0) >= 0 ? TrendingUp : TrendingDown}
                color={(dash?.dailyPnl ?? 0) >= 0 ? "text-success" : "text-destructive"}
                loading={dashLoading}
              />
              <StatCard
                title="Open Positions"
                value={String(dash?.openPositions ?? 0)}
                sub={`Stop-loss coverage: ${dash?.stopLossRate?.toFixed(0) ?? 100}%`}
                icon={Target}
                color={(dash?.stopLossRate ?? 100) < 80 ? "text-yellow-400" : "text-foreground"}
                loading={dashLoading}
              />
              <StatCard
                title="Drawdown"
                value={formatPercent(dash?.drawdown ?? 0)}
                sub={`Peak: ${formatCurrency(dash?.peakValue ?? 0)}`}
                icon={TrendingDown}
                color={(dash?.drawdown ?? 0) > 15 ? "text-destructive" : (dash?.drawdown ?? 0) > 8 ? "text-yellow-400" : "text-foreground"}
                loading={dashLoading}
              />
              <StatCard
                title="Leverage"
                value={`${dash?.leverage?.toFixed(2) ?? "0"}x`}
                sub="Recommended: ≤3x"
                icon={Gauge}
                color={(dash?.leverage ?? 0) > 5 ? "text-destructive" : (dash?.leverage ?? 0) > 3 ? "text-yellow-400" : "text-foreground"}
                loading={dashLoading}
              />
              <StatCard
                title="Value at Risk (95%)"
                value={formatCurrency(dash?.varAmount ?? 0)}
                sub={`${dash?.varConfidence ?? 95}% confidence, 1-day`}
                icon={BarChart2}
                loading={dashLoading}
              />
            </div>
          </div>

          {/* Daily Limit Bar */}
          {!dashLoading && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Daily Loss Limit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Used: {formatCurrency(Math.abs(Math.min(0, dash?.dailyPnl ?? 0)))}</span>
                  <span className="text-muted-foreground">Limit: {formatCurrency((dash?.peakValue ?? 10000) * ((dash?.dailyLimitPct ?? 5) / 100))}</span>
                </div>
                <Progress value={Math.min(100, dash?.dailyUsedPct ?? 0)} className="h-3" />
                <div className="grid grid-cols-4 text-xs text-muted-foreground">
                  <span>Safe</span><span className="text-center">Warning</span><span className="text-center">Danger</span><span className="text-right">Critical</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Concentration Risk */}
          {!dashLoading && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Concentration Risk</CardTitle>
                <CardDescription>Single-asset exposure</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className={cn("text-3xl font-bold", (dash?.concentrationRisk ?? 0) > 60 ? "text-destructive" : (dash?.concentrationRisk ?? 0) > 40 ? "text-yellow-400" : "text-success")}>
                    {dash?.concentrationRisk?.toFixed(1) ?? 0}%
                  </div>
                  <div>
                    <Progress value={dash?.concentrationRisk ?? 0} className="h-2 w-48" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {(dash?.concentrationRisk ?? 0) > 60 ? "Too concentrated — reduce largest position" :
                       (dash?.concentrationRisk ?? 0) > 40 ? "Moderate concentration — monitor closely" :
                       "Well diversified"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── POSITIONS ── */}
        <TabsContent value="positions" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Position Risk Breakdown</CardTitle>
              <CardDescription>Live risk metrics for every open position</CardDescription>
            </CardHeader>
            <CardContent>
              {posLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (positions ?? []).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No open positions — risk engine idle</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead className="text-right">Entry</TableHead>
                      <TableHead className="text-right">Stop Loss</TableHead>
                      <TableHead className="text-right">Stop Dist %</TableHead>
                      <TableHead className="text-right">Max Loss</TableHead>
                      <TableHead className="text-right">Risk %</TableHead>
                      <TableHead className="text-right">Liq Price</TableHead>
                      <TableHead className="text-right">Liq Buffer</TableHead>
                      <TableHead className="text-center">Stop</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(positions ?? []).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold">{p.symbol}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={p.side === "long" ? "text-success border-success/30" : "text-destructive border-destructive/30"}>
                            {p.side.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(p.entryPrice)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(p.stopLoss)}</TableCell>
                        <TableCell className={cn("text-right", p.stopDistancePct > 5 ? "text-yellow-400" : "")}>{p.stopDistancePct.toFixed(2)}%</TableCell>
                        <TableCell className="text-right text-destructive font-mono">{formatCurrency(p.maxLoss)}</TableCell>
                        <TableCell className={cn("text-right font-semibold", p.riskPct > 2 ? "text-destructive" : p.riskPct > 1.5 ? "text-yellow-400" : "text-success")}>
                          {p.riskPct.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right font-mono text-orange-400">{formatCurrency(p.liquidationPrice)}</TableCell>
                        <TableCell className={cn("text-right", p.liquidationBuffer < 10 ? "text-destructive" : p.liquidationBuffer < 20 ? "text-yellow-400" : "text-success")}>
                          {p.liquidationBuffer.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center">
                          {p.hasStopLoss ? <CheckCircle2 className="w-4 h-4 text-success mx-auto" /> : <XCircle className="w-4 h-4 text-destructive mx-auto" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── VaR ENGINE ── */}
        <TabsContent value="var" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {varLoading ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
            )) : [
              { label: "Historical VaR (95%)", value: varData?.historicalVar95 ?? 0, desc: "Normal bad-day loss estimate" },
              { label: "Historical VaR (99%)", value: varData?.historicalVar99 ?? 0, desc: "Rare bad-day loss estimate" },
              { label: "Simulation VaR (95%)", value: varData?.simulationVar95 ?? 0, desc: "Monte Carlo simulation" },
              { label: "Simulation VaR (99%)", value: varData?.simulationVar99 ?? 0, desc: "Extreme simulation" },
              { label: "Expected Shortfall (95%)", value: varData?.expectedShortfall95 ?? 0, desc: "Avg loss beyond VaR 95%" },
              { label: "Expected Shortfall (99%)", value: varData?.expectedShortfall99 ?? 0, desc: "Avg loss beyond VaR 99%" },
            ].map(({ label, value, desc }) => (
              <Card key={label}>
                <CardContent className="pt-5 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(value)}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Time-Scaled VaR</CardTitle>
              <CardDescription>Loss estimates across different time horizons</CardDescription>
            </CardHeader>
            <CardContent>
              {varLoading ? <Skeleton className="h-40 w-full" /> : (
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { period: "Daily", value: varData?.dailyVar ?? 0 },
                    { period: "Weekly (5d)", value: varData?.weeklyVar ?? 0 },
                    { period: "Monthly (21d)", value: varData?.monthlyVar ?? 0 },
                  ].map(({ period, value }) => (
                    <div key={period} className="p-4 rounded-lg border border-border bg-muted/10 text-center">
                      <p className="text-xs text-muted-foreground mb-2">{period}</p>
                      <p className="text-xl font-bold text-destructive">{formatCurrency(value)}</p>
                      <p className="text-xs text-muted-foreground mt-1">95% confidence</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Portfolio Volatility</CardTitle>
            </CardHeader>
            <CardContent>
              {varLoading ? <Skeleton className="h-8 w-full" /> : (
                <div className="flex items-center gap-4">
                  <p className={cn("text-3xl font-bold", (varData?.portfolioVolatility ?? 0) > 5 ? "text-destructive" : (varData?.portfolioVolatility ?? 0) > 3 ? "text-yellow-400" : "text-success")}>
                    {(varData?.portfolioVolatility ?? 0).toFixed(2)}%
                  </p>
                  <div>
                    <Progress value={Math.min(100, (varData?.portfolioVolatility ?? 0) * 10)} className="h-2 w-48" />
                    <p className="text-xs text-muted-foreground mt-1">Standard deviation of trade returns</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── DRAWDOWN ── */}
        <TabsContent value="drawdown" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ddLoading ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            )) : [
              { label: "Peak Value", value: formatCurrency(drawdown?.peakValue ?? 0), color: "text-success", icon: TrendingUp },
              { label: "Current Value", value: formatCurrency(drawdown?.currentValue ?? 0), color: "text-foreground", icon: Activity },
              { label: "Current Drawdown", value: formatPercent(drawdown?.drawdownPct ?? 0), color: (drawdown?.drawdownPct ?? 0) > 10 ? "text-destructive" : "text-foreground", icon: TrendingDown },
              { label: "Max Drawdown", value: formatPercent(drawdown?.maxDrawdownPct ?? 0), color: "text-destructive", icon: TrendingDown },
            ].map(({ label, value, color, icon: Icon }) => (
              <Card key={label}><CardContent className="pt-5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className={cn("text-2xl font-bold", color)}>{value}</p>
              </CardContent></Card>
            ))}
          </div>

          {!ddLoading && (drawdown?.drawdownPct ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Recovery Needed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <p className="text-2xl font-bold text-yellow-400">{formatPercent(drawdown?.recoveryNeeded ?? 0)}</p>
                  <p className="text-sm text-muted-foreground">return required to recover to peak</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Drawdown Chart */}
          {!ddLoading && (drawdown?.history ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Value History</CardTitle>
                <CardDescription>Account value over closed trades</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={drawdown?.history ?? []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                    <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Protection Rules */}
          <Card>
            <CardHeader>
              <CardTitle>Drawdown Protection Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { threshold: "5%", action: "Warning — review open positions", icon: AlertTriangle, color: "text-yellow-400" },
                  { threshold: "10%", action: "Reduce risk — cut position sizes by 50%", icon: ShieldAlert, color: "text-orange-400" },
                  { threshold: "15%", action: "Stop new trades — preserve remaining capital", icon: ShieldX, color: "text-destructive" },
                  { threshold: "20%", action: "Emergency mode — close all positions", icon: ShieldX, color: "text-destructive" },
                ].map(({ threshold, action, icon: Icon, color }) => (
                  <div key={threshold} className="flex items-center gap-3 p-3 rounded-lg bg-muted/10 border border-border">
                    <Icon className={cn("w-4 h-4 shrink-0", color)} />
                    <span className="font-mono font-semibold text-sm w-10">{threshold}</span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">{action}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── LEVERAGE ── */}
        <TabsContent value="leverage" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {levLoading ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            )) : (
              <>
                <Card>
                  <CardContent className="pt-5 space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Leverage</p>
                    <p className={cn("text-3xl font-bold", (leverage?.currentLeverage ?? 0) > 5 ? "text-destructive" : (leverage?.currentLeverage ?? 0) > 3 ? "text-yellow-400" : "text-success")}>
                      {(leverage?.currentLeverage ?? 0).toFixed(2)}x
                    </p>
                    <p className="text-xs text-muted-foreground">Recommended: ≤{leverage?.recommendedLeverage ?? 3}x | Hard limit: {leverage?.maxLeverage ?? 5}x</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5 space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Margin Used</p>
                    <p className="text-3xl font-bold">{formatCurrency(leverage?.marginUsed ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">Available: {formatCurrency(leverage?.marginAvailable ?? 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5 space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Margin Usage</p>
                    <p className={cn("text-3xl font-bold", (leverage?.marginUsedPct ?? 0) > 80 ? "text-destructive" : (leverage?.marginUsedPct ?? 0) > 60 ? "text-yellow-400" : "text-success")}>
                      {(leverage?.marginUsedPct ?? 0).toFixed(1)}%
                    </p>
                    <Progress value={leverage?.marginUsedPct ?? 0} className="h-2" />
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {!levLoading && leverage?.liquidationDistance && (
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-orange-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Liquidation Warning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Average liquidation distance is <span className="font-semibold text-orange-400">{leverage.liquidationDistance.toFixed(1)}%</span> from current prices.
                  Maintain margin buffer above 20% at all times.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Leverage Safety Zones</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { range: "1x – 2x", label: "Conservative", color: "bg-success", pct: 20 },
                  { range: "2x – 3x", label: "Recommended Max", color: "bg-success/60", pct: 40 },
                  { range: "3x – 5x", label: "Warning Zone", color: "bg-yellow-500", pct: 60 },
                  { range: "5x – 8x", label: "Danger Zone", color: "bg-orange-500", pct: 80 },
                  { range: "8x+", label: "Critical — Liquidation Risk", color: "bg-destructive", pct: 100 },
                ].map(({ range, label, color, pct }) => (
                  <div key={range} className="flex items-center gap-3">
                    <div className={cn("h-2.5 rounded-full", color)} style={{ width: `${pct * 2}px`, minWidth: "20px" }} />
                    <span className="font-mono text-sm font-semibold w-20">{range}</span>
                    <span className="text-sm text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── STRESS TEST ── */}
        <TabsContent value="stress" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Zap className="w-4 h-4" />Stress Test Scenarios</CardTitle>
              <CardDescription>AI-simulated market scenarios and their impact on your portfolio</CardDescription>
            </CardHeader>
            <CardContent>
              {stressLoading ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : (
                <div className="space-y-3">
                  {(stressTests ?? []).map((s) => (
                    <div key={s.name} className={cn("p-4 rounded-lg border", s.severity === "positive" ? "border-success/30 bg-success/5" : s.severity === "critical" ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/5")}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-sm">{s.name}</p>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-semibold", severityBadge(s.severity))}>
                              {s.severity.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{s.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn("text-lg font-bold", severityColor(s.severity))}>
                            {s.portfolioMove >= 0 ? "+" : ""}{s.portfolioMove.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(s.newPortfolioValue)}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Market: {s.marketMove >= 0 ? "+" : ""}{s.marketMove}%</span>
                        <span>Impact: {formatCurrency(s.impact)}</span>
                        <span className={cn("font-semibold", s.survivable ? "text-success" : "text-destructive")}>
                          {s.survivable ? "✓ Survivable" : "✗ Not survivable"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stress bar chart */}
          {!stressLoading && (stressTests ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Scenario Comparison</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stressTests ?? []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} unit="%" />
                    <RechartsTooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Bar dataKey="portfolioMove" name="Portfolio Move %" fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── AI ADVISOR ── */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          {aiLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <>
              {/* Overall Assessment */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    AI Risk Assessment
                    <span className={cn("ml-auto text-xs px-2 py-0.5 rounded-full border font-semibold", severityBadge(aiAdvisor?.riskLevel ?? "low"))}>
                      {(aiAdvisor?.riskLevel ?? "low").toUpperCase()} RISK
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{aiAdvisor?.overallAssessment}</p>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-muted-foreground">AI Confidence</p>
                    <Progress value={aiAdvisor?.confidence ?? 0} className="h-2 flex-1 max-w-48" />
                    <p className="text-sm font-semibold">{aiAdvisor?.confidence ?? 0}%</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Generated: {aiAdvisor?.generatedAt ? new Date(aiAdvisor.generatedAt).toLocaleTimeString() : "—"}</p>
                </CardContent>
              </Card>

              {/* Alerts */}
              {(aiAdvisor?.alerts ?? []).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Risk Alerts</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(aiAdvisor?.alerts ?? []).map((a, i) => (
                        <div key={i} className={cn("flex items-start gap-3 p-3 rounded-lg border", safetyBg(a.severity ?? "warning"))}>
                          <AlertTriangle className={cn("w-4 h-4 shrink-0 mt-0.5", safetyColor(a.severity ?? "warning"))} />
                          <p className="text-sm">{a.message}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Position Advice */}
              {(aiAdvisor?.positionAdvice ?? []).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Position-Level Advice</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(aiAdvisor?.positionAdvice ?? []).map((p, i) => (
                        <div key={i} className="p-3 rounded-lg border border-border bg-muted/10">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-sm">{p.symbol}</p>
                            <Badge variant="outline" className="text-xs">{p.action}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{p.advice}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              <Card>
                <CardHeader><CardTitle className="text-sm">AI Recommendations</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(aiAdvisor?.recommendations ?? []).map((r, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-muted/10">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">{r}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── TRADE APPROVAL ── */}
        <TabsContent value="approval" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" />
                Trade Risk Approval System
              </CardTitle>
              <CardDescription>Run any trade through the full risk engine before execution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Symbol</Label>
                  <Input value={approvalSymbol} onChange={e => setApprovalSymbol(e.target.value)} placeholder="BTCUSDT" />
                </div>
                <div className="space-y-1.5">
                  <Label>Side</Label>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={approvalSide} onChange={e => setApprovalSide(e.target.value)}>
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Position Size (qty)</Label>
                  <Input value={approvalSize} onChange={e => setApprovalSize(e.target.value)} placeholder="0.1" type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Entry Price ($)</Label>
                  <Input value={approvalEntry} onChange={e => setApprovalEntry(e.target.value)} placeholder="103500" type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Stop Loss ($)</Label>
                  <Input value={approvalStopLoss} onChange={e => setApprovalStopLoss(e.target.value)} placeholder="100800" type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>AI Confidence (%)</Label>
                  <Input value={approvalConfidence} onChange={e => setApprovalConfidence(e.target.value)} placeholder="75" type="number" />
                </div>
              </div>
              <Button
                onClick={() => {
                  resetApproval();
                  approveRisk({ data: {
                    symbol: approvalSymbol, side: approvalSide,
                    requestedSize: parseFloat(approvalSize),
                    entry: parseFloat(approvalEntry),
                    stopLoss: parseFloat(approvalStopLoss),
                    aiConfidence: parseFloat(approvalConfidence),
                  }});
                }}
                disabled={approvePending}
              >
                <ClipboardCheck className="w-4 h-4 mr-2" />
                {approvePending ? "Checking..." : "Run Risk Check"}
              </Button>

              {approvalResult && (
                <div className={cn("mt-4 p-4 rounded-lg border", (() => {
                  const d = (approvalResult as any).decision;
                  return d === "approved" ? "border-success/30 bg-success/5" :
                    d === "rejected" ? "border-destructive/30 bg-destructive/5" :
                    "border-yellow-500/30 bg-yellow-500/5";
                })())}>
                  <div className="flex items-center gap-3 mb-3">
                    {(approvalResult as any).decision === "approved" ?
                      <CheckCircle2 className="w-6 h-6 text-success" /> :
                      (approvalResult as any).decision === "rejected" ?
                      <XCircle className="w-6 h-6 text-destructive" /> :
                      <AlertTriangle className="w-6 h-6 text-yellow-400" />
                    }
                    <p className="text-lg font-bold capitalize">{(approvalResult as any).decision}</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{(approvalResult as any).reason}</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="p-2 rounded bg-muted/20">
                      <p className="text-xs text-muted-foreground">Approved Size</p>
                      <p className="font-semibold">{(approvalResult as any).approvedSize}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/20">
                      <p className="text-xs text-muted-foreground">Risk %</p>
                      <p className="font-semibold">{(approvalResult as any).riskPct?.toFixed(2)}%</p>
                    </div>
                    <div className="p-2 rounded bg-muted/20">
                      <p className="text-xs text-muted-foreground">Risk Score</p>
                      <p className="font-semibold">{(approvalResult as any).riskScore} / 100</p>
                    </div>
                  </div>
                  {((approvalResult as any).issues ?? []).length > 0 && (
                    <div className="mt-3 space-y-1">
                      {((approvalResult as any).issues ?? []).map((issue: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-yellow-400">
                          <AlertTriangle className="w-3 h-3" /> {issue}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approval Flow */}
          <Card>
            <CardHeader><CardTitle>Approval Flow</CardTitle><CardDescription>Every trade passes through these checks</CardDescription></CardHeader>
            <CardContent>
              <div className="flex flex-col gap-0">
                {[
                  "New Trade Request",
                  "Risk % Check (≤2% per trade)",
                  "Portfolio Exposure Check (≤60%)",
                  "Stop Loss Validation (required)",
                  "AI Confidence Check (≥65%)",
                  "Risk:Reward Check (≥1.5:1)",
                  "Final Decision",
                ].map((step, i, arr) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-7 h-7 rounded-full border-2 border-primary/50 bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{i + 1}</div>
                      {i < arr.length - 1 && <div className="w-0.5 h-6 bg-border" />}
                    </div>
                    <p className="text-sm text-muted-foreground py-1">{step}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CALCULATOR ── */}
        <TabsContent value="calculator" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Position Size Calculator
              </CardTitle>
              <CardDescription>Calculate exact position size from risk parameters. Formula: Position Size = Account Risk ÷ Stop Distance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Account Size ($)</Label>
                  <Input value={calcAccount} onChange={e => setCalcAccount(e.target.value)} placeholder="10000" type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Risk % per trade</Label>
                  <Input value={calcRiskPct} onChange={e => setCalcRiskPct(e.target.value)} placeholder="2" type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Entry Price ($)</Label>
                  <Input value={calcEntry} onChange={e => setCalcEntry(e.target.value)} placeholder="103500" type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Stop Loss Price ($)</Label>
                  <Input value={calcStop} onChange={e => setCalcStop(e.target.value)} placeholder="100800" type="number" />
                </div>
              </div>
              <Button
                onClick={() => calcRisk({ data: { account: parseFloat(calcAccount), riskPercent: parseFloat(calcRiskPct), entry: parseFloat(calcEntry), stopLoss: parseFloat(calcStop) } })}
                disabled={calcPending}
              >
                <Calculator className="w-4 h-4 mr-2" />
                {calcPending ? "Calculating..." : "Calculate"}
              </Button>

              {calcResult && (
                <div className="grid gap-3 sm:grid-cols-4 border-t border-border pt-4">
                  {[
                    { label: "Position Size", value: (calcResult as any).positionSize?.toFixed(4) ?? "—", color: "" },
                    { label: "Risk Amount", value: formatCurrency((calcResult as any).riskAmount ?? 0), color: "text-destructive" },
                    { label: "Stop Distance", value: formatCurrency((calcResult as any).stopDistance ?? 0), color: "" },
                    { label: "Risk:Reward", value: (calcResult as any).riskReward ? `1:${(calcResult as any).riskReward?.toFixed(1)}` : "—", color: ((calcResult as any).riskReward ?? 0) >= 2 ? "text-success" : "text-yellow-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="p-3 rounded-lg bg-muted/20 border border-border">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                      <p className={cn("text-xl font-bold", color)}>{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── RULES ── */}
        <TabsContent value="rules" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk Rules Engine</CardTitle>
              <CardDescription>Active constraints enforced on every trade</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { label: "Position", color: "bg-blue-500/20 text-blue-400" },
                  { label: "Daily", color: "bg-purple-500/20 text-purple-400" },
                  { label: "Exposure", color: "bg-orange-500/20 text-orange-400" },
                  { label: "Protection", color: "bg-green-500/20 text-green-400" },
                  { label: "AI", color: "bg-cyan-500/20 text-cyan-400" },
                ].map(cat => {
                  const catRules = (rules ?? []).filter(r => r.category === cat.label.toLowerCase() || r.category === cat.label);
                  if (catRules.length === 0) return null;
                  return null;
                })}
                {(rules ?? []).map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/10 border border-border">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", r.active ? "bg-success" : "bg-muted-foreground")} />
                    <p className={cn("text-sm flex-1", !r.active && "text-muted-foreground line-through")}>{r.rule}</p>
                    <Badge variant="outline" className="text-xs capitalize">{r.category}</Badge>
                    {!r.active && r.phase && <span className="text-xs text-muted-foreground">{r.phase}</span>}
                    {r.active && <CheckCircle2 className="w-4 h-4 text-success" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ALERTS ── */}
        <TabsContent value="alerts" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Active Risk Alerts
              </CardTitle>
              <CardDescription>Real-time risk events requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              {(alerts ?? []).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30 text-success" />
                  <p className="text-success font-semibold">No active alerts — system is safe</p>
                  <p className="text-sm mt-1">All risk parameters within acceptable limits</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(alerts ?? []).map(a => (
                    <div key={a.id} className={cn("flex items-start gap-3 p-3 rounded-lg border", safetyBg(a.severity))}>
                      <AlertTriangle className={cn("w-4 h-4 shrink-0 mt-0.5", safetyColor(a.severity))} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{a.message}</p>
                        {a.detail && <p className="text-xs text-muted-foreground mt-0.5">{a.detail}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{new Date(a.createdAt).toLocaleString()}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-xs capitalize", severityBadge(a.severity))}>{a.severity}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── HISTORY ── */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Risk Event History
              </CardTitle>
              <CardDescription>Complete log of all risk events</CardDescription>
            </CardHeader>
            <CardContent>
              {(history ?? []).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No risk events recorded yet</p>
                  <p className="text-sm mt-1">Events are logged as the system monitors your portfolio</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(history ?? []).map(h => (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{h.type.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell><span className={cn("text-xs font-semibold capitalize", severityColor(h.severity))}>{h.severity}</span></TableCell>
                        <TableCell className="text-sm">{h.message}</TableCell>
                        <TableCell>
                          {h.resolved ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Clock className="w-4 h-4 text-yellow-400" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── REPORT ── */}
        <TabsContent value="report" className="space-y-4 mt-4">
          {reportLoading ? <Skeleton className="h-64 w-full" /> : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Daily Risk Report
                  </CardTitle>
                  <CardDescription>Generated: {report?.generatedAt ? new Date(report.generatedAt).toLocaleString() : "—"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-6">
                    {[
                      { label: "Risk Score", value: `${report?.summary?.riskScore ?? 0}/100` },
                      { label: "Total Trades", value: String(report?.summary?.totalTrades ?? 0) },
                      { label: "Win Rate", value: formatPercent(report?.summary?.winRate ?? 0) },
                      { label: "Max Drawdown", value: formatPercent(report?.summary?.maxDrawdown ?? 0) },
                      { label: "Avg Exposure", value: formatPercent(report?.summary?.avgExposure ?? 0) },
                      { label: "Total P&L", value: formatCurrency(report?.summary?.totalPnl ?? 0) },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 rounded-lg border border-border bg-muted/10 text-center">
                        <p className="text-xs text-muted-foreground mb-1">{label}</p>
                        <p className="font-bold">{value}</p>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-4" />

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="text-sm font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400" /> Top Risks</p>
                      <div className="space-y-2">
                        {(report?.topRisks ?? []).map((r, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded bg-yellow-500/5 border border-yellow-500/20">
                            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-muted-foreground">{r}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> AI Improvements</p>
                      <div className="space-y-2">
                        {(report?.improvements ?? []).map((r, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded bg-success/5 border border-success/20">
                            <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                            <p className="text-sm text-muted-foreground">{r}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Report Types</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-4">
                    {["Daily", "Weekly", "Monthly", "Annual"].map(p => (
                      <Button key={p} variant="outline" className="h-16 flex-col gap-1">
                        <FileText className="w-4 h-4" />
                        <span className="text-xs">{p} Report</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
