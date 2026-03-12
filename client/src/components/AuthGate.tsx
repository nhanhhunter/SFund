import { ShieldAlert } from "lucide-react";
import AuthPanel from "@/components/AuthPanel";
import { useAuth } from "@/components/AuthProvider";

type AuthGateProps = {
  title: string;
  description: string;
};

export default function AuthGate({ title, description }: AuthGateProps) {
  const { enabled } = useAuth();

  if (!enabled) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-card-border bg-card p-6 text-center">
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-500" />
          <h1 className="mb-2 text-xl font-bold text-foreground">Thiếu cấu hình Firebase</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            Sao chép `.env.example` thành `.env` và điền các biến `VITE_FIREBASE_*` trước khi dùng dữ liệu cá nhân.
          </p>
          <p className="text-xs text-muted-foreground">
            Khi hoàn tất cấu hình, dữ liệu danh mục, theo dõi và cài đặt sẽ được tách riêng theo từng tài khoản.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-card-border bg-card p-6">
        <div className="mx-auto max-w-md">
          <AuthPanel title={title} description={description} />
        </div>
      </div>
    </div>
  );
}
