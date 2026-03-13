import { useEffect, useState } from "react";
import { HandCoins, Heart, LockKeyhole, MoonStar, Paintbrush2, Shield, Trash2, UserCircle2 } from "lucide-react";
import { Link } from "wouter";
import AuthGate from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { useUserPreferences, type MiniChartPeriodPreference } from "@/components/UserPreferencesProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { deleteAllUserData } from "@/lib/user-data";
import momoQrImage from "../../../attached_assets/momoQR.jpg";

const MENU_ITEMS = [
  { href: "/portfolio", label: "Danh mục" },
  { href: "/watchlist", label: "Theo dõi" },
  { href: "/", label: "Tổng quan" },
  { href: "/stocks", label: "Cổ phiếu" },
  { href: "/gold", label: "Vàng" },
  { href: "/oil", label: "Dầu thô" },
  { href: "/crypto", label: "Crypto" },
];

const FONT_OPTIONS = [
  { value: "editorial", label: "Editorial Serif" },
  { value: "sans", label: "Be Vietnam Pro" },
  { value: "display", label: "Space Grotesk" },
] as const;

const MINI_CHART_PERIOD_OPTIONS: Array<{ value: MiniChartPeriodPreference; label: string }> = [
  { value: "1", label: "1N" },
  { value: "7", label: "7N" },
  { value: "30", label: "30N" },
];

const AVATAR_OPTIONS = ["👨", "👩", "👨‍💼", "👩‍💼", "🧑"];

