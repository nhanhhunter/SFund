import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, RefreshCw, Settings, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";
import PriceChart from "@/components/PriceChart";
import NewsSection from "@/components/NewsSection";
import { queryClient, fetchJson } from "@/lib/queryClient";

const ALL_INDEX_CARDS = [
  { key: "vnIndex", label: "VN-Index", symbol: "VNINDEX", type: "index" as const },
  { key: "hnxIndex", label: "HNX-Index", symbol: "HNXINDEX", type: "index" as const },
  { key: "upcom", label: "UPCOM", symbol: "UPCOMINDEX", type: "index" as const },
  { key: "vn30", label: "VN30", symbol: "VN30", type: "index" as const },
  { key: "hnx30", label: "HNX30", symbol: "HNX30", type: "index" as const },
  { key: "vn100", label: "VN100", symbol: "VN100", type: "index" as const },
];

const ALL_COMMODITY_CARDS = [
  { key: "gold_vnd", label: "Vàng (VND/Lượng)", symbol: "SJC_VND", type: "gold" as const },
  { key: "gold_usd", label: "Vàng (USD/Oz)", symbol: "XAU", type: "gold" as const },
  { key: "wti", label: "Dầu WTI (USD/bbl)", symbol: "WTI", type: "oil" as const },
  { key: "brent", label: "Dầu Brent (USD/bbl)", symbol: "BRENT", type: "oil" as const },
];

const DEFAULT_CRYPTO_IDS = ["bitcoin", "ethereum"];

const CRYPTO_NAMES: Record<string, string> = {
  bitcoin: "BTC", ethereum: "ETH", binancecoin: "BNB", solana: "SOL",
  ripple: "XRP", cardano: "ADA", dogecoin: "DOGE", tron: "TRX",
  polkadot: "DOT", avalanche: "AVAX", chainlink: "LINK", uniswap: "UNI",
};

const ALL_CRYPTO_OPTIONS = [
  { id: "bitcoin", label: "Bitcoin (BTC)" },
  { id: "ethereum", label: "Ethereum (ETH)" },
  { id: "binancecoin", label: "Binance Coin (BNB)" },
  { id: "solana", label: "Solana (SOL)" },
  { id: "ripple", label: "Ripple (XRP)" },
  { id: "cardano", label: "Cardano (ADA)" },
  { id: "dogecoin", label: "Dogecoin (DOGE)" },
  { id: "tron", label: "TRON (TRX)" },
];

function useLocalStorage<T>(key: string, def: T) {
  const [v, setV] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; }
  });
  const set = (val: T) => { setV(val); try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
  return [v, set] as const;
}

// Mini card with embedded chart for indices/commodities
function MiniChartCard({ label, value, change, changePercent, loading, symbol, chartType, chartCurrentPrice }: {
  label: string; value: string; change: number; changePercent: number; loading: boolean;
  symbol: string; chartType: "index" | "gold" | "oil";
  chartCurrentPrice?: number;
}) {
  if (loading) return <Skeleton className="h-32 rounded-xl" />;
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
      <p className="text-xl font-bold text-foreground mb-0.5">{value}</p>
      <p className={cn("text-xs mb-2", getChangeColor(change))}>
        {change >= 0 ? "+" : ""}{typeof change === "number" ? change.toFixed(2) : change}
      </p>
      <PriceChart
        type={chartType}
        symbol={symbol}
        days={7}
        currentPrice={chartCurrentPrice}
        mini
        height={48}
      />
    </div>
  );
}

function CryptoMiniCard({ id, data }: { id: string; data: any }) {
  if (!data) return <Skeleton className="h-16 rounded-xl" />;
  const change = data.usd_24h_change || 0;
  return (
    <div className="bg-card border border-card-border rounded-xl px-3 py-2.5 hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-foreground">{CRYPTO_NAMES[id] || id.toUpperCase()}</span>
        <span className={cn("text-xs font-medium", getChangeColor(change))}>
          {formatPercent(change)}
        </span>
      </div>
      <p className="text-sm font-bold text-foreground mt-0.5">{formatCurrency(data.usd)}</p>
    </div>
  );
}

