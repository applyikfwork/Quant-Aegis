import { useListTrades, useGetPerformance, getListTradesQueryKey, getGetPerformanceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316"];

export default function Portfolio() {
  const { data: trades, isLoading: loadingTrades } = useListTrades(
    { status: "open" },
    { query: { queryKey: [...getListTradesQueryKey(), "open"] } }
  );
  const { data: allTrades } = useListTrades(
    {},
    { query: { queryKey: getListTradesQueryKey() } }
  );
  const { data: perf, isLoading: loadingPerf } = useGetPerformance({ query: { queryKey: getGetPerformanceQueryKey() } });

  const openTrades = trades ?? [];
  const closedTrades = (allTrades ?? []).filter((t) => t.status === "closed");

  // Build allocation from open trades
  const symbolMap = new Map<string, { symbol: string; quantity: number; entryValue: number; side: string }>();
  for (const t of openTrades) {
    const val = (t.entryPrice ?? 0) * (t.quantity ?? 0);
    const existing = symbolMap.get(t.symbol) ?? { symbol: t.symbol, quantity: 0, entryValue: 0, side: t.side ?? "long" };
    existing.entryValue += val;
    existing.quantity += t.quantity ?? 0;
    symbolMap.set(t.symbol, existing);
  }
  const totalExposure = Array.from(symbolMap.values()).reduce((s, v) => s + v.entryValue, 0);
  const ACCOUNT = 10000;
  const cashPct = Math.max(0, 100 - (totalExposure / ACCOUNT) * 100);

  const pieData = [
    ...Array.from(symbolMap.values()).map((v) => ({
      name: v.symbol,
      value: Math.round((v.entryValue / ACCOUNT) * 100 * 10) / 10,
    })),
    { name: "Cash", value: Math.round(cashPct * 10) / 10 },
  ];

  const totalPnlClosed = closedTrades.reduce((s, t) => s + (t.profitLoss ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-primary" />
          Portfolio Center
        </h1>
        <p className="text-sm text-muted-foreground">Allocation, exposure, and portfolio overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Account Value" value={formatCurrency(ACCOUNT + totalPnlClosed)} loading={loadingPerf} />
        <SummaryCard title="Realized P&L" value={formatCurrency(totalPnlClosed)} valueColor={totalPnlClosed >= 0 ? "text-success" : "text-destructive"} loading={loadingPerf} />
        <SummaryCard title="Open Positions" value={String(openTrades.length)} loading={loadingTrades} />
        <SummaryCard title="Total Exposure" value={formatPercent(Math.min((totalExposure / ACCOUNT) * 100, 100))} loading={loadingTrades} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Allocation Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Allocation</CardTitle>
            <CardDescription>Current capital distribution across assets</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTrades ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name} ${value}%`} labelLine={false}>
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Open Positions */}
        <Card>
          <CardHeader>
            <CardTitle>Open Positions</CardTitle>
            <CardDescription>Currently active trades</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTrades ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : openTrades.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No open positions</p>
            ) : (
              <div className="space-y-3">
                {openTrades.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-semibold text-sm">{t.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {t.quantity} @ {formatCurrency(t.entryPrice ?? 0)}
                        </p>
                      </div>
                      <Badge variant={t.side === "long" ? "default" : "destructive"} className="text-xs capitalize">
                        {t.side}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Entry value</p>
                      <p className="font-medium text-sm">{formatCurrency((t.entryPrice ?? 0) * (t.quantity ?? 0))}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Performance</CardTitle>
          <CardDescription>All-time statistics across all closed trades</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPerf ? (
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Win Rate", value: formatPercent(perf?.winRate ?? 0) },
                { label: "Profit Factor", value: (perf?.profitFactor ?? 0).toFixed(2) },
                { label: "Sharpe Ratio", value: (perf?.sharpeRatio ?? 0).toFixed(2) },
                { label: "Max Drawdown", value: formatPercent(perf?.maxDrawdown ?? 0), color: "text-destructive" },
                { label: "Avg Win", value: formatCurrency(perf?.avgWin ?? 0), color: "text-success" },
                { label: "Avg Loss", value: formatCurrency(perf?.avgLoss ?? 0), color: "text-destructive" },
              ].map((m) => (
                <div key={m.label} className="p-3 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{m.label}</p>
                  <p className={cn("text-lg font-bold", m.color)}>{m.value}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value, valueColor, loading }: { title: string; value: string; valueColor?: string; loading?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
        {loading ? <Skeleton className="h-8 w-24" /> : (
          <p className={cn("text-2xl font-bold", valueColor)}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
