import { useState } from "react";
import { 
  useListTrades, 
  useUpdateTrade, 
  getListTradesQueryKey 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent, formatNumber, cnValueColor, formatDate } from "@/lib/format";
import { BarChart2, Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Trades() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: trades, isLoading } = useListTrades({
    query: { queryKey: getListTradesQueryKey() }
  });

  const updateTrade = useUpdateTrade();

  const handleCloseTrade = (id: number, currentPrice: number = 0) => {
    updateTrade.mutate(
      { id, data: { status: "closed", exitPrice: currentPrice, exitTime: new Date().toISOString() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
          toast({ title: "Trade closed", description: "Position successfully closed." });
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trade Journal</h1>
          <p className="text-sm text-muted-foreground">History of open and closed positions</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Log Trade
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart2 className="w-5 h-5 mr-2" />
            Trade History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Side</TableHead>
                <TableHead className="text-right">Entry</TableHead>
                <TableHead className="text-right">Exit</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : trades?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No trades logged
                  </TableCell>
                </TableRow>
              ) : (
                trades?.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell className="font-mono font-medium">{trade.symbol}</TableCell>
                    <TableCell>
                      <span className={trade.side === 'long' ? 'text-success flex items-center' : 'text-destructive flex items-center'}>
                        {trade.side === 'long' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                        {trade.side.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(trade.entryPrice, 4)}</TableCell>
                    <TableCell className="text-right font-mono">{trade.exitPrice ? formatCurrency(trade.exitPrice, 4) : '—'}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(trade.quantity, 4)}</TableCell>
                    <TableCell className="text-right">
                      {trade.profitLoss != null ? (
                        <div className={`font-mono ${cnValueColor(trade.profitLoss)}`}>
                          {trade.profitLoss > 0 ? '+' : ''}{formatCurrency(trade.profitLoss)}
                          <span className="text-xs ml-1 opacity-70">
                            ({trade.profitPercent! > 0 ? '+' : ''}{formatPercent(trade.profitPercent!)})
                          </span>
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        trade.status === 'open' ? 'border-primary text-primary' : 
                        trade.status === 'closed' ? 'border-muted text-muted-foreground' : 
                        'border-warning text-warning'
                      }>
                        {trade.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                      {trade.entryTime ? formatDate(trade.entryTime) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {trade.status === 'open' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={() => handleCloseTrade(trade.id, trade.entryPrice * 1.05)} // Mock exit price
                        >
                          Close
                        </Button>
                      )}
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
