import { useState } from "react";
import { 
  useListBacktests,
  getListBacktestsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent, formatNumber, formatDate } from "@/lib/format";
import { Terminal, Plus, Play } from "lucide-react";

export default function Backtests() {
  const { data: backtests, isLoading } = useListBacktests({
    query: { queryKey: getListBacktestsQueryKey() }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backtesting</h1>
          <p className="text-sm text-muted-foreground">Historical simulation and algorithm testing</p>
        </div>
        <Button>
          <Play className="w-4 h-4 mr-2" />
          Run Simulation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Terminal className="w-5 h-5 mr-2" />
            Previous Runs
          </CardTitle>
          <CardDescription>Results from completed historical simulations</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategy</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Trades</TableHead>
                <TableHead className="text-right">Profit Factor</TableHead>
                <TableHead className="text-right">Drawdown</TableHead>
                <TableHead className="text-right">Run Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : backtests?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No backtests run yet
                  </TableCell>
                </TableRow>
              ) : (
                backtests?.map((bt) => (
                  <TableRow key={bt.id}>
                    <TableCell className="font-medium">{bt.strategyName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(bt.startDate).toLocaleDateString()} - {new Date(bt.endDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatPercent(bt.winRate)}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(bt.totalTrades, 0)}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(bt.profitFactor)}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{formatPercent(bt.drawdown)}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">{formatDate(bt.createdAt)}</TableCell>
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
