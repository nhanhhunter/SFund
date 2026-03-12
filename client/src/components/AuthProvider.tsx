import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getRedirectResult,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updatePassword,
  updateProfile,
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
  updateDisplayName: (displayName: string) => Promise<void>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
]);

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

function validateStrongPassword(password: string) {
  if (!STRONG_PASSWORD_REGEX.test(password)) {
    throw new Error("Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và ký tự đặc biệt.");
  }
}

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
      return new Error("Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và ký tự đặc biệt.");
    case "auth/requires-recent-login":
      return new Error("Phiên đăng nhập đã cũ. Hãy đăng nhập lại rồi thử lại.");
    case "auth/unauthorized-domain":
      return new Error("Domain hiện tại chưa được thêm vào Authorized domains trong Firebase Authentication.");
    case "auth/popup-blocked":
      return new Error("Trình duyệt đang chặn cửa sổ đăng nhập.");
    default:
      return new Error((error as Error)?.message || "Không thể xử lý yêu cầu lúc này.");
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
          validateStrongPassword(password);
          await createUserWithEmailAndPassword(auth, email.trim(), password);
        } catch (error) {
          throw mapAuthError(error);
        }
      },
      async updateDisplayName(displayName: string) {
        if (!auth?.currentUser) {
          throw new Error("Bạn cần đăng nhập để cập nhật tên hiển thị.");
        }

        await updateProfile(auth.currentUser, {
          displayName: displayName.trim(),
        });
        setUser({ ...auth.currentUser });
      },
      async changePassword(currentPassword: string, nextPassword: string) {
        if (!auth?.currentUser || !auth.currentUser.email) {
          throw new Error("Tài khoản hiện tại không hỗ trợ đổi mật khẩu bằng email.");
        }

        validateStrongPassword(nextPassword);

        try {
          const credential = EmailAuthProvider.credential(
            auth.currentUser.email,
            currentPassword,
          );
          await reauthenticateWithCredential(auth.currentUser, credential);
          await updatePassword(auth.currentUser, nextPassword);
        } catch (error) {
          throw mapAuthError(error);
        }
      },
      async deleteAccount() {
        if (!auth?.currentUser) {
          throw new Error("Bạn cần đăng nhập để xóa tài khoản.");
        }

        try {
          await deleteUser(auth.currentUser);
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
