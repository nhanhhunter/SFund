import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import { UserPreferencesProvider } from "@/components/UserPreferencesProvider";
import Dashboard from "@/pages/Dashboard";
import StocksPage from "@/pages/StocksPage";
import GoldPage from "@/pages/GoldPage";
import OilPage from "@/pages/OilPage";
import CryptoPage from "@/pages/CryptoPage";
import PortfolioPage from "@/pages/PortfolioPage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import SettingsPage from "@/pages/SettingsPage";
import TermsOfUsePage from "@/pages/TermsOfUsePage";
import WatchlistPage from "@/pages/WatchlistPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/stocks" component={StocksPage} />
        <Route path="/gold" component={GoldPage} />
        <Route path="/oil" component={OilPage} />
        <Route path="/crypto" component={CryptoPage} />
        <Route path="/portfolio" component={PortfolioPage} />
        <Route path="/watchlist" component={WatchlistPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/privacy-policy" component={PrivacyPolicyPage} />
        <Route path="/terms-of-use" component={TermsOfUsePage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UserPreferencesProvider>
          <Toaster />
          <Router />
        </UserPreferencesProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
