import { 
  useGetDashboardSummary, 
  useGetMarketPrices,
  useListSignals,
  useListTrades,
  useGetDailyPerformance
} from "@workspace/api-client-react";
import { getGetDashboardSummaryQueryKey, getGetMarketPricesQueryKey, getListSignalsQueryKey, getListTradesQueryKey, getGetDailyPerformanceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent, cnValueColor, formatNumber } from "@/lib/format";
import { 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Wallet
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({
    query: {
      queryKey: getGetDashboardSummaryQueryKey()
    }
  });

  const { data: prices, isLoading: loadingPrices } = useGetMarketPrices({
    query: {
      queryKey: getGetMarketPricesQueryKey()
    }
  });

  const { data: trades, isLoading: loadingTrades } = useListTrades(
    { status: "open", limit: 5 },
    { query: { queryKey: getListTradesQueryKey({ status: "open", limit: 5 }) } }
  );

  const { data: signals, isLoading: loadingSignals } = useListSignals(
    { limit: 5 },
    { query: { queryKey: getListSignalsQueryKey({ limit: 5 }) } }
  );

  const { data: performance, isLoading: loadingPerf } = useGetDailyPerformance(
    { days: 7 },
    { query: { queryKey: getGetDailyPerformanceQueryKey({ days: 7 }) } }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
        <p className="text-sm text-muted-foreground">System Overview & Live Activity</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard 
          title="Account Balance" 
          value={summary ? formatCurrency(summary.accountBalance) : undefined}
          icon={Wallet}
          loading={loadingSummary}
        />
        <MetricCard 
          title="Today's P&L" 
          value={summary ? formatCurrency(summary.totalPnlToday) : undefined}
          valueColor={summary ? cnValueColor(summary.totalPnlToday) : undefined}
          icon={Activity}
          loading={loadingSummary}
        />
        <MetricCard 
          title="Win Rate (All Time)" 
          value={summary ? formatPercent(summary.winRateAllTime) : undefined}
          icon={TrendingUp}
          loading={loadingSummary}
        />
        <MetricCard 
          title="System Health" 
          value={summary?.systemHealth}
          icon={summary?.systemHealth === "healthy" ? CheckCircle2 : AlertCircle}
          iconColor={summary?.systemHealth === "healthy" ? "text-success" : "text-warning"}
          loading={loadingSummary}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>7-Day P&L</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPerf ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performance || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#888" 
                      fontSize={12} 
                      tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { weekday: 'short' })}
                    />
                    <YAxis 
                      stroke="#888" 
                      fontSize={12}
                      tickFormatter={(val) => `$${val}`}
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(val: number) => [formatCurrency(val), "Cumulative P&L"]}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cumulativePnl" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Live Market Prices</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPrices ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {prices?.slice(0, 5).map(price => (
                  <div key={price.symbol} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                    <div>
                      <div className="font-mono font-medium">{price.symbol}</div>
                      <div className="text-xs text-muted-foreground">Vol: {formatNumber(price.volume24h, 0)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono">{formatCurrency(price.price, 4)}</div>
                      <div className={cnValueColor(price.changePercent24h)}>
                        {price.changePercent24h > 0 ? '+' : ''}{formatPercent(price.changePercent24h)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  valueColor, 
  iconColor,
  loading 
}: { 
  title: string; 
  value?: string | number; 
  icon: any; 
  valueColor?: string;
  iconColor?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 text-muted-foreground ${iconColor || ""}`} />
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