function SettingsPanel({ visibleCards, onToggle, cryptoIds, onCryptoToggle, onClose }: {
  visibleCards: Record<string, boolean>;
  onToggle: (key: string) => void;
  cryptoIds: string[];
  onCryptoToggle: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">Tùy chỉnh dashboard</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Chỉ số VN</p>
        <div className="space-y-1 mb-4">
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
        </div>

        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Hàng hóa</p>
        <div className="space-y-1 mb-4">
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

        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tiền điện tử</p>
        <div className="space-y-1 mb-4">
          {ALL_CRYPTO_OPTIONS.map(c => (
            <label key={c.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted cursor-pointer">
              <input
                type="checkbox"
                checked={cryptoIds.includes(c.id)}
                onChange={() => onCryptoToggle(c.id)}
                className="rounded"
                data-testid={`toggle-crypto-${c.id}`}
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
  const [cryptoIds, setCryptoIds] = useLocalStorage<string[]>("dashboard_crypto_ids", DEFAULT_CRYPTO_IDS);

  const isVisible = (key: string) => visibleCards[key] !== false;
  const toggleCard = (key: string) => {
    setVisibleCards({ ...visibleCards, [key]: !isVisible(key) });
  };
  const toggleCrypto = (id: string) => {
    setCryptoIds(
      cryptoIds.includes(id) ? cryptoIds.filter((x: string) => x !== id) : [...cryptoIds, id]
    );
  };

  const { data: overview, isLoading, dataUpdatedAt } = useQuery<any>({
    queryKey: ["/api/market-overview"],
    refetchInterval: 60_000,
  });

  const cryptoIdStr = cryptoIds.join(",");
  const { data: cryptoData } = useQuery<Record<string, any>>({
    queryKey: ["/api/prices/crypto", cryptoIdStr],
    queryFn: () => fetchJson(`/api/prices/crypto?ids=${cryptoIdStr}`),
    enabled: cryptoIds.length > 0,
    refetchInterval: 60_000,
  });

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("vi-VN") : "--:--";
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/market-overview"] });
    queryClient.invalidateQueries({ queryKey: ["/api/prices/crypto"] });
  };

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
  const crypto = cryptoData || overview?.crypto || {};

  const visibleIndexCards = ALL_INDEX_CARDS.filter(c => isVisible(c.key));
  const visibleCommodityCards = ALL_COMMODITY_CARDS.filter(c => isVisible(c.key));

  function getIndexCardProps(c: typeof ALL_INDEX_CARDS[0]) {
    const d = indices[c.key];
    return {
      label: c.label,
      value: d ? d.price.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : "--",
      change: d?.change || 0,
      changePercent: d?.changePercent || 0,
      symbol: c.symbol,
      chartType: "index" as const,
      chartCurrentPrice: d?.price,
    };
  }

  function getCommodityCardProps(c: typeof ALL_COMMODITY_CARDS[0]) {
    switch (c.key) {
      case "gold_vnd": return {
        label: c.label,
        value: gold ? new Intl.NumberFormat("vi-VN").format(gold.priceVndLuong) : "--",
        change: gold?.change || 0,
        changePercent: gold?.changePercent || 0,
        symbol: "SJC_VND",
        chartType: "gold" as const,
        chartCurrentPrice: gold?.priceVndLuong,
      };
      case "gold_usd": return {
        label: c.label,
        value: gold ? `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(gold.priceUsdOz)}` : "--",
        change: gold?.changePercent ? gold.priceUsdOz * 0.001 : 0,
        changePercent: gold?.changePercent || 0,
        symbol: "XAU",
        chartType: "gold" as const,
        chartCurrentPrice: gold?.priceUsdOz,
      };
      case "wti": return {
        label: c.label,
        value: oil?.WTI ? `$${oil.WTI.price.toFixed(2)}` : "--",
        change: oil?.WTI?.change || 0,
        changePercent: oil?.WTI?.changePercent || 0,
        symbol: "WTI",
        chartType: "oil" as const,
        chartCurrentPrice: oil?.WTI?.price,
      };
      case "brent": return {
        label: c.label,
        value: oil?.BRENT ? `$${oil.BRENT.price.toFixed(2)}` : "--",
        change: oil?.BRENT?.change || 0,
        changePercent: oil?.BRENT?.changePercent || 0,
        symbol: "BRENT",
        chartType: "oil" as const,
        chartCurrentPrice: oil?.BRENT?.price,
      };
      default: return { label: c.key, value: "--", change: 0, changePercent: 0, symbol: c.key, chartType: "gold" as const };
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

      {/* Market Indices with mini charts */}
      {visibleIndexCards.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Chỉ số thị trường</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleIndexCards.map(c => {
              const props = getIndexCardProps(c);
              return (
                <MiniChartCard
                  key={c.key}
                  loading={isLoading}
                  {...props}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Commodities with mini charts */}
      {visibleCommodityCards.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Hàng hóa</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {visibleCommodityCards.map(c => {
              const props = getCommodityCardProps(c);
              return (
                <MiniChartCard
                  key={c.key}
                  loading={isLoading}
                  {...props}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Crypto - only selected coins */}
      {cryptoIds.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Tiền điện tử</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {cryptoIds.map((id) => (
              <CryptoMiniCard key={id} id={id} data={crypto[id]} />
            ))}
          </div>
        </section>
      )}

      {/* News - Vietstock international finance + industry */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-card-border rounded-xl p-4">
            <NewsSection endpoint="/api/news/intl-finance" title="Tài chính quốc tế" maxItems={5} />
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4">
            <NewsSection endpoint="/api/news/industry" title="Kinh tế - Đầu tư" maxItems={5} />
          </div>
        </div>
      </section>

      {showSettings && (
        <SettingsPanel
          visibleCards={visibleCards}
          onToggle={toggleCard}
          cryptoIds={cryptoIds}
          onCryptoToggle={toggleCrypto}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
