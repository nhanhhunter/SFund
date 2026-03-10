import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  TrendingUp,
  CircleDollarSign,
  Droplets,
  Bitcoin,
  Star,
  Moon,
  Sun,
  Menu,
  X,
  BarChart3,
  Settings,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type NavItemDef = { href: string; label: string; iconKey: string };

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  portfolio: BarChart3,
  watchlist: Star,
  dashboard: LayoutDashboard,
  stocks: TrendingUp,
  gold: CircleDollarSign,
  oil: Droplets,
  crypto: Bitcoin,
};

const DEFAULT_NAV_ITEMS: NavItemDef[] = [
  { href: "/portfolio", label: "Danh mục", iconKey: "portfolio" },
  { href: "/watchlist", label: "Theo dõi", iconKey: "watchlist" },
  { href: "/", label: "Tổng quan", iconKey: "dashboard" },
  { href: "/stocks", label: "Cổ phiếu", iconKey: "stocks" },
  { href: "/gold", label: "Vàng", iconKey: "gold" },
  { href: "/oil", label: "Dầu thô", iconKey: "oil" },
  { href: "/crypto", label: "Crypto", iconKey: "crypto" },
];

function useLocalStorage<T>(key: string, def: T) {
  const [v, setV] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; }
  });
  const set = (val: T) => { setV(val); try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
  return [v, set] as const;
}

function SidebarSettingsModal({ items, hidden, onReorder, onToggleHidden, onClose }: {
  items: NavItemDef[];
  hidden: string[];
  onReorder: (items: NavItemDef[]) => void;
  onToggleHidden: (href: string) => void;
  onClose: () => void;
}) {
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...items];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onReorder(next);
  };
  const moveDown = (idx: number) => {
    if (idx === items.length - 1) return;
    const next = [...items];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onReorder(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-card-border rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">Tùy chỉnh menu</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Sắp xếp thứ tự và ẩn/hiện các mục trong menu</p>
        <div className="space-y-1 mb-4">
          {items.map((item, idx) => {
            const Icon = ICON_MAP[item.iconKey];
            const isHidden = hidden.includes(item.href);
            return (
              <div
                key={item.href}
                className={cn("flex items-center gap-2 px-2 py-2 rounded-xl border transition-colors", isHidden ? "bg-muted/50 border-transparent opacity-60" : "bg-muted/30 border-transparent")}
              >
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className={cn("flex-1 text-sm", isHidden && "line-through text-muted-foreground")}>{item.label}</span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="p-1 rounded hover:bg-muted disabled:opacity-20"
                    data-testid={`btn-nav-up-${item.iconKey}`}
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === items.length - 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-20"
                    data-testid={`btn-nav-down-${item.iconKey}`}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onToggleHidden(item.href)}
                    className="p-1 rounded hover:bg-muted"
                    data-testid={`btn-nav-toggle-${item.iconKey}`}
                  >
                    {isHidden ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <Button onClick={onClose} className="w-full">Đóng</Button>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSidebarSettings, setShowSidebarSettings] = useState(false);
  const [navItems, setNavItems] = useLocalStorage<NavItemDef[]>("nav_items_order", DEFAULT_NAV_ITEMS);
  const [hiddenNavItems, setHiddenNavItems] = useLocalStorage<string[]>("nav_items_hidden", []);

  const visibleItems = navItems.filter(item => !hiddenNavItems.includes(item.href));

  const toggleDark = () => {
    setDarkMode((d) => {
      if (!d) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      return !d;
    });
  };

  const toggleHidden = (href: string) => {
    setHiddenNavItems(
      hiddenNavItems.includes(href)
        ? hiddenNavItems.filter(h => h !== href)
        : [...hiddenNavItems, href]
    );
  };

  const NavItems = ({ onClick }: { onClick?: () => void }) => (
    <>
      {visibleItems.map(({ href, label, iconKey }) => {
        const Icon = ICON_MAP[iconKey];
        const active = location === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onClick}
            data-testid={`nav-${href.replace("/", "") || "home"}`}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
              active
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-sidebar-border">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#fa00af]">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-sidebar-foreground">SFund</span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          <NavItems />
        </nav>

        <div className="px-2 py-4 border-t border-sidebar-border space-y-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSidebarSettings(true)}
            data-testid="btn-sidebar-settings"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:text-sidebar-foreground"
          >
            <Settings className="w-4 h-4" />
            Tùy chỉnh menu
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleDark}
            data-testid="toggle-darkmode"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:text-sidebar-foreground"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {darkMode ? "Sáng" : "Tối"}
          </Button>
        </div>
      </aside>
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4 md:hidden z-50">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm">VN Finance</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
          <Menu className="w-5 h-5" />
        </Button>
      </div>
      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
              <span className="font-semibold text-sm">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
              <NavItems onClick={() => setMobileOpen(false)} />
            </nav>
            <div className="px-2 py-4 border-t border-sidebar-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setMobileOpen(false); setShowSidebarSettings(true); }}
                className="w-full justify-start gap-2 text-sidebar-foreground"
              >
                <Settings className="w-4 h-4" />
                Tùy chỉnh menu
              </Button>
            </div>
          </aside>
        </div>
      )}
      {/* Main content */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-14">
        {children}
      </main>
      {showSidebarSettings && (
        <SidebarSettingsModal
          items={navItems}
          hidden={hiddenNavItems}
          onReorder={setNavItems}
          onToggleHidden={toggleHidden}
          onClose={() => setShowSidebarSettings(false)}
        />
      )}
    </div>
  );
}
