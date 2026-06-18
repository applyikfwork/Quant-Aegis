import { useGetMarketPrices, getGetMarketPricesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent, formatNumber, cnValueColor } from "@/lib/format";

export default function Market() {
  const { data: prices, isLoading } = useGetMarketPrices({
    query: {
      queryKey: getGetMarketPricesQueryKey(),
      refetchInterval: 5000 // Refresh every 5s
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Market Data</h1>
        <p className="text-sm text-muted-foreground">Live crypto market prices and metrics</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Pairs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">24h Change</TableHead>
                <TableHead className="text-right">24h Volume</TableHead>
                <TableHead className="text-right">24h High</TableHead>
                <TableHead className="text-right">24h Low</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : prices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No market data available
                  </TableCell>
                </TableRow>
              ) : (
                prices?.map((price) => (
                  <TableRow key={price.symbol}>
                    <TableCell className="font-mono font-medium">{price.symbol}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(price.price, 4)}</TableCell>
                    <TableCell className={`text-right font-mono ${cnValueColor(price.changePercent24h)}`}>
                      {price.changePercent24h > 0 ? '+' : ''}{formatPercent(price.changePercent24h)}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(price.volume24h, 0)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(price.high24h, 4)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(price.low24h, 4)}</TableCell>
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
