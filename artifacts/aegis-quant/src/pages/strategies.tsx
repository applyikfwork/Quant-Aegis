import { useState } from "react";
import { 
  useListStrategies, 
  useCreateStrategy, 
  useUpdateStrategy, 
  useDeleteStrategy,
  getListStrategiesQueryKey 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { formatPercent, formatNumber } from "@/lib/format";
import { Target, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Strategies() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: strategies, isLoading } = useListStrategies({
    query: { queryKey: getListStrategiesQueryKey() }
  });

  const updateStrategy = useUpdateStrategy();

  const handleToggleActive = (id: number, active: boolean) => {
    updateStrategy.mutate(
      { id, data: { active } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStrategiesQueryKey() });
          toast({ title: "Strategy updated", description: `Strategy is now ${active ? 'active' : 'inactive'}.` });
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Strategy Library</h1>
          <p className="text-sm text-muted-foreground">Manage trading algorithms and execution rules</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Strategy
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Active Strategies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Total Trades</TableHead>
                <TableHead className="text-right">Profit Factor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : strategies?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No strategies configured
                  </TableCell>
                </TableRow>
              ) : (
                strategies?.map((strategy) => (
                  <TableRow key={strategy.id}>
                    <TableCell>
                      <Switch 
                        checked={strategy.active} 
                        onCheckedChange={(checked) => handleToggleActive(strategy.id, checked)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{strategy.name}</TableCell>
                    <TableCell>v{strategy.version}</TableCell>
                    <TableCell className="text-right">{strategy.winRate != null ? formatPercent(strategy.winRate) : '—'}</TableCell>
                    <TableCell className="text-right">{strategy.totalTrades != null ? formatNumber(strategy.totalTrades, 0) : '—'}</TableCell>
                    <TableCell className="text-right">{strategy.profitFactor != null ? formatNumber(strategy.profitFactor) : '—'}</TableCell>
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
