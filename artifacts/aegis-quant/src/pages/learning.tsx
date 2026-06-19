import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  GraduationCap, Brain, Star, Flame, Trophy, BookOpen, Target, Zap,
  CheckCircle2, Clock, BarChart2, AlertTriangle, TrendingUp,
  ChevronRight, Play, Lock, Award, RefreshCw, Lightbulb,
  MessageSquare, XCircle, Activity, Layers, ChevronDown, ChevronUp,
  ArrowUpRight, Info, AlertCircle, Sparkles, Timer, Eye,
  DollarSign, Gauge, Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Profile = {
  level: string; tradingIQ: number; skillRating: number; streak: number;
  longestStreak: number; totalLessonsCompleted: number; totalSimulations: number;
  totalQuizzes: number; quizAccuracy: number; practicalAccuracy: number;
  totalStudyMinutes: number; weeklyStudyMinutes: number; currentGoal: string;
  weakestSkill: string; strongestSkill: string; estimatedDaysToNextLevel: number;
  xpTotal: number; xpToNextLevel: number;
  weeklyProgress: { day: string; minutes: number }[];
  certificates: { id: string; title: string; earnedAt: string; score: number; hours: number; practicalScore: number }[];
};
type Lesson = { id: string; title: string; duration: number; completed: boolean; type: string; difficulty: number };
type LearningPath = {
  id: string; title: string; level: string; description: string; icon: string;
  color: string; estimatedHours: number; completedPct: number;
  skills: string[]; lessons: Lesson[];
  totalLessons: number; completedLessons: number; nextLesson: Lesson | null;
};
type Skill = {
  id: string; name: string; category: string; overall: number;
  knowledge: number; practical: number; consistency: number; confidence: number;
  improvementRate: number;
};
type MentorMessage = {
  id: string; type: string; priority: string; title: string; content: string;
  action: string; actionLink: string | null; relatedSkill: string;
  createdAt: string; read: boolean;
};
type Achievement = {
  id: string; title: string; description: string; icon: string; category: string;
  earned: boolean; earnedAt: string | null; xp: number; rarity: string;
};
type Mistake = {
  id: string; type: string; description: string; frequency: number;
  severity: string; financialCost: number; recovering: boolean; recommendation: string;
};
type QuizQuestion = {
  id: string; skill: string; difficulty: number; type: string;
  question: string; options: string[]; explanation?: string; _answer?: number;
};
type Recommendation = {
  priority: number; type: string; title: string; reason: string;
  path: string | null; lessonId: string | null; estimatedMinutes: number; urgency: string;
};
type Analytics = {
  quizTrend: { attempt: number; score: number; date: string }[];
  skillProgress: { skill: string; startScore: number; currentScore: number }[];
  studyHeatmap: { date: string; minutes: number }[];
  topicRetention: { topic: string; retention: number }[];
  sessionsLast30: number; avgSessionMin: number;
  dropOffRate: number; retentionRate: number;
};

