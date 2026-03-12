import { useState, type ComponentType, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  Bitcoin,
  CircleDollarSign,
  Droplets,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Settings,
  Star,
  Sun,
  TrendingUp,
  X,
} from "lucide-react";
import AuthPanel from "@/components/AuthPanel";
import { useAuth } from "@/components/AuthProvider";
import { useUserPreferences } from "@/components/UserPreferencesProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type NavItemDef = { href: string; label: string; icon: ComponentType<{ className?: string }> };

const DEFAULT_NAV_ITEMS: NavItemDef[] = [
  { href: "/portfolio", label: "Danh mục", icon: BarChart3 },
  { href: "/watchlist", label: "Theo dõi", icon: Star },
  { href: "/", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/stocks", label: "Cổ phiếu", icon: TrendingUp },
  { href: "/gold", label: "Vàng", icon: CircleDollarSign },
  { href: "/oil", label: "Dầu thô", icon: Droplets },
  { href: "/crypto", label: "Crypto", icon: Bitcoin },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, enabled, signOutUser } = useAuth();
  const { preferences, updatePreferences } = useUserPreferences();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const navItems = preferences.menuOrder
    .map((href) => DEFAULT_NAV_ITEMS.find((item) => item.href === href))
    .filter((item): item is NavItemDef => Boolean(item))
    .filter((item) => !preferences.hiddenMenuItems.includes(item.href));

  const displayName =
    preferences.displayName.trim() || user?.displayName?.trim() || user?.email?.split("@")[0] || "Người dùng";

  const toggleTheme = async () => {
    await updatePreferences({
      theme: preferences.theme === "dark" ? "light" : "dark",
    });
  };

  const NavItems = ({ onClick }: { onClick?: () => void }) => (
    <>
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = location === href;

        return (
          <Link
            key={href}
            href={href}
            onClick={onClick}
            data-testid={`nav-${href.replace("/", "") || "home"}`}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </>
  );

  const AccountBlock = () => {
    if (!enabled) {
      return (
        <div className="mb-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
          Chưa cấu hình Firebase
        </div>
      );
    }

    if (!user) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAuthDialogOpen(true)}
          className="w-full justify-start gap-2 text-sidebar-foreground hover:text-sidebar-foreground"
        >
          <LogIn className="h-4 w-4" />
          Đăng nhập
        </Button>
      );
    }

    return (
      <div className="mb-2 rounded-xl bg-sidebar-accent/40 px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-lg">
            {preferences.avatar}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fa00af]">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">SFund</span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
          <NavItems />
        </nav>

        <div className="space-y-1 border-t border-sidebar-border px-2 py-4">
          <AccountBlock />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:text-sidebar-foreground"
          >
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              Cài đặt
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void toggleTheme()}
            data-testid="toggle-darkmode"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:text-sidebar-foreground"
          >
            {preferences.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {preferences.theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}
          </Button>
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void signOutUser()}
              className="w-full justify-start gap-2 text-sidebar-foreground hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </Button>
          )}
        </div>
      </aside>

      <div className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center border-b border-sidebar-border bg-sidebar px-4 md:hidden">
        <div className="flex flex-1 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold">SFund</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute bottom-0 left-0 top-0 flex w-64 flex-col border-r border-sidebar-border bg-sidebar">
            <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
              <span className="text-sm font-semibold">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
              <NavItems onClick={() => setMobileOpen(false)} />
            </nav>
            <div className="space-y-1 border-t border-sidebar-border px-2 py-4">
              {enabled && !user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMobileOpen(false);
                    setAuthDialogOpen(true);
                  }}
                  className="w-full justify-start gap-2 text-sidebar-foreground"
                >
                  <LogIn className="h-4 w-4" />
                  Đăng nhập
                </Button>
              )}
              <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground">
                <Link href="/settings" onClick={() => setMobileOpen(false)}>
                  <Settings className="h-4 w-4" />
                  Cài đặt
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMobileOpen(false);
                  void toggleTheme();
                }}
                className="w-full justify-start gap-2 text-sidebar-foreground"
              >
                {preferences.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {preferences.theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}
              </Button>
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMobileOpen(false);
                    void signOutUser();
                  }}
                  className="w-full justify-start gap-2 text-sidebar-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </Button>
              )}
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">{children}</main>

      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Đăng nhập tài khoản</DialogTitle>
          </DialogHeader>
          <AuthPanel
            title="Tiếp tục với tài khoản của bạn"
            description="Đăng nhập để đồng bộ danh mục, danh sách theo dõi và cài đặt cá nhân trên mọi thiết bị."
            onSuccess={() => setAuthDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
