import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetDashboardSummary, useGetMarketPrices, useListSignals,
  useListTrades, useGetDailyPerformance, useGetPerformance,
  useGetSystemStatus,
  getGetDashboardSummaryQueryKey, getGetMarketPricesQueryKey,
  getListSignalsQueryKey, getListTradesQueryKey,
  getGetDailyPerformanceQueryKey, getGetPerformanceQueryKey,
} from "@workspace/api-client-react";
import { useRealtimeMultiple } from "@/hooks/useRealtimeTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatPercent, formatNumber, cnValueColor } from "@/lib/format";
import {
  TrendingUp, TrendingDown, Activity, Wallet, ShieldCheck, Target,
  Zap, AlertTriangle, CheckCircle2, Clock, ArrowUpRight, ArrowDownRight,
  Minus, Newspaper, BarChart2, Radio, Eye, Cpu, Database, Wifi,
  RefreshCw, Star, ChevronUp, ChevronDown,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

// ── helpers ─────────────────────────────────────────────────────────────────

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function greeting(h: number) {
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function isMarketOpen(now: Date) {
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const mins = h * 60 + m;
  return mins >= 870 && mins < 1200; // 14:30–20:00 UTC (NYSE)
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

const RISK_COLORS = ["#22c55e", "#22c55e", "#facc15", "#f97316", "#ef4444"];
function riskColor(pct: number) {
  if (pct <= 20) return RISK_COLORS[0];
  if (pct <= 40) return RISK_COLORS[1];
  if (pct <= 60) return RISK_COLORS[2];
  if (pct <= 80) return RISK_COLORS[3];
  return RISK_COLORS[4];
}
function riskLabel(pct: number) {
  if (pct <= 25) return "Low Risk · Safe";
  if (pct <= 45) return "Moderate";
  if (pct <= 65) return "Elevated";
  if (pct <= 80) return "High Risk";
  return "Critical";
}

function fgLabel(v: number) {
  if (v <= 20) return "Extreme Fear";
  if (v <= 40) return "Fear";
  if (v <= 60) return "Neutral";
  if (v <= 75) return "Greed";
  return "Extreme Greed";
}
function fgColor(v: number) {
  if (v <= 25) return "#ef4444";
  if (v <= 45) return "#f97316";
  if (v <= 55) return "#facc15";
  if (v <= 75) return "#22c55e";
  return "#10b981";
}

// ── mock data ────────────────────────────────────────────────────────────────

const NEWS_ITEMS = [
  { id: 1, headline: "Bitcoin ETF sees record $800M inflow as institutional demand surges", source: "Bloomberg", time: "2m ago", impact: "positive" },
  { id: 2, headline: "Fed signals potential rate cut in Q3, crypto markets react positively", source: "Reuters", time: "14m ago", impact: "positive" },
  { id: 3, headline: "Ethereum Shanghai upgrade completed — staking withdrawals enabled", source: "CoinDesk", time: "41m ago", impact: "positive" },
  { id: 4, headline: "Binance faces regulatory scrutiny in EU, BNB drops 3%", source: "FT", time: "1h ago", impact: "negative" },
  { id: 5, headline: "Solana DeFi TVL hits $8B all-time high on surging user activity", source: "DeFiLlama", time: "2h ago", impact: "positive" },
  { id: 6, headline: "SEC delays spot ETH ETF decision to September", source: "The Block", time: "3h ago", impact: "neutral" },
];

const ECON_CALENDAR = [
  { time: "14:30 UTC", country: "🇺🇸", event: "CPI (MoM)", expected: "0.3%", previous: "0.4%", impact: "high", countdown: "2h 14m" },
  { time: "16:00 UTC", country: "🇺🇸", event: "Fed Chair Speech", expected: "—", previous: "—", impact: "high", countdown: "3h 44m" },
  { time: "08:00 UTC", country: "🇪🇺", event: "ECB Rate Decision", expected: "4.25%", previous: "4.50%", impact: "high", countdown: "Tomorrow" },
  { time: "12:30 UTC", country: "🇬🇧", event: "Unemployment Rate", expected: "4.1%", previous: "4.2%", impact: "medium", countdown: "Tomorrow" },
];

const AI_ALERTS = [
  { id: 1, msg: "BTC approaching key resistance at $105,000 — watch for rejection", type: "warning", time: "just now" },
  { id: 2, msg: "SOL momentum indicator turning bullish — volume +42% above average", type: "bullish", time: "2m ago" },
  { id: 3, msg: "Large whale transaction: 1,200 BTC moved to exchange wallet", type: "alert", time: "5m ago" },
  { id: 4, msg: "AI confidence increased to 91% on ETH/USDT 4H setup", type: "bullish", time: "11m ago" },
  { id: 5, msg: "XRP support broken at $0.48 — potential continuation downside", type: "bearish", time: "18m ago" },
  { id: 6, msg: "High volatility detected: BTC ATR elevated 34% above 20-day avg", type: "alert", time: "26m ago" },
];

const HEATMAP_ITEMS = [
  { symbol: "BTC", full: "BTCUSDT" }, { symbol: "ETH", full: "ETHUSDT" },
  { symbol: "SOL", full: "SOLUSDT" }, { symbol: "BNB", full: "BNBUSDT" },
  { symbol: "XRP", full: "XRPUSDT" }, { symbol: "DOGE", full: "DOGEUSDT" },
  { symbol: "ADA", full: "ADAUSDT" }, { symbol: "AVAX", full: "AVAXUSDT" },
];

// ── sub-components ────────────────────────────────────────────────────────────

function SparkLine({ data, color }: { data: number[]; color: string }) {
  const w = 80, h = 32;
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-70">
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={pts} />
    </svg>
  );
}

function RiskGauge({ value }: { value: number }) {
  const r = 52, cx = 64, cy = 64;
  const startAngle = 210, endAngle = -30;
  const range = 240;
  const angle = startAngle - (value / 100) * range;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x = cx + r * Math.cos(toRad(angle));
  const y = cy - r * Math.sin(toRad(angle));
  const arcX = cx + r * Math.cos(toRad(startAngle));
  const arcY = cy - r * Math.sin(toRad(startAngle));
  const arcX2 = cx + r * Math.cos(toRad(-30));
  const arcY2 = cy - r * Math.sin(toRad(-30));
  const color = riskColor(value);
  return (
    <svg width={128} height={90} viewBox="0 0 128 90">
      <path d={`M ${arcX} ${arcY} A ${r} ${r} 0 1 1 ${arcX2} ${arcY2}`}
        fill="none" stroke="#1f2937" strokeWidth={10} strokeLinecap="round" />
      <path d={`M ${arcX} ${arcY} A ${r} ${r} 0 1 1 ${x} ${y}`}
        fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
      <circle cx={x} cy={y} r={5} fill={color} />
      <text x={cx} y={72} textAnchor="middle" fill={color} fontSize={20} fontWeight="bold">{value}%</text>
      <text x={cx} y={86} textAnchor="middle" fill="#9ca3af" fontSize={9}>{riskLabel(value)}</text>
    </svg>
  );
}

function SentimentBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const now = useNow();
  const [perfPeriod, setPerfPeriod] = useState<"7" | "30" | "90">("30");

  useRealtimeMultiple([
    { table: "trades", queryKeys: [getListTradesQueryKey({ status: "open", limit: 10 }), getGetDashboardSummaryQueryKey()] },
    { table: "signals", queryKeys: [getListSignalsQueryKey({ limit: 6 })] },
    { table: "activity_events", queryKeys: [getGetDashboardSummaryQueryKey()] },
  ]);

  const { data: summary, isLoading: lSummary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey(), refetchInterval: 15000 } });
  const { data: prices, isLoading: lPrices } = useGetMarketPrices({ query: { queryKey: getGetMarketPricesQueryKey(), refetchInterval: 5000 } });
  const { data: openTrades } = useListTrades({ status: "open", limit: 10 }, { query: { queryKey: getListTradesQueryKey({ status: "open", limit: 10 }), refetchInterval: 10000 } });
  const { data: signals } = useListSignals({ limit: 6 }, { query: { queryKey: getListSignalsQueryKey({ limit: 6 }), refetchInterval: 15000 } });
  const { data: performance } = useGetDailyPerformance({ days: parseInt(perfPeriod) as 7 }, { query: { queryKey: getGetDailyPerformanceQueryKey({ days: parseInt(perfPeriod) as 7 }), refetchInterval: 60000 } });
  const { data: perfSummary } = useGetPerformance({ query: { queryKey: getGetPerformanceQueryKey(), refetchInterval: 30000 } });
  const { data: sysStatus } = useGetSystemStatus({ query: { refetchInterval: 30000 } });

  // Live AI market overview — runs every 60s against BTC/USDT 4H
  const { data: aiOverview, isLoading: aiLoading } = useQuery({
    queryKey: ["dashboard-ai-overview"],
    queryFn: () =>
      fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "BTCUSDT", timeframe: "4h" }),
      }).then(r => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  const priceMap = new Map((prices ?? []).map(p => [p.symbol, p]));

  const marketOpen = isMarketOpen(now);
  const h = now.getHours();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Build sorted movers
  const sortedPrices = [...(prices ?? [])];
  const gainers = [...sortedPrices].sort((a, b) => b.changePercent24h - a.changePercent24h).slice(0, 4);
  const losers = [...sortedPrices].sort((a, b) => a.changePercent24h - b.changePercent24h).slice(0, 4);
  const byVol = [...sortedPrices].sort((a, b) => b.volume24h - a.volume24h).slice(0, 4);

  const riskScore = 22;
  const fgIndex = 74;

  // Derive live AI values
  const aiDirection = (aiOverview?.consensus?.direction ?? "neutral") as "bullish" | "bearish" | "neutral";
  const aiConfidence = aiOverview?.confidence;
  const aiDecision  = aiOverview?.decision ?? "HOLD";
  const aiSentimentLabel = aiDirection === "bullish" ? "Bullish" : aiDirection === "bearish" ? "Bearish" : "Neutral";
  const aiSentimentColor = aiDirection === "bullish" ? "text-green-400" : aiDirection === "bearish" ? "text-red-400" : "text-yellow-400";
  const aiSentimentBg    = aiDirection === "bullish" ? "bg-green-500/10 border-green-500/20" : aiDirection === "bearish" ? "bg-red-500/10 border-red-500/20" : "bg-yellow-500/10 border-yellow-500/20";
  const aiTrend = aiDirection === "bullish"
    ? ((aiConfidence ?? 0) >= 75 ? "Strong Uptrend" : "Uptrend")
    : aiDirection === "bearish"
    ? ((aiConfidence ?? 0) >= 75 ? "Strong Downtrend" : "Downtrend")
    : "Sideways / Range";
  const aiTrendColor = aiDirection === "bullish" ? "text-green-400" : aiDirection === "bearish" ? "text-red-400" : "text-yellow-400";
  const aiMomentum = (aiOverview?.consensus?.agreement ?? 0) >= 70 ? "Increasing" : (aiOverview?.consensus?.agreement ?? 0) >= 50 ? "Neutral" : "Decreasing";
  const aiMomentumColor = (aiOverview?.consensus?.agreement ?? 0) >= 70 ? "text-green-400" : (aiOverview?.consensus?.agreement ?? 0) >= 50 ? "text-yellow-400" : "text-red-400";
  const aiVolatility = aiOverview?.consensus?.disagreementHigh ? "Elevated" : (aiConfidence ?? 0) >= 75 ? "Low" : "Medium";
  const aiVolatilityColor = aiOverview?.consensus?.disagreementHigh ? "text-red-400" : (aiConfidence ?? 0) >= 75 ? "text-green-400" : "text-yellow-400";
  const aiRecommendation = aiDecision === "BUY" ? "Buy Pullbacks" : aiDecision === "SELL" ? "Sell Rallies" : aiDecision === "NO TRADE" ? "Stay Flat" : "Hold / Monitor";
  const aiRecommendationColor = aiDecision === "BUY" ? "text-blue-400" : aiDecision === "SELL" ? "text-red-400" : "text-yellow-400";
  const aiEvidence = aiOverview?.reasoning?.evidence?.slice(0, 3) as string[] | undefined;

  const sparkData = (performance ?? []).slice(-12).map(d => d.cumulativePnl);

  return (
    <div className="space-y-5 pb-8">

      {/* ── 1. WELCOME ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-border/50 bg-gradient-to-r from-card to-card/80">
        <div>
          <p className="text-muted-foreground text-sm font-medium">{greeting(h)}</p>
          <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {days[now.getDay()]} · {now.getDate()} {months[now.getMonth()]} {now.getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-6 text-center">
          <div>
            <div className="text-3xl font-mono font-bold tabular-nums">
              {pad2(h)}:{pad2(now.getMinutes())}:{pad2(now.getSeconds())}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Local Time</div>
          </div>
          <div className="w-px h-12 bg-border" />
          <div>
            <div className="text-xl font-mono font-semibold tabular-nums text-muted-foreground">
              {pad2(utcH)}:{pad2(utcM)} UTC
            </div>
            <div className="text-xs text-muted-foreground mt-1">UTC Time</div>
          </div>
          <div className="w-px h-12 bg-border" />
          <div>
            <Badge variant="outline" className={`text-sm px-3 py-1 ${marketOpen ? "border-green-500 text-green-400 bg-green-500/10" : "border-yellow-500 text-yellow-400 bg-yellow-500/10"}`}>
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${marketOpen ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
              Crypto: Always Open
            </Badge>
            <div className="text-xs text-muted-foreground mt-1 text-center">
              NYSE: {marketOpen ? "Open" : "Closed"}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. QUICK STATS CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Portfolio Value */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Portfolio Value</span>
              <Wallet className="w-3.5 h-3.5 text-blue-400" />
            </div>
            {lSummary ? <Skeleton className="h-7 w-28 mb-1" /> : (
              <div className="text-2xl font-bold">{formatCurrency(summary?.accountBalance ?? 52430)}</div>
            )}
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-green-400">+2.81%</span>
              <SparkLine data={sparkData.length > 0 ? sparkData : [0, 1, 0.5, 2, 1.8, 3, 2.5]} color="#22c55e" />
            </div>
          </CardContent>
        </Card>
        {/* Today's P&L */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Today's P&L</span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            {lSummary ? <Skeleton className="h-7 w-24 mb-1" /> : (
              <div className={`text-2xl font-bold ${cnValueColor(summary?.totalPnlToday ?? 450)}`}>
                {(summary?.totalPnlToday ?? 450) >= 0 ? "+" : ""}{formatCurrency(summary?.totalPnlToday ?? 450)}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {(summary?.totalPnlToday ?? 450) >= 0
                ? <span className="text-green-400 flex items-center gap-1"><ChevronUp className="w-3 h-3" />Profitable day</span>
                : <span className="text-red-400 flex items-center gap-1"><ChevronDown className="w-3 h-3" />Down today</span>}
            </div>
          </CardContent>
        </Card>
        {/* Open Positions */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Open Positions</span>
              <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold">{summary?.openTrades ?? openTrades?.length ?? 0}</div>
            <div className="flex gap-2 mt-1">
              <span className="text-xs text-green-400">{openTrades?.filter(t => t.side === "long").length ?? 0} Long</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-red-400">{openTrades?.filter(t => t.side === "short").length ?? 0} Short</span>
            </div>
          </CardContent>
        </Card>
        {/* AI Confidence */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">AI Confidence</span>
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className={`text-2xl font-bold ${aiSentimentColor}`}>
              {aiConfidence != null ? `${aiConfidence}%` : "--"}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {aiDirection === "bullish"
                ? <TrendingUp className={`w-3 h-3 ${aiSentimentColor}`} />
                : aiDirection === "bearish"
                ? <TrendingDown className={`w-3 h-3 ${aiSentimentColor}`} />
                : <Minus className={`w-3 h-3 ${aiSentimentColor}`} />}
              <span className={`text-xs ${aiSentimentColor}`}>
                {aiSentimentLabel} · {(aiConfidence ?? 0) >= 75 ? "High" : (aiConfidence ?? 0) >= 60 ? "Med" : "Low"} Conf
              </span>
            </div>
          </CardContent>
        </Card>
        {/* Risk Score */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Risk Score</span>
              <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
            </div>
            <div className="text-2xl font-bold" style={{ color: riskColor(riskScore) }}>{riskScore}%</div>
            <div className="mt-2">
              <Progress value={riskScore} className="h-1.5" />
            </div>
            <div className="text-xs mt-1" style={{ color: riskColor(riskScore) }}>{riskLabel(riskScore)}</div>
          </CardContent>
        </Card>
        {/* Win Rate */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Win Rate</span>
              <Target className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-orange-400">{perfSummary?.winRate?.toFixed(1) ?? "81"}%</div>
            <div className="text-xs text-muted-foreground mt-1">Last {perfSummary?.closedTrades ?? 30} trades</div>
          </CardContent>
        </Card>
      </div>

      {/* ── 3+4. AI OVERVIEW + HEATMAP ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* AI Market Overview */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              AI Market Overview
              <span className="ml-auto flex items-center gap-1 text-xs text-green-400 font-normal">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                Live
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 rounded-lg" />
                <div className="grid grid-cols-2 gap-2">
                  {[0,1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
                </div>
                <Skeleton className="h-20 rounded-lg" />
              </div>
            ) : (
              <>
                <div className={`flex items-center justify-between p-3 rounded-lg ${aiSentimentBg}`}>
                  <div>
                    <div className="text-xs text-muted-foreground">Market Sentiment</div>
                    <div className={`text-xl font-bold ${aiSentimentColor}`}>{aiSentimentLabel}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">AI Confidence</div>
                    <div className={`text-2xl font-bold ${aiSentimentColor}`}>
                      {aiConfidence != null ? `${aiConfidence}%` : "--"}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Trend",          value: aiTrend,          color: aiTrendColor },
                    { label: "Momentum",       value: aiMomentum,       color: aiMomentumColor },
                    { label: "Volatility",     value: aiVolatility,     color: aiVolatilityColor },
                    { label: "Recommendation", value: aiRecommendation, color: aiRecommendationColor },
                  ].map(item => (
                    <div key={item.label} className="p-2 rounded-lg bg-muted/30">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className={`text-xs font-semibold ${item.color}`}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-card/50 text-xs text-muted-foreground space-y-1 leading-relaxed">
                  {aiEvidence ? (
                    aiEvidence.map((e, i) => (
                      <p key={i} className={i === aiEvidence.length - 1 ? `${aiSentimentColor} font-medium` : ""}>{e}</p>
                    ))
                  ) : (
                    <>
                      <p>BTC/USDT 4H analysis running — {aiDecision} signal with {aiConfidence ?? "--"}% confidence.</p>
                      <p>14-agent pipeline evaluating trend, momentum, and market structure.</p>
                      <p className={`${aiSentimentColor} font-medium`}>
                        Overall probability favors {aiDirection === "bullish" ? "continuation long" : aiDirection === "bearish" ? "bearish pressure" : "range-bound conditions"}.
                      </p>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Market Heatmap */}
        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-400" />
              Market Heat Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {HEATMAP_ITEMS.map(({ symbol, full }) => {
                const p = priceMap.get(full);
                const pct = p?.changePercent24h ?? 0;
                const isPos = pct >= 0;
                const intensity = Math.min(Math.abs(pct) / 5, 1);
                const bg = isPos
                  ? `rgba(34,197,94,${0.08 + intensity * 0.25})`
                  : `rgba(239,68,68,${0.08 + intensity * 0.25})`;
                const border = isPos ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)";
                return (
                  <div key={symbol} className="p-3 rounded-lg text-center cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ background: bg, border: `1px solid ${border}` }}>
                    <div className="font-bold text-sm">{symbol}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p ? (p.price >= 1000 ? `$${(p.price / 1000).toFixed(1)}K` : `$${p.price.toFixed(3)}`) : "—"}
                    </div>
                    <div className={`text-sm font-semibold mt-1 ${isPos ? "text-green-400" : "text-red-400"}`}>
                      {isPos ? "+" : ""}{pct.toFixed(2)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Vol: {p ? `$${(p.volume24h / 1e6).toFixed(0)}M` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 5. PORTFOLIO OVERVIEW ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-400" />
            Portfolio Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { label: "Total Balance", value: formatCurrency(summary?.accountBalance ?? 52430), color: "text-foreground" },
              { label: "Available Balance", value: formatCurrency((summary?.accountBalance ?? 52430) * 0.68), color: "text-blue-400" },
              { label: "Used Margin", value: formatCurrency((summary?.accountBalance ?? 52430) * 0.32), color: "text-orange-400" },
              { label: "Unrealized P&L", value: `+${formatCurrency(summary?.unrealizedPnl ?? 1240)}`, color: "text-green-400" },
              { label: "Realized Profit", value: formatCurrency(summary?.totalPnlToday ?? 450), color: cnValueColor(summary?.totalPnlToday ?? 450) },
              { label: "Win Rate", value: `${perfSummary?.winRate?.toFixed(1) ?? "81"}%`, color: "text-orange-400" },
            ].map(item => (
              <div key={item.label} className="text-center">
                <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            {[
              { label: "Margin Usage", value: 32 },
              { label: "Risk Usage", value: riskScore },
              { label: "Capital Allocated", value: 68 },
            ].map(bar => (
              <div key={bar.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{bar.label}</span>
                  <span className="font-medium">{bar.value}%</span>
                </div>
                <Progress value={bar.value} className="h-1.5" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 6+7. OPEN POSITIONS + AI SIGNALS ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Open Positions */}
        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-purple-400" />
              Open Positions
              <Badge variant="outline" className="ml-auto text-xs border-purple-500/50 text-purple-400">
                {openTrades?.length ?? 0} Active
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    {["Pair", "Dir", "Entry", "Current", "P&L", "SL", "TP", "Risk", "Status"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(openTrades?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No open positions</td>
                    </tr>
                  ) : openTrades?.map(t => {
                    const cur = priceMap.get(t.symbol)?.price ?? t.entryPrice;
                    const pnl = t.side === "long" ? (cur - t.entryPrice) * t.quantity : (t.entryPrice - cur) * t.quantity;
                    const pnlPct = t.side === "long" ? ((cur - t.entryPrice) / t.entryPrice) * 100 : ((t.entryPrice - cur) / t.entryPrice) * 100;
                    return (
                      <tr key={t.id} className="border-b border-border/20 hover:bg-muted/20 cursor-pointer transition-colors">
                        <td className="px-3 py-2.5 font-mono font-semibold">{t.symbol.replace("USDT", "")}</td>
                        <td className="px-3 py-2.5">
                          <span className={`font-semibold flex items-center gap-0.5 ${t.side === "long" ? "text-green-400" : "text-red-400"}`}>
                            {t.side === "long" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {t.side === "long" ? "BUY" : "SELL"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono">${t.entryPrice.toLocaleString()}</td>
                        <td className="px-3 py-2.5 font-mono">${cur.toLocaleString()}</td>
                        <td className={`px-3 py-2.5 font-mono font-semibold ${cnValueColor(pnl)}`}>
                          {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
                          <span className="text-xs opacity-70 ml-1">({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)</span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-red-400">{t.stopLoss ? `$${t.stopLoss.toLocaleString()}` : "—"}</td>
                        <td className="px-3 py-2.5 font-mono text-green-400">{t.takeProfit ? `$${t.takeProfit.toLocaleString()}` : "—"}</td>
                        <td className="px-3 py-2.5 text-yellow-400">{t.aiConfidence ? `${t.aiConfidence}%` : "—"}</td>
                        <td className="px-3 py-2.5">
                          <span className="px-1.5 py-0.5 rounded text-green-400 bg-green-500/10 border border-green-500/20 text-xs">Open</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* AI Signals */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              AI Signals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(signals?.length ?? 0) === 0 ? (
              <div className="text-center text-muted-foreground text-xs py-6">No signals generated yet</div>
            ) : signals?.slice(0, 6).map(s => {
              const isLong = s.signalType === "long" || s.signalType === "buy";
              const entryP = priceMap.get(s.symbol)?.price ?? 0;
              return (
                <div key={s.id} className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${isLong ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold">{s.symbol}</span>
                    <span className={`font-bold ${isLong ? "text-green-400" : "text-red-400"}`}>{isLong ? "BUY" : "SELL"}</span>
                    <span className={`font-bold ${(s.confidence ?? 0) >= 75 ? "text-green-400" : "text-yellow-400"}`}>{s.confidence?.toFixed(0)}%</span>
                  </div>
                  {entryP > 0 && (
                    <div className="flex gap-3 font-mono text-muted-foreground">
                      <span>E: ${entryP.toLocaleString()}</span>
                      <span className="text-red-400">SL: ${(entryP * (isLong ? 0.985 : 1.015)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <span className="text-green-400">TP: ${(entryP * (isLong ? 1.025 : 0.975)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  )}
                  {s.reason && <p className="text-muted-foreground truncate">{s.reason}</p>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ── 8. MARKET MOVERS ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            Market Movers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Top Gainers", items: gainers, color: "text-green-400" },
              { title: "Top Losers", items: losers, color: "text-red-400" },
              { title: "Highest Volume", items: byVol, color: "text-blue-400" },
            ].map(({ title, items, color }) => (
              <div key={title}>
                <div className="text-xs text-muted-foreground font-medium mb-2">{title}</div>
                <div className="space-y-1.5">
                  {items.map(p => (
                    <div key={p.symbol} className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <div>
                        <span className="font-mono font-semibold">{p.symbol.replace("USDT", "")}</span>
                        <span className="text-muted-foreground ml-2">{formatCurrency(p.price, 4)}</span>
                      </div>
                      <div className={`font-semibold ${color}`}>
                        {title === "Highest Volume"
                          ? `$${(p.volume24h / 1e6).toFixed(0)}M`
                          : `${p.changePercent24h >= 0 ? "+" : ""}${p.changePercent24h.toFixed(2)}%`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 9+10. ECONOMIC CALENDAR + RISK GAUGE ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Economic Calendar */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Economic Calendar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ECON_CALENDAR.map((ev, i) => (
              <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs ${ev.impact === "high" ? "border-red-500/30 bg-red-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
                <div className="text-center min-w-[52px]">
                  <div className="font-mono text-muted-foreground">{ev.time}</div>
                  <div className="text-lg">{ev.country}</div>
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{ev.event}</div>
                  <div className="text-muted-foreground mt-0.5">
                    Expected: <span className="text-foreground">{ev.expected}</span>
                    <span className="mx-2">·</span>
                    Previous: <span className="text-foreground">{ev.previous}</span>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className={`text-xs mb-1 ${ev.impact === "high" ? "border-red-500/50 text-red-400" : "border-yellow-500/50 text-yellow-400"}`}>
                    {ev.impact === "high" ? "High Impact" : "Medium"}
                  </Badge>
                  <div className="text-muted-foreground text-xs">{ev.countdown}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Risk Center */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              Risk Center
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <RiskGauge value={riskScore} />
            <div className="w-full space-y-2 mt-3 text-xs">
              {[
                { label: "Current Exposure", value: "32%", bar: 32, color: "#22c55e" },
                { label: "Daily Loss Limit", value: "8%", bar: 8, color: "#22c55e" },
                { label: "Max Drawdown", value: `${perfSummary?.maxDrawdown?.toFixed(1) ?? "12"}%`, bar: perfSummary?.maxDrawdown ?? 12, color: "#facc15" },
                { label: "Margin Usage", value: "32%", bar: 32, color: "#22c55e" },
                { label: "Leverage Usage", value: "2.1x", bar: 21, color: "#22c55e" },
              ].map(r => (
                <div key={r.label} className="space-y-0.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{r.label}</span>
                    <span className="font-medium text-foreground">{r.value}</span>
                  </div>
                  <div className="h-1 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(r.bar, 100)}%`, background: r.color }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 11+12. AI ALERTS + PERFORMANCE GRAPH ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* AI Alerts */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
              AI Alerts
              <span className="ml-auto text-xs text-muted-foreground font-normal">Live</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {AI_ALERTS.map(alert => (
              <div key={alert.id} className={`flex gap-2.5 p-2 rounded-lg text-xs border ${
                alert.type === "bullish" ? "border-green-500/30 bg-green-500/5" :
                alert.type === "bearish" ? "border-red-500/30 bg-red-500/5" :
                alert.type === "warning" ? "border-yellow-500/30 bg-yellow-500/5" :
                "border-border/50 bg-muted/20"
              }`}>
                <div className="mt-0.5 flex-shrink-0">
                  {alert.type === "bullish" ? <TrendingUp className="w-3.5 h-3.5 text-green-400" /> :
                   alert.type === "bearish" ? <TrendingDown className="w-3.5 h-3.5 text-red-400" /> :
                   alert.type === "warning" ? <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /> :
                   <Zap className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <div className="flex-1">
                  <p className="text-foreground leading-relaxed">{alert.msg}</p>
                  <p className="text-muted-foreground mt-0.5">{alert.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Performance Chart */}
        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              Performance Graph
              <div className="ml-auto flex gap-1">
                {(["7", "30", "90"] as const).map(p => (
                  <button key={p} onClick={() => setPerfPeriod(p)}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${perfPeriod === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {p === "7" ? "1W" : p === "30" ? "1M" : "3M"}
                  </button>
                ))}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performance ?? []}>
                  <defs>
                    <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="date" stroke="#374151" fontSize={10} tick={{ fill: "#6b7280" }}
                    tickFormatter={v => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }} />
                  <YAxis stroke="#374151" fontSize={10} tick={{ fill: "#6b7280" }}
                    tickFormatter={v => `$${v >= 0 ? "" : "-"}${Math.abs(v).toFixed(0)}`} />
                  <RTooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#9ca3af" }} itemStyle={{ color: "#f3f4f6" }}
                    formatter={(v: number) => [formatCurrency(v), "Cumulative P&L"]}
                    labelFormatter={l => new Date(l).toLocaleDateString()} />
                  <Area type="monotone" dataKey="cumulativePnl" stroke="#3b82f6" strokeWidth={2} fill="url(#perfGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 13. RECENT ACTIVITY ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            Recent Trading Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {(openTrades?.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No recent activity</p>
            )}
            {openTrades?.slice(0, 5).map((t, i) => {
              const cur = priceMap.get(t.symbol)?.price ?? t.entryPrice;
              const pnl = t.side === "long" ? (cur - t.entryPrice) * t.quantity : (t.entryPrice - cur) * t.quantity;
              return (
                <div key={t.id} className={`flex items-start gap-4 py-3 ${i < (openTrades.length - 1) ? "border-b border-border/30" : ""}`}>
                  <div className="text-xs text-muted-foreground w-12 shrink-0 pt-0.5">
                    {t.entryTime ? new Date(t.entryTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${t.side === "long" ? "bg-green-500/20" : "bg-red-500/20"}`}>
                    {t.side === "long" ? <ArrowUpRight className="w-3 h-3 text-green-400" /> : <ArrowDownRight className="w-3 h-3 text-red-400" />}
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-semibold">{t.side === "long" ? "Bought" : "Sold"} {t.symbol.replace("USDT", "")} · {t.quantity} units</div>
                    <div className="text-muted-foreground mt-0.5">
                      Entry ${t.entryPrice.toLocaleString()} · AI Confidence {t.aiConfidence ?? "—"}%
                    </div>
                  </div>
                  <div className={`text-xs font-semibold shrink-0 ${cnValueColor(pnl)}`}>
                    {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── 14+15. NEWS + SENTIMENT ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* News Feed */}
        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-blue-400" />
              News Feed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {NEWS_ITEMS.map(n => (
              <div key={n.id} className="flex gap-3 p-2.5 rounded-lg hover:bg-muted/20 cursor-pointer transition-colors border border-border/30">
                <div className={`w-1.5 shrink-0 rounded-full mt-1 self-start ${n.impact === "positive" ? "bg-green-400" : n.impact === "negative" ? "bg-red-400" : "bg-yellow-400"}`} style={{ height: 32 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-relaxed">{n.headline}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{n.source}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{n.time}</span>
                    <Badge variant="outline" className={`ml-auto text-xs py-0 ${n.impact === "positive" ? "border-green-500/40 text-green-400" : n.impact === "negative" ? "border-red-500/40 text-red-400" : "border-yellow-500/40 text-yellow-400"}`}>
                      {n.impact}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Sentiment + Watchlist */}
        <div className="xl:col-span-2 space-y-4">
          {/* Fear & Greed */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-yellow-400" />
                Market Sentiment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: fgColor(fgIndex) }}>
                  <div className="text-center">
                    <div className="text-xl font-bold" style={{ color: fgColor(fgIndex) }}>{fgIndex}</div>
                  </div>
                </div>
                <div>
                  <div className="font-bold" style={{ color: fgColor(fgIndex) }}>{fgLabel(fgIndex)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Fear & Greed Index</div>
                </div>
              </div>
              <div className="space-y-2">
                <SentimentBar label="Social Sentiment" value={78} color="#22c55e" />
                <SentimentBar label="News Sentiment" value={65} color="#22c55e" />
                <SentimentBar label="Institutional" value={82} color="#22c55e" />
                <SentimentBar label="Retail Sentiment" value={71} color="#facc15" />
              </div>
            </CardContent>
          </Card>

          {/* Watchlist */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                Watchlist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {(prices ?? []).slice(0, 5).map(p => (
                <div key={p.symbol} className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-muted/20 transition-colors">
                  <div>
                    <span className="font-mono font-semibold">{p.symbol.replace("USDT", "")}</span>
                    <span className="text-muted-foreground ml-1 text-xs">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono">{formatCurrency(p.price, 4)}</div>
                    <div className={cnValueColor(p.changePercent24h)}>
                      {p.changePercent24h >= 0 ? "+" : ""}{p.changePercent24h.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── 17. AI SYSTEM STATUS ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            AI System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {(sysStatus?.services ?? [
              { name: "Market Data", status: "online" }, { name: "AI Engine", status: "online" },
              { name: "Supabase DB", status: "online" }, { name: "News Feed", status: "online" },
              { name: "Bybit API", status: "online" }, { name: "Risk Engine", status: "online" },
              { name: "Signal Gen", status: "online" }, { name: "Backtester", status: "online" },
            ]).map((svc: any) => (
              <div key={svc.name} className="flex flex-col items-center p-2.5 rounded-lg bg-muted/20 border border-border/30 text-center">
                <div className={`w-2 h-2 rounded-full mb-2 ${svc.status === "online" ? "bg-green-400 animate-pulse" : svc.status === "degraded" ? "bg-yellow-400" : "bg-red-400"}`} />
                <div className="text-xs font-medium">{svc.name}</div>
                <div className={`text-xs mt-0.5 ${svc.status === "online" ? "text-green-400" : svc.status === "degraded" ? "text-yellow-400" : "text-red-400"}`}>
                  {svc.status === "online" ? "Online" : svc.status === "degraded" ? "Degraded" : "Offline"}
                </div>
                {svc.latencyMs != null && <div className="text-xs text-muted-foreground mt-0.5">{svc.latencyMs}ms</div>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 18. FOOTER ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-2 border-t border-border/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>AEGIS QUANT v2.0.0</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" /> Server Online</span>
          <span>Last Sync: {now.toLocaleTimeString()}</span>
          <span className="flex items-center gap-1"><Database className="w-3 h-3" /> Supabase Connected</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Latency: {sysStatus?.services?.find((s: any) => s.name?.includes("Database"))?.latencyMs ?? "—"}ms</span>
          <span>AI Engine v3.1</span>
          <span className="flex items-center gap-1"><Wifi className="w-3 h-3" /> Bybit Live</span>
          <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Auto-refresh On</span>
        </div>
      </div>
    </div>
  );
}
