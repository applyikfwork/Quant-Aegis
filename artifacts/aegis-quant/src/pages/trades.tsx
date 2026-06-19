import { useState } from "react";
import {
  useListTrades,
  useUpdateTrade,
  useCreateTrade,
  getListTradesQueryKey,
  useGetJournalStats,
  getGetJournalStatsQueryKey,
  useGetTradeEvents,
  useCreateTradeEvent,
  useGetTradePsychology,
  useUpsertTradePsychology,
  useGetTradeReview,
  useGenerateTradeReview,
  useGetTradeMistakes,
  useCreateTradeMistake,
  getGetTradeEventsQueryKey,
  getGetTradePsychologyQueryKey,
  getGetTradeReviewQueryKey,
  getGetTradeMistakesQueryKey,
} from "@workspace/api-client-react";
import type { Trade } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatPercent, formatNumber, cnValueColor, formatDate } from "@/lib/format";
import {
  BarChart2, Plus, ArrowUpRight, ArrowDownRight, Brain, Clock,
  Heart, AlertTriangle, Target, TrendingUp, TrendingDown,
  CheckCircle, XCircle, Star, Filter, Search, BookOpen,
  Activity, Zap, Shield, ChevronRight, RefreshCw
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { cn } from "@/lib/utils";

// ── Score Ring Component ────────────────────────────────────────────────────
function ScoreRing({ score, size = 80, label }: { score: number; size?: number; label?: string }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth="6" fill="none" className="text-muted/30" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="6" fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
          className="rotate-90 fill-foreground font-bold text-sm" style={{ fontSize: size < 64 ? "10px" : "14px", transform: `rotate(90deg) translate(0, 0)`, transformOrigin: `${size / 2}px ${size / 2}px` }}>
          {score}
        </text>
      </svg>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ title, value, sub, icon: Icon, color, loading }: {
  title: string; value: string; sub?: string; icon?: React.ComponentType<{ className?: string }>;
  color?: string; loading?: boolean;
}) {
  if (loading) return (
    <Card><CardContent className="pt-5"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-16" /></CardContent></Card>
  );
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
        </div>
        <p className={cn("text-2xl font-bold tracking-tight", color)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Psychology Slider ────────────────────────────────────────────────────────
function PsychSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}/100</span>
      </div>
      <input type="range" min={0} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-primary h-1.5 rounded-full cursor-pointer" />
    </div>
  );
}

