import { useState } from "react";
import {
  useListPaperTrades,
  useCreatePaperTrade,
  useUpdatePaperTrade,
  useListStrategies,
  getListPaperTradesQueryKey,
  getListStrategiesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercent, cnValueColor } from "@/lib/format";
import { cn } from "@/lib/utils";

const SYMBOLS = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","AVAXUSDT","ADAUSDT","DOGEUSDT"];

export default function PaperTrading() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ symbol: "BTCUSDT", side: "long", strategyId: "", entryPrice: "", quantity: "", stopLoss: "", takeProfit: "" });
  const [closingId, setClosingId] = useState<number | null>(null);
  const [exitPrice, setExitPrice] = useState("");

  const { data: paperTrades, isLoading } = useListPaperTrades({ query: { queryKey: getListPaperTradesQueryKey() } });
  const { data: strategies } = useListStrategies({ query: { queryKey: getListStrategiesQueryKey() } });

  const { mutate: create, isPending: creating } = useCreatePaperTrade({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPaperTradesQueryKey() }); setShowForm(false); setForm({ symbol: "BTCUSDT", side: "long", strategyId: "", entryPrice: "", quantity: "", stopLoss: "", takeProfit: "" }); } },
  });

  const { mutate: update, isPending: closing } = useUpdatePaperTrade({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPaperTradesQueryKey() }); setClosingId(null); setExitPrice(""); } },
  });

  const trades = paperTrades ?? [];
  const openTrades = trades.filter((t) => t.status === "open");
  const closedTrades = trades.filter((t) => t.status === "closed");
  const totalPnl = closedTrades.reduce((s, t) => s + (t.profitLoss ?? 0), 0);
  const wins = closedTrades.filter((t) => (t.profitLoss ?? 0) > 0).length;
  const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;

  const f = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Paper Trading
          </h1>
          <p className="text-sm text-muted-foreground">Simulate trades with real market data before going live</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Open Paper Trade
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Open Positions", value: String(openTrades.length) },
          { label: "Total P&L", value: formatCurrency(totalPnl), color: cnValueColor(totalPnl) },
          { label: "Win Rate", value: formatPercent(winRate), color: winRate >= 60 ? "text-success" : "text-yellow-400" },
          { label: "Closed Trades", value: String(closedTrades.length) },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle>Open Paper Trade</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div className="space-y-1.5">
                <Label>Symbol</Label>
                <Select value={form.symbol} onValueChange={(v) => f("symbol", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SYMBOLS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Side</Label>
                <Select value={form.side} onValueChange={(v) => f("side", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="long">Long</SelectItem>
                    <SelectItem value="short">Short</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Entry Price</Label>
                <Input value={form.entryPrice} onChange={(e) => f("entryPrice", e.target.value)} placeholder="103500" />
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input value={form.quantity} onChange={(e) => f("quantity", e.target.value)} placeholder="0.05" />
              </div>
              <div className="space-y-1.5">
                <Label>Stop Loss</Label>
                <Input value={form.stopLoss} onChange={(e) => f("stopLoss", e.target.value)} placeholder="100800" />
              </div>
              <div className="space-y-1.5">
                <Label>Take Profit</Label>
                <Input value={form.takeProfit} onChange={(e) => f("takeProfit", e.target.value)} placeholder="112000" />
              </div>
            </div>
            <div className="space-y-1.5 sm:w-48">
              <Label>Strategy (optional)</Label>
              <Select value={form.strategyId} onValueChange={(v) => f("strategyId", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(strategies ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={creating || !form.entryPrice || !form.quantity}
                onClick={() => create({ data: { symbol: form.symbol, side: form.side, entryPrice: parseFloat(form.entryPrice), quantity: parseFloat(form.quantity), stopLoss: form.stopLoss ? parseFloat(form.stopLoss) : undefined, takeProfit: form.takeProfit ? parseFloat(form.takeProfit) : undefined, strategyId: form.strategyId && form.strategyId !== "none" ? parseInt(form.strategyId) : undefined, status: "open" } })}
              >
                {creating ? "Opening…" : "Open Trade"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Open Positions */}
      <Card>
        <CardHeader>
          <CardTitle>Open Paper Positions</CardTitle>
          <CardDescription>{openTrades.length} active</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            : openTrades.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">No open paper positions</p>
            : (
              <div className="space-y-3">
                {openTrades.map((t) => (
                  <div key={t.id} className="p-3 rounded-lg border border-border bg-muted/20">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{t.symbol}</span>
                        <Badge variant={t.side === "long" ? "default" : "destructive"} className="text-xs capitalize">{t.side}</Badge>
                        <span className="text-sm text-muted-foreground">@ {formatCurrency(t.entryPrice ?? 0)} × {t.quantity}</span>
                      </div>
                      {closingId === t.id ? (
                        <div className="flex items-center gap-2">
                          <Input className="w-32 h-8 text-sm" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} placeholder="Exit price" />
                          <Button size="sm" disabled={closing || !exitPrice}
                            onClick={() => update({ id: t.id, data: { exitPrice: parseFloat(exitPrice), status: "closed" } })}>
                            {closing ? "Closing…" : "Close"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setClosingId(null)}>✕</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setClosingId(t.id)}>Close Position</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </CardContent>
      </Card>

      {/* Closed Trades */}
      <Card>
        <CardHeader>
          <CardTitle>Closed Paper Trades</CardTitle>
          <CardDescription>{closedTrades.length} completed</CardDescription>
        </CardHeader>
        <CardContent>
          {closedTrades.length === 0 ? <p className="text-center text-muted-foreground py-6 text-sm">No closed paper trades yet</p> : (
            <div className="space-y-2">
              {closedTrades.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/10">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{t.symbol}</span>
                    <Badge variant={t.side === "long" ? "default" : "destructive"} className="text-xs capitalize">{t.side}</Badge>
                    <span className="text-xs text-muted-foreground">{formatCurrency(t.entryPrice ?? 0)} → {formatCurrency(t.exitPrice ?? 0)}</span>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-bold text-sm", cnValueColor(t.profitLoss ?? 0))}>{formatCurrency(t.profitLoss ?? 0)}</p>
                    <p className={cn("text-xs", cnValueColor(t.profitPercent ?? 0))}>{formatPercent(t.profitPercent ?? 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
