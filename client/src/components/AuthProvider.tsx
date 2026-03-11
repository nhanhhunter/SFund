import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type AuthError,
  type User,
} from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  enabled: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
]);

function mapAuthError(error: unknown): Error {
  const code = (error as AuthError | undefined)?.code;

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return new Error("Email hoặc mật khẩu không đúng.");
    case "auth/email-already-in-use":
      return new Error("Email này đã được đăng ký.");
    case "auth/invalid-email":
      return new Error("Email không hợp lệ.");
    case "auth/weak-password":
      return new Error("Mật khẩu quá yếu. Hãy dùng ít nhất 6 ký tự.");
    case "auth/unauthorized-domain":
      return new Error("Domain hiện tại chưa được thêm vào Authorized domains trong Firebase Authentication.");
    case "auth/popup-blocked":
      return new Error("Trình duyệt chặn popup đăng nhập.");
    default:
      return new Error((error as Error)?.message || "Không thể đăng nhập lúc này.");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!auth || !isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    let active = true;

    getRedirectResult(auth).catch((error) => {
      console.error("Firebase redirect sign-in failed:", mapAuthError(error));
    });

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      enabled: isFirebaseConfigured,
      async signInWithGoogle() {
        if (!auth || !googleProvider) {
          throw new Error("Firebase chưa được cấu hình.");
        }

        try {
          await signInWithPopup(auth, googleProvider);
        } catch (error) {
          const code = (error as AuthError | undefined)?.code;
          if (code && POPUP_FALLBACK_CODES.has(code)) {
            await signInWithRedirect(auth, googleProvider);
            return;
          }

          throw mapAuthError(error);
        }
      },
      async signInWithEmail(email: string, password: string) {
        if (!auth) {
          throw new Error("Firebase chưa được cấu hình.");
        }

        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (error) {
          throw mapAuthError(error);
        }
      },
      async signUpWithEmail(email: string, password: string) {
        if (!auth) {
          throw new Error("Firebase chưa được cấu hình.");
        }

        try {
          await createUserWithEmailAndPassword(auth, email.trim(), password);
        } catch (error) {
          throw mapAuthError(error);
        }
      },
      async signOutUser() {
        if (!auth) return;
        await signOut(auth);
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
