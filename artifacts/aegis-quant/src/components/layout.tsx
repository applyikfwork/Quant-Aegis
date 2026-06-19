import { Link, useLocation } from "wouter";
import {
  Activity,
  BarChart2,
  Bell,
  Brain,
  Briefcase,
  FlaskConical,
  GraduationCap,
  LineChart,
  Map,
  Settings,
  Shield,
  ShieldCheck,
  Signal,
  Target,
  Terminal,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  // ── CORE ─────────────────────────────
  { href: "/", label: "Dashboard", icon: Activity, group: "Core" },
  { href: "/market", label: "Market Data", icon: LineChart, group: "Core" },
  // ── INTELLIGENCE ─────────────────────
  { href: "/ai", label: "AI Center", icon: Brain, group: "Intelligence" },
  { href: "/signals", label: "Signals Feed", icon: Signal, group: "Intelligence" },
  { href: "/learning", label: "Learning Center", icon: GraduationCap, group: "Intelligence" },
  { href: "/notifications", label: "Notifications", icon: Bell, group: "Intelligence" },
  // ── TRADING ──────────────────────────
  { href: "/trades", label: "Trade Journal", icon: BarChart2, group: "Trading" },
  { href: "/paper-trading", label: "Paper Trading", icon: ClipboardList, group: "Trading" },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase, group: "Trading" },
  { href: "/risk", label: "Risk Center", icon: ShieldCheck, group: "Trading" },
  // ── RESEARCH ─────────────────────────
  { href: "/strategies", label: "Strategies", icon: Target, group: "Research" },
  { href: "/backtests", label: "Backtesting", icon: Terminal, group: "Research" },
  { href: "/analytics", label: "Analytics", icon: BarChart2, group: "Research" },
  { href: "/research", label: "Research Lab", icon: FlaskConical, group: "Research" },
  // ── SYSTEM ───────────────────────────
  { href: "/system", label: "System Monitor", icon: Settings, group: "System" },
  // ── HELP ─────────────────────────────
  { href: "/guidance", label: "Guidance Center", icon: Map, group: "Help" },
];

const GROUPS = ["Core", "Intelligence", "Trading", "Research", "System", "Help"];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground selection:bg-primary/30">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-sidebar flex flex-col hidden md:flex shrink-0">
        <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
          <Shield className="w-5 h-5 text-primary mr-2" />
          <span className="font-bold text-sm tracking-widest text-sidebar-primary-foreground uppercase">
            AEGIS QUANT AI
          </span>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          <nav className="px-2 space-y-4">
            {GROUPS.map((group) => {
              const items = NAV_ITEMS.filter((i) => i.group === group);
              return (
                <div key={group}>
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {group}
                  </p>
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const isActive = location === item.href;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center px-3 py-2 text-sm rounded-md transition-colors",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <Icon className="w-4 h-4 mr-3 shrink-0 opacity-70" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-border shrink-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>v0.3.0-alpha</span>
            <span className="flex items-center text-success">
              <span className="w-2 h-2 rounded-full bg-success mr-2 animate-pulse" />
              Connected
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-border flex items-center px-4 bg-background shrink-0 md:hidden">
          <Shield className="w-5 h-5 text-primary mr-2" />
          <span className="font-bold text-sm tracking-widest text-foreground uppercase">
            AEGIS QUANT AI
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
