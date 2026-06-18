import { useListAiFeedback, useListAiDecisions, getListAiFeedbackQueryKey, getListAiDecisionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap, CheckCircle2, XCircle, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Learning() {
  const { data: feedback, isLoading: loadingFeedback } = useListAiFeedback({ query: { queryKey: getListAiFeedbackQueryKey() } });
  const { data: decisions, isLoading: loadingDecisions } = useListAiDecisions({ query: { queryKey: getListAiDecisionsQueryKey() } });

  const feedbackList = feedback ?? [];
  const totalFeedback = feedbackList.length;
  const correct = feedbackList.filter((f) => f.correct).length;
  const incorrect = feedbackList.filter((f) => f.correct === false).length;
  const accuracyRate = totalFeedback > 0 ? Math.round((correct / totalFeedback) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-primary" />
          Learning Center
        </h1>
        <p className="text-sm text-muted-foreground">AI improvement history — mistakes, lessons, and correction tracking</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Feedback", value: totalFeedback, loading: loadingFeedback },
          { label: "Correct Predictions", value: correct, color: "text-success", loading: loadingFeedback },
          { label: "Incorrect Predictions", value: incorrect, color: "text-destructive", loading: loadingFeedback },
          { label: "Prediction Accuracy", value: `${accuracyRate}%`, color: accuracyRate >= 65 ? "text-success" : "text-yellow-400", loading: loadingFeedback },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
              {s.loading ? <Skeleton className="h-8 w-16" /> : <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lessons Learned */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Lessons Learned
          </CardTitle>
          <CardDescription>Post-trade feedback and extracted lessons from every AI decision</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingFeedback ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : feedbackList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No feedback yet — lessons appear after trades close and AI decisions are reviewed</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedbackList.map((f) => (
                <div key={f.id} className="p-4 rounded-lg border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {f.correct ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                      <span className="text-sm font-medium">
                        Predicted: <span className="font-bold">{f.prediction}</span>
                      </span>
                      <span className="text-muted-foreground text-sm">→</span>
                      <span className="text-sm">
                        Actual: <span className="font-bold">{f.actualResult ?? "Pending"}</span>
                      </span>
                    </div>
                    <Badge variant={f.correct ? "default" : "destructive"} className="text-xs">
                      {f.correct === null ? "Pending" : f.correct ? "Correct" : "Incorrect"}
                    </Badge>
                  </div>
                  {f.lesson && (
                    <div className="flex items-start gap-2 p-2 rounded bg-muted/40">
                      <BookOpen className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <p className="text-xs">{f.lesson}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision log */}
      <Card>
        <CardHeader>
          <CardTitle>AI Decision Log</CardTitle>
          <CardDescription>All AI decisions — {decisions?.length ?? 0} recorded</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDecisions ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !decisions?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">No decisions recorded yet</p>
          ) : (
            <div className="space-y-2">
              {decisions.slice(0, 20).map((d) => {
                const reasoning = d.reasoning as Record<string, string[]>;
                return (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/10">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">{d.symbol}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-xs font-bold", d.decision === "BUY" ? "text-success" : d.decision === "SELL" ? "text-destructive" : "text-yellow-400")}
                      >
                        {d.decision}
                      </Badge>
                      {reasoning?.summary && <span className="text-xs text-muted-foreground hidden sm:block">{reasoning.summary}</span>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn("text-sm font-bold", d.confidence >= 80 ? "text-success" : d.confidence >= 65 ? "text-yellow-400" : "text-destructive")}>
                        {d.confidence}%
                      </span>
                      <p className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</p>
                    </div>
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
