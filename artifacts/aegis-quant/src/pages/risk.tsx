import { useState } from "react";
import { useListTrades, useCalculateRisk, getListTradesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ShieldCheck, ShieldAlert, Calculator } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACCOUNT = 10000;
const DAILY_LIMIT_PCT = 5;
const MAX_EXPOSURE_PCT = 60;
const MAX_TRADE_RISK_PCT = 2;

export default function Risk() {
  const { data: openTrades, isLoading } = useListTrades({ status: "open" }, { query: { queryKey: [...getListTradesQueryKey(), "open"] } });
  const { data: allTrades } = useListTrades({}, { query: { queryKey: getListTradesQueryKey() } });

  const [account, setAccount] = useState("10000");
  const [riskPct, setRiskPct] = useState("2");
  const [entry, setEntry] = useState("103500");
  const [stop, setStop] = useState("100800");
  const { mutate: calcRisk, data: riskResult, isPending: calculating } = useCalculateRisk();

  const todayPnl = (allTrades ?? [])
    .filter((t) => t.status === "closed" && t.exitTime && new Date(t.exitTime).toDateString() === new Date().toDateString())
    .reduce((s, t) => s + (t.profitLoss ?? 0), 0);

  const totalExposure = (openTrades ?? []).reduce((s, t) => s + (t.entryPrice ?? 0) * (t.quantity ?? 0), 0);
  const exposurePct = (totalExposure / ACCOUNT) * 100;
  const dailyUsedPct = Math.abs(todayPnl / ACCOUNT) * 100;
  const dailyLimitReached = dailyUsedPct >= DAILY_LIMIT_PCT;
  const exposureWarning = exposurePct >= MAX_EXPOSURE_PCT * 0.8;

  const rr = entry && stop ? (parseFloat(entry) - parseFloat(stop)) : 0;
  const result = riskResult as { positionSize?: number; riskAmount?: number; riskReward?: number; stopDistance?: number } | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          Risk Center
        </h1>
        <p className="text-sm text-muted-foreground">Real-time risk metrics, position sizing, and account protection</p>
      </div>

      {/* Risk Status */}
      {dailyLimitReached && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive bg-destructive/10 text-destructive">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <p className="font-semibold">Daily loss limit reached — stop trading for today</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RiskCard
          title="Daily P&L"
          value={formatCurrency(todayPnl)}
          sub={`${formatPercent(dailyUsedPct)} of ${DAILY_LIMIT_PCT}% limit used`}
          status={dailyUsedPct >= DAILY_LIMIT_PCT ? "danger" : dailyUsedPct >= DAILY_LIMIT_PCT * 0.8 ? "warn" : "ok"}
          loading={isLoading}
        />
        <RiskCard
          title="Open Exposure"
          value={formatCurrency(totalExposure)}
          sub={`${formatPercent(exposurePct)} of account (limit ${MAX_EXPOSURE_PCT}%)`}
          status={exposurePct >= MAX_EXPOSURE_PCT ? "danger" : exposureWarning ? "warn" : "ok"}
          loading={isLoading}
        />
        <RiskCard
          title="Open Trades"
          value={String(openTrades?.length ?? 0)}
          sub="Active positions"
          status={(openTrades?.length ?? 0) > 5 ? "warn" : "ok"}
          loading={isLoading}
        />
        <RiskCard
          title="Max Trade Risk"
          value={formatPercent(MAX_TRADE_RISK_PCT)}
          sub="Per trade limit"
          status="ok"
          loading={false}
        />
      </div>

      {/* Risk Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Rules</CardTitle>
          <CardDescription>Active constraints on every trade</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { rule: `Max ${MAX_TRADE_RISK_PCT}% account risk per trade`, active: true },
              { rule: `Daily loss limit: ${DAILY_LIMIT_PCT}% of account — halt trading if hit`, active: true },
              { rule: `Max open exposure: ${MAX_EXPOSURE_PCT}% of account`, active: true },
              { rule: "Stop loss required on every trade — no exceptions", active: true },
              { rule: "Maximum 3 highly correlated positions simultaneously", active: true },
              { rule: "No new trades during last 30 minutes before major news events", active: false },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                <div className={cn("w-2 h-2 rounded-full shrink-0", r.active ? "bg-success" : "bg-muted-foreground")} />
                <p className={cn("text-sm", !r.active && "text-muted-foreground line-through")}>{r.rule}</p>
                {!r.active && <span className="ml-auto text-xs text-muted-foreground">Phase 9</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Position Size Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Position Size Calculator
          </CardTitle>
          <CardDescription>Calculate exact position size from risk parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Account Size ($)</Label>
              <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="10000" />
            </div>
            <div className="space-y-1.5">
              <Label>Risk % per trade</Label>
              <Input value={riskPct} onChange={(e) => setRiskPct(e.target.value)} placeholder="2" />
            </div>
            <div className="space-y-1.5">
              <Label>Entry Price</Label>
              <Input value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="103500" />
            </div>
            <div className="space-y-1.5">
              <Label>Stop Loss Price</Label>
              <Input value={stop} onChange={(e) => setStop(e.target.value)} placeholder="100800" />
            </div>
          </div>
          <Button
            onClick={() => calcRisk({ data: { account: parseFloat(account), riskPercent: parseFloat(riskPct), entry: parseFloat(entry), stopLoss: parseFloat(stop) } })}
            disabled={calculating || !account || !riskPct || !entry || !stop}
          >
            <Calculator className="w-4 h-4 mr-2" />
            Calculate
          </Button>

          {result && (
            <div className="mt-2 grid gap-4 sm:grid-cols-4 border-t border-border pt-4">
              <ResultBox label="Position Size" value={result.positionSize?.toFixed(4) ?? "—"} />
              <ResultBox label="Risk Amount" value={formatCurrency(result.riskAmount ?? 0)} valueColor="text-destructive" />
              <ResultBox label="Stop Distance" value={formatCurrency(result.stopDistance ?? 0)} />
              <ResultBox label="Risk:Reward" value={result.riskReward ? `1:${result.riskReward.toFixed(1)}` : "—"} valueColor={(result.riskReward ?? 0) >= 2 ? "text-success" : "text-yellow-400"} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RiskCard({ title, value, sub, status, loading }: { title: string; value: string; sub: string; status: "ok" | "warn" | "danger"; loading: boolean }) {
  const color = status === "danger" ? "text-destructive" : status === "warn" ? "text-yellow-400" : "text-success";
  const Icon = status === "danger" ? ShieldAlert : status === "warn" ? AlertTriangle : ShieldCheck;
  return (
    <Card>
      <CardContent className="pt-5 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
          <Icon className={cn("w-4 h-4", color)} />
        </div>
        {loading ? <Skeleton className="h-8 w-24" /> : <p className={cn("text-2xl font-bold", color)}>{value}</p>}
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function ResultBox({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("text-xl font-bold", valueColor)}>{value}</p>
    </div>
  );
}
