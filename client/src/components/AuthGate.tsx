import { useState } from "react";
import { ShieldAlert, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/AuthProvider";

type AuthGateProps = {
  title: string;
  description: string;
};

export default function AuthGate({ title, description }: AuthGateProps) {
  const { enabled, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<null | "google" | "email">(null);

  const handleGoogleLogin = async () => {
    try {
      setLoading("google");
      await signInWithGoogle();
    } catch (error) {
      toast({
        title: "Không thể đăng nhập Google",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const handleEmailSubmit = async () => {
    try {
      setLoading("email");
      if (mode === "signin") {
        await signInWithEmail(email, password);
        toast({ title: "Đăng nhập thành công" });
      } else {
        await signUpWithEmail(email, password);
        toast({ title: "Tạo tài khoản thành công" });
      }
    } catch (error) {
      toast({
        title: mode === "signin" ? "Không thể đăng nhập" : "Không thể tạo tài khoản",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  if (!enabled) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-card border border-card-border rounded-2xl p-6 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto text-amber-500 mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Thiếu cấu hình Firebase</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Sao chép `.env.example` thành `.env` và điền các biến `VITE_FIREBASE_*` trước khi dùng tính năng dữ liệu cá nhân.
          </p>
          <p className="text-xs text-muted-foreground">
            Portfolio và watchlist hiện được lưu theo tài khoản người dùng trong Firestore.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-card border border-card-border rounded-2xl p-6">
        <div className="text-center mb-6">
          <UserRound className="w-10 h-10 mx-auto text-primary mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          <Button onClick={() => void handleGoogleLogin()} className="w-full gap-2" disabled={loading !== null}>
            {loading === "google" ? "Đang chuyển hướng..." : "Tiếp tục với Google"}
          </Button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-card-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-xs text-muted-foreground">hoặc</span>
            </div>
          </div>

          <div className="flex gap-2 rounded-xl bg-muted p-1">
            <Button
              type="button"
              variant={mode === "signin" ? "default" : "ghost"}
              className="flex-1"
              onClick={() => setMode("signin")}
            >
              Đăng nhập
            </Button>
            <Button
              type="button"
              variant={mode === "signup" ? "default" : "ghost"}
              className="flex-1"
              onClick={() => setMode("signup")}
            >
              Tạo tài khoản
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth-password">Mật khẩu</Label>
            <Input
              id="auth-password"
              type="password"
              placeholder="Ít nhất 6 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button
            type="button"
            onClick={() => void handleEmailSubmit()}
            className="w-full"
            disabled={loading !== null || !email.trim() || password.length < 6}
          >
            {loading === "email"
              ? "Đang xử lý..."
              : mode === "signin"
                ? "Đăng nhập với Email"
                : "Tạo tài khoản với Email"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Nếu popup Google bị chặn trên môi trường hosted, ứng dụng sẽ tự fallback sang redirect.
          </p>
        </div>
      </div>
    </div>
  );
}
