import { 
  useGetPerformance,
  useGetDailyPerformance,
  useGetStrategyComparison,
  getGetPerformanceQueryKey,
  getGetDailyPerformanceQueryKey,
  getGetStrategyComparisonQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent, formatNumber, cnValueColor } from "@/lib/format";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";

export default function Analytics() {
  const { data: perf, isLoading: loadingPerf } = useGetPerformance({
    query: { queryKey: getGetPerformanceQueryKey() }
  });

  const { data: daily, isLoading: loadingDaily } = useGetDailyPerformance(
    { days: 30 },
    { query: { queryKey: getGetDailyPerformanceQueryKey({ days: 30 }) } }
  );

  const { data: stratComparison, isLoading: loadingStrat } = useGetStrategyComparison({
    query: { queryKey: getGetStrategyComparisonQueryKey() }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Portfolio and strategy performance metrics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Win Rate" value={perf ? formatPercent(perf.winRate) : undefined} loading={loadingPerf} />
        <MetricCard title="Profit Factor" value={perf ? formatNumber(perf.profitFactor) : undefined} loading={loadingPerf} />
        <MetricCard title="Sharpe Ratio" value={perf ? formatNumber(perf.sharpeRatio) : undefined} loading={loadingPerf} />
        <MetricCard title="Max Drawdown" value={perf ? formatPercent(perf.maxDrawdown) : undefined} valueColor="text-destructive" loading={loadingPerf} />
        <MetricCard title="Total P&L" value={perf ? formatCurrency(perf.totalPnl) : undefined} valueColor={perf ? cnValueColor(perf.totalPnl) : undefined} loading={loadingPerf} />
        <MetricCard title="Avg Win" value={perf ? formatCurrency(perf.avgWin) : undefined} valueColor="text-success" loading={loadingPerf} />
        <MetricCard title="Avg Loss" value={perf ? formatCurrency(perf.avgLoss) : undefined} valueColor="text-destructive" loading={loadingPerf} />
        <MetricCard title="Total Trades" value={perf ? formatNumber(perf.totalTrades, 0) : undefined} loading={loadingPerf} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily P&L</CardTitle>
            <CardDescription>Last 30 days performance</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDaily ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#888" 
                      fontSize={12} 
                      tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis 
                      stroke="#888" 
                      fontSize={12}
                      tickFormatter={(val) => `$${val}`}
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(val: number) => [formatCurrency(val), "P&L"]}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    />
                    <ReferenceLine y={0} stroke="#555" />
                    <Bar 
                      dataKey="pnl" 
                      fill="#3b82f6" 
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strategy Comparison</CardTitle>
            <CardDescription>Performance metrics by algorithm</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Strategy</TableHead>
                  <TableHead className="text-right">Win Rate</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                  <TableHead className="text-right">Profit Factor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingStrat ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : stratComparison?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No strategies data
                    </TableCell>
                  </TableRow>
                ) : (
                  stratComparison?.map((strat) => (
                    <TableRow key={strat.strategyId}>
                      <TableCell className="font-medium">{strat.strategyName}</TableCell>
                      <TableCell className="text-right font-mono">{formatPercent(strat.winRate)}</TableCell>
                      <TableCell className={`text-right font-mono ${cnValueColor(strat.totalPnl)}`}>
                        {strat.totalPnl > 0 ? '+' : ''}{formatCurrency(strat.totalPnl)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(strat.profitFactor)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  valueColor, 
  loading 
}: { 
  title: string; 
  value?: string | number; 
  valueColor?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className={`text-2xl font-bold ${valueColor || ""}`}>
            {value !== undefined ? value : "—"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
