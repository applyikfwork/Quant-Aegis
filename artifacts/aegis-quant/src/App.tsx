import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

// Pages
import Dashboard from "@/pages/dashboard";
import Market from "@/pages/market";
import Strategies from "@/pages/strategies";
import Signals from "@/pages/signals";
import Trades from "@/pages/trades";
import Analytics from "@/pages/analytics";
import Backtests from "@/pages/backtests";
import SystemMonitor from "@/pages/system";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/market" component={Market} />
        <Route path="/strategies" component={Strategies} />
        <Route path="/signals" component={Signals} />
        <Route path="/trades" component={Trades} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/backtests" component={Backtests} />
        <Route path="/system" component={SystemMonitor} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