// ─── API ──────────────────────────────────────────────────────────────────────
const BASE = "/api/learning";
const apiFetch = (path: string) => fetch(path).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
const apiPost = (path: string, body: unknown) => fetch(path, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}).then(r => r.json());

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function relTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
}
function fmtMin(m: number) {
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60 > 0 ? `${m % 60}m` : ""}`.trim();
}
function scoreColor(n: number) {
  return n >= 75 ? "text-emerald-400" : n >= 50 ? "text-yellow-400" : "text-red-400";
}
function scoreBar(n: number) {
  return n >= 75 ? "bg-emerald-500" : n >= 50 ? "bg-yellow-500" : "bg-red-500";
}
function difficultyDots(d: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={cn("w-1.5 h-1.5 rounded-full inline-block", i < d ? "bg-primary" : "bg-muted/30")} />
  ));
}

const LEVEL_COLORS: Record<string, string> = {
  Beginner: "text-emerald-400 border-emerald-500/30",
  Intermediate: "text-blue-400 border-blue-500/30",
  Advanced: "text-purple-400 border-purple-500/30",
  Expert: "text-orange-400 border-orange-500/30",
};
const URGENCY_COLORS: Record<string, string> = {
  critical: "text-red-400 border-red-500/30",
  high: "text-orange-400 border-orange-500/30",
  medium: "text-yellow-400 border-yellow-500/30",
  low: "text-muted-foreground border-border",
};
const TYPE_ICONS: Record<string, React.ElementType> = {
  theory: BookOpen, practical: Target, simulation: Activity,
  quiz: Brain, replay: RefreshCw, lesson: BookOpen,
};
const RARITY_COLORS: Record<string, string> = {
  Common: "text-muted-foreground", Uncommon: "text-emerald-400",
  Rare: "text-blue-400", Epic: "text-purple-400", Legendary: "text-orange-400",
};
const SEVERITY_BG: Record<string, string> = {
  Critical: "border-red-500/30 bg-red-500/5",
  High: "border-orange-500/30 bg-orange-500/5",
  Medium: "border-yellow-500/30 bg-yellow-500/5",
};
const SEVERITY_TEXT: Record<string, string> = {
  Critical: "text-red-400", High: "text-orange-400", Medium: "text-yellow-400",
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, valueClass, bg }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; valueClass?: string; bg?: string;
}) {
  return (
    <div className={cn("rounded-xl border p-4 space-y-1.5", bg ?? "bg-muted/10 border-border")}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="text-xs text-muted-foreground leading-tight">{label}</span>
      </div>
      <div className={cn("text-xl font-black tabular-nums leading-none", valueClass ?? "")}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ─── SKILL METER ──────────────────────────────────────────────────────────────
function SkillMeter({ label, value, compact }: { label: string; value: number; compact?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className={cn("text-muted-foreground", compact ? "text-[10px]" : "text-xs")}>{label}</span>
        <span className={cn("font-bold tabular-nums", compact ? "text-[10px]" : "text-xs", scoreColor(value))}>{value}</span>
      </div>
      <div className={cn("rounded-full bg-muted/30 overflow-hidden", compact ? "h-1" : "h-1.5")}>
        <div className={cn("h-full rounded-full transition-all", scoreBar(value))} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardTab({ profile, recs, mentor }: {
  profile: Profile;
  recs: Recommendation[];
  mentor: { messages: MentorMessage[]; unread: number } | undefined;
}) {
  const xpPct = profile.xpToNextLevel > 0 ? Math.min((profile.xpTotal / profile.xpToNextLevel) * 100, 100) : 0;
  const maxBarMin = 90;

  return (
    <div className="space-y-4">
      {/* Hero stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <StatCard icon={GraduationCap} label="Level" value={profile.level} bg="bg-primary/5 border-primary/20" />
        <StatCard icon={Brain} label="Trading IQ" value={profile.tradingIQ} valueClass={scoreColor(profile.tradingIQ)} sub="out of 100" />
        <StatCard icon={Star} label="Skill Rating" value={profile.skillRating} valueClass={scoreColor(profile.skillRating)} />
        <StatCard icon={Flame} label="Streak" value={`${profile.streak}d`} valueClass="text-orange-400" sub={`Best: ${profile.longestStreak}d`} />
        <StatCard icon={BookOpen} label="Lessons Done" value={profile.totalLessonsCompleted} sub="total completed" />
        <StatCard icon={Brain} label="Quiz Accuracy" value={`${profile.quizAccuracy}%`} valueClass={scoreColor(profile.quizAccuracy)} />
        <StatCard icon={Timer} label="Study Time" value={fmtMin(profile.weeklyStudyMinutes)} sub="this week" />
        <StatCard icon={Zap} label="XP" value={profile.xpTotal.toLocaleString()} sub={`${profile.xpToNextLevel.toLocaleString()} to next`} />
      </div>

      {/* XP bar */}
      <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress to {profile.level === "Intermediate" ? "Advanced" : "Expert"} Level</span>
          <span className="font-semibold tabular-nums">{profile.xpTotal.toLocaleString()} / {profile.xpToNextLevel.toLocaleString()} XP</span>
        </div>
        <div className="h-3 rounded-full bg-muted/30 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-blue-500 transition-all" style={{ width: `${xpPct}%` }} />
        </div>
        <div className="text-[11px] text-muted-foreground">~{profile.estimatedDaysToNextLevel} days at current pace</div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" />Current Goal</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <p className="text-sm">{profile.currentGoal}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                Weakest: <span className="text-orange-400 font-medium capitalize">{profile.weakestSkill.replace("_", " ")}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Star className="w-3.5 h-3.5 text-emerald-400" />
                Strongest: <span className="text-emerald-400 font-medium capitalize">{profile.strongestSkill.replace("_", " ")}</span>
              </div>
            </CardContent>
          </Card>

          {/* Weekly bars */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" />Weekly Study</CardTitle>
              <CardDescription className="text-xs">{fmtMin(profile.weeklyStudyMinutes)} total this week</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-end gap-1.5 h-20">
                {profile.weeklyProgress.map(({ day, minutes }) => {
                  const pct = maxBarMin > 0 ? (minutes / maxBarMin) * 100 : 0;
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center" style={{ height: 64 }}>
                        <div
                          className={cn("w-full rounded-t-sm transition-all", minutes > 0 ? "bg-primary/70" : "bg-muted/20")}
                          style={{ height: `${Math.max(pct, minutes > 0 ? 8 : 4)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{day}</span>
                      {minutes > 0 && <span className="text-[8px] text-primary/70">{minutes}m</span>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {profile.certificates.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2"><Award className="w-4 h-4 text-primary" />Certificates</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {profile.certificates.map(c => (
                  <div key={c.id} className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{c.title}</span>
                      <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Certified</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                      <div><div className="text-muted-foreground">Score</div><div className="font-bold text-emerald-400">{c.score}%</div></div>
                      <div><div className="text-muted-foreground">Practical</div><div className="font-bold">{c.practicalScore}%</div></div>
                      <div><div className="text-muted-foreground">Hours</div><div className="font-bold">{c.hours}h</div></div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{relTime(c.earnedAt)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Center — AI recommendations */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />AI Recommendations
                <Badge variant="outline" className="text-[10px] text-primary border-primary/30 ml-auto">Personalized</Badge>
              </CardTitle>
              <CardDescription className="text-xs">Based on trading behavior, mistakes, and skill gaps</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {recs.map((rec, i) => {
                const TypeIcon = TYPE_ICONS[rec.type] ?? BookOpen;
                const isCritical = rec.urgency === "critical";
                return (
                  <div key={i} className={cn(
                    "p-3 rounded-xl border space-y-1.5 cursor-pointer transition-all hover:border-primary/30",
                    isCritical ? "bg-red-500/3 border-red-500/20" : "bg-muted/10 border-border"
                  )}>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-lg bg-muted/40 flex items-center justify-center shrink-0 mt-0.5">
                        <TypeIcon className="w-3 h-3 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold">{rec.title}</span>
                          <Badge variant="outline" className={cn("text-[9px] shrink-0 capitalize", URGENCY_COLORS[rec.urgency])}>{rec.urgency}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{rec.reason}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{rec.estimatedMinutes}m</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right — Mentor + mistakes */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />AI Mentor
                {mentor && mentor.unread > 0 && (
                  <Badge className="text-[10px] ml-auto bg-red-500 text-white">{mentor.unread} new</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {mentor?.messages.slice(0, 3).map(msg => {
                const typeIcon = msg.type === "warning"
                  ? <AlertTriangle className="w-3 h-3 text-orange-400" />
                  : msg.type === "achievement" ? <Trophy className="w-3 h-3 text-yellow-400" />
                  : msg.type === "insight" ? <Lightbulb className="w-3 h-3 text-blue-400" />
                  : <Info className="w-3 h-3 text-primary" />;
                return (
                  <div key={msg.id} className={cn("p-3 rounded-xl border space-y-1.5", !msg.read ? "border-primary/30 bg-primary/3" : "border-border bg-muted/10")}>
                    <div className="flex items-center gap-2">
                      {typeIcon}
                      <span className="text-xs font-semibold flex-1 min-w-0 truncate">{msg.title}</span>
                      {!msg.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{msg.content}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">{relTime(msg.createdAt)}</span>
                      {msg.action && <span className="text-[10px] text-primary font-medium cursor-pointer hover:underline">{msg.action} →</span>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-400" />Top Mistakes</CardTitle>
              <CardDescription className="text-xs">AI-detected from paper trading</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {[
                { type: "Stop Loss", freq: 27, cost: 1240, icon: "🚫" },
                { type: "Low RR", freq: 22, cost: 870, icon: "📉" },
                { type: "Late Entry", freq: 18, cost: 420, icon: "⏰" },
              ].map(({ type, freq, cost, icon }) => (
                <div key={type} className="flex items-center gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/15">
                  <span className="text-base">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">{type}</div>
                    <div className="text-[10px] text-muted-foreground">{freq}× detected</div>
                  </div>
                  <span className="text-xs text-red-400 font-bold tabular-nums shrink-0">-${cost}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── COURSES ──────────────────────────────────────────────────────────────────
function CoursesTab({ paths }: { paths: LearningPath[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const sel = selected ? paths.find(p => p.id === selected) : null;

  const PROG_COLORS: Record<string, string> = {
    emerald: "bg-emerald-500", blue: "bg-blue-500", yellow: "bg-yellow-500",
    red: "bg-red-500", purple: "bg-purple-500", cyan: "bg-cyan-500", orange: "bg-orange-500",
  };

  return (
    <div className={cn("grid gap-4", sel ? "lg:grid-cols-2" : "lg:grid-cols-3 xl:grid-cols-4")}>
      {paths.map(path => {
        const isSelected = selected === path.id;
        const isLocked = path.completedPct === 0 && path.level === "Expert";
        return (
          <div
            key={path.id}
            onClick={() => setSelected(isSelected ? null : path.id)}
            className={cn(
              "rounded-xl border p-4 cursor-pointer transition-all space-y-3 hover:border-primary/30",
              isSelected ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border bg-muted/10",
              isLocked ? "opacity-60" : "",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{path.icon}</span>
                <div>
                  <div className="font-semibold text-sm leading-tight">{path.title}</div>
                  <Badge variant="outline" className={cn("text-[10px] mt-0.5", LEVEL_COLORS[path.level])}>{path.level}</Badge>
                </div>
              </div>
              {isLocked ? <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                : path.completedPct === 100 ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                : isSelected ? <ChevronUp className="w-4 h-4 text-primary shrink-0" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
            </div>

            <p className="text-[11px] text-muted-foreground line-clamp-2">{path.description}</p>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">{path.completedLessons}/{path.totalLessons} lessons</span>
                <span className={cn("font-bold", path.completedPct === 100 ? "text-emerald-400" : "")}>{path.completedPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", PROG_COLORS[path.color] ?? "bg-primary")} style={{ width: `${path.completedPct}%` }} />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{path.estimatedHours}h</span>
              {path.nextLesson && <span className="text-primary truncate max-w-[130px]">Next: {path.nextLesson.title}</span>}
            </div>
          </div>
        );
      })}

      {sel && (
        <div className="lg:col-span-2">
          <Card className="border-primary/20 sticky top-4">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="text-lg">{sel.icon}</span>{sel.title}
                <Badge variant="outline" className={cn("text-[10px] ml-auto", LEVEL_COLORS[sel.level])}>{sel.level}</Badge>
              </CardTitle>
              <CardDescription className="text-xs">{sel.description}</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {sel.lessons.map((lesson, i) => {
                const TypeIcon = TYPE_ICONS[lesson.type] ?? BookOpen;
                const locked = !lesson.completed && i > 0 && !sel.lessons[i - 1].completed;
                return (
                  <div key={lesson.id} className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border transition-all",
                    lesson.completed ? "border-emerald-500/20 bg-emerald-500/3"
                      : locked ? "border-border/40 bg-muted/5 opacity-50"
                      : "border-primary/20 bg-primary/3 cursor-pointer hover:border-primary/40"
                  )}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border border-current/20">
                      {lesson.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        : locked ? <Lock className="w-3 h-3 text-muted-foreground" />
                        : <Play className="w-3 h-3 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm font-medium", lesson.completed ? "text-muted-foreground line-through" : "")}>{lesson.title}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <TypeIcon className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground capitalize">{lesson.type}</span>
                        <span className="text-[10px] text-muted-foreground">· {lesson.duration}m</span>
                        <span className="flex gap-0.5 ml-1">{difficultyDots(lesson.difficulty)}</span>
                      </div>
                    </div>
                    {!lesson.completed && !locked && (
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1 border-primary/30 text-primary hover:bg-primary/10 shrink-0">
                        <Play className="w-3 h-3" />Start
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── SKILLS ───────────────────────────────────────────────────────────────────
function SkillsTab({ skills }: { skills: Skill[] }) {
  const [category, setCategory] = useState("All");
  const categories = ["All", ...Array.from(new Set(skills.map(s => s.category)))];
  const filtered = category === "All" ? skills : skills.filter(s => s.category === category);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {categories.map(c => (
          <Button key={c} size="sm" variant={category === c ? "default" : "outline"} className="text-xs h-7 rounded-lg" onClick={() => setCategory(c)}>{c}</Button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(skill => (
          <div key={skill.id} className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">{skill.name}</div>
                <Badge variant="outline" className="text-[10px] mt-0.5">{skill.category}</Badge>
              </div>
              <div className="text-right">
                <div className={cn("text-2xl font-black tabular-nums", scoreColor(skill.overall))}>{skill.overall}</div>
                <div className="text-[10px] text-muted-foreground">overall</div>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { l: "Knowledge", v: skill.knowledge },
                { l: "Practical", v: skill.practical },
                { l: "Consistency", v: skill.consistency },
                { l: "Confidence", v: skill.confidence },
              ].map(({ l, v }) => <SkillMeter key={l} label={l} value={v} compact />)}
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Improvement rate</span>
              <span className="text-emerald-400 font-semibold">+{skill.improvementRate}%/mo</span>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" />Full Skill Matrix</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {["Skill", "Category", "Knowledge", "Practical", "Consistency", "Confidence", "Overall", "Trend"].map(h => (
                  <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {skills.map(s => (
                <tr key={s.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                  <td className="py-2 px-2 font-medium">{s.name}</td>
                  <td className="py-2 px-2 text-muted-foreground">{s.category}</td>
                  {[s.knowledge, s.practical, s.consistency, s.confidence].map((v, i) => (
                    <td key={i} className={cn("py-2 px-2 font-bold tabular-nums", scoreColor(v))}>{v}</td>
                  ))}
                  <td className={cn("py-2 px-2 font-black tabular-nums", scoreColor(s.overall))}>{s.overall}</td>
                  <td className="py-2 px-2 text-emerald-400 font-medium">+{s.improvementRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── AI MENTOR ────────────────────────────────────────────────────────────────
function MentorTab({ mentor }: {
  mentor: {
    messages: MentorMessage[];
    unread: number;
    profile: { name: string; level: string; specializations: string[]; sessionsCount: number; topicsExplained: number; lastSession: string };
  };
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const msgCfg = {
    insight: { icon: Lightbulb, color: "text-blue-400", bg: "bg-blue-500/5 border-blue-500/20", label: "Insight" },
    recommendation: { icon: ChevronRight, color: "text-primary", bg: "bg-primary/5 border-primary/20", label: "Recommendation" },
    warning: { icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/5 border-orange-500/20", label: "Warning" },
    achievement: { icon: Trophy, color: "text-yellow-400", bg: "bg-yellow-500/5 border-yellow-500/20", label: "Achievement" },
  } as const;

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="space-y-4">
        <Card className="border-primary/20 bg-primary/3">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-blue-500/30 border border-primary/30 flex items-center justify-center">
                <Brain className="w-9 h-9 text-primary" />
              </div>
              <div>
                <div className="font-bold text-lg">{mentor.profile.name}</div>
                <Badge variant="outline" className="text-[11px] text-primary border-primary/30 mt-1">{mentor.profile.level}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              {[
                { l: "Sessions", v: mentor.profile.sessionsCount },
                { l: "Topics", v: mentor.profile.topicsExplained },
                { l: "Last Session", v: relTime(mentor.profile.lastSession) },
                { l: "Status", v: "Active" },
              ].map(({ l, v }) => (
                <div key={l} className="p-2 rounded-lg bg-muted/30 border border-border">
                  <div className="text-muted-foreground">{l}</div>
                  <div className="font-bold mt-0.5">{v}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Specializations</div>
              <div className="flex flex-wrap gap-1">
                {mentor.profile.specializations.map(s => (
                  <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-primary" />Knowledge Graph</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5 text-xs">
            {[
              { from: "EMA", to: "Trend", mastered: true },
              { from: "Trend", to: "Momentum", mastered: true },
              { from: "Momentum", to: "Breakout", mastered: true },
              { from: "Breakout", to: "Volume", mastered: false },
              { from: "Volume", to: "Risk", mastered: false },
              { from: "Risk", to: "Entry / Exit", mastered: false },
            ].map(({ from, to, mastered }) => (
              <div key={from} className="flex items-center gap-2">
                <span className={cn("font-medium w-20 shrink-0", mastered ? "text-emerald-400" : "text-muted-foreground")}>{from}</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className={cn("flex-1", mastered ? "" : "text-muted-foreground/50")}>{to}</span>
                {mastered ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> : <Lock className="w-3 h-3 text-muted-foreground/30 shrink-0" />}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="w-4 h-4 text-primary" />Mentor Messages
          {mentor.unread > 0 && <Badge className="text-[10px] bg-red-500 text-white">{mentor.unread} unread</Badge>}
        </div>

        {mentor.messages.map(msg => {
          const type = msg.type as keyof typeof msgCfg;
          const cfg = msgCfg[type] ?? msgCfg.recommendation;
          const MsgIcon = cfg.icon;
          const isOpen = expanded === msg.id;

          return (
            <div key={msg.id} className={cn("rounded-xl border transition-all", cfg.bg, !msg.read && "ring-1 ring-primary/20")}>
              <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : msg.id)}>
                <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                  <MsgIcon className={cn("w-4 h-4", cfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{msg.title}</span>
                    <Badge variant="outline" className={cn("text-[10px] capitalize border-current/30", cfg.color)}>{cfg.label}</Badge>
                    <Badge variant="outline" className={cn("text-[10px] capitalize", URGENCY_COLORS[msg.priority])}>{msg.priority}</Badge>
                    {!msg.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className={cn("text-muted-foreground mt-1", isOpen ? "text-xs" : "text-[11px] line-clamp-1")}>{msg.content}</p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className="text-[10px] text-muted-foreground">{relTime(msg.createdAt)}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-border/30 pt-3 space-y-3">
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Brain className="w-3.5 h-3.5" />Related skill:
                    <span className="font-medium text-foreground capitalize">{msg.relatedSkill.replace("_", " ")}</span>
                  </div>
                  {msg.action && (
                    <Button size="sm" className="gap-1.5 text-xs h-7">
                      <Play className="w-3 h-3" />{msg.action}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────
function AchievementsTab({ achievements, totalXP, earnedCount }: {
  achievements: Achievement[]; totalXP: number; earnedCount: number;
}) {
  const [filter, setFilter] = useState("All");
  const categories = ["All", "Learning", "Trading", "Consistency", "Courses", "Risk", "Knowledge", "AI"];
  const filtered = filter === "All" ? achievements : achievements.filter(a => a.category === filter);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-muted/10 p-4 text-center space-y-1">
          <Trophy className="w-6 h-6 mx-auto text-yellow-400" />
          <div className="text-2xl font-black text-yellow-400">{totalXP.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Total XP Earned</div>
        </div>
        <div className="rounded-xl border border-border bg-muted/10 p-4 text-center space-y-1">
          <Award className="w-6 h-6 mx-auto text-emerald-400" />
          <div className="text-2xl font-black text-emerald-400">{earnedCount}</div>
          <div className="text-xs text-muted-foreground">Achievements Earned</div>
        </div>
        <div className="rounded-xl border border-border bg-muted/10 p-4 text-center space-y-1">
          <Lock className="w-6 h-6 mx-auto text-muted-foreground" />
          <div className="text-2xl font-black text-muted-foreground">{achievements.length - earnedCount}</div>
          <div className="text-xs text-muted-foreground">Still to Unlock</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {categories.map(c => (
          <Button key={c} size="sm" variant={filter === c ? "default" : "outline"} className="text-xs h-7 rounded-lg" onClick={() => setFilter(c)}>{c}</Button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map(a => (
          <div key={a.id} className={cn(
            "rounded-xl border p-4 space-y-2 transition-all",
            a.earned ? "border-yellow-500/20 bg-yellow-500/3 hover:border-yellow-500/40" : "border-border/40 bg-muted/5 opacity-60"
          )}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-3xl">{a.icon}</span>
              <div className="text-right space-y-1">
                <Badge variant="outline" className={cn("text-[10px] border-current/30", RARITY_COLORS[a.rarity])}>{a.rarity}</Badge>
                <div className="text-[10px] text-yellow-400 font-bold">+{a.xp} XP</div>
              </div>
            </div>
            <div>
              <div className="font-bold text-sm">{a.title}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{a.description}</p>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <Badge variant="outline" className="text-[10px]">{a.category}</Badge>
              {a.earned
                ? <span className="text-emerald-400">{relTime(a.earnedAt!)}</span>
                : <span className="text-muted-foreground flex items-center gap-1"><Lock className="w-2.5 h-2.5" />Locked</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── QUIZ ─────────────────────────────────────────────────────────────────────
function QuizTab({ mistakes }: { mistakes: Mistake[] }) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [results, setResults] = useState<Record<string, { correct: boolean; correctAnswer: number; explanation: string }>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function startQuiz() {
    setLoading(true);
    setAnswers({});
    setResults({});
    try {
      const qs = await apiFetch(`${BASE}/quiz`);
      setQuestions(qs);
    } catch {
      toast({ title: "Failed to load quiz", variant: "destructive" });
    }
    setLoading(false);
  }

  async function submitAnswer(qId: string, answerIdx: number) {
    if (results[qId] !== undefined) return;
    setAnswers(p => ({ ...p, [qId]: answerIdx }));
    const res = await apiPost(`${BASE}/quiz/answer`, { questionId: qId, answer: answerIdx });
    setResults(p => ({ ...p, [qId]: res }));
  }

  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.values(results).filter(r => r.correct).length;
  const total = questions?.length ?? 0;

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        {!questions ? (
          <div className="rounded-xl border border-primary/20 bg-primary/3 p-10 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <div>
              <div className="text-lg font-bold">Adaptive Quiz Engine</div>
              <p className="text-sm text-muted-foreground mt-1">Questions generated from your skill gaps and detected mistakes.<br />Difficulty adapts to your performance.</p>
            </div>
            <Button onClick={startQuiz} disabled={loading} className="gap-2">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Start Quiz Session
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                Quiz — {answeredCount}/{total} answered
                {answeredCount === total && total > 0 && (
                  <Badge className="text-[10px] bg-emerald-500 text-white">{correctCount}/{total} correct ({Math.round(correctCount / total * 100)}%)</Badge>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={startQuiz} className="text-xs gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />New Quiz
              </Button>
            </div>

            {questions.map((q, qi) => {
              const answered = answers[q.id] !== undefined;
              const result = results[q.id];
              return (
                <div key={q.id} className={cn(
                  "rounded-xl border p-4 space-y-3 transition-all",
                  result ? (result.correct ? "border-emerald-500/30 bg-emerald-500/3" : "border-red-500/30 bg-red-500/3") : "border-border bg-muted/10"
                )}>
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-muted/40 flex items-center justify-center text-xs font-bold shrink-0">{qi + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-[10px] capitalize">{q.skill.replace("_", " ")}</Badge>
                        <span className="flex gap-0.5">{difficultyDots(q.difficulty)}</span>
                      </div>
                      <p className="text-sm font-medium">{q.question}</p>
                    </div>
                  </div>
                  <div className="grid gap-1.5 pl-8">
                    {q.options.map((opt, oi) => {
                      const isSelected = answers[q.id] === oi;
                      const isCorrect = result && result.correctAnswer === oi;
                      const isWrong = result && isSelected && !result.correct;
                      return (
                        <button
                          key={oi}
                          onClick={() => submitAnswer(q.id, oi)}
                          disabled={answered}
                          className={cn(
                            "flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-all",
                            isCorrect ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                              : isWrong ? "border-red-500/50 bg-red-500/10 text-red-400"
                              : isSelected ? "border-primary/50 bg-primary/10"
                              : answered ? "border-border/40 opacity-60 cursor-default"
                              : "border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                          )}
                        >
                          <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center shrink-0 text-[10px] font-bold">
                            {String.fromCharCode(65 + oi)}
                          </span>
                          {opt}
                          {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-400 shrink-0" />}
                          {isWrong && <XCircle className="w-3.5 h-3.5 ml-auto text-red-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  {result && (
                    <div className={cn("pl-8 p-3 rounded-lg text-xs border", result.correct ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20")}>
                      <div className={cn("font-semibold mb-1", result.correct ? "text-emerald-400" : "text-red-400")}>
                        {result.correct ? "✓ Correct!" : "✗ Incorrect"}
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{result.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-400" />Mistake Detection Engine</CardTitle>
            <CardDescription className="text-xs">AI-detected recurring patterns from paper trading history</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {mistakes.map(m => (
              <div key={m.id} className={cn("rounded-xl border p-3 space-y-2", SEVERITY_BG[m.severity] ?? "border-border bg-muted/10")}>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-xs font-bold", SEVERITY_TEXT[m.severity])}>{m.type}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={cn("text-[10px] border-current/30", SEVERITY_TEXT[m.severity])}>{m.severity}</Badge>
                    {m.recovering && <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Recovering</Badge>}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">{m.description}</p>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{m.frequency}× detected</span>
                  <span className="text-red-400 font-bold">-${m.financialCost.toLocaleString()}</span>
                </div>
                <div className="p-2 rounded-lg bg-muted/30 text-[11px] text-muted-foreground">
                  <Lightbulb className="w-3 h-3 inline mr-1 text-yellow-400" />{m.recommendation}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
function AnalyticsTab({ analytics }: { analytics: Analytics }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Activity, label: "Sessions (30d)", value: analytics.sessionsLast30 },
          { icon: Timer, label: "Avg Session", value: `${analytics.avgSessionMin}m` },
          { icon: Eye, label: "Retention Rate", value: `${analytics.retentionRate}%`, c: scoreColor(analytics.retentionRate) },
          { icon: Gauge, label: "Drop-off Rate", value: `${analytics.dropOffRate}%`, c: analytics.dropOffRate < 20 ? "text-emerald-400" : "text-red-400" },
        ].map(({ icon: Icon, label, value, c }) => (
          <div key={label} className="rounded-xl border border-border bg-muted/10 p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <div className={cn("text-2xl font-black tabular-nums", c ?? "")}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Quiz trend */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Quiz Score Trend</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-end gap-1 h-28">
              {analytics.quizTrend.map((qt, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] text-primary opacity-0 group-hover:opacity-100 whitespace-nowrap bg-background border border-border rounded px-1 z-10">{qt.score}%</div>
                  <div className="w-full flex items-end" style={{ height: 96 }}>
                    <div className={cn("w-full rounded-t-sm", scoreBar(qt.score))} style={{ height: `${qt.score}%`, opacity: 0.6 + i * 0.04 }} />
                  </div>
                  <span className="text-[8px] text-muted-foreground">{qt.attempt}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground text-center mt-2">Quiz attempt number</div>
          </CardContent>
        </Card>

        {/* Skill progress */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-primary" />Skill Progress vs Start</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {analytics.skillProgress.map(({ skill, startScore, currentScore }) => {
              const gain = currentScore - startScore;
              return (
                <div key={skill} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-32 shrink-0 truncate">{skill}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden relative">
                    <div className="absolute top-0 h-full rounded-full bg-muted/50" style={{ width: `${startScore}%` }} />
                    <div className="absolute top-0 h-full rounded-full bg-emerald-500" style={{ left: `${startScore}%`, width: `${Math.max(gain, 0)}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums w-6 shrink-0">{startScore}</span>
                  <span className="text-xs text-emerald-400 font-bold tabular-nums w-10 shrink-0">→{currentScore}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Topic retention */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><Repeat className="w-4 h-4 text-primary" />Topic Retention</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {analytics.topicRetention.map(({ topic, retention }) => (
              <div key={topic} className="flex items-center gap-3">
                <span className="text-xs w-36 shrink-0">{topic}</span>
                <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div className={cn("h-full rounded-full", scoreBar(retention))} style={{ width: `${retention}%` }} />
                </div>
                <span className={cn("text-xs font-bold tabular-nums w-9 text-right shrink-0", scoreColor(retention))}>{retention}%</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Study heatmap */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><Flame className="w-4 h-4 text-primary" />Study Heatmap (28 days)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-wrap gap-1">
              {analytics.studyHeatmap.map((d, i) => {
                const intensity = d.minutes === 0 ? 0 : d.minutes < 20 ? 1 : d.minutes < 45 ? 2 : d.minutes < 70 ? 3 : 4;
                const colors = ["bg-muted/20", "bg-primary/15", "bg-primary/35", "bg-primary/60", "bg-primary"];
                return (
                  <div
                    key={i}
                    title={`${d.date.slice(5)}: ${d.minutes}m`}
                    className={cn("w-6 h-6 rounded-sm group relative cursor-default", colors[intensity])}
                  >
                    {d.minutes > 0 && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] bg-background border border-border rounded px-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">{d.minutes}m</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
              <span>Less</span>
              {["bg-muted/20","bg-primary/15","bg-primary/35","bg-primary/60","bg-primary"].map((c, i) => (
                <div key={i} className={cn("w-3 h-3 rounded-sm", c)} />
              ))}
              <span>More</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Learning() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const { data: profile, isLoading: profLoading } = useQuery<Profile>({
    queryKey: ["learning", "profile"],
    queryFn: () => apiFetch(`${BASE}/profile`),
    refetchInterval: 60000,
  });
  const { data: paths = [], isLoading: pathsLoading } = useQuery<LearningPath[]>({
    queryKey: ["learning", "paths"],
    queryFn: () => apiFetch(`${BASE}/paths`),
  });
  const { data: skills = [] } = useQuery<Skill[]>({
    queryKey: ["learning", "skills"],
    queryFn: () => apiFetch(`${BASE}/skills`),
  });
  const { data: mentor } = useQuery({
    queryKey: ["learning", "mentor"],
    queryFn: () => apiFetch(`${BASE}/mentor`),
    refetchInterval: 30000,
  });
  const { data: achievData } = useQuery({
    queryKey: ["learning", "achievements"],
    queryFn: () => apiFetch(`${BASE}/achievements`),
  });
  const { data: mistakeData } = useQuery({
    queryKey: ["learning", "mistakes"],
    queryFn: () => apiFetch(`${BASE}/mistakes`),
  });
  const { data: recs = [] } = useQuery<Recommendation[]>({
    queryKey: ["learning", "recommendations"],
    queryFn: () => apiFetch(`${BASE}/recommendations`),
  });
  const { data: analytics } = useQuery<Analytics>({
    queryKey: ["learning", "analytics"],
    queryFn: () => apiFetch(`${BASE}/analytics`),
  });

  const totalLessons = paths.reduce((s, p) => s + p.totalLessons, 0);
  const completedLessons = paths.reduce((s, p) => s + p.completedLessons, 0);
  const unread = mentor?.unread ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-primary" />
            </div>
            Learning Center
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Institutional AI Trading Academy — adaptive, personalized, connected to every module
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {profile && (
            <>
              <Badge variant="outline" className="gap-1.5 text-[11px] text-orange-400 border-orange-500/30">
                <Flame className="w-3 h-3" />{profile.streak}-day streak
              </Badge>
              <Badge variant="outline" className="gap-1.5 text-[11px] text-primary border-primary/30">
                <Star className="w-3 h-3" />{profile.level}
              </Badge>
              <Badge variant="outline" className="text-[11px]">{completedLessons}/{totalLessons} lessons</Badge>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto bg-muted/30 p-1 rounded-xl">
          {[
            { id: "dashboard", label: "Dashboard", icon: BarChart2 },
            { id: "courses", label: "Courses", icon: BookOpen },
            { id: "skills", label: "Skills", icon: Target },
            { id: "mentor", label: "AI Mentor", icon: Brain, badge: unread },
            { id: "quiz", label: "Quiz & Mistakes", icon: Zap },
            { id: "achievements", label: "Achievements", icon: Trophy },
            { id: "analytics", label: "Analytics", icon: Activity },
          ].map(({ id, label, icon: Icon, badge }) => (
            <TabsTrigger key={id} value={id} className="text-xs gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Icon className="w-3.5 h-3.5" />{label}
              {badge && badge > 0 ? (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">{badge}</span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          {profLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : profile ? (
            <DashboardTab profile={profile} recs={recs} mentor={mentor} />
          ) : null}
        </TabsContent>

        <TabsContent value="courses" className="mt-4">
          {pathsLoading ? (
            <div className="grid grid-cols-3 gap-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
          ) : (
            <CoursesTab paths={paths} />
          )}
        </TabsContent>

        <TabsContent value="skills" className="mt-4">
          <SkillsTab skills={skills} />
        </TabsContent>

        <TabsContent value="mentor" className="mt-4">
          {mentor ? <MentorTab mentor={mentor} /> : <Skeleton className="h-96 rounded-xl" />}
        </TabsContent>

        <TabsContent value="quiz" className="mt-4">
          <QuizTab mistakes={mistakeData?.mistakes ?? []} />
        </TabsContent>

        <TabsContent value="achievements" className="mt-4">
          {achievData ? (
            <AchievementsTab
              achievements={achievData.achievements}
              totalXP={achievData.totalXP}
              earnedCount={achievData.earnedCount}
            />
          ) : <Skeleton className="h-96 rounded-xl" />}
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          {analytics ? <AnalyticsTab analytics={analytics} /> : <Skeleton className="h-96 rounded-xl" />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
