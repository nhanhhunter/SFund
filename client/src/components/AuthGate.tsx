import { ShieldAlert, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";

type AuthGateProps = {
  title: string;
  description: string;
};

export default function AuthGate({ title, description }: AuthGateProps) {
  const { enabled, signInWithGoogle } = useAuth();

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
            Portfolio và watchlist hiện được lưu theo tài khoản Google trong Firestore.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-card border border-card-border rounded-2xl p-6 text-center">
        <UserRound className="w-10 h-10 mx-auto text-primary mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-5">{description}</p>
        <Button onClick={() => void signInWithGoogle()} className="gap-2">
          Đăng nhập với Google
        </Button>
      </div>
    </div>
  );
}
