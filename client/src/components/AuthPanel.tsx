import { useState } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type AuthPanelProps = {
  title: string;
  description: string;
  onSuccess?: () => void;
};

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

export default function AuthPanel({ title, description, onSuccess }: AuthPanelProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<null | "google" | "email">(null);

  const passwordHint = "Ít nhất 8 ký tự, gồm hoa, thường và đặc biệt";
  const passwordValid = mode === "signin" ? password.length > 0 : STRONG_PASSWORD_REGEX.test(password);

  const handleGoogleLogin = async () => {
    try {
      setLoading("google");
      await signInWithGoogle();
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Không thể đăng nhập",
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
        toast({ title: "Tài khoản đã được tạo" });
      }
      onSuccess?.();
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

  return (
    <div className="space-y-5">
      <div className="text-center">
        <UserRound className="mx-auto mb-4 h-10 w-10 text-primary" />
        <h1 className="mb-2 text-xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Bảo vệ bởi Google</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Dữ liệu cá nhân được lưu trữ trên Google Cloud Firestore và chỉ khả dụng trong tài khoản của bạn.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Button onClick={() => void handleGoogleLogin()} className="w-full gap-2" disabled={loading !== null}>
          {loading === "google" ? "Đang xử lý..." : "Đăng nhập với Google"}
        </Button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-card-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-xs text-muted-foreground">hoặc</span>
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
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="auth-password">Mật khẩu</Label>
          <Input
            id="auth-password"
            type="password"
            placeholder={passwordHint}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === "signup" && (
            <p className="text-xs text-muted-foreground">{passwordHint}</p>
          )}
        </div>

        <Button
          type="button"
          onClick={() => void handleEmailSubmit()}
          className="w-full"
          disabled={loading !== null || !email.trim() || !passwordValid}
        >
          {loading === "email"
            ? "Đang xử lý..."
            : mode === "signin"
              ? "Đăng nhập với Email"
              : "Tạo tài khoản với Email"}
        </Button>
      </div>
    </div>
  );
}
