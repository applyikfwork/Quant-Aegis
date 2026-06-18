import { useState } from "react";
import {
  useListExperiments,
  useCreateExperiment,
  useListStrategies,
  getListExperimentsQueryKey,
  getListStrategiesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FlaskConical, Plus, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === "approved") return <Badge className="bg-success/20 text-success border-success/30"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>;
  if (verdict === "rejected") return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
  return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
}

export default function Research() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [hypothesis, setHypothesis] = useState("");
  const [strategyId, setStrategyId] = useState<string>("");
  const [testPeriod, setTestPeriod] = useState("");
  const [notes, setNotes] = useState("");

  const { data: experiments, isLoading } = useListExperiments({ query: { queryKey: getListExperimentsQueryKey() } });
  const { data: strategies } = useListStrategies({ query: { queryKey: getListStrategiesQueryKey() } });

  const { mutate: createExperiment, isPending: creating } = useCreateExperiment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExperimentsQueryKey() });
        setShowForm(false);
        setHypothesis("");
        setStrategyId("");
        setTestPeriod("");
        setNotes("");
      },
    },
  });

  const experimentList = experiments ?? [];
  const approved = experimentList.filter((e) => e.verdict === "approved").length;
  const rejected = experimentList.filter((e) => e.verdict === "rejected").length;
  const pending = experimentList.filter((e) => e.verdict === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-primary" />
            Research Center
          </h1>
          <p className="text-sm text-muted-foreground">Strategy experiments, hypotheses, and improvement tracking</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          New Experiment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Experiments", value: experimentList.length },
          { label: "Approved", value: approved, color: "text-success" },
          { label: "Rejected", value: rejected, color: "text-destructive" },
          { label: "Pending", value: pending, color: "text-yellow-400" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Experiment Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>New Experiment</CardTitle>
            <CardDescription>Document a strategy improvement hypothesis to test</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Hypothesis *</Label>
              <Textarea
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                placeholder="e.g. Adding an ATR volatility filter will reduce false breakout entries during low-volatility periods"
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Strategy (optional)</Label>
                <Select value={strategyId} onValueChange={setStrategyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific strategy</SelectItem>
                    {(strategies ?? []).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Test Period</Label>
                <Input value={testPeriod} onChange={(e) => setTestPeriod(e.target.value)} placeholder="e.g. 2022-2024" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional context or expected outcome" rows={2} />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => createExperiment({
                  data: {
                    hypothesis,
                    strategyId: strategyId && strategyId !== "none" ? parseInt(strategyId) : undefined,
                    testPeriod: testPeriod || undefined,
                    notes: notes || undefined,
                    verdict: "pending",
                  }
                })}
                disabled={creating || !hypothesis.trim()}
              >
                {creating ? "Saving…" : "Save Experiment"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Experiment List */}
      <Card>
        <CardHeader>
          <CardTitle>Experiment Log</CardTitle>
          <CardDescription>All strategy improvement experiments — {experimentList.length} total</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : experimentList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No experiments yet — add your first strategy improvement hypothesis</p>
            </div>
          ) : (
            <div className="space-y-3">
              {experimentList.map((e) => {
                const result = e.backtestResult as Record<string, unknown> | null;
                const stratName = (strategies ?? []).find((s) => s.id === e.strategyId)?.name;
                return (
                  <div key={e.id} className="p-4 rounded-lg border border-border bg-muted/20 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{e.hypothesis}</p>
                        {stratName && <p className="text-xs text-muted-foreground mt-0.5">Strategy: {stratName}</p>}
                        {e.testPeriod && <p className="text-xs text-muted-foreground">Period: {e.testPeriod}</p>}
                      </div>
                      <VerdictBadge verdict={e.verdict} />
                    </div>
                    {result && Object.keys(result).length > 0 && (
                      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                        {Object.entries(result).map(([k, v]) => (
                          <span key={k}><span className="capitalize">{k.replace(/_/g, " ")}</span>: <span className="font-medium text-foreground">{String(v)}</span></span>
                        ))}
                      </div>
                    )}
                    {e.notes && <p className="text-xs text-muted-foreground italic">{e.notes}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
