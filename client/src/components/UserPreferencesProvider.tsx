import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_NAV_ORDER,
  DEFAULT_USER_PREFERENCES,
  type FontPreference,
  type UserPreferences,
  getUserPreferences,
  saveUserPreferences,
} from "@/lib/user-data";

type UserPreferencesContextValue = {
  preferences: UserPreferences;
  loading: boolean;
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<void>;
};

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);
const GUEST_STORAGE_KEY = "sfund_guest_preferences";

function normalizePreferences(
  raw: Partial<UserPreferences> | null | undefined,
  fallbackName = "",
): UserPreferences {
  const orderSource = raw?.menuOrder?.filter((href) => DEFAULT_NAV_ORDER.includes(href as (typeof DEFAULT_NAV_ORDER)[number])) ?? [];
  const menuOrder = [
    ...orderSource,
    ...DEFAULT_NAV_ORDER.filter((href) => !orderSource.includes(href)),
  ];

  const hiddenMenuItems =
    raw?.hiddenMenuItems?.filter((href) => DEFAULT_NAV_ORDER.includes(href as (typeof DEFAULT_NAV_ORDER)[number])) ?? [];

  return {
    ...DEFAULT_USER_PREFERENCES,
    ...raw,
    displayName: raw?.displayName?.trim() || fallbackName,
    menuOrder,
    hiddenMenuItems,
    updatedAt: raw?.updatedAt || new Date().toISOString(),
  };
}

function readGuestPreferences() {
  try {
    const stored = localStorage.getItem(GUEST_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Partial<UserPreferences>) : null;
  } catch {
    return null;
  }
}

function writeGuestPreferences(preferences: UserPreferences) {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore storage failures in restricted browsers.
  }
}

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { user, enabled } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [loading, setLoading] = useState(false);
  const preferencesRef = useRef(preferences);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    const root = document.documentElement;

    if (preferences.theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    root.dataset.font = preferences.fontFamily;
  }, [preferences.fontFamily, preferences.theme]);

  useEffect(() => {
    let active = true;

    async function loadPreferences() {
      const fallbackName =
        user?.displayName?.trim() || user?.email?.split("@")[0]?.trim() || "";

      if (!user || !enabled) {
        const guestPreferences = normalizePreferences(readGuestPreferences(), fallbackName);
        if (active) {
          setPreferences(guestPreferences);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const remotePreferences = await getUserPreferences(user.uid);
        if (!active) return;

        const merged = normalizePreferences(remotePreferences, fallbackName);
        setPreferences(merged);
      } catch (error) {
        if (!active) return;
        setPreferences(normalizePreferences(null, fallbackName));
        toast({
          title: "Không thể tải cài đặt",
          description: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPreferences();

    return () => {
      active = false;
    };
  }, [enabled, toast, user]);

  async function updatePreferences(patch: Partial<UserPreferences>) {
    const nextPreferences = normalizePreferences(
      {
        ...preferencesRef.current,
        ...patch,
        updatedAt: new Date().toISOString(),
      },
      patch.displayName ?? preferencesRef.current.displayName,
    );

    setPreferences(nextPreferences);
    preferencesRef.current = nextPreferences;

    try {
      if (user && enabled) {
        await saveUserPreferences(user.uid, nextPreferences);
      } else {
        writeGuestPreferences(nextPreferences);
      }
    } catch (error) {
      toast({
        title: "Không thể lưu cài đặt",
        description: (error as Error).message,
        variant: "destructive",
      });
      throw error;
    }
  }

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        loading,
        updatePreferences,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);

  if (!context) {
    throw new Error("useUserPreferences must be used within UserPreferencesProvider");
  }

  return context;
}

export type { FontPreference };