export default function SettingsPage() {
  const { user, loading, updateDisplayName, changePassword, deleteAccount } = useAuth();
  const { preferences, updatePreferences } = useUserPreferences();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(preferences.displayName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const passwordProviders = user?.providerData.map((provider) => provider.providerId) ?? [];
  const canChangePassword = passwordProviders.includes("password");

  useEffect(() => {
    setDisplayName(preferences.displayName);
  }, [preferences.displayName]);

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">Đang tải cài đặt...</div>;
  }

  if (!user) {
    return (
      <AuthGate
        title="Đăng nhập để quản lý cài đặt"
        description="Cài đặt giao diện và hồ sơ của bạn sẽ được đồng bộ an toàn theo từng tài khoản."
      />
    );
  }

  const orderedMenu = preferences.menuOrder
    .map((href) => MENU_ITEMS.find((item) => item.href === href))
    .filter((item): item is (typeof MENU_ITEMS)[number] => Boolean(item));

  const moveMenuItem = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedMenu.length) return;

    const reordered = [...orderedMenu];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];

    await updatePreferences({
      menuOrder: reordered.map((item) => item.href),
    });
  };

  const toggleMenuItem = async (href: string, checked: boolean) => {
    const hiddenMenuItems = checked
      ? preferences.hiddenMenuItems.filter((item) => item !== href)
      : [...preferences.hiddenMenuItems, href];

    await updatePreferences({ hiddenMenuItems });
  };

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      await updateDisplayName(displayName);
      await updatePreferences({ displayName: displayName.trim() });
      toast({ title: "Đã cập nhật hồ sơ" });
    } catch (error) {
      toast({
        title: "Không thể cập nhật hồ sơ",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async () => {
    try {
      setSavingPassword(true);
      await changePassword(currentPassword, nextPassword);
      toast({ title: "Đã đổi mật khẩu" });
      setCurrentPassword("");
      setNextPassword("");
    } catch (error) {
      toast({
        title: "Không thể đổi mật khẩu",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      await deleteAllUserData(user.uid);
      await deleteAccount();
      toast({ title: "Tài khoản và dữ liệu đã được xóa" });
    } catch (error) {
      toast({
        title: "Không thể xóa tài khoản",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setDeletingAccount(false);
      setDeleteDialogOpen(false);
      setDeleteConfirm("");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Cài đặt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cá nhân hóa trải nghiệm, quản lý hồ sơ và bảo mật tài khoản của bạn.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-card-border bg-card p-5">
          <div className="mb-4 flex items-center gap-3">
            <MoonStar className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Giao diện</h2>
              <p className="text-sm text-muted-foreground">Lưu theo tài khoản để đồng bộ trên thiết bị khác.</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-xl border border-card-border p-4">
              <div>
                <p className="font-medium text-foreground">Chế độ tối</p>
                <p className="text-sm text-muted-foreground">Chuyển đổi giữa giao diện sáng và tối.</p>
              </div>
              <Switch
                checked={preferences.theme === "dark"}
                onCheckedChange={(checked) => {
                  void updatePreferences({ theme: checked ? "dark" : "light" });
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Font chữ</Label>
              <Select
                value={preferences.fontFamily}
                onValueChange={(value) => {
                  void updatePreferences({ fontFamily: value as (typeof FONT_OPTIONS)[number]["value"] });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn font chữ" />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-card-border bg-card p-5">
          <div className="mb-4 flex items-center gap-3">
            <UserCircle2 className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Hồ sơ cá nhân</h2>
              <p className="text-sm text-muted-foreground">Tên hiển thị và biểu tượng đại diện sẽ xuất hiện trong sidebar.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Tên hiển thị</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Nhập tên hiển thị"
              />
            </div>

            <div className="space-y-2">
              <Label>Icon đại diện</Label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_OPTIONS.map((avatar) => (
                  <Button
                    key={avatar}
                    type="button"
                    variant={preferences.avatar === avatar ? "default" : "outline"}
                    className="h-11 w-11 rounded-2xl p-0 text-lg"
                    onClick={() => void updatePreferences({ avatar })}
                  >
                    {avatar}
                  </Button>
                ))}
              </div>
            </div>

            <Button onClick={() => void handleSaveProfile()} disabled={savingProfile || !displayName.trim()}>
              {savingProfile ? "Đang lưu..." : "Lưu hồ sơ"}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-card-border bg-card p-5">
          <div className="mb-4 flex items-center gap-3">
            <Paintbrush2 className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Tùy chỉnh menu</h2>
              <p className="text-sm text-muted-foreground">Ẩn hiện và sắp xếp các mục điều hướng chính.</p>
            </div>
          </div>

          <div className="space-y-2">
            {orderedMenu.map((item, index) => {
              const visible = !preferences.hiddenMenuItems.includes(item.href);

              return (
                <div
                  key={item.href}
                  className="flex items-center gap-3 rounded-xl border border-card-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.href}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void moveMenuItem(index, -1)} disabled={index === 0}>
                      Lên
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void moveMenuItem(index, 1)}
                      disabled={index === orderedMenu.length - 1}
                    >
                      Xuống
                    </Button>
                    <div className="flex items-center gap-2 pl-2">
                      <span className="text-xs text-muted-foreground">{visible ? "Hiện" : "Ẩn"}</span>
                      <Switch checked={visible} onCheckedChange={(checked) => void toggleMenuItem(item.href, checked)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 space-y-2 border-t border-card-border pt-5">
            <Label>Chu kỳ mini chart mặc định</Label>
            <Select
              value={preferences.miniChartPeriod}
              onValueChange={(value) => {
                void updatePreferences({ miniChartPeriod: value as MiniChartPeriodPreference });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn chu kỳ" />
              </SelectTrigger>
              <SelectContent>
                {MINI_CHART_PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Áp dụng cho mini chart trong các card ở trang Tổng quan, Theo dõi và Cổ phiếu.
            </p>
          </div>

          <div className="mt-5 border-t border-card-border pt-5">
            <div className="mb-4 flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold text-foreground">Chính sách và điều khoản</h2>
                <p className="text-sm text-muted-foreground">Các tài liệu pháp lý dành cho người dùng ứng dụng.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/privacy-policy">Chính sách bảo mật</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/terms-of-use">Điều khoản sử dụng</Link>
              </Button>
            </div>
          </div>

          <div className="mt-5 border-t border-card-border pt-5">
            <div className="mb-4 flex items-center gap-3">
              <Heart className="h-5 w-5 text-rose-500" />
              <div>
                <h2 className="font-semibold text-foreground">Thông tin chung về SFund</h2>
              </div>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                SFund mang đến trải nghiệm cá nhân hóa cho việc quản lý danh mục đầu tư và theo dõi thông tin thị trường.
              </p>
              <p>
                Liên hệ:{" "}
                <a
                  href="https://www.nhanh.dev/contact/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  nhanh.dev/contact
                </a>
              </p>
              <p className="flex items-center gap-2 text-foreground">
                Built with <Heart className="h-4 w-4 fill-rose-500 text-rose-500" /> @NHANH.DEV
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-card-border bg-card p-5">
          <div className="mb-4 flex items-center gap-3">
            <LockKeyhole className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Bảo mật</h2>
              <p className="text-sm text-muted-foreground">Quản lý mật khẩu, xóa tài khoản và hỗ trợ chi phí vận hành.</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-card-border p-4">
              <div className="mb-3">
                <p className="font-medium text-foreground">Đổi mật khẩu</p>
                <p className="text-sm text-muted-foreground">Áp dụng cho tài khoản đăng nhập bằng email/password.</p>
              </div>
              {canChangePassword ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="next-password">Mật khẩu mới</Label>
                    <Input
                      id="next-password"
                      type="password"
                      value={nextPassword}
                      onChange={(event) => setNextPassword(event.target.value)}
                      placeholder="Ít nhất 8 ký tự, gồm hoa, thường và đặc biệt"
                    />
                    <p className="text-xs text-muted-foreground">
                      Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và ký tự đặc biệt.
                    </p>
                  </div>
                  <Button
                    onClick={() => void handlePasswordChange()}
                    disabled={savingPassword || !currentPassword || !nextPassword}
                  >
                    {savingPassword ? "Đang cập nhật..." : "Đổi mật khẩu"}
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">
                  Tài khoản này đang dùng tùy chọn đăng nhập khác. Nếu bạn đăng nhập bằng Google, hãy quản lý mật khẩu
                  trực tiếp trong tài khoản Google của mình nhé!
                </div>
              )}
            </div>

            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                <p className="font-medium text-foreground">Xóa tài khoản</p>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                Bạn có toàn quyền đối với dữ liệu của mình. Hành động này sẽ xóa toàn bộ dữ liệu của bạn.
              </p>
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                Xóa dữ liệu - Không thể khôi phục
              </Button>
            </div>

            <div className="rounded-xl border border-card-border p-4">
              <div className="mb-3 flex items-center gap-2">
                <HandCoins className="h-4 w-4 text-primary" />
                <p className="font-medium text-foreground">Donate</p>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Nếu SFund hữu ích với bạn, hãy ủng hộ chúng tôi và giúp duy trì tên miền, hosting và các API dùng cho ứng dụng.
              </p>
              <div className="grid gap-4 lg:grid-cols-1">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Momo</p>
                      <p className="text-sm text-muted-foreground">Quét mã hoặc chuyển khoản</p>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-card-border bg-white p-3">
                    <img
                      src={momoQrImage}
                      alt="Momo QR"
                      className="mx-auto aspect-square w-full max-w-[220px] rounded-xl object-cover"
                    />
                  </div>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-muted-foreground">Số điện thoại Momo</p>
                    <p className="text-lg font-semibold tracking-wide text-foreground">0906.953.436</p>
                    <p className="text-sm text-muted-foreground">
                      Cảm ơn bạn đã sử dụng ứng dụng và hỗ trợ SFund.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>
      </div>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteConfirm("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa tài khoản</DialogTitle>
            <DialogDescription>
              Hành động này sẽ xóa tài khoản gồm toàn bộ dữ liệu cá nhân của bạn. Gõ `delete` để tiếp tục.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">Nhập `delete`</Label>
            <Input
              id="delete-confirm"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder="delete"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteAccount()}
              disabled={deletingAccount || deleteConfirm.trim().toLowerCase() !== "delete"}
            >
              {deletingAccount ? "Đang xóa..." : "Xóa tài khoản"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
