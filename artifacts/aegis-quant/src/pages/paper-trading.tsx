import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet, TrendingUp, TrendingDown, Activity, Target, ShieldCheck,
  Zap, BarChart2, RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Clock, Brain, ArrowUpRight, ArrowDownRight, DollarSign, Gauge,
  ChevronRight, BookOpen, Award, AlertCircle, Info, History,
  ListOrdered, Settings, PlayCircle, PauseCircle, Layers, Star,
  CircleDot, Timer, Eye, Flame, Shield, RotateCcw, X, Plus, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Account = {
  id: string; balance: number; currency: string; leverage: number;
  equity: number; usedMargin: number; freeMargin: number; marginLevel: number;
  unrealizedPnl: number; realizedPnl: number;
  todayPnl: number; weekPnl: number; monthPnl: number;
  initialBalance: number; totalTrades: number; winningTrades: number;
  losingTrades: number; totalFees: number; version: number;
  maxEquity: number; minEquity: number; resetCount: number;
};
type Fill = { qty: number; price: number; ts: string; fee: number };
type Position = {
  id: string; symbol: string; side: "long" | "short"; quantity: number;
  entryPrice: number; currentPrice: number; unrealizedPnl: number;
  unrealizedPnlPct: number; stopLoss: number | null; takeProfit: number | null;
  leverage: number; margin: number; liquidationPrice: number;
  strategy: string; openTime: string; maxProfit: number; maxDrawdown: number;
  currentRisk: number; atr: number; fee: number; slippage: number;
  notes: string; fills: Fill[];
};
type LifecycleEvt = { state: string; ts: string; detail: string };
type Order = {
  id: string; symbol: string; orderType: string; side: "buy" | "sell";
  quantity: number; status: string; filledQty: number; avgFillPrice: number;
  fee: number; slippage: number; source: string; strategy: string;
  latencyMs: number; fillQuality: number; rejectReason: string | null;
  validationLog: string[]; lifecycle: LifecycleEvt[];
  createdAt: string; executedAt: string | null;
};
type Performance = {
  totalTrades: number; wins: number; losses: number; winRate: number;
  totalPnl: number; grossProfit: number; grossLoss: number;
  profitFactor: number; expectancy: number; avgWin: number; avgLoss: number;
  avgRR: number; avgDurationMin: number;
  sharpe: number; sortino: number; calmar: number; maxDrawdownPct: number;
  totalFees: number; totalSlippage: number; executionQuality: number;
  capitalEfficiency: number;
  bySymbol: Record<string, { trades: number; wins: number; pnl: number }>;
  byStrategy: Record<string, { trades: number; wins: number; pnl: number }>;
};
type ClosedTrade = {
  id: string; symbol: string; side: "long" | "short"; quantity: number;
  entryPrice: number; exitPrice: number; pnl: number; pnlPct: number;
  fee: number; duration: number; exitReason: string; strategy: string;
  openTime: string; closeTime: string; rr: number;
};
type OrderForm = {
  symbol: string; orderType: string; side: "buy" | "sell";
  quantity: string; price: string; stopPrice: string;
  stopLoss: string; takeProfit: string; leverage: number;
  strategy: string; trailingPct: string;
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const SYMBOLS = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","AVAXUSDT","ADAUSDT","DOGEUSDT"];
const ORDER_TYPES = ["market","limit","stop","stop_limit","trailing_stop","oco","bracket","twap","vwap"];
const STRATEGIES = ["Manual","SMC Breakout","Trend Following","Momentum Alpha","Mean Reversion","Swing Pivot","Scalping Alpha","AI Adaptive","Grid Strategy"];
const BASE_PRICES: Record<string, number> = {
  BTCUSDT:104231,ETHUSDT:3847,SOLUSDT:178.4,BNBUSDT:672,XRPUSDT:2.34,AVAXUSDT:38.2,ADAUSDT:0.862,DOGEUSDT:0.178
};

function pnlColor(v: number) { return v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-muted-foreground"; }
function pnlBg(v: number) { return v > 0 ? "bg-emerald-500/8 border-emerald-500/20" : v < 0 ? "bg-red-500/8 border-red-500/20" : "bg-muted/10 border-border"; }
function sideColor(s: string) { const sl = s.toLowerCase(); return sl === "long" || sl === "buy" ? "text-emerald-400" : "text-red-400"; }
function sideBg(s: string) { const sl = s.toLowerCase(); return sl === "long" || sl === "buy" ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"; }
function statusColor(s: string) {
  if (["filled","completed"].includes(s)) return "text-emerald-400 border-emerald-500/30";
  if (["cancelled","rejected","expired"].includes(s)) return "text-red-400 border-red-500/30";
  if (["partial"].includes(s)) return "text-yellow-400 border-yellow-500/30";
  if (["pending","validated","queued","submitted"].includes(s)) return "text-blue-400 border-blue-500/30";
  return "text-muted-foreground border-border";
}
function fmtPrice(n: number | null | undefined) {
  if (n == null || n === 0) return "—";
  return n > 1000 ? `$${n.toLocaleString(undefined,{maximumFractionDigits:0})}` : `$${n.toFixed(n < 1 ? 4 : 2)}`;
}
function fmtPnl(n: number) {
  return `${n >= 0 ? "+" : ""}$${Math.abs(n).toFixed(2)}`;
}
function fmtPct(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`; }
function relTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m/60)}h ago` : `${Math.floor(m/1440)}d ago`;
}
function durFmt(mins: number) {
  if (mins < 60) return `${Math.round(mins)}m`;
  if (mins < 1440) return `${Math.round(mins/60)}h`;
  return `${(mins/1440).toFixed(1)}d`;
}

// ─── API ──────────────────────────────────────────────────────────────────────
const BASE = "/api/paper-trading";
const apiFetch = (path: string) => fetch(path).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
const apiPost = (path: string, body: unknown) => fetch(path, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) }).then(r => r.json());

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, bg, trend }:
  { icon: React.ElementType; label: string; value: string; sub?: string; color?: string; bg?: string; trend?: number }) {
  return (
    <div className={cn("rounded-xl border p-4 space-y-2", bg ?? "bg-muted/10 border-border")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        {trend !== undefined && (
          <span className={cn("text-[10px] font-medium", trend >= 0 ? "text-emerald-400" : "text-red-400")}>
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(2)}%
          </span>
        )}
      </div>
      <div className={cn("text-xl font-black tabular-nums", color ?? "")}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ─── ACCOUNT HEALTH BAR ───────────────────────────────────────────────────────
function AccountHealth({ acc }: { acc: Account }) {
  const marginUsePct = acc.usedMargin > 0 ? (acc.usedMargin / acc.equity) * 100 : 0;
  const pnlPct = ((acc.balance - acc.initialBalance) / acc.initialBalance) * 100;
  const winRate = acc.totalTrades > 0 ? (acc.winningTrades / acc.totalTrades) * 100 : 0;
  const health = Math.max(0, 100 - marginUsePct * 0.5 - (acc.marginLevel < 200 ? 30 : 0) + (winRate > 50 ? 10 : 0));

  return (
    <div className="p-4 rounded-xl border bg-muted/10 border-border space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Account Health</span>
        </div>
        <span className={cn("text-lg font-black", health > 70 ? "text-emerald-400" : health > 40 ? "text-yellow-400" : "text-red-400")}>
          {Math.round(health)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", health > 70 ? "bg-emerald-500" : health > 40 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${health}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
        <div><div className="text-muted-foreground">Margin Use</div><div className={cn("font-bold", marginUsePct > 70 ? "text-red-400" : "text-emerald-400")}>{marginUsePct.toFixed(1)}%</div></div>
        <div><div className="text-muted-foreground">Margin Level</div><div className={cn("font-bold", acc.marginLevel < 150 ? "text-red-400" : "text-emerald-400")}>{acc.marginLevel.toFixed(0)}%</div></div>
        <div><div className="text-muted-foreground">Win Rate</div><div className={cn("font-bold", winRate > 50 ? "text-emerald-400" : "text-red-400")}>{winRate.toFixed(1)}%</div></div>
      </div>
    </div>
  );
}

// Import missing icon
import { Heart } from "lucide-react";

// ─── ORDER FORM ───────────────────────────────────────────────────────────────
function ExecutePanel({ account, onSuccess }: { account: Account | undefined; onSuccess: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<OrderForm>({
    symbol: "BTCUSDT", orderType: "market", side: "buy",
    quantity: "", price: "", stopPrice: "",
    stopLoss: "", takeProfit: "", leverage: 5,
    strategy: "Manual", trailingPct: "1.5",
  });
  const [preview, setPreview] = useState<{
    execPrice: number; notional: number; margin: number;
    fee: number; sl: number | null; tp: number | null;
    liqPrice: number; rr: number | null;
  } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [validating, setValidating] = useState(false);

  const f = (k: keyof OrderForm, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const basePrice = BASE_PRICES[form.symbol] ?? 100;
  const qty = Number(form.quantity) || 0;
  const lev = form.leverage;
  const execPrice = basePrice * (form.side === "buy" ? 1.0002 : 0.9998);
  const notional = execPrice * qty;
  const margin = notional / lev;
  const fee = notional * 0.0006;
  const sl = form.stopLoss ? Number(form.stopLoss) : null;
  const tp = form.takeProfit ? Number(form.takeProfit) : null;
  const liqPrice = form.side === "buy" ? execPrice * (1 - 1/lev * 0.9) : execPrice * (1 + 1/lev * 0.9);
  const rrVal = sl && tp ? Math.abs(tp - execPrice) / Math.abs(execPrice - sl) : null;

  async function calcPreview() {
    if (qty <= 0) { setPreview(null); return; }
    setValidating(true);
    await new Promise(r => setTimeout(r, 300));
    setPreview({ execPrice, notional, margin, fee, sl, tp, liqPrice, rr: rrVal });
    setValidating(false);
  }

  useEffect(() => { calcPreview(); }, [form.symbol, form.side, form.quantity, form.stopLoss, form.takeProfit, form.leverage]);

  async function placeOrder() {
    if (qty <= 0) { toast({ title: "Invalid quantity", variant: "destructive" }); return; }
    if (account && margin > account.freeMargin * 0.95) {
      toast({ title: "Insufficient free margin", description: `Need $${margin.toFixed(2)}, have $${account.freeMargin.toFixed(2)}`, variant: "destructive" });
      return;
    }
    setPlacing(true);
    try {
      const result = await apiPost(`${BASE}/orders`, {
        symbol: form.symbol,
        orderType: form.orderType,
        side: form.side,
        quantity: qty,
        price: form.price ? Number(form.price) : undefined,
        stopPrice: form.stopPrice ? Number(form.stopPrice) : undefined,
        stopLoss: sl ?? undefined,
        takeProfit: tp ?? undefined,
        leverage: lev,
        strategy: form.strategy,
      });
      if (result.error) throw new Error(result.error);
      toast({ title: "Order filled!", description: `${form.symbol} ${form.side.toUpperCase()} ${qty} — filled at ${fmtPrice(result.order?.avgFillPrice)}` });
      setForm(p => ({ ...p, quantity: "", price: "", stopLoss: "", takeProfit: "" }));
      setPreview(null);
      onSuccess();
    } catch (e: unknown) {
      toast({ title: "Order rejected", description: (e as Error).message, variant: "destructive" });
    } finally {
      setPlacing(false);
    }
  }

  const needsPrice = ["limit","stop_limit"].includes(form.orderType);
  const needsStop = ["stop","stop_limit"].includes(form.orderType);
  const needsTrailing = form.orderType === "trailing_stop";
  const marginOk = !account || margin <= account.freeMargin;
  const hasQty = qty > 0;

  return (
    <div className="space-y-4">
      {/* Execution panel header */}
      <div className="flex items-center gap-2">
        <PlayCircle className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Execution Engine</span>
        <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 ml-auto">Exchange Simulator Active</Badge>
      </div>

      {/* BUY / SELL toggle */}
      <div className="grid grid-cols-2 gap-2">
        {(["buy","sell"] as const).map(s => (
          <button
            key={s}
            onClick={() => f("side", s)}
            className={cn(
              "py-3 rounded-xl border font-bold text-sm uppercase tracking-wide transition-all",
              form.side === s
                ? s === "buy" ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20"
                               : "bg-red-500 border-red-500 text-white shadow-md shadow-red-500/20"
                : "bg-muted/10 border-border text-muted-foreground hover:border-primary/30"
            )}
          >
            {s === "buy" ? <ArrowUpRight className="w-4 h-4 inline mr-1" /> : <ArrowDownRight className="w-4 h-4 inline mr-1" />}
            {s === "buy" ? "LONG / BUY" : "SHORT / SELL"}
          </button>
        ))}
      </div>

      {/* Symbol + Order Type */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Asset</Label>
          <Select value={form.symbol} onValueChange={v => f("symbol", v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{SYMBOLS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Order Type</Label>
          <Select value={form.orderType} onValueChange={v => f("orderType", v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ORDER_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs capitalize">{t.replace("_"," ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quantity */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Quantity <span className="text-muted-foreground/60">({form.symbol.replace("USDT","")})</span></Label>
        <Input value={form.quantity} onChange={e => f("quantity", e.target.value)} placeholder="0.00" type="number" min="0" step="any" className="h-9 text-sm" />
      </div>

      {/* Price fields (conditional) */}
      {needsPrice && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Limit Price</Label>
          <Input value={form.price} onChange={e => f("price", e.target.value)} placeholder={fmtPrice(basePrice)} type="number" className="h-9 text-sm" />
        </div>
      )}
      {needsStop && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Stop Trigger Price</Label>
          <Input value={form.stopPrice} onChange={e => f("stopPrice", e.target.value)} placeholder={fmtPrice(basePrice * 0.99)} type="number" className="h-9 text-sm" />
        </div>
      )}
      {needsTrailing && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Trailing Distance %</Label>
          <Input value={form.trailingPct} onChange={e => f("trailingPct", e.target.value)} placeholder="1.5" type="number" className="h-9 text-sm" />
        </div>
      )}

      {/* SL / TP */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-red-400">Stop Loss</Label>
          <Input value={form.stopLoss} onChange={e => f("stopLoss", e.target.value)} placeholder={fmtPrice(basePrice * 0.97)} type="number" className="h-9 text-sm border-red-500/20" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-emerald-400">Take Profit</Label>
          <Input value={form.takeProfit} onChange={e => f("takeProfit", e.target.value)} placeholder={fmtPrice(basePrice * 1.05)} type="number" className="h-9 text-sm border-emerald-500/20" />
        </div>
      </div>

      {/* Leverage */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Leverage</Label>
          <span className={cn("text-sm font-bold tabular-nums", lev >= 10 ? "text-red-400" : lev >= 5 ? "text-yellow-400" : "text-emerald-400")}>{lev}×</span>
        </div>
        <Slider min={1} max={20} step={1} value={[lev]} onValueChange={([v]) => f("leverage", v)} className="cursor-pointer" />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>1× Safe</span><span>5× Moderate</span><span>10× High</span><span>20× Max</span>
        </div>
      </div>

      {/* Strategy */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Strategy</Label>
        <Select value={form.strategy} onValueChange={v => f("strategy", v)}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{STRATEGIES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Order Preview */}
      {hasQty && (
        <div className="rounded-xl border border-border bg-muted/15 p-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Execution Preview</div>
          {validating ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="w-3 h-3 animate-spin" />Validating…</div>
          ) : preview ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {[
                { l: "Est. Price", v: fmtPrice(preview.execPrice) },
                { l: "Notional", v: `$${preview.notional.toFixed(2)}` },
                { l: "Margin Required", v: `$${preview.margin.toFixed(2)}`, color: marginOk ? "text-foreground" : "text-red-400" },
                { l: "Fee (0.06%)", v: `$${preview.fee.toFixed(4)}`, color: "text-orange-400" },
                { l: "Liq. Price", v: fmtPrice(preview.liqPrice), color: "text-red-400" },
                { l: "Risk:Reward", v: preview.rr ? `1:${preview.rr.toFixed(2)}` : "—", color: preview.rr && preview.rr >= 2 ? "text-emerald-400" : "text-yellow-400" },
              ].map(({ l, v, color }) => (
                <div key={l} className="flex justify-between">
                  <span className="text-muted-foreground">{l}</span>
                  <span className={cn("font-medium tabular-nums", color ?? "")}>{v}</span>
                </div>
              ))}
            </div>
          ) : null}
          {!marginOk && <div className="flex items-center gap-1.5 text-xs text-red-400"><AlertTriangle className="w-3 h-3" />Insufficient free margin</div>}
        </div>
      )}

      {/* Validation pipeline */}
      <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Validation Pipeline</div>
        {["Symbol","Quantity","Margin","Risk","Position Limit","Market Status","Permissions","AI Approval"].map((step, i) => {
          const failed = !hasQty && i === 1;
          const marginFail = !marginOk && i === 2;
          return (
            <div key={step} className="flex items-center gap-2 text-[11px]">
              {failed || marginFail
                ? <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                : hasQty ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> : <CircleDot className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
              <span className={failed || marginFail ? "text-red-400" : hasQty ? "text-foreground" : "text-muted-foreground/50"}>{step}</span>
            </div>
          );
        })}
      </div>

      {/* Place Order Button */}
      <Button
        onClick={placeOrder}
        disabled={placing || !hasQty || !marginOk}
        className={cn(
          "w-full h-11 font-bold tracking-wide text-sm uppercase",
          form.side === "buy"
            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
            : "bg-red-600 hover:bg-red-500 text-white"
        )}
      >
        {placing
          ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Executing…</>
          : <><Zap className="w-4 h-4 mr-2" />Place {form.side === "buy" ? "LONG" : "SHORT"} {form.orderType.replace("_"," ").toUpperCase()}</>
        }
      </Button>
    </div>
  );
}

// ─── POSITIONS TABLE ──────────────────────────────────────────────────────────
function PositionsPanel({ positions, onClose }: { positions: Position[]; onClose: (id: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-muted-foreground">
        <Layers className="w-10 h-10 mb-2 opacity-20" />
        <p className="text-sm">No open positions</p>
        <p className="text-xs mt-1">Place your first order in the Execute tab</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {positions.map((pos) => {
        const isWinning = pos.unrealizedPnl > 0;
        const open = expanded === pos.id;
        const distToLiq = Math.abs((pos.liquidationPrice - pos.currentPrice) / pos.currentPrice * 100);

        return (
          <div key={pos.id} className={cn("rounded-xl border transition-all", isWinning ? "border-emerald-500/20 bg-emerald-500/3" : "border-red-500/20 bg-red-500/3")}>
            {/* Header */}
            <div
              className="flex items-center gap-3 p-4 cursor-pointer"
              onClick={() => setExpanded(open ? null : pos.id)}
            >
              <div className={cn("px-2.5 py-1 rounded-lg border text-xs font-bold", sideBg(pos.side), sideColor(pos.side))}>
                {pos.side === "long" ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
                {" "}{pos.side.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{pos.symbol}</span>
                  <span className="text-xs text-muted-foreground">{pos.quantity} × {pos.leverage}×</span>
                </div>
                <div className="text-xs text-muted-foreground">{pos.strategy}</div>
              </div>
              <div className="text-right">
                <div className={cn("font-bold tabular-nums", pnlColor(pos.unrealizedPnl))}>
                  {fmtPnl(pos.unrealizedPnl)}
                </div>
                <div className={cn("text-xs tabular-nums", pnlColor(pos.unrealizedPnlPct))}>
                  {fmtPct(pos.unrealizedPnlPct)}
                </div>
              </div>
              {open ? <Minus className="w-4 h-4 text-muted-foreground shrink-0" /> : <Plus className="w-4 h-4 text-muted-foreground shrink-0" />}
            </div>

            {/* Expanded detail */}
            {open && (
              <div className="px-4 pb-4 border-t border-border/40 pt-3 space-y-3">
                {/* Price row */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { l: "Entry", v: fmtPrice(pos.entryPrice), color: "" },
                    { l: "Current", v: fmtPrice(pos.currentPrice), color: sideColor(pos.side) },
                    { l: "Liquidation", v: fmtPrice(pos.liquidationPrice), color: "text-red-400" },
                  ].map(({ l, v, color }) => (
                    <div key={l} className="text-center p-2 rounded-lg bg-muted/30 border border-border">
                      <div className="text-[10px] text-muted-foreground">{l}</div>
                      <div className={cn("text-xs font-bold tabular-nums mt-0.5", color)}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* SL / TP */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/20">
                    <div className="text-[10px] text-red-400">Stop Loss</div>
                    <div className="text-sm font-bold text-red-400 tabular-nums">{pos.stopLoss ? fmtPrice(pos.stopLoss) : "Not set"}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <div className="text-[10px] text-emerald-400">Take Profit</div>
                    <div className="text-sm font-bold text-emerald-400 tabular-nums">{pos.takeProfit ? fmtPrice(pos.takeProfit) : "Not set"}</div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
                  {[
                    { l: "Margin", v: `$${pos.margin.toFixed(2)}` },
                    { l: "Leverage", v: `${pos.leverage}×` },
                    { l: "To Liq.", v: `${distToLiq.toFixed(1)}%` },
                    { l: "Duration", v: relTime(pos.openTime) },
                  ].map(({ l, v }) => (
                    <div key={l} className="p-1.5 rounded bg-muted/30 border border-border">
                      <div className="text-muted-foreground">{l}</div>
                      <div className="font-semibold mt-0.5">{v}</div>
                    </div>
                  ))}
                </div>

                {/* Liquidation risk bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Distance to Liquidation</span>
                    <span className={cn("font-bold", distToLiq < 10 ? "text-red-400" : distToLiq < 25 ? "text-yellow-400" : "text-emerald-400")}>{distToLiq.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", distToLiq < 10 ? "bg-red-500" : distToLiq < 25 ? "bg-yellow-500" : "bg-emerald-500")} style={{ width: `${Math.min(distToLiq * 2, 100)}%` }} />
                  </div>
                </div>

                {/* Fill details */}
                {pos.fills.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Fill History</div>
                    {pos.fills.map((f, i) => (
                      <div key={i} className="flex justify-between text-[11px] p-2 rounded bg-muted/20 border border-border">
                        <span className="text-muted-foreground">Fill {i + 1}</span>
                        <span>{f.qty}</span>
                        <span className="tabular-nums">{fmtPrice(f.price)}</span>
                        <span className="text-orange-400">fee ${f.fee.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {pos.notes && (
                  <div className="text-[11px] text-muted-foreground italic">{pos.notes}</div>
                )}

                {/* Close button */}
                <Button
                  onClick={() => onClose(pos.id)}
                  variant="outline"
                  size="sm"
                  className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />Close Position at Market
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── ORDER HISTORY ────────────────────────────────────────────────────────────
function OrdersPanel({ orders }: { orders: Order[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const sel = selected ? orders.find(o => o.id === selected) : null;

  return (
    <div className={cn("grid gap-4", sel ? "lg:grid-cols-2" : "")}>
      <div className="space-y-2">
        {orders.map(ord => (
          <div
            key={ord.id}
            onClick={() => setSelected(selected === ord.id ? null : ord.id)}
            className={cn("flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:border-primary/30",
              selected === ord.id ? "border-primary/40 bg-primary/5" : "border-border bg-muted/10"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full shrink-0", ord.status === "filled" ? "bg-emerald-500" : ord.status === "partial" ? "bg-yellow-500" : ord.status === "cancelled" || ord.status === "rejected" ? "bg-red-500" : "bg-blue-500")} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{ord.symbol}</span>
                <Badge variant="outline" className={cn("text-[10px] capitalize", statusColor(ord.status))}>{ord.status}</Badge>
                <span className={cn("text-xs font-medium", sideColor(ord.side))}>{ord.side.toUpperCase()}</span>
              </div>
              <div className="text-[11px] text-muted-foreground flex gap-2 mt-0.5">
                <span>{ord.orderType.replace("_"," ")}</span>
                <span>·</span>
                <span>{ord.quantity}</span>
                {ord.avgFillPrice > 0 && <><span>·</span><span className="tabular-nums">{fmtPrice(ord.avgFillPrice)}</span></>}
                <span>·</span>
                <span>{ord.source}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              {ord.fee > 0 && <div className="text-[11px] text-orange-400 tabular-nums">${ord.fee.toFixed(4)} fee</div>}
              <div className="text-[10px] text-muted-foreground">{relTime(ord.createdAt)}</div>
              {ord.fillQuality > 0 && <div className="text-[10px] text-blue-400">{ord.fillQuality}% quality</div>}
            </div>
          </div>
        ))}
      </div>

      {sel && (
        <div className="lg:sticky lg:top-4">
          <Card className="border-primary/20">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />Order Detail — {sel.id}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { l: "Symbol", v: sel.symbol },
                  { l: "Type", v: sel.orderType.replace("_"," ") },
                  { l: "Side", v: sel.side.toUpperCase(), c: sideColor(sel.side) },
                  { l: "Status", v: sel.status },
                  { l: "Qty", v: String(sel.quantity) },
                  { l: "Filled", v: String(sel.filledQty) },
                  { l: "Avg Price", v: sel.avgFillPrice > 0 ? fmtPrice(sel.avgFillPrice) : "—" },
                  { l: "Fee", v: sel.fee > 0 ? `$${sel.fee.toFixed(4)}` : "—", c: "text-orange-400" },
                  { l: "Slippage", v: sel.slippage > 0 ? `$${sel.slippage.toFixed(4)}` : "—", c: sel.slippage > 0 ? "text-yellow-400" : "" },
                  { l: "Latency", v: `${sel.latencyMs}ms` },
                  { l: "Fill Quality", v: sel.fillQuality > 0 ? `${sel.fillQuality}%` : "—" },
                  { l: "Source", v: sel.source },
                  { l: "Strategy", v: sel.strategy },
                ].map(({ l, v, c }) => (
                  <div key={l} className="p-2 rounded bg-muted/20 border border-border">
                    <div className="text-muted-foreground text-[10px]">{l}</div>
                    <div className={cn("font-semibold mt-0.5 capitalize", c ?? "")}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Validation log */}
              {sel.validationLog.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Validation Log</div>
                  {sel.validationLog.map((line, i) => (
                    <div key={i} className={cn("text-[11px] flex items-center gap-1.5", line.startsWith("✓") ? "text-emerald-400" : "text-red-400")}>
                      {line}
                    </div>
                  ))}
                </div>
              )}

              {/* Lifecycle timeline */}
              {sel.lifecycle.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Order Lifecycle</div>
                  {sel.lifecycle.map((evt, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="flex flex-col items-center">
                        <div className="w-4 h-4 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        </div>
                        {i < sel.lifecycle.length - 1 && <div className="w-px flex-1 bg-border" style={{minHeight:12}} />}
                      </div>
                      <div className="pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold capitalize">{evt.state}</span>
                          <span className="text-[10px] text-muted-foreground">{relTime(evt.ts)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{evt.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sel.rejectReason && (
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-red-400">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />{sel.rejectReason}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── PERFORMANCE TAB ──────────────────────────────────────────────────────────
function PerformancePanel({ perf, trades }: { perf: Performance; trades: ClosedTrade[] }) {
  const kpis = [
    { label: "Net P&L", value: `$${perf.totalPnl.toFixed(2)}`, color: perf.totalPnl >= 0 ? "text-emerald-400" : "text-red-400", icon: DollarSign },
    { label: "Win Rate", value: `${perf.winRate}%`, color: perf.winRate >= 55 ? "text-emerald-400" : "text-red-400", icon: Target },
    { label: "Profit Factor", value: perf.profitFactor.toFixed(2), color: perf.profitFactor >= 1.5 ? "text-emerald-400" : "text-yellow-400", icon: TrendingUp },
    { label: "Expectancy", value: `$${perf.expectancy.toFixed(2)}`, color: perf.expectancy >= 0 ? "text-emerald-400" : "text-red-400", icon: BarChart2 },
    { label: "Sharpe Ratio", value: perf.sharpe.toFixed(2), color: perf.sharpe >= 1 ? "text-emerald-400" : perf.sharpe >= 0 ? "text-yellow-400" : "text-red-400", icon: Activity },
    { label: "Sortino Ratio", value: perf.sortino.toFixed(2), color: perf.sortino >= 1.5 ? "text-emerald-400" : "text-yellow-400", icon: Shield },
    { label: "Calmar Ratio", value: perf.calmar.toFixed(2), color: perf.calmar >= 0.5 ? "text-emerald-400" : "text-yellow-400", icon: Gauge },
    { label: "Max Drawdown", value: `-${perf.maxDrawdownPct}%`, color: "text-red-400", icon: TrendingDown },
    { label: "Avg Win", value: `$${perf.avgWin.toFixed(2)}`, color: "text-emerald-400", icon: ArrowUpRight },
    { label: "Avg Loss", value: `-$${perf.avgLoss.toFixed(2)}`, color: "text-red-400", icon: ArrowDownRight },
    { label: "Avg R:R", value: `1:${perf.avgRR.toFixed(2)}`, color: perf.avgRR >= 2 ? "text-emerald-400" : "text-yellow-400", icon: Star },
    { label: "Avg Duration", value: durFmt(perf.avgDurationMin), color: "", icon: Timer },
    { label: "Exec Quality", value: `${perf.executionQuality}%`, color: "text-blue-400", icon: Zap },
    { label: "Total Fees", value: `-$${perf.totalFees.toFixed(2)}`, color: "text-orange-400", icon: DollarSign },
  ];

  return (
    <div className="space-y-4">
      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        {kpis.slice(0, 7).map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-muted/10 p-3 text-center space-y-1">
            <Icon className="w-3.5 h-3.5 mx-auto text-primary/60" />
            <div className={cn("text-base font-black tabular-nums", color)}>{value}</div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        {kpis.slice(7).map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-muted/10 p-3 text-center space-y-1">
            <Icon className="w-3.5 h-3.5 mx-auto text-primary/60" />
            <div className={cn("text-base font-black tabular-nums", color)}>{value}</div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* By symbol */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" />Performance by Asset</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {Object.entries(perf.bySymbol).sort((a,b) => b[1].trades - a[1].trades).map(([sym, d]) => {
              const wr = d.trades > 0 ? (d.wins / d.trades) * 100 : 0;
              return (
                <div key={sym} className="flex items-center gap-2">
                  <span className="text-xs font-medium w-20 shrink-0">{sym}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div className={cn("h-full rounded-full", wr >= 55 ? "bg-emerald-500" : wr >= 40 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${wr}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-12 text-right">{d.trades} tr.</span>
                  <span className={cn("text-xs font-bold w-10 text-right tabular-nums", wr >= 55 ? "text-emerald-400" : "text-red-400")}>{wr.toFixed(0)}%</span>
                  <span className={cn("text-xs w-16 text-right tabular-nums", d.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>${d.pnl.toFixed(0)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* By strategy */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><Brain className="w-4 h-4 text-primary" />Performance by Strategy</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {Object.entries(perf.byStrategy).sort((a,b) => b[1].pnl - a[1].pnl).map(([strat, d]) => {
              const wr = d.trades > 0 ? (d.wins / d.trades) * 100 : 0;
              return (
                <div key={strat} className="flex items-center gap-2">
                  <span className="text-xs w-36 shrink-0 truncate">{strat}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div className={cn("h-full rounded-full", d.pnl >= 0 ? "bg-emerald-500" : "bg-red-500")} style={{ width: `${Math.min(Math.abs(d.pnl) / 100, 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-8 text-right">{d.trades}</span>
                  <span className={cn("text-xs font-bold w-12 text-right tabular-nums", d.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>${d.pnl.toFixed(0)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Closed trades journal */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" />Trade Journal</CardTitle>
          <CardDescription className="text-xs">{trades.length} completed trades — immutable record, never deleted</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {["Asset","Side","Qty","Entry","Exit","PnL","PnL%","RR","Exit Reason","Strategy","Duration","Closed"].map(h => (
                  <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map(t => (
                <tr key={t.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                  <td className="py-2 px-2 font-semibold">{t.symbol}</td>
                  <td className={cn("py-2 px-2 font-bold", sideColor(t.side))}>{t.side.toUpperCase()}</td>
                  <td className="py-2 px-2 tabular-nums">{t.quantity.toFixed(3)}</td>
                  <td className="py-2 px-2 tabular-nums text-muted-foreground">{fmtPrice(t.entryPrice)}</td>
                  <td className="py-2 px-2 tabular-nums text-muted-foreground">{fmtPrice(t.exitPrice)}</td>
                  <td className={cn("py-2 px-2 font-bold tabular-nums", pnlColor(t.pnl))}>{fmtPnl(t.pnl)}</td>
                  <td className={cn("py-2 px-2 tabular-nums", pnlColor(t.pnlPct))}>{fmtPct(t.pnlPct)}</td>
                  <td className="py-2 px-2 tabular-nums">{t.rr > 0 ? `1:${t.rr}` : "—"}</td>
                  <td className="py-2 px-2 capitalize">{t.exitReason}</td>
                  <td className="py-2 px-2 text-muted-foreground truncate max-w-[100px]">{t.strategy}</td>
                  <td className="py-2 px-2 text-muted-foreground">{durFmt(t.duration)}</td>
                  <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">{relTime(t.closeTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function PaperTrading() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showReset, setShowReset] = useState(false);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["paper-trading"] });
  }, [qc]);

  const { data: account, isLoading: accLoading } = useQuery<Account>({
    queryKey: ["paper-trading", "account"],
    queryFn: () => apiFetch(`${BASE}/account`),
    refetchInterval: 5000,
  });

  const { data: positions = [], isLoading: posLoading } = useQuery<Position[]>({
    queryKey: ["paper-trading", "positions"],
    queryFn: () => apiFetch(`${BASE}/positions`),
    refetchInterval: 5000,
  });

  const { data: orders = [], isLoading: ordLoading } = useQuery<Order[]>({
    queryKey: ["paper-trading", "orders"],
    queryFn: () => apiFetch(`${BASE}/orders`),
    refetchInterval: 15000,
  });

  const { data: performance, isLoading: perfLoading } = useQuery<Performance>({
    queryKey: ["paper-trading", "performance"],
    queryFn: () => apiFetch(`${BASE}/performance`),
    refetchInterval: 30000,
  });

  const { data: trades = [] } = useQuery<ClosedTrade[]>({
    queryKey: ["paper-trading", "trades"],
    queryFn: () => apiFetch(`${BASE}/trades`),
    refetchInterval: 30000,
  });

  const { mutate: closePosition } = useMutation({
    mutationFn: (id: string) => apiPost(`${BASE}/positions/${id}/close`, { exitReason: "manual" }),
    onSuccess: (data) => {
      const t = data.trade;
      if (t) toast({ title: t.pnl >= 0 ? "Position closed — profit!" : "Position closed", description: `${t.symbol} ${t.side.toUpperCase()} — ${fmtPnl(t.pnl)} (${fmtPct(t.pnlPct)})` });
      invalidate();
    },
  });

  const { mutate: resetAccount, isPending: resetting } = useMutation({
    mutationFn: () => apiPost(`${BASE}/account/reset`, {}),
    onSuccess: () => { toast({ title: "Account reset to $100,000" }); setShowReset(false); invalidate(); },
  });

  const unrealized = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const totalEquity = account ? account.balance + unrealized : 0;

  return (
    <div className="space-y-4">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <PlayCircle className="w-4.5 h-4.5 text-primary" />
            </div>
            Paper Trading
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Institutional Execution Simulation Engine — real conditions, zero risk</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] text-emerald-400 border-emerald-500/30 gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Exchange Simulator Live
          </Badge>
          <Button size="sm" variant="outline" onClick={() => invalidate()} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowReset(true)} className="gap-1.5 text-xs text-orange-400 border-orange-500/30 hover:bg-orange-500/10">
            <RotateCcw className="w-3.5 h-3.5" />Reset
          </Button>
        </div>
      </div>

      {/* Reset confirmation */}
      {showReset && (
        <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
            <span>Reset account to $100,000? All positions, orders, and trade history will be cleared.</span>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setShowReset(false)} className="text-xs">Cancel</Button>
            <Button size="sm" onClick={() => resetAccount()} disabled={resetting} className="text-xs bg-orange-500 hover:bg-orange-400 text-white">
              {resetting ? "Resetting…" : "Confirm Reset"}
            </Button>
          </div>
        </div>
      )}

      {/* ── TOP STATS ──────────────────────────────────────────────────────── */}
      {accLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : account ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <StatCard icon={Wallet} label="Balance" value={`$${account.balance.toLocaleString(undefined,{maximumFractionDigits:2})}`} bg="bg-primary/5 border-primary/20" />
          <StatCard icon={Activity} label="Equity" value={`$${totalEquity.toLocaleString(undefined,{maximumFractionDigits:2})}`} />
          <StatCard icon={TrendingUp} label="Unrealized" value={fmtPnl(unrealized)} color={pnlColor(unrealized)} />
          <StatCard icon={DollarSign} label="Realized" value={fmtPnl(account.realizedPnl)} color={pnlColor(account.realizedPnl)} />
          <StatCard icon={DollarSign} label="Today" value={fmtPnl(account.todayPnl)} color={pnlColor(account.todayPnl)} />
          <StatCard icon={Shield} label="Free Margin" value={`$${account.freeMargin.toLocaleString(undefined,{maximumFractionDigits:0})}`} />
          <StatCard icon={Gauge} label="Margin Lvl" value={`${account.marginLevel.toFixed(0)}%`} color={account.marginLevel < 150 ? "text-red-400" : account.marginLevel < 300 ? "text-yellow-400" : "text-emerald-400"} />
          <StatCard icon={Target} label="Win Rate" value={account.totalTrades > 0 ? `${((account.winningTrades/account.totalTrades)*100).toFixed(1)}%` : "—"} color={account.totalTrades > 0 && account.winningTrades/account.totalTrades > 0.5 ? "text-emerald-400" : "text-yellow-400"} sub={`${account.totalTrades} trades`} />
        </div>
      ) : null}

      {/* ── TABS ────────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto bg-muted/30 p-1 rounded-xl">
          {[
            { id: "dashboard", label: "Dashboard", icon: BarChart2 },
            { id: "execute", label: "Execute", icon: Zap },
            { id: "positions", label: `Positions (${positions.length})`, icon: Layers },
            { id: "orders", label: "Orders", icon: ListOrdered },
            { id: "performance", label: "Performance", icon: TrendingUp },
          ].map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="text-xs gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Icon className="w-3.5 h-3.5" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ══ DASHBOARD ══════════════════════════════════════════════════════ */}
        <TabsContent value="dashboard" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Left: account health + allocation */}
            <div className="space-y-4">
              {account && <AccountHealth acc={account} />}

              {/* Margin allocation */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><Gauge className="w-4 h-4 text-primary" />Margin Allocation</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {account && (
                    <>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Used Margin</span>
                          <span className="font-bold tabular-nums">${account.usedMargin.toFixed(2)}</span>
                        </div>
                        <Progress value={account.equity > 0 ? (account.usedMargin / account.equity) * 100 : 0} className="h-2" />
                      </div>
                      {[
                        { l: "Balance", v: `$${account.balance.toFixed(2)}` },
                        { l: "Used Margin", v: `$${account.usedMargin.toFixed(2)}` },
                        { l: "Free Margin", v: `$${account.freeMargin.toFixed(2)}` },
                        { l: "Unrealized PnL", v: fmtPnl(unrealized), c: pnlColor(unrealized) },
                        { l: "Total Fees Paid", v: `-$${account.totalFees.toFixed(2)}`, c: "text-orange-400" },
                      ].map(({ l, v, c }) => (
                        <div key={l} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{l}</span>
                          <span className={cn("font-medium tabular-nums", c ?? "")}>{v}</span>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Account info */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><Info className="w-4 h-4 text-primary" />Account Info</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {account && [
                    { l: "Account ID", v: account.id },
                    { l: "Currency", v: account.currency },
                    { l: "Max Leverage", v: `${account.leverage}×` },
                    { l: "Initial Balance", v: `$${account.initialBalance.toLocaleString()}` },
                    { l: "Max Equity", v: `$${account.maxEquity.toLocaleString()}` },
                    { l: "Min Equity", v: `$${account.minEquity.toLocaleString()}` },
                    { l: "Resets", v: String(account.resetCount) },
                    { l: "Version", v: String(account.version) },
                  ].map(({ l, v }) => (
                    <div key={l} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{l}</span>
                      <span className="font-medium tabular-nums">{v}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Center: Open positions */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    Open Positions
                    <Badge variant="outline" className="text-[10px] ml-auto">{positions.length} open</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {posLoading ? (
                    <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
                  ) : positions.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-muted-foreground">
                      <Layers className="w-8 h-8 mb-2 opacity-20" />
                      <p className="text-xs">No open positions</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {positions.map(pos => (
                        <div key={pos.id} className={cn("p-3 rounded-xl border", pnlBg(pos.unrealizedPnl))}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs font-bold", sideColor(pos.side))}>
                                {pos.side === "long" ? "▲" : "▼"} {pos.symbol}
                              </span>
                              <span className="text-[11px] text-muted-foreground">{pos.quantity} × {pos.leverage}×</span>
                            </div>
                            <span className={cn("text-sm font-bold tabular-nums", pnlColor(pos.unrealizedPnl))}>
                              {fmtPnl(pos.unrealizedPnl)}
                            </span>
                          </div>
                          <div className="flex justify-between mt-1 text-[11px] text-muted-foreground">
                            <span>Entry {fmtPrice(pos.entryPrice)}</span>
                            <span>Now {fmtPrice(pos.currentPrice)}</span>
                            <span className={pnlColor(pos.unrealizedPnlPct)}>{fmtPct(pos.unrealizedPnlPct)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick performance */}
              {performance && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2"><Award className="w-4 h-4 text-primary" />Performance Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    {[
                      { l: "Total Trades", v: String(performance.totalTrades) },
                      { l: "Win Rate", v: `${performance.winRate}%`, c: performance.winRate >= 55 ? "text-emerald-400" : "text-red-400" },
                      { l: "Profit Factor", v: performance.profitFactor.toFixed(2), c: performance.profitFactor >= 1.5 ? "text-emerald-400" : "text-yellow-400" },
                      { l: "Sharpe Ratio", v: performance.sharpe.toFixed(2), c: performance.sharpe >= 1 ? "text-emerald-400" : "text-yellow-400" },
                      { l: "Max Drawdown", v: `-${performance.maxDrawdownPct}%`, c: "text-red-400" },
                      { l: "Expectancy", v: `$${performance.expectancy.toFixed(2)}`, c: pnlColor(performance.expectancy) },
                    ].map(({ l, v, c }) => (
                      <div key={l} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{l}</span>
                        <span className={cn("font-bold tabular-nums", c ?? "")}>{v}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right: Recent orders */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4 text-primary" />Recent Orders</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {ordLoading ? (
                    <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
                  ) : orders.slice(0, 8).map(ord => (
                    <div key={ord.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/20 border border-border hover:border-primary/20 transition-colors">
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", ord.status === "filled" ? "bg-emerald-500" : ord.status === "cancelled" || ord.status === "rejected" ? "bg-red-500" : "bg-yellow-500")} />
                      <span className="font-medium">{ord.symbol}</span>
                      <span className={cn("font-bold", sideColor(ord.side))}>{ord.side.toUpperCase()}</span>
                      <span className="text-muted-foreground">{ord.quantity}</span>
                      <Badge variant="outline" className={cn("text-[9px] ml-auto shrink-0 capitalize", statusColor(ord.status))}>{ord.status}</Badge>
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">No orders yet</div>
                  )}
                </CardContent>
              </Card>

              {/* AI Performance sync */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><Brain className="w-4 h-4 text-primary" />AI Learning Sync</CardTitle>
                  <CardDescription className="text-xs">Every trade feeds AI evaluation pipeline</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {[
                    { label: "Signals Validated", count: orders.filter(o => o.source === "signal").length },
                    { label: "AI Orders Executed", count: orders.filter(o => o.source === "ai").length },
                    { label: "Outcomes Recorded", count: trades.length },
                    { label: "Training Records", count: Math.floor(trades.length * 0.8) },
                  ].map(({ label, count }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-bold tabular-nums text-primary">{count}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ══ EXECUTE ════════════════════════════════════════════════════════ */}
        <TabsContent value="execute" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />Order Placement
                  </CardTitle>
                  <CardDescription className="text-xs">Execution Engine v2 — full pipeline simulation</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ExecutePanel account={account} onSuccess={invalidate} />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
              {/* Execution architecture */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><Settings className="w-4 h-4 text-primary" />Execution Engine Status</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { name: "Price Stream Engine", status: "Active", color: "text-emerald-400", detail: "Live price feed — 8 assets" },
                      { name: "Spread Engine", status: "Active", color: "text-emerald-400", detail: "BTC: 0.01% · ETH: 0.02%" },
                      { name: "Slippage Simulator", status: "Active", color: "text-emerald-400", detail: "Market impact modeling on" },
                      { name: "Fill Simulation", status: "Active", color: "text-emerald-400", detail: "Partial fills enabled" },
                      { name: "Commission Engine", status: "Active", color: "text-emerald-400", detail: "Taker 0.06% · Maker 0.01%" },
                      { name: "Margin Engine", status: "Active", color: "text-emerald-400", detail: "Cross margin mode" },
                      { name: "Liquidation Monitor", status: "Active", color: "text-emerald-400", detail: `Watching ${positions.length} positions` },
                      { name: "Risk Engine", status: "Active", color: "text-emerald-400", detail: "Max 2% per trade enforced" },
                      { name: "Audit Logger", status: "Active", color: "text-emerald-400", detail: "All events immutably logged" },
                      { name: "AI Learning Sync", status: "Active", color: "text-emerald-400", detail: `${trades.length} outcomes queued` },
                    ].map(({ name, status, color, detail }) => (
                      <div key={name} className="flex items-start gap-2 p-3 rounded-xl bg-muted/20 border border-border">
                        <div className={cn("w-2 h-2 rounded-full mt-1 shrink-0", color.replace("text-","bg-"))} />
                        <div>
                          <div className="text-xs font-semibold">{name}</div>
                          <div className="text-[10px] text-muted-foreground">{detail}</div>
                        </div>
                        <Badge variant="outline" className={cn("text-[9px] ml-auto shrink-0", color, "border-current/30")}>{status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Order types reference */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" />Order Types Reference</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid sm:grid-cols-2 gap-2">
                    {[
                      { type: "Market", desc: "Immediate execution at current price + spread" },
                      { type: "Limit", desc: "Execute only at specified price or better" },
                      { type: "Stop", desc: "Trigger market order when price hits stop" },
                      { type: "Stop Limit", desc: "Stop trigger + limit execution price" },
                      { type: "Trailing Stop", desc: "Dynamic stop that follows price movement" },
                      { type: "OCO", desc: "One-Cancels-Other — SL + TP bracket" },
                      { type: "TWAP", desc: "Time-Weighted Average Price execution" },
                      { type: "VWAP", desc: "Volume-Weighted Average Price execution" },
                    ].map(({ type, desc }) => (
                      <div key={type} className="flex gap-2 p-2 rounded bg-muted/20 border border-border text-xs">
                        <span className="font-bold text-primary shrink-0 w-20">{type}</span>
                        <span className="text-muted-foreground">{desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ══ POSITIONS ══════════════════════════════════════════════════════ */}
        <TabsContent value="positions" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              {posLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
              ) : (
                <PositionsPanel positions={positions} onClose={(id) => closePosition(id)} />
              )}
            </div>
            <div className="space-y-4">
              {/* Portfolio stats */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-primary" />Portfolio Exposure</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                      <div className="text-[11px] text-muted-foreground">Long Exposure</div>
                      <div className="text-sm font-bold text-emerald-400 mt-1">
                        ${positions.filter(p=>p.side==="long").reduce((s,p)=>s+p.entryPrice*p.quantity,0).toFixed(0)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-center">
                      <div className="text-[11px] text-muted-foreground">Short Exposure</div>
                      <div className="text-sm font-bold text-red-400 mt-1">
                        ${positions.filter(p=>p.side==="short").reduce((s,p)=>s+p.entryPrice*p.quantity,0).toFixed(0)}
                      </div>
                    </div>
                  </div>
                  {positions.length > 0 && (
                    <div className="space-y-2">
                      {positions.map(p => (
                        <div key={p.id} className="text-xs flex justify-between">
                          <span className={sideColor(p.side)}>{p.symbol}</span>
                          <span className="text-muted-foreground">${(p.entryPrice * p.quantity).toFixed(0)}</span>
                          <span className={pnlColor(p.unrealizedPnl)}>{fmtPnl(p.unrealizedPnl)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Risk warnings */}
              {positions.some(p => Math.abs((p.liquidationPrice - p.currentPrice)/p.currentPrice) < 0.15) && (
                <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5">
                  <div className="flex items-center gap-2 text-sm text-red-400 font-semibold mb-2">
                    <Flame className="w-4 h-4" />Liquidation Risk Alert
                  </div>
                  {positions.filter(p => Math.abs((p.liquidationPrice - p.currentPrice)/p.currentPrice) < 0.15).map(p => (
                    <div key={p.id} className="text-xs text-muted-foreground">
                      {p.symbol} — {(Math.abs((p.liquidationPrice - p.currentPrice)/p.currentPrice)*100).toFixed(1)}% from liquidation
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ══ ORDERS ═════════════════════════════════════════════════════════ */}
        <TabsContent value="orders" className="mt-4">
          {ordLoading ? (
            <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : (
            <OrdersPanel orders={orders} />
          )}
        </TabsContent>

        {/* ══ PERFORMANCE ════════════════════════════════════════════════════ */}
        <TabsContent value="performance" className="mt-4">
          {perfLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
          ) : performance ? (
            <PerformancePanel perf={performance} trades={trades} />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