// ── New Trade Dialog ─────────────────────────────────────────────────────────
function NewTradeDialog({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const createTrade = useCreateTrade();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    symbol: "BTCUSDT", side: "long", entryPrice: "", quantity: "",
    stopLoss: "", takeProfit: "", aiConfidence: "", timeframe: "1h"
  });

  const handleSubmit = () => {
    if (!form.symbol || !form.entryPrice || !form.quantity) {
      toast({ title: "Missing fields", description: "Symbol, entry price and quantity are required.", variant: "destructive" });
      return;
    }
    createTrade.mutate({
      data: {
        symbol: form.symbol, side: form.side as "long" | "short",
        entryPrice: parseFloat(form.entryPrice), quantity: parseFloat(form.quantity),
        stopLoss: form.stopLoss ? parseFloat(form.stopLoss) : undefined,
        takeProfit: form.takeProfit ? parseFloat(form.takeProfit) : undefined,
        aiConfidence: form.aiConfidence ? parseFloat(form.aiConfidence) : undefined,
        timeframe: form.timeframe || undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Trade logged", description: `${form.side.toUpperCase()} ${form.symbol} recorded in journal.` });
        setOpen(false);
        setForm({ symbol: "BTCUSDT", side: "long", entryPrice: "", quantity: "", stopLoss: "", takeProfit: "", aiConfidence: "", timeframe: "1h" });
        onSuccess();
      },
      onError: (e: unknown) => toast({ title: "Error", description: String(e), variant: "destructive" })
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-2" />Log Trade</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Log New Trade</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Symbol</Label>
              <Input value={form.symbol} onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Direction</Label>
              <Select value={form.side} onValueChange={v => setForm(p => ({ ...p, side: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">LONG</SelectItem>
                  <SelectItem value="short">SHORT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Entry Price</Label>
              <Input type="number" value={form.entryPrice} onChange={e => setForm(p => ({ ...p, entryPrice: e.target.value }))} className="h-8 text-sm" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantity</Label>
              <Input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} className="h-8 text-sm" placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Stop Loss</Label>
              <Input type="number" value={form.stopLoss} onChange={e => setForm(p => ({ ...p, stopLoss: e.target.value }))} className="h-8 text-sm" placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Take Profit</Label>
              <Input type="number" value={form.takeProfit} onChange={e => setForm(p => ({ ...p, takeProfit: e.target.value }))} className="h-8 text-sm" placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">AI Confidence (%)</Label>
              <Input type="number" value={form.aiConfidence} onChange={e => setForm(p => ({ ...p, aiConfidence: e.target.value }))} className="h-8 text-sm" placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Timeframe</Label>
              <Select value={form.timeframe} onValueChange={v => setForm(p => ({ ...p, timeframe: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["1m","5m","15m","1h","4h","1d"].map(tf => <SelectItem key={tf} value={tf}>{tf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={createTrade.isPending}>
              {createTrade.isPending ? "Logging…" : "Log Trade"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Trade Timeline Panel ─────────────────────────────────────────────────────
function TradeTimeline({ trade }: { trade: Trade }) {
  const { data: events, isLoading } = useGetTradeEvents(trade.id, {
    query: { queryKey: getGetTradeEventsQueryKey(trade.id) }
  });
  const createEvent = useCreateTradeEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ eventType: "note", description: "" });

  const systemEvents = [
    { id: 0, eventType: "trade_opened", description: `${trade.side.toUpperCase()} ${trade.symbol} opened at ${formatCurrency(trade.entryPrice, 4)}`, timestamp: trade.entryTime },
    ...(trade.exitTime ? [{ id: -1, eventType: "trade_closed", description: `Trade closed at ${formatCurrency(trade.exitPrice ?? 0, 4)} — P&L: ${trade.profitLoss != null ? (trade.profitLoss > 0 ? "+" : "") + formatCurrency(trade.profitLoss) : "—"}`, timestamp: trade.exitTime }] : []),
  ];

  const allEvents = [
    ...systemEvents,
    ...(events ?? []).map(e => ({ id: e.id, eventType: e.eventType, description: e.description, timestamp: e.timestamp }))
  ].sort((a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime());

  const eventIcon = (type: string) => {
    const m: Record<string, React.ReactNode> = {
      trade_opened: <ArrowUpRight className="w-3 h-3" />,
      trade_closed: <CheckCircle className="w-3 h-3" />,
      stop_updated: <Shield className="w-3 h-3" />,
      partial_exit: <TrendingUp className="w-3 h-3" />,
      signal: <Zap className="w-3 h-3" />,
      note: <BookOpen className="w-3 h-3" />,
    };
    return m[type] ?? <Activity className="w-3 h-3" />;
  };

  const eventColor = (type: string) => {
    const m: Record<string, string> = {
      trade_opened: "bg-primary/10 text-primary border-primary/30",
      trade_closed: "bg-success/10 text-success border-success/30",
      stop_updated: "bg-warning/10 text-warning border-warning/30",
      signal: "bg-blue-500/10 text-blue-400 border-blue-400/30",
      note: "bg-muted/30 text-muted-foreground border-muted/40",
    };
    return m[type] ?? "bg-muted/20 text-muted-foreground border-muted/30";
  };

  const addEvent = () => {
    if (!form.description.trim()) return;
    createEvent.mutate({ tradeId: trade.id, data: { eventType: form.eventType, description: form.description } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTradeEventsQueryKey(trade.id) });
        setForm({ eventType: "note", description: "" });
        toast({ title: "Event added" });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
        ) : allEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No events recorded yet</p>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-3">
              {allEvents.map((ev, i) => (
                <div key={`${ev.id}-${i}`} className="flex gap-3 pl-8 relative">
                  <div className={cn("absolute left-2 top-2 w-4 h-4 rounded-full border flex items-center justify-center", eventColor(ev.eventType))} style={{ transform: "translateX(-50%)" }}>
                    {eventIcon(ev.eventType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </p>
                    <p className="text-sm">{ev.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Separator />
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Event</p>
        <div className="flex gap-2">
          <Select value={form.eventType} onValueChange={v => setForm(p => ({ ...p, eventType: v }))}>
            <SelectTrigger className="h-8 text-xs w-36 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["note","stop_updated","partial_exit","signal","alert"].map(t => <SelectItem key={t} value={t}>{t.replace("_"," ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Describe what happened…" className="h-8 text-sm flex-1"
            onKeyDown={e => e.key === "Enter" && addEvent()} />
          <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={addEvent} disabled={createEvent.isPending}>Add</Button>
        </div>
      </div>
    </div>
  );
}

// ── Psychology Panel ─────────────────────────────────────────────────────────
function PsychologyPanel({ trade }: { trade: Trade }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: psych, isLoading } = useGetTradePsychology(trade.id, {
    query: { queryKey: getGetTradePsychologyQueryKey(trade.id), retry: false }
  });
  const upsert = useUpsertTradePsychology();
  const [pre, setPre] = useState({ confidence: 70, fear: 20, stress: 30, focus: 80, emotion: "neutral", notes: "" });
  const [post, setPost] = useState({ satisfaction: 70, regret: 20, confidenceChange: 0, learning: "", notes: "" });
  const [initialized, setInitialized] = useState(false);

  if (psych && !initialized) {
    setPre({ confidence: psych.preConfidence ?? 70, fear: psych.preFear ?? 20, stress: psych.preStress ?? 30, focus: psych.preFocus ?? 80, emotion: psych.preEmotion ?? "neutral", notes: psych.preNotes ?? "" });
    setPost({ satisfaction: psych.postSatisfaction ?? 70, regret: psych.postRegret ?? 20, confidenceChange: psych.postConfidenceChange ?? 0, learning: psych.postLearning ?? "", notes: psych.postNotes ?? "" });
    setInitialized(true);
  }

  const save = () => {
    upsert.mutate({
      tradeId: trade.id,
      data: {
        preConfidence: pre.confidence, preFear: pre.fear, preStress: pre.stress,
        preFocus: pre.focus, preEmotion: pre.emotion, preNotes: pre.notes || undefined,
        postSatisfaction: post.satisfaction, postRegret: post.regret,
        postConfidenceChange: post.confidenceChange,
        postLearning: post.learning || undefined, postNotes: post.notes || undefined,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTradePsychologyQueryKey(trade.id) });
        toast({ title: "Psychology saved" });
      }
    });
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>;

  const emotions = ["fearful", "anxious", "neutral", "confident", "excited", "overconfident"];
  const emotionColor = (e: string) => ({ fearful: "text-red-400", anxious: "text-orange-400", neutral: "text-muted-foreground", confident: "text-green-400", excited: "text-blue-400", overconfident: "text-yellow-400" })[e] ?? "text-muted-foreground";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-primary" />Before Trade — Mental State</p>
        <div className="space-y-3">
          <PsychSlider label="Confidence" value={pre.confidence} onChange={v => setPre(p => ({ ...p, confidence: v }))} />
          <PsychSlider label="Fear" value={pre.fear} onChange={v => setPre(p => ({ ...p, fear: v }))} />
          <PsychSlider label="Stress" value={pre.stress} onChange={v => setPre(p => ({ ...p, stress: v }))} />
          <PsychSlider label="Focus" value={pre.focus} onChange={v => setPre(p => ({ ...p, focus: v }))} />
          <div>
            <Label className="text-xs text-muted-foreground">Emotional State</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {emotions.map(e => (
                <button key={e} onClick={() => setPre(p => ({ ...p, emotion: e }))}
                  className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors capitalize",
                    pre.emotion === e ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50", emotionColor(e)
                  )}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Pre-trade Notes</Label>
            <Textarea value={pre.notes} onChange={e => setPre(p => ({ ...p, notes: e.target.value }))} placeholder="Why did you take this trade?" className="mt-1 text-sm h-16 resize-none" />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Brain className="w-4 h-4 text-primary" />After Trade — Review</p>
        <div className="space-y-3">
          <PsychSlider label="Satisfaction" value={post.satisfaction} onChange={v => setPost(p => ({ ...p, satisfaction: v }))} />
          <PsychSlider label="Regret" value={post.regret} onChange={v => setPost(p => ({ ...p, regret: v }))} />
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Confidence Change</span>
              <span className={cn("font-medium tabular-nums", post.confidenceChange > 0 ? "text-success" : post.confidenceChange < 0 ? "text-destructive" : "text-muted-foreground")}>
                {post.confidenceChange > 0 ? "+" : ""}{post.confidenceChange}
              </span>
            </div>
            <input type="range" min={-100} max={100} value={post.confidenceChange}
              onChange={e => setPost(p => ({ ...p, confidenceChange: Number(e.target.value) }))}
              className="w-full accent-primary h-1.5 rounded-full cursor-pointer" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">What did you learn?</Label>
            <Textarea value={post.learning} onChange={e => setPost(p => ({ ...p, learning: e.target.value }))} placeholder="Key takeaway from this trade…" className="mt-1 text-sm h-16 resize-none" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Post-trade Notes</Label>
            <Textarea value={post.notes} onChange={e => setPost(p => ({ ...p, notes: e.target.value }))} placeholder="Additional thoughts…" className="mt-1 text-sm h-14 resize-none" />
          </div>
        </div>
      </div>

      <Button onClick={save} disabled={upsert.isPending} className="w-full" size="sm">
        {upsert.isPending ? "Saving…" : "Save Psychology Record"}
      </Button>
    </div>
  );
}

// ── AI Review Panel ──────────────────────────────────────────────────────────
function AIReviewPanel({ trade }: { trade: Trade }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: review, isLoading } = useGetTradeReview(trade.id, {
    query: { queryKey: getGetTradeReviewQueryKey(trade.id), retry: false }
  });
  const generate = useGenerateTradeReview();

  const handleGenerate = () => {
    generate.mutate({ tradeId: trade.id, data: { aiGenerated: true } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTradeReviewQueryKey(trade.id) });
        toast({ title: "AI Review generated" });
      },
      onError: () => toast({ title: "Failed to generate review", variant: "destructive" })
    });
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;

  if (!review) return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <Brain className="w-10 h-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground text-center">No AI review generated yet</p>
      {trade.status === "closed" && (
        <Button size="sm" onClick={handleGenerate} disabled={generate.isPending}>
          <Brain className="w-4 h-4 mr-2" />
          {generate.isPending ? "Generating…" : "Generate AI Review"}
        </Button>
      )}
      {trade.status !== "closed" && <p className="text-xs text-muted-foreground">Close the trade to generate a review</p>}
    </div>
  );

  const scores = [
    { label: "Entry Quality", score: review.entryScore ?? 0 },
    { label: "Risk Management", score: review.riskScore ?? 0 },
    { label: "Exit Quality", score: review.exitScore ?? 0 },
    { label: "Timing", score: review.timingScore ?? 0 },
  ];

  const scoreColor = (s: number) => s >= 80 ? "text-success" : s >= 60 ? "text-warning" : "text-destructive";
  const progressColor = (s: number) => s >= 80 ? "bg-success" : s >= 60 ? "bg-warning" : "bg-destructive";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">AI Trade Review</span>
          {review.aiGenerated && <Badge variant="outline" className="text-xs border-primary/40 text-primary">AI Generated</Badge>}
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleGenerate} disabled={generate.isPending}>
          <RefreshCw className="w-3 h-3 mr-1" />Refresh
        </Button>
      </div>

      <div className="flex items-center justify-center py-2">
        <div className="flex flex-col items-center">
          <ScoreRing score={review.overallScore ?? 0} size={96} />
          <p className="text-sm font-semibold mt-2">Overall Score</p>
          <p className={cn("text-2xl font-bold", scoreColor(review.overallScore ?? 0))}>{review.overallScore ?? 0}/100</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {scores.map(s => (
          <div key={s.label} className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{s.label}</span>
              <span className={cn("font-medium", scoreColor(s.score))}>{s.score}</span>
            </div>
            <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", progressColor(s.score))} style={{ width: `${s.score}%` }} />
            </div>
          </div>
        ))}
      </div>

      <Separator />

      {review.strengths && (
        <div>
          <p className="text-xs font-semibold text-success flex items-center gap-1 mb-2"><CheckCircle className="w-3 h-3" />Strengths</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{review.strengths}</p>
        </div>
      )}
      {review.weaknesses && (
        <div>
          <p className="text-xs font-semibold text-destructive flex items-center gap-1 mb-2"><XCircle className="w-3 h-3" />Weaknesses</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{review.weaknesses}</p>
        </div>
      )}
      {review.recommendations && (
        <div>
          <p className="text-xs font-semibold text-warning flex items-center gap-1 mb-2"><Star className="w-3 h-3" />Recommendations</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{review.recommendations}</p>
        </div>
      )}
    </div>
  );
}

// ── Mistakes Panel ───────────────────────────────────────────────────────────
function MistakesPanel({ trade }: { trade: Trade }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: mistakes, isLoading } = useGetTradeMistakes(trade.id, {
    query: { queryKey: getGetTradeMistakesQueryKey(trade.id) }
  });
  const createMistake = useCreateTradeMistake();
  const [form, setForm] = useState({ mistakeType: "", category: "entry" as const, severity: "medium" as const, description: "", solution: "" });
  const [showForm, setShowForm] = useState(false);

  const sevColor = (s: string) => ({ low: "text-muted-foreground", medium: "text-warning", high: "text-orange-400", critical: "text-destructive" })[s] ?? "text-muted-foreground";
  const catIcon = (c: string) => ({ entry: <ArrowUpRight className="w-3 h-3" />, exit: <ArrowDownRight className="w-3 h-3" />, risk: <Shield className="w-3 h-3" />, strategy: <Target className="w-3 h-3" />, psychology: <Heart className="w-3 h-3" /> })[c] ?? <AlertTriangle className="w-3 h-3" />;

  const submit = () => {
    if (!form.mistakeType || !form.description) return;
    createMistake.mutate({ tradeId: trade.id, data: { ...form, solution: form.solution || undefined } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTradeMistakesQueryKey(trade.id) });
        setForm({ mistakeType: "", category: "entry", severity: "medium", description: "", solution: "" });
        setShowForm(false);
        toast({ title: "Mistake logged" });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" />Detected Mistakes</p>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-3 h-3 mr-1" />Log Mistake
        </Button>
      </div>

      {showForm && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Mistake Type</Label>
                <Input value={form.mistakeType} onChange={e => setForm(p => ({ ...p, mistakeType: e.target.value }))} placeholder="e.g. FOMO Entry" className="h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v as typeof form.category }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{["entry","exit","risk","strategy","psychology"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Severity</Label>
              <Select value={form.severity} onValueChange={v => setForm(p => ({ ...p, severity: v as typeof form.severity }))}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{["low","medium","high","critical"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the mistake…" className="h-14 text-xs resize-none" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Solution</Label>
              <Textarea value={form.solution} onChange={e => setForm(p => ({ ...p, solution: e.target.value }))} placeholder="How to avoid next time…" className="h-14 text-xs resize-none" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs flex-1" onClick={submit} disabled={createMistake.isPending}>
                {createMistake.isPending ? "Saving…" : "Log Mistake"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
      ) : mistakes?.length === 0 ? (
        <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground">
          <CheckCircle className="w-8 h-8 text-success/50" />
          <p className="text-sm">No mistakes logged</p>
        </div>
      ) : (
        <div className="space-y-2">
          {mistakes?.map(m => (
            <div key={m.id} className="border border-border rounded-md p-3 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground capitalize">{catIcon(m.category)}{m.category}</span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                  <span className="font-medium">{m.mistakeType}</span>
                </div>
                <span className={cn("text-xs font-semibold capitalize", sevColor(m.severity))}>{m.severity}</span>
              </div>
              <p className="text-xs text-muted-foreground">{m.description}</p>
              {m.solution && <p className="text-xs text-success/80 border-t border-border/50 pt-1 mt-1">✓ {m.solution}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Trade Detail Drawer ──────────────────────────────────────────────────────
function TradeDetailPanel({ trade, onClose }: { trade: Trade; onClose: () => void }) {
  const pnlColor = trade.profitLoss != null ? cnValueColor(trade.profitLoss) : "text-muted-foreground";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-4 border-b border-border mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg font-mono">{trade.symbol}</span>
            <Badge variant="outline" className={trade.side === "long" ? "border-success text-success" : "border-destructive text-destructive"}>
              {trade.side === "long" ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
              {trade.side.toUpperCase()}
            </Badge>
            <Badge variant="outline" className={
              trade.status === "open" ? "border-primary text-primary" :
              trade.status === "closed" ? "border-muted text-muted-foreground" : "border-warning text-warning"
            }>{trade.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Trade #{trade.id}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none">×</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 shrink-0">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Entry</p>
          <p className="font-mono font-semibold text-sm">{formatCurrency(trade.entryPrice, 4)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Exit</p>
          <p className="font-mono font-semibold text-sm">{trade.exitPrice ? formatCurrency(trade.exitPrice, 4) : "—"}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">P&L</p>
          <p className={cn("font-mono font-semibold text-sm", pnlColor)}>
            {trade.profitLoss != null ? `${trade.profitLoss > 0 ? "+" : ""}${formatCurrency(trade.profitLoss)}` : "—"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="timeline" className="flex-1 overflow-hidden flex flex-col">
        <TabsList className="shrink-0 w-full grid grid-cols-4 h-8">
          <TabsTrigger value="timeline" className="text-xs"><Clock className="w-3 h-3 mr-1" />Timeline</TabsTrigger>
          <TabsTrigger value="psychology" className="text-xs"><Heart className="w-3 h-3 mr-1" />Mind</TabsTrigger>
          <TabsTrigger value="review" className="text-xs"><Brain className="w-3 h-3 mr-1" />AI Review</TabsTrigger>
          <TabsTrigger value="mistakes" className="text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Mistakes</TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-y-auto mt-4">
          <TabsContent value="timeline" className="mt-0"><TradeTimeline trade={trade} /></TabsContent>
          <TabsContent value="psychology" className="mt-0"><PsychologyPanel trade={trade} /></TabsContent>
          <TabsContent value="review" className="mt-0"><AIReviewPanel trade={trade} /></TabsContent>
          <TabsContent value="mistakes" className="mt-0"><MistakesPanel trade={trade} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ── Main Journal Page ────────────────────────────────────────────────────────
export default function Trades() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useRealtimeTable("trades", [getListTradesQueryKey() as unknown[]]);

  const { data: trades, isLoading: tradesLoading } = useListTrades(
    undefined,
    { query: { queryKey: getListTradesQueryKey() } }
  );
  const { data: stats, isLoading: statsLoading } = useGetJournalStats({
    query: { queryKey: getGetJournalStatsQueryKey() }
  });
  const updateTrade = useUpdateTrade();

  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sideFilter, setSideFilter] = useState("all");

  const filteredTrades = (trades ?? []).filter(t => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (sideFilter !== "all" && t.side !== sideFilter) return false;
    if (search && !t.symbol.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCloseTrade = (id: number, exitPrice: number, e: React.MouseEvent) => {
    e.stopPropagation();
    updateTrade.mutate(
      { id, data: { status: "closed", exitPrice, exitTime: new Date().toISOString() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetJournalStatsQueryKey() });
          toast({ title: "Trade closed" });
        }
      }
    );
  };

  const disciplineColor = (s: number) => s >= 80 ? "text-success" : s >= 60 ? "text-warning" : "text-destructive";

  return (
    <div className="flex h-full gap-6 min-h-0">
      {/* Main Content */}
      <div className={cn("flex flex-col gap-6 transition-all min-w-0", selectedTrade ? "flex-1" : "w-full")}>
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trade Journal</h1>
            <p className="text-sm text-muted-foreground">Complete history, psychology & AI analysis of every decision</p>
          </div>
          <NewTradeDialog onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetJournalStatsQueryKey() });
          }} />
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
          <StatCard title="Total Trades" value={stats ? String(stats.totalTrades) : "—"}
            sub={`${stats?.openTrades ?? 0} open`} icon={BarChart2} loading={statsLoading} />
          <StatCard title="Win Rate" value={stats ? `${stats.winRate.toFixed(1)}%` : "—"}
            sub={`${stats?.winningTrades ?? 0}W / ${stats?.losingTrades ?? 0}L`}
            icon={TrendingUp} color={stats && stats.winRate >= 50 ? "text-success" : "text-destructive"} loading={statsLoading} />
          <StatCard title="Avg R:R" value={stats ? `1:${stats.avgRR.toFixed(1)}` : "—"}
            sub="Risk reward" icon={Target} loading={statsLoading} />
          <StatCard title="Total P&L" value={stats ? formatCurrency(stats.totalPnl) : "—"}
            icon={Activity} color={stats ? cnValueColor(stats.totalPnl) : undefined} loading={statsLoading} />
          <StatCard title="Discipline" value={stats ? `${stats.disciplineScore}/100` : "—"}
            sub="AI scored" icon={Shield} color={stats ? disciplineColor(stats.disciplineScore) : undefined} loading={statsLoading} />
          <StatCard title="AI Confidence" value={stats ? `${stats.avgAiConfidence.toFixed(0)}%` : "—"}
            sub="Avg at entry" icon={Brain} loading={statsLoading} />
        </div>

        {/* Filters + Table */}
        <Card className="flex flex-col min-h-0 flex-1">
          <CardHeader className="pb-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart2 className="w-4 h-4" />Trade History
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search symbol…"
                    className="h-8 pl-8 text-xs w-36" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs w-24"><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sideFilter} onValueChange={setSideFilter}>
                  <SelectTrigger className="h-8 text-xs w-24"><SelectValue placeholder="Side" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sides</SelectItem>
                    <SelectItem value="long">Long</SelectItem>
                    <SelectItem value="short">Short</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Entry</TableHead>
                  <TableHead className="text-right">Exit</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                  <TableHead className="text-right">AI Conf</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                  <TableHead className="pr-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tradesLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 10 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full max-w-16" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredTrades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                      {search || statusFilter !== "all" || sideFilter !== "all" ? "No trades match your filters" : "No trades logged yet — start by clicking Log Trade"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTrades.map(trade => (
                    <TableRow key={trade.id} onClick={() => setSelectedTrade(trade.id === selectedTrade?.id ? null : trade)}
                      className={cn("cursor-pointer", selectedTrade?.id === trade.id && "bg-primary/5 border-l-2 border-l-primary")}>
                      <TableCell className="pl-4 font-mono font-medium">{trade.symbol}</TableCell>
                      <TableCell>
                        <span className={cn("flex items-center gap-0.5 text-sm", trade.side === "long" ? "text-success" : "text-destructive")}>
                          {trade.side === "long" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {trade.side.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(trade.entryPrice, 4)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{trade.exitPrice ? formatCurrency(trade.exitPrice, 4) : "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatNumber(trade.quantity, 4)}</TableCell>
                      <TableCell className="text-right">
                        {trade.profitLoss != null ? (
                          <div className={cn("font-mono text-sm", cnValueColor(trade.profitLoss))}>
                            {trade.profitLoss > 0 ? "+" : ""}{formatCurrency(trade.profitLoss)}
                            {trade.profitPercent != null && (
                              <span className="text-xs opacity-70 ml-1">({trade.profitPercent > 0 ? "+" : ""}{formatPercent(trade.profitPercent)})</span>
                            )}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {trade.aiConfidence != null ? (
                          <span className={cn("text-sm font-medium", trade.aiConfidence >= 80 ? "text-success" : trade.aiConfidence >= 60 ? "text-warning" : "text-destructive")}>
                            {trade.aiConfidence.toFixed(0)}%
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs",
                          trade.status === "open" ? "border-primary text-primary" :
                          trade.status === "closed" ? "border-muted text-muted-foreground" : "border-warning text-warning"
                        )}>{trade.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs whitespace-nowrap text-muted-foreground">
                        {trade.entryTime ? formatDate(trade.entryTime) : "—"}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        {trade.status === "open" && (
                          <Button variant="outline" size="sm" className="h-6 text-xs"
                            onClick={e => handleCloseTrade(trade.id, trade.entryPrice * 1.03, e)}>Close</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
          {filteredTrades.length > 0 && (
            <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground flex items-center justify-between shrink-0">
              <span>{filteredTrades.length} trade{filteredTrades.length !== 1 ? "s" : ""} shown</span>
              <span>Click a row to open full journal details</span>
            </div>
          )}
        </Card>
      </div>

      {/* Trade Detail Sidebar */}
      {selectedTrade && (
        <div className="w-[380px] shrink-0 border border-border rounded-lg bg-card p-4 overflow-y-auto flex flex-col">
          <TradeDetailPanel trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
        </div>
      )}
    </div>
  );
}
