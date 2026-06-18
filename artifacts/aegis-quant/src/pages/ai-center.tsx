import { useState } from "react";
import {
  useListAiDecisions,
  useAnalyzeMarket,
  useGetMarketPrices,
  getListAiDecisionsQueryKey,
  getGetMarketPricesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, TrendingUp, TrendingDown, Minus, RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "AVAXUSDT"];
const TIMEFRAMES = ["15m", "1h", "4h", "1d"];

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 80 ? "text-success" : value >= 65 ? "text-yellow-400" : "text-destructive";
  return <span className={cn("text-2xl font-bold tabular-nums", color)}>{value}%</span>;
}

function AgentCard({ name, verdict, detail }: { name: string; verdict: string; detail: string }) {
  const icon =
    verdict === "bullish" || verdict === "pass" || verdict === "approved"
      ? <CheckCircle2 className="w-4 h-4 text-success" />
      : verdict === "bearish" || verdict === "fail" || verdict === "rejected"
      ? <XCircle className="w-4 h-4 text-destructive" />
      : <AlertCircle className="w-4 h-4 text-yellow-400" />;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{name}</p>
        <p className="text-sm mt-0.5">{detail}</p>
      </div>
    </div>
  );
}

function DecisionCard({ d }: { d: { id: number; symbol: string; decision: string; confidence: number; reasoning: unknown; agentVotes: unknown; createdAt: string } }) {
  const reasoning = d.reasoning as Record<string, string[]>;
  const color = d.decision === "BUY" ? "text-success" : d.decision === "SELL" ? "text-destructive" : "text-yellow-400";

  return (
    <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{d.symbol}</span>
          <Badge variant="outline" className={cn("font-bold", color)}>{d.decision}</Badge>
        </div>
        <span className={cn("text-lg font-bold tabular-nums", d.confidence >= 80 ? "text-success" : d.confidence >= 65 ? "text-yellow-400" : "text-destructive")}>
          {d.confidence}%
        </span>
      </div>
      {reasoning?.evidence && reasoning.evidence.length > 0 && (
        <ul className="space-y-1">
          {reasoning.evidence.map((e: string, i: number) => (
            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
              <span className="mt-1 w-1 h-1 rounded-full bg-primary shrink-0" />
              {e}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</p>
    </div>
  );
}

export default function AiCenter() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("4h");
  const queryClient = useQueryClient();

  const { data: prices } = useGetMarketPrices({ query: { queryKey: getGetMarketPricesQueryKey() } });
  const { data: decisions, isLoading: loadingDecisions } = useListAiDecisions({
    query: { queryKey: getListAiDecisionsQueryKey() },
  });

  const { mutate: analyze, isPending: analyzing, data: analysisResult } = useAnalyzeMarket({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAiDecisionsQueryKey() });
      },
    },
  });

  const livePrice = prices?.find((p) => p.symbol === symbol);
  const result = analysisResult as { decision?: string; confidence?: number; reasoning?: Record<string, string[]>; agentVotes?: Record<string, { verdict: string; detail: string }> } | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            AI Command Center
          </h1>
          <p className="text-sm text-muted-foreground">Market reasoning, agent analysis, and decision history</p>
        </div>
      </div>

      {/* Analyzer */}
      <Card>
        <CardHeader>
          <CardTitle>Run AI Analysis</CardTitle>
          <CardDescription>Select a symbol and timeframe — the AI will analyze market conditions and generate a reasoned decision</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYMBOLS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map((tf) => (
                  <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {livePrice && (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-md text-sm">
                <span className="text-muted-foreground">Live:</span>
                <span className="font-semibold tabular-nums">${livePrice.price.toLocaleString()}</span>
                <span className={cn("text-xs", (livePrice.change24h ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                  {(livePrice.change24h ?? 0) >= 0 ? "+" : ""}{livePrice.change24h?.toFixed(2)}%
                </span>
              </div>
            )}
            <Button onClick={() => analyze({ data: { symbol, timeframe } })} disabled={analyzing} className="ml-auto">
              {analyzing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
              {analyzing ? "Analyzing…" : "Analyze"}
            </Button>
          </div>

          {result && (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Decision</p>
                  <span className={cn("text-3xl font-bold", result.decision === "BUY" ? "text-success" : result.decision === "SELL" ? "text-destructive" : "text-yellow-400")}>
                    {result.decision}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Confidence</p>
                  <ConfidenceBadge value={result.confidence ?? 0} />
                </div>
              </div>

              {result.agentVotes && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Agent Breakdown</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(result.agentVotes as Record<string, { verdict: string; detail: string }>).map(([name, vote]) => (
                      <AgentCard key={name} name={name} verdict={vote.verdict} detail={vote.detail} />
                    ))}
                  </div>
                </div>
              )}

              {result.reasoning?.evidence && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Evidence</p>
                  <ul className="space-y-1.5">
                    {result.reasoning.evidence.map((e: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision History */}
      <Card>
        <CardHeader>
          <CardTitle>Decision History</CardTitle>
          <CardDescription>All AI decisions recorded with full reasoning</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDecisions ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : !decisions?.length ? (
            <div className="text-center py-10 text-muted-foreground">
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No decisions yet — run your first analysis above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {decisions.map((d) => <DecisionCard key={d.id} d={d} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
