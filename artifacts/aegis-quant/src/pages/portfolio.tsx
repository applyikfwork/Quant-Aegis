import { useState } from "react";
import {
  useGetPortfolioSummary,
  useGetPortfolioHoldings,
  useGetPortfolioAllocation,
  useGetPortfolioRisk,
  useGetPortfolioAiAnalysis,
  useGetPortfolioStressTest,
  useGetPerformance,
  getGetPortfolioSummaryQueryKey,
  getGetPortfolioHoldingsQueryKey,
  getGetPortfolioAllocationQueryKey,
  getGetPortfolioRiskQueryKey,
  getGetPortfolioAiAnalysisQueryKey,
  getGetPortfolioStressTestQueryKey,
  getGetPerformanceQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatPercent, formatNumber, cnValueColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend,
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, ReferenceLine,
} from "recharts";
import {
  Briefcase, TrendingUp, TrendingDown, Shield, Brain, AlertTriangle,
  Activity, DollarSign, Target, Zap, ArrowUpRight, ArrowDownRight,
  CheckCircle, XCircle, BarChart2, PieChartIcon, RefreshCw, Info,
} from "lucide-react";

const PALETTE = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ef4444","#06b6d4","#f97316","#ec4899","#84cc16","#14b8a6"];

// ── Shared Components ────────────────────────────────────────────────────────
function StatCard({
  title, value, sub, icon: Icon, color, loading, badge
}: {
  title: string; value?: string; sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string; loading?: boolean; badge?: { label: string; color: string };
}) {
  if (loading) return (
    <Card><CardContent className="pt-5 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-24" /><Skeleton className="h-3 w-16" /></CardContent></Card>
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
          {badge && <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded-full", badge.color)}>{badge.label}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreGauge({ score, label, size = 88 }: { score: number; label: string; size?: number }) {
  const r = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} stroke="currentColor" strokeWidth="7" fill="none" className="text-muted/20" />
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth="7" fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill={color}
          fontWeight="bold" fontSize={size < 70 ? "11" : "15"} style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}>
          {pct}
        </text>
      </svg>
      <p className="text-xs text-muted-foreground text-center leading-tight">{label}</p>
    </div>
  );
}

const riskColor = (level: string) => ({
  low: "text-success border-success", medium: "text-warning border-warning", high: "text-destructive border-destructive",
  positive: "text-success bg-success/10", critical: "text-destructive bg-destructive/10"
})[level] ?? "text-muted-foreground";

