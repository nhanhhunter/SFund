import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const NUMBER_LOCALE = "en-US";

export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(NUMBER_LOCALE, options).format(value);
}

export function formatVnd(amount: number, fractionDigits = 0): string {
  return `${formatNumber(amount, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} đ`;
}

export function formatVND(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}T`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toFixed(0);
}

export function formatCurrency(amount: number, currency = "USD"): string {
  if (currency === "VND") {
    return formatVnd(amount);
  }
  if (currency === "compact") {
    if (amount >= 1_000_000_000_000) return `$${(amount / 1_000_000_000_000).toFixed(2)}T`;
    if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
    return `$${amount.toFixed(2)}`;
  }
  if (amount < 0.01) return `$${amount.toFixed(6)}`;
  if (amount < 1) return `$${amount.toFixed(4)}`;
  if (amount > 1000) return `$${formatNumber(amount, { maximumFractionDigits: 0 })}`;
  return `$${amount.toFixed(2)}`;
}

export function formatChange(change: number, currency = "USD"): string {
  const prefix = change >= 0 ? "+" : "";
  if (currency === "VND") return `${prefix}${formatNumber(change, { maximumFractionDigits: 0 })} đ`;
  if (Math.abs(change) < 0.01) return `${prefix}${change.toFixed(6)}`;
  return `${prefix}${change.toFixed(2)}`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatVolume(volume: number): string {
  return formatNumber(volume, { maximumFractionDigits: 0 });
}

export function formatTime(dateStr: string): string {
  try {
    const normalized = dateStr.includes("T")
      ? dateStr
      : dateStr.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6");
    const date = new Date(normalized);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return "Vừa xong";
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    return date.toLocaleDateString("vi-VN");
  } catch {
    return "";
  }
}

export function getChangeColor(change: number): string {
  if (change > 0) return "text-emerald-600 dark:text-emerald-400";
  if (change < 0) return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}

export function getChangeBg(change: number): string {
  if (change > 0) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
  if (change < 0) return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400";
  return "bg-muted text-muted-foreground";
}

export function getSentimentColor(sentiment: string): string {
  const s = sentiment?.toLowerCase() || "";
  if (s.includes("bullish")) return "text-emerald-600 dark:text-emerald-400";
  if (s.includes("bearish")) return "text-rose-600 dark:text-rose-400";
  return "text-amber-600 dark:text-amber-400";
}

export function assetTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    stock: "Cổ phiếu",
    gold: "Vàng",
    oil: "Dầu thô",
    crypto: "Crypto",
  };
  return labels[type] || type;
}
