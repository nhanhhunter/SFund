import type { ComponentType } from "react";
import {
  BriefcaseBusiness,
  Compass,
  Crown,
  Gem,
  Landmark,
  Rocket,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";

export const AVATAR_OPTIONS = [
  { id: "compass", label: "Định hướng", icon: Compass, locked: false },
  { id: "trend-up", label: "Tăng trưởng", icon: TrendingUp, locked: false },
  { id: "briefcase", label: "Đầu tư", icon: BriefcaseBusiness, locked: false },
  { id: "rocket", label: "Bứt tốc", icon: Rocket, locked: false },
  { id: "shield", label: "Phòng thủ", icon: ShieldCheck, locked: false },
  { id: "wallet", label: "Tài sản", icon: Wallet, locked: false },
  { id: "gem", label: "Tinh tuyển", icon: Gem, locked: false },
  { id: "landmark", label: "Bền vững", icon: Landmark, locked: false },
  { id: "crown-vip", label: "VIP", icon: Crown, locked: true },
] as const satisfies readonly AvatarOption[];

type AvatarOption = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  locked?: boolean;
};

export const AVATAR_CHOICES = [
  "compass",
  "trend-up",
  "briefcase",
  "rocket",
  "shield",
  "wallet",
  "gem",
  "landmark",
] as const;

export type AvatarOptionId = typeof AVATAR_CHOICES[number];

const LEGACY_AVATAR_MAP: Record<string, AvatarOptionId> = {
  "🧭": "compass",
  "📈": "trend-up",
  "💼": "briefcase",
  "🚀": "rocket",
  "🛡️": "shield",
  "👨": "compass",
  "👩": "trend-up",
  "👨‍💼": "briefcase",
  "👩‍💼": "wallet",
  "🧑": "gem",
};

export function normalizeAvatarChoice(value: string | null | undefined): AvatarOptionId {
  if (!value) {
    return AVATAR_CHOICES[0];
  }

  if (AVATAR_CHOICES.includes(value as AvatarOptionId)) {
    return value as AvatarOptionId;
  }

  return LEGACY_AVATAR_MAP[value] ?? AVATAR_CHOICES[0];
}

export function getAvatarOption(value: string | null | undefined) {
  const normalized = normalizeAvatarChoice(value);
  return AVATAR_OPTIONS.find((option) => option.id === normalized) ?? AVATAR_OPTIONS[0];
}