const sentimentColor = (s: string) => ({ bullish: "text-success bg-success/10 border-success/30", bearish: "text-destructive bg-destructive/10 border-destructive/30", neutral: "text-muted-foreground bg-muted/20 border-border" })[s] ?? "text-muted-foreground bg-muted/20";

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const { data: summary, isLoading: loadingSum } = useGetPortfolioSummary({ query: { queryKey: getGetPortfolioSummaryQueryKey() } });
  const { data: perf, isLoading: loadingPerf } = useGetPerformance({ query: { queryKey: getGetPerformanceQueryKey() } });

  const perfData = [
    { label: "Win Rate", value: perf ? formatPercent(perf.winRate) : "—", color: (perf?.winRate ?? 0) >= 50 ? "text-success" : "text-destructive" },
    { label: "Profit Factor", value: perf ? formatNumber(perf.profitFactor, 2) : "—" },
    { label: "Sharpe Ratio", value: perf ? formatNumber(perf.sharpeRatio, 2) : "—" },
    { label: "Max Drawdown", value: perf ? formatPercent(perf.maxDrawdown) : "—", color: "text-destructive" },
    { label: "Avg Win", value: perf ? formatCurrency(perf.avgWin) : "—", color: "text-success" },
    { label: "Avg Loss", value: perf ? formatCurrency(perf.avgLoss) : "—", color: "text-destructive" },
    { label: "Total Trades", value: perf ? formatNumber(perf.totalTrades, 0) : "—" },
    { label: "Exp. Value", value: perf ? formatCurrency((perf.avgWin * perf.winRate / 100) - (perf.avgLoss * (1 - perf.winRate / 100))) : "—" },
  ];

  return (
    <div className="space-y-6">
      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Value" loading={loadingSum}
          value={summary ? formatCurrency(summary.totalValue) : undefined}
          sub={summary ? `Base: ${formatCurrency(summary.baseCapital)}` : undefined}
          icon={DollarSign}
          badge={summary ? { label: `${summary.totalReturn >= 0 ? "+" : ""}${summary.totalReturn.toFixed(2)}%`, color: summary.totalReturn >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive" } : undefined}
        />
        <StatCard title="Total P&L" loading={loadingSum}
          value={summary ? formatCurrency(summary.totalPnl) : undefined}
          sub={summary ? `Real: ${formatCurrency(summary.realizedPnl)} | Unreal: ${formatCurrency(summary.unrealizedPnl)}` : undefined}
          color={summary ? cnValueColor(summary.totalPnl) : undefined} icon={TrendingUp}
        />
        <StatCard title="Free Capital" loading={loadingSum}
          value={summary ? formatCurrency(summary.freeCapital) : undefined}
          sub={summary ? `${formatPercent((summary.freeCapital / summary.baseCapital) * 100)} available` : undefined}
          icon={Activity}
        />
        <StatCard title="Daily P&L" loading={loadingSum}
          value={summary ? formatCurrency(summary.dailyPnl) : undefined}
          sub={`${summary?.openPositions ?? 0} open positions`} icon={Zap}
          color={summary ? cnValueColor(summary.dailyPnl) : undefined}
        />
      </div>

      {/* Health + Capital usage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />Portfolio Health</CardTitle></CardHeader>
          <CardContent>
            {loadingSum ? <Skeleton className="h-32 w-full" /> : (
              <div className="flex flex-col items-center gap-3">
                <ScoreGauge score={summary?.healthScore ?? 0} label="Health Score" size={100} />
                <div className="w-full space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Risk Level</span>
                    <span className={cn("text-xs font-semibold capitalize border rounded-full px-2", riskColor(summary?.riskLevel ?? "low"))}>{summary?.riskLevel ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Win Rate</span>
                    <span className={cn("text-xs font-semibold", (summary?.winRate ?? 0) >= 50 ? "text-success" : "text-destructive")}>{summary ? `${summary.winRate.toFixed(1)}%` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Closed Trades</span>
                    <span className="text-xs font-semibold">{summary?.closedTrades ?? "—"}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" />Capital Utilization</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {loadingSum ? <div className="space-y-3">{Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-8 w-full" />)}</div> : (
              <>
                {[
                  { label: "Deployed Capital", value: summary?.usedCapital ?? 0, max: summary?.baseCapital ?? 1, color: "bg-primary" },
                  { label: "Free Capital", value: summary?.freeCapital ?? 0, max: summary?.baseCapital ?? 1, color: "bg-success" },
                  { label: "Realized P&L", value: Math.abs(summary?.realizedPnl ?? 0), max: summary?.baseCapital ?? 1, color: (summary?.realizedPnl ?? 0) >= 0 ? "bg-success" : "bg-destructive" },
                ].map(b => (
                  <div key={b.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{b.label}</span>
                      <span className="font-medium tabular-nums">{formatCurrency(b.value)} ({((b.value / b.max) * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", b.color)} style={{ width: `${Math.min(100, (b.value / b.max) * 100)}%` }} />
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Total Value", value: formatCurrency(summary?.totalValue ?? 0) },
                    { label: "Total Return", value: `${(summary?.totalReturn ?? 0) >= 0 ? "+" : ""}${(summary?.totalReturn ?? 0).toFixed(2)}%` },
                    { label: "Open", value: String(summary?.openPositions ?? 0) },
                    { label: "Closed", value: String(summary?.closedTrades ?? 0) },
                  ].map(m => (
                    <div key={m.label} className="bg-muted/20 rounded-md p-2">
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                      <p className="text-sm font-semibold">{m.value}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance metrics */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Professional Performance Metrics</CardTitle></CardHeader>
        <CardContent>
          {loadingPerf ? (
            <div className="grid grid-cols-4 gap-3">{Array.from({length:8}).map((_,i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {perfData.map(m => (
                <div key={m.label} className="p-3 rounded-lg bg-muted/20 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                  <p className={cn("text-lg font-bold", m.color ?? "")}>{m.value}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Holdings Tab ─────────────────────────────────────────────────────────────
function HoldingsTab() {
  const { data: holdings, isLoading } = useGetPortfolioHoldings({ query: { queryKey: getGetPortfolioHoldingsQueryKey() } });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Briefcase className="w-4 h-4 text-primary" />Asset Holdings</CardTitle>
          <CardDescription>Aggregated positions by asset across all open trades</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Asset</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Avg Cost</TableHead>
                <TableHead className="text-right">Mkt Value</TableHead>
                <TableHead className="text-right">Unreal P&L</TableHead>
                <TableHead className="text-right">Allocation</TableHead>
                <TableHead className="text-right">Risk</TableHead>
                <TableHead className="text-right pr-4">Stop / TP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({length:5}).map((_,i) => (
                  <TableRow key={i}>{Array.from({length:8}).map((__,j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : !holdings?.length ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No holdings — open positions to see data</TableCell></TableRow>
              ) : (
                holdings.map(h => (
                  <TableRow key={h.symbol}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {h.symbol === "CASH" ? "$" : h.symbol.slice(0,2)}
                        </div>
                        <div>
                          <p className="font-mono font-semibold text-sm">{h.symbol}</p>
                          {h.trades > 0 && <p className="text-xs text-muted-foreground">{h.trades} trade{h.trades !== 1 ? "s" : ""}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{h.symbol === "CASH" ? "—" : formatNumber(h.quantity, 4)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(h.averageCost, 2)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(h.marketValue)}</TableCell>
                    <TableCell className="text-right">
                      {h.symbol === "CASH" ? <span className="text-muted-foreground">—</span> : (
                        <div className={cn("text-sm font-mono", cnValueColor(h.unrealizedPnl))}>
                          {h.unrealizedPnl > 0 ? "+" : ""}{formatCurrency(h.unrealizedPnl)}
                          <span className="text-xs opacity-70 ml-1">({h.unrealizedPnlPct > 0 ? "+" : ""}{h.unrealizedPnlPct.toFixed(2)}%)</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="space-y-0.5">
                        <span className="text-sm font-medium">{h.allocationPct.toFixed(1)}%</span>
                        <div className="h-1 bg-muted/30 rounded-full overflow-hidden w-16 ml-auto">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${h.allocationPct}%` }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("text-xs font-medium", h.riskContrib > 40 ? "text-destructive" : h.riskContrib > 25 ? "text-warning" : "text-success")}>{h.riskContrib.toFixed(1)}%</span>
                    </TableCell>
                    <TableCell className="text-right pr-4 text-xs font-mono">
                      {h.stopLoss || h.takeProfit ? (
                        <div>
                          {h.stopLoss && <span className="text-destructive">SL {formatCurrency(h.stopLoss, 0)}</span>}
                          {h.stopLoss && h.takeProfit && <span className="text-muted-foreground"> / </span>}
                          {h.takeProfit && <span className="text-success">TP {formatCurrency(h.takeProfit, 0)}</span>}
                        </div>
                      ) : <span className="text-muted-foreground">None</span>}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Allocation Tab ────────────────────────────────────────────────────────────
function AllocationTab() {
  const { data: allocation, isLoading } = useGetPortfolioAllocation({ query: { queryKey: getGetPortfolioAllocationQueryKey() } });

  const grouped = allocation ? allocation.reduce((acc, item) => {
    const cat = item.category;
    acc[cat] = (acc[cat] ?? 0) + item.pct;
    return acc;
  }, {} as Record<string, number>) : {};

  const categoryData = Object.entries(grouped).map(([name, pct], i) => ({ name, value: Math.round(pct * 10) / 10, fill: PALETTE[i % PALETTE.length] }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><PieChartIcon className="w-4 h-4 text-primary" />Asset Allocation</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-56 w-full" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={allocation?.map((a,i) => ({ ...a, fill: PALETTE[i % PALETTE.length] })) ?? []}
                    cx="50%" cy="50%" outerRadius={95} innerRadius={40} dataKey="pct" nameKey="symbol">
                    {(allocation ?? []).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: number) => `${v}%`} />
                  <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4 text-primary" />Category Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-10 w-full" />) : (
              categoryData.map((cat, i) => (
                <div key={cat.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{cat.name}</span>
                    <span className="text-muted-foreground">{cat.value}%</span>
                  </div>
                  <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${cat.value}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Allocation detail table */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Allocation Detail</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Symbol</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right pr-4">Allocation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({length:5}).map((_,i) => <TableRow key={i}>{Array.from({length:4}).map((__,j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>) :
                !allocation?.length ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No allocation data</TableCell></TableRow> :
                allocation.map((item, i) => (
                  <TableRow key={item.symbol}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                        <span className="font-mono font-medium text-sm">{item.symbol}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{item.category}</Badge></TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(item.value)}</TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 bg-muted/30 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{item.pct}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Risk Tab ──────────────────────────────────────────────────────────────────
function RiskTab() {
  const { data: risk, isLoading } = useGetPortfolioRisk({ query: { queryKey: getGetPortfolioRiskQueryKey() } });

  const radarData = risk ? [
    { metric: "Diversif.", score: Math.max(0, 100 - (risk.concentrationRisk ?? 0)) },
    { metric: "Stop Loss", score: risk.stopLossRate },
    { metric: "Low Lever.", score: Math.max(0, 100 - risk.leverageRisk) },
    { metric: "Low Vol.", score: Math.max(0, 100 - risk.portfolioVolatility * 10) },
    { metric: "Low Exp.", score: Math.max(0, 100 - risk.exposurePct) },
  ] : [];

  const riskItems = risk ? [
    { label: "Open Exposure", value: formatCurrency(risk.openExposure), sub: `${risk.exposurePct}% of capital`, severity: risk.exposurePct > 80 ? "high" : risk.exposurePct > 50 ? "medium" : "low" },
    { label: "Concentration Risk", value: `${risk.concentrationRisk.toFixed(1)}%`, sub: "Largest single asset", severity: risk.concentrationRisk > 60 ? "high" : risk.concentrationRisk > 40 ? "medium" : "low" },
    { label: "Portfolio Volatility", value: `${risk.portfolioVolatility.toFixed(2)}%`, sub: "Based on closed trades", severity: risk.portfolioVolatility > 10 ? "high" : risk.portfolioVolatility > 5 ? "medium" : "low" },
    { label: "Value at Risk (95%)", value: formatCurrency(risk.valueAtRisk95), sub: "1-day 95% VaR", severity: risk.valueAtRisk95 > 1000 ? "high" : risk.valueAtRisk95 > 500 ? "medium" : "low" },
    { label: "Leverage Risk", value: `${risk.leverageRisk.toFixed(1)}%`, sub: "Exposure vs capital", severity: risk.leverageRisk > 50 ? "high" : risk.leverageRisk > 20 ? "medium" : "low" },
    { label: "Stop Loss Rate", value: `${risk.stopLossRate.toFixed(1)}%`, sub: `${risk.positionsWithoutStops} position${risk.positionsWithoutStops !== 1 ? "s" : ""} unprotected`, severity: risk.stopLossRate < 50 ? "high" : risk.stopLossRate < 80 ? "medium" : "low" },
    { label: "Max Drawdown", value: `${risk.maxDrawdown.toFixed(2)}%`, sub: "Worst individual trade", severity: risk.maxDrawdown > 20 ? "high" : risk.maxDrawdown > 10 ? "medium" : "low" },
    { label: "Downside Volatility", value: `${risk.downsideVolatility.toFixed(2)}%`, sub: "Sortino-relevant measure", severity: risk.downsideVolatility > 8 ? "high" : risk.downsideVolatility > 4 ? "medium" : "low" },
  ] : [];

  const sevColor = (s: string) => ({ high: "text-destructive", medium: "text-warning", low: "text-success" })[s] ?? "text-muted-foreground";
  const sevBg = (s: string) => ({ high: "border-l-destructive", medium: "border-l-warning", low: "border-l-success" })[s] ?? "";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Risk Score */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />Risk Score</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-36 w-full" /> : (
              <div className="flex flex-col items-center gap-3">
                <ScoreGauge score={risk?.riskScore ?? 0} label="Risk Control Score" size={104} />
                <p className="text-xs text-muted-foreground text-center">Higher = better risk management</p>
                <div className="w-full text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Open Positions</span>
                    <span className="font-medium">{risk?.openPositions ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Without Stops</span>
                    <span className={cn("font-medium", (risk?.positionsWithoutStops ?? 0) > 0 ? "text-destructive" : "text-success")}>{risk?.positionsWithoutStops ?? 0}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Radar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">Risk Profile</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "#888" }} />
                  <Radar name="Risk" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Risk metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isLoading ? Array.from({length:8}).map((_,i) => <Skeleton key={i} className="h-16 w-full" />) :
          riskItems.map(item => (
            <div key={item.label} className={cn("border-l-2 pl-3 py-2 border border-border rounded-r-md", sevBg(item.severity))}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className={cn("text-xs font-semibold capitalize", sevColor(item.severity))}>{item.severity}</span>
              </div>
              <p className="text-base font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.sub}</p>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── AI Advisor Tab ────────────────────────────────────────────────────────────
function AiAdvisorTab() {
  const { data: analysis, isLoading } = useGetPortfolioAiAnalysis({ query: { queryKey: getGetPortfolioAiAnalysisQueryKey() } });

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Brain className="w-4 h-4 text-primary" />AI Portfolio Analysis</CardTitle>
            {analysis && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("text-xs border", sentimentColor(analysis.sentiment))}>
                  {analysis.sentiment === "bullish" ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : analysis.sentiment === "bearish" ? <ArrowDownRight className="w-3 h-3 mr-0.5" /> : null}
                  {analysis.sentiment.toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground">Confidence: <strong>{analysis.confidence}%</strong></span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
          ) : (
            <p className="text-sm leading-relaxed text-foreground/90">{analysis?.summary ?? "No analysis available."}</p>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4 text-primary" />Recommendations</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !analysis?.recommendations?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recommendations at this time</p>
          ) : (
            <div className="space-y-3">
              {analysis.recommendations.map((rec, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                  <div className="shrink-0 w-5 h-5 rounded-full bg-warning/20 text-warning flex items-center justify-center text-xs font-bold mt-0.5">{i + 1}</div>
                  <p className="text-sm">{rec}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Portfolio metrics snapshot */}
      {analysis?.metrics && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-primary" />Snapshot Metrics</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Open Positions", value: String(analysis.metrics.openPositions ?? 0) },
                { label: "Unique Symbols", value: String(analysis.metrics.symbolCount ?? 0) },
                { label: "Free Capital", value: `${(analysis.metrics.freeCapitalPct as number ?? 0).toFixed(1)}%` },
                { label: "Win Rate", value: `${(analysis.metrics.winRate as number ?? 0).toFixed(1)}%` },
                { label: "Realized P&L", value: formatCurrency(analysis.metrics.realizedPnl as number ?? 0) },
                { label: "AI Confidence", value: `${analysis.confidence}%` },
              ].map(m => (
                <div key={m.label} className="p-3 bg-muted/20 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                  <p className="text-base font-bold">{m.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Stress Test Tab ───────────────────────────────────────────────────────────
function StressTestTab() {
  const { data: scenarios, isLoading } = useGetPortfolioStressTest({ query: { queryKey: getGetPortfolioStressTestQueryKey() } });

  const barData = scenarios?.map(s => ({
    name: s.name.replace(" ", "\n"),
    impact: s.impact,
    portfolioMove: s.portfolioMove,
  })) ?? [];

  const sevColor = (s: string) => ({
    positive: "border-success/30 bg-success/5",
    low: "border-muted",
    medium: "border-warning/30 bg-warning/5",
    high: "border-orange-400/30 bg-orange-400/5",
    critical: "border-destructive/30 bg-destructive/5",
  })[s] ?? "border-border";

  const sevTextColor = (s: string) => ({
    positive: "text-success",
    low: "text-muted-foreground",
    medium: "text-warning",
    high: "text-orange-400",
    critical: "text-destructive",
  })[s] ?? "text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg border border-warning/30 bg-warning/5">
        <Info className="w-4 h-4 text-warning shrink-0" />
        <p className="text-xs text-muted-foreground">Stress tests simulate portfolio impact based on historical exposure. Results are estimates for risk planning.</p>
      </div>

      {/* Bar chart */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" />Impact Projection</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="name" stroke="#888" fontSize={10} />
                <YAxis stroke="#888" fontSize={11} tickFormatter={v => `$${v}`} />
                <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                <ReferenceLine y={0} stroke="#666" />
                <Bar dataKey="impact" name="P&L Impact" fill="#3b82f6"
                  radius={[3, 3, 0, 0]}
                  label={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Scenario cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading ? Array.from({length:6}).map((_,i) => <Skeleton key={i} className="h-36 w-full" />) :
          scenarios?.map(s => (
            <div key={s.name} className={cn("border rounded-lg p-4 space-y-2", sevColor(s.severity))}>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{s.name}</p>
                <span className={cn("text-xs font-bold capitalize", sevTextColor(s.severity))}>{s.severity}</span>
              </div>
              <p className="text-xs text-muted-foreground">{s.description}</p>
              <Separator />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Market Move</p>
                  <p className={cn("font-semibold", s.marketMove >= 0 ? "text-success" : "text-destructive")}>
                    {s.marketMove >= 0 ? "+" : ""}{s.marketMove}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Portfolio Move</p>
                  <p className={cn("font-semibold", s.portfolioMove >= 0 ? "text-success" : "text-destructive")}>
                    {s.portfolioMove >= 0 ? "+" : ""}{s.portfolioMove}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">P&L Impact</p>
                  <p className={cn("font-semibold", s.impact >= 0 ? "text-success" : "text-destructive")}>
                    {s.impact >= 0 ? "+" : ""}{formatCurrency(s.impact)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Portfolio After</p>
                  <p className="font-semibold">{formatCurrency(s.newPortfolioValue)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {s.survivable
                  ? <><CheckCircle className="w-3 h-3 text-success" /><span className="text-xs text-success">Portfolio survives</span></>
                  : <><XCircle className="w-3 h-3 text-destructive" /><span className="text-xs text-destructive">Critical loss</span></>
                }
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── Main Portfolio Page ───────────────────────────────────────────────────────
export default function Portfolio() {
  const [tab, setTab] = useState("overview");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />Portfolio Center
          </h1>
          <p className="text-sm text-muted-foreground">Institutional capital management, position intelligence & AI control system</p>
        </div>
        <Badge variant="outline" className="text-xs gap-1.5 border-primary/30 text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Live
        </Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-5 h-9 w-full max-w-xl">
          <TabsTrigger value="overview" className="text-xs"><Activity className="w-3 h-3 mr-1" />Overview</TabsTrigger>
          <TabsTrigger value="holdings" className="text-xs"><Briefcase className="w-3 h-3 mr-1" />Holdings</TabsTrigger>
          <TabsTrigger value="allocation" className="text-xs"><PieChartIcon className="w-3 h-3 mr-1" />Allocation</TabsTrigger>
          <TabsTrigger value="risk" className="text-xs"><Shield className="w-3 h-3 mr-1" />Risk</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs"><Brain className="w-3 h-3 mr-1" />AI Advisor</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
        <TabsContent value="holdings" className="mt-4"><HoldingsTab /></TabsContent>
        <TabsContent value="allocation" className="mt-4"><AllocationTab /></TabsContent>
        <TabsContent value="risk" className="mt-4"><RiskTab /></TabsContent>
        <TabsContent value="ai" className="mt-4">
          <Tabs defaultValue="analysis">
            <TabsList className="h-8">
              <TabsTrigger value="analysis" className="text-xs">AI Analysis</TabsTrigger>
              <TabsTrigger value="stress" className="text-xs">Stress Test</TabsTrigger>
            </TabsList>
            <TabsContent value="analysis" className="mt-4"><AiAdvisorTab /></TabsContent>
            <TabsContent value="stress" className="mt-4"><StressTestTab /></TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
