import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, RefreshCw, Activity, Settings, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";
import PriceChart from "@/components/PriceChart";
import NewsSection from "@/components/NewsSection";
import { queryClient } from "@/lib/queryClient";

const ALL_INDEX_CARDS = [
  { key: "vnIndex", label: "VN-Index" },
  { key: "hnxIndex", label: "HNX-Index" },
  { key: "upcom", label: "UPCOM" },
  { key: "vn30", label: "VN30" },
  { key: "hnx30", label: "HNX30" },
  { key: "vn100", label: "VN100" },
];

const ALL_COMMODITY_CARDS = [
  { key: "gold_vnd", label: "Vàng (VND/Lượng)" },
  { key: "gold_usd", label: "Vàng (USD/Oz)" },
  { key: "wti", label: "Dầu WTI (USD/bbl)" },
  { key: "brent", label: "Dầu Brent (USD/bbl)" },
];

function useLocalStorage<T>(key: string, def: T) {
  const [v, setV] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; }
  });
  const set = (val: T) => { setV(val); try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
  return [v, set] as const;
}

function IndexCard({ label, value, change, changePercent, loading }: {
  label: string; value: string; change: number; changePercent: number; loading: boolean;
}) {
  if (loading) return <Skeleton className="h-24 rounded-xl" />;
  const up = changePercent >= 0;
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <span className={cn("flex items-center gap-0.5 text-xs font-semibold", getChangeColor(changePercent))}>
          {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {formatPercent(changePercent)}
        </span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className={cn("text-xs mt-0.5", getChangeColor(change))}>
        {change >= 0 ? "+" : ""}{typeof change === "number" ? change.toFixed(2) : change}
      </p>
    </div>
  );
}

function CryptoMiniCard({ id, data }: { id: string; data: any }) {
  const names: Record<string, string> = {
    bitcoin: "BTC", ethereum: "ETH", binancecoin: "BNB", solana: "SOL",
    ripple: "XRP", cardano: "ADA", dogecoin: "DOGE", tron: "TRX",
  };
  if (!data) return <Skeleton className="h-16 rounded-xl" />;
  const change = data.usd_24h_change || 0;
  return (
    <div className="bg-card border border-card-border rounded-xl px-3 py-2.5 hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-foreground">{names[id] || id}</span>
        <span className={cn("text-xs font-medium", getChangeColor(change))}>
          {formatPercent(change)}
        </span>
      </div>
      <p className="text-sm font-bold text-foreground mt-0.5">{formatCurrency(data.usd)}</p>
    </div>
  );
}

function SettingsPanel({ visibleCards, onToggle, onClose }: {
  visibleCards: Record<string, boolean>;
  onToggle: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">Tùy chỉnh dashboard</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Chọn các chỉ số muốn hiển thị</p>
        <div className="space-y-1 mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Chỉ số VN</p>
          {ALL_INDEX_CARDS.map(c => (
            <label key={c.key} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted cursor-pointer">
              <input
                type="checkbox"
                checked={visibleCards[c.key] !== false}
                onChange={() => onToggle(c.key)}
                className="rounded"
                data-testid={`toggle-card-${c.key}`}
              />
              <span className="text-sm">{c.label}</span>
            </label>
          ))}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-2">Hàng hóa</p>
          {ALL_COMMODITY_CARDS.map(c => (
            <label key={c.key} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted cursor-pointer">
              <input
                type="checkbox"
                checked={visibleCards[c.key] !== false}
                onChange={() => onToggle(c.key)}
                className="rounded"
                data-testid={`toggle-card-${c.key}`}
              />
              <span className="text-sm">{c.label}</span>
            </label>
          ))}
        </div>
        <Button onClick={onClose} className="w-full">Đóng</Button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [showSettings, setShowSettings] = useState(false);
  const [visibleCards, setVisibleCards] = useLocalStorage<Record<string, boolean>>("dashboard_visible_cards", {});

  const isVisible = (key: string) => visibleCards[key] !== false;
  const toggleCard = (key: string) => {
    setVisibleCards({ ...visibleCards, [key]: !isVisible(key) });
  };

  const { data: overview, isLoading, dataUpdatedAt } = useQuery<any>({
    queryKey: ["/api/market-overview"],
    refetchInterval: 60_000,
  });

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("vi-VN") : "--:--";
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/market-overview"] });

  const indices: Record<string, any> = {
    vnIndex: overview?.vnIndex,
    hnxIndex: overview?.hnxIndex,
    upcom: overview?.upcom,
    vn30: overview?.vn30,
    hnx30: overview?.hnx30,
    vn100: overview?.vn100,
  };

  const gold = overview?.gold?.XAU;
  const oil = overview?.oil;
  const crypto = overview?.crypto || {};

  const visibleIndexCards = ALL_INDEX_CARDS.filter(c => isVisible(c.key));
  const visibleCommodityCards = ALL_COMMODITY_CARDS.filter(c => isVisible(c.key));

  function getIndexValue(key: string) {
    const d = indices[key];
    return { value: d ? d.price.toFixed(2) : "--", change: d?.change || 0, changePercent: d?.changePercent || 0 };
  }

  function getCommodityCard(key: string) {
    switch (key) {
      case "gold_vnd": return {
        label: "Vàng (VND/Lượng)",
        value: gold ? new Intl.NumberFormat("vi-VN").format(gold.priceVndLuong) : "--",
        change: gold?.change || 0,
        changePercent: gold?.changePercent || 0,
      };
      case "gold_usd": return {
        label: "Vàng (USD/Oz)",
        value: gold ? `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(gold.priceUsdOz)}` : "--",
        change: gold?.changePercent ? gold.priceUsdOz * 0.001 : 0,
        changePercent: gold?.changePercent || 0,
      };
      case "wti": return {
        label: "Dầu WTI (USD/bbl)",
        value: oil?.WTI ? `$${oil.WTI.price.toFixed(2)}` : "--",
        change: oil?.WTI?.change || 0,
        changePercent: oil?.WTI?.changePercent || 0,
      };
      case "brent": return {
        label: "Dầu Brent (USD/bbl)",
        value: oil?.BRENT ? `$${oil.BRENT.price.toFixed(2)}` : "--",
        change: oil?.BRENT?.change || 0,
        changePercent: oil?.BRENT?.changePercent || 0,
      };
      default: return { label: key, value: "--", change: 0, changePercent: 0 };
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tổng quan thị trường</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cập nhật lúc {lastUpdate}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="gap-2" data-testid="btn-dashboard-settings">
            <Settings className="w-3.5 h-3.5" />
            Tùy chỉnh
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Market Indices */}
      {visibleIndexCards.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Chỉ số thị trường</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleIndexCards.map(c => {
              const { value, change, changePercent } = getIndexValue(c.key);
              return <IndexCard key={c.key} label={c.label} value={value} change={change} changePercent={changePercent} loading={isLoading} />;
            })}
          </div>
        </section>
      )}

      {/* Commodities */}
      {visibleCommodityCards.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Hàng hóa</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {visibleCommodityCards.map(c => {
              const { label, value, change, changePercent } = getCommodityCard(c.key);
              return <IndexCard key={c.key} label={label} value={value} change={change} changePercent={changePercent} loading={isLoading} />;
            })}
          </div>
        </section>
      )}

      {/* Crypto */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Tiền điện tử</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {["bitcoin", "ethereum", "binancecoin", "solana", "ripple", "cardano", "dogecoin", "tron"].map((id) => (
            <CryptoMiniCard key={id} id={id} data={crypto[id]} />
          ))}
        </div>
      </section>

      {/* Charts */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Biểu đồ VN-Index</h2>
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">VN-Index 30 ngày</span>
          </div>
          <PriceChart
            type="stock"
            symbol="VN_INDEX"
            days={30}
            currentPrice={overview?.vnIndex?.price || undefined}
            height={200}
          />
        </div>
      </section>

      {/* News */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <NewsSection endpoint="/api/news/stocks" title="Tin tức thị trường chứng khoán" maxItems={5} />
          <NewsSection endpoint="/api/news/crypto" title="Tin tức Crypto" maxItems={5} />
        </div>
      </section>

      {showSettings && (
        <SettingsPanel
          visibleCards={visibleCards}
          onToggle={toggleCard}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
