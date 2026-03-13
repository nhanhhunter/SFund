import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, RefreshCw, X, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";
import PriceChart from "@/components/PriceChart";
import NewsSection from "@/components/NewsSection";
import { queryClient, fetchJson } from "@/lib/queryClient";

const ALL_INDEX_CARDS = [
  { key: "vnIndex", label: "VN-Index", symbol: "VNINDEX", type: "index" as const },
  { key: "hnxIndex", label: "HNX-Index", symbol: "HNXINDEX", type: "index" as const },
  { key: "upcom", label: "UPCOM", symbol: "UPCOMINDEX", type: "index" as const },
  { key: "sp500", label: "S&P 500", symbol: "^GSPC", type: "index" as const },
  { key: "dowJones", label: "Dow Jones", symbol: "^DJI", type: "index" as const },
  { key: "nasdaqComposite", label: "Nasdaq Composite", symbol: "^IXIC", type: "index" as const },
];

const ALL_COMMODITY_CARDS = [
  { key: "gold_usd", label: "Vàng (USD/Oz)", symbol: "XAU", type: "gold" as const },
  { key: "gold_vnd", label: "Vàng SJC 9999", symbol: "SJC_VND", type: "gold" as const },
  { key: "brent", label: "Dầu Brent (USD/bbl)", symbol: "BRENT", type: "oil" as const },
  { key: "wti", label: "Dầu WTI (USD/bbl)", symbol: "WTI", type: "oil" as const },
];

const DEFAULT_INDEX_CARD_KEYS = ["vnIndex", "hnxIndex", "upcom", "sp500", "dowJones", "nasdaqComposite"];
const DEFAULT_COMMODITY_CARD_KEYS = ["gold_usd", "gold_vnd", "brent", "wti"];
const DEFAULT_CRYPTO_IDS = ["bitcoin", "ethereum"];

const CRYPTO_NAMES: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  binancecoin: "BNB",
  solana: "SOL",
  ripple: "XRP",
  cardano: "ADA",
  dogecoin: "DOGE",
  tron: "TRX",
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

function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const set = useCallback((nextValue: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof nextValue === "function" ? (nextValue as (prev: T) => T)(prev) : nextValue;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [key]);

  return [value, set] as const;
}

function MiniChartCard({
  label,
  value,
  change,
  changePercent,
  loading,
  symbol,
  chartType,
  chartCurrentPrice,
  onRemove,
}: {
  label: string;
  value: string;
  change: number;
  changePercent: number;
  loading: boolean;
  symbol: string;
  chartType: "index" | "gold" | "oil";
  chartCurrentPrice?: number;
  onRemove: () => void;
}) {
  if (loading) return <Skeleton className="h-32 rounded-xl" />;
  const up = changePercent >= 0;

  return (
    <div className="group relative bg-card border border-card-border rounded-xl p-4 hover:shadow-sm transition-shadow">
      <button
        onClick={onRemove}
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
        aria-label={`Ẩn ${label}`}
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      <div className="flex items-center justify-between mb-1 pl-6">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <span className={cn("flex items-center gap-0.5 text-xs font-semibold", getChangeColor(changePercent))}>
          {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {formatPercent(changePercent)}
        </span>
      </div>
      <p className="text-xl font-bold text-foreground mb-0.5">{value}</p>
      <p className={cn("text-xs mb-2", getChangeColor(change))}>
        {change >= 0 ? "+" : ""}
        {typeof change === "number" ? change.toFixed(2) : change}
      </p>
      <PriceChart type={chartType} symbol={symbol} days={7} currentPrice={chartCurrentPrice} mini height={48} />
    </div>
  );
}

function CryptoMiniCard({ id, data, onRemove }: { id: string; data: any; onRemove: () => void }) {
  if (!data) return <Skeleton className="h-16 rounded-xl" />;
  const change = data.usd_24h_change || 0;

  return (
    <div className="group relative bg-card border border-card-border rounded-xl px-3 py-2.5 hover:shadow-sm transition-shadow">
      <button
        onClick={onRemove}
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
        aria-label={`Ẩn ${CRYPTO_NAMES[id] || id.toUpperCase()}`}
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      <div className="flex justify-between items-center pl-6">
        <span className="text-xs font-semibold text-foreground">{CRYPTO_NAMES[id] || id.toUpperCase()}</span>
        <span className={cn("text-xs font-medium", getChangeColor(change))}>{formatPercent(change)}</span>
      </div>
      <p className="text-sm font-bold text-foreground mt-0.5">{formatCurrency(data.usd)}</p>
    </div>
  );
}

function AddCardSearch<T extends { key?: string; id?: string; label: string }>({
  placeholder,
  options,
  existingIds,
  onAdd,
}: {
  placeholder: string;
  options: T[];
  existingIds: string[];
  onAdd: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const available = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return options.filter((option) => {
      const id = (option.key || option.id) as string;
      if (existingIds.includes(id)) return false;
      if (!normalizedQuery) return true;
      return option.label.toLowerCase().includes(normalizedQuery) || id.toLowerCase().includes(normalizedQuery);
    });
  }, [existingIds, options, query]);

  return (
    <div ref={ref} className="relative w-full sm:w-64">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {open && (
        <div className="absolute left-0 top-9 z-50 bg-card border border-card-border rounded-xl shadow-lg w-full py-1 max-h-64 overflow-y-auto">
          {available.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2">
              {existingIds.length >= options.length ? "Đã thêm tất cả mục" : "Không tìm thấy kết quả"}
            </p>
          ) : (
            available.map((option) => {
              const id = (option.key || option.id) as string;
              return (
                <button
                  key={id}
                  className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                  onClick={() => {
                    onAdd(id);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <p className="text-sm font-semibold text-foreground">{option.label}</p>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [indexKeys, setIndexKeys] = useLocalStorage<string[]>("dashboard_index_card_keys", DEFAULT_INDEX_CARD_KEYS);
  const [commodityKeys, setCommodityKeys] = useLocalStorage<string[]>("dashboard_commodity_card_keys", DEFAULT_COMMODITY_CARD_KEYS);
  const [cryptoIds, setCryptoIds] = useLocalStorage<string[]>("dashboard_crypto_ids", DEFAULT_CRYPTO_IDS);

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

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("vi-VN") : "--";

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/market-overview"] });
    queryClient.invalidateQueries({ queryKey: ["/api/prices/crypto"] });
  };

  const indices: Record<string, any> = {
    vnIndex: overview?.vnIndex,
    hnxIndex: overview?.hnxIndex,
    upcom: overview?.upcom,
    sp500: overview?.sp500,
    dowJones: overview?.dowJones,
    nasdaqComposite: overview?.nasdaqComposite,
  };

  const gold = overview?.gold;
  const oil = overview?.oil;
  const crypto = cryptoData || overview?.crypto || {};

  const visibleIndexCards = ALL_INDEX_CARDS.filter((card) => indexKeys.includes(card.key));
  const visibleCommodityCards = ALL_COMMODITY_CARDS.filter((card) => commodityKeys.includes(card.key));

  const addIndexCard = (key: string) => {
    setIndexKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const removeIndexCard = (key: string) => {
    setIndexKeys((prev) => prev.filter((item) => item !== key));
  };

  const addCommodityCard = (key: string) => {
    setCommodityKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const removeCommodityCard = (key: string) => {
    setCommodityKeys((prev) => prev.filter((item) => item !== key));
  };

  const addCryptoCard = (id: string) => {
    setCryptoIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const removeCryptoCard = (id: string) => {
    setCryptoIds((prev) => prev.filter((item) => item !== id));
  };

  const getIndexCardProps = (card: (typeof ALL_INDEX_CARDS)[0]) => {
    const data = indices[card.key];
    return {
      label: card.label,
      value: data ? data.price.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : "--",
      change: data?.change || 0,
      changePercent: data?.changePercent || 0,
      symbol: card.symbol,
      chartType: "index" as const,
      chartCurrentPrice: data?.price,
    };
  };

  const getCommodityCardProps = (card: (typeof ALL_COMMODITY_CARDS)[0]) => {
    switch (card.key) {
      case "gold_usd":
        return {
          label: card.label,
          value: gold?.XAU ? `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(gold.XAU.priceUsdOz)}` : "--",
          change: gold?.XAU?.changeUsdOz || 0,
          changePercent: gold?.XAU?.changePercent || 0,
          symbol: "XAU",
          chartType: "gold" as const,
          chartCurrentPrice: gold?.XAU?.priceUsdOz,
        };
      case "gold_vnd":
        return {
          label: card.label,
          value: gold?.SJC?.sell ? new Intl.NumberFormat("vi-VN").format(gold.SJC.sell) : "--",
          change: 0,
          changePercent: 0,
          symbol: "SJC_VND",
          chartType: "gold" as const,
          chartCurrentPrice: gold?.SJC?.sell,
        };
      case "brent":
        return {
          label: card.label,
          value: oil?.BRENT ? `$${oil.BRENT.price.toFixed(2)}` : "--",
          change: oil?.BRENT?.change || 0,
          changePercent: oil?.BRENT?.changePercent || 0,
          symbol: "BRENT",
          chartType: "oil" as const,
          chartCurrentPrice: oil?.BRENT?.price,
        };
      case "wti":
        return {
          label: card.label,
          value: oil?.WTI ? `$${oil.WTI.price.toFixed(2)}` : "--",
          change: oil?.WTI?.change || 0,
          changePercent: oil?.WTI?.changePercent || 0,
          symbol: "WTI",
          chartType: "oil" as const,
          chartCurrentPrice: oil?.WTI?.price,
        };
      default:
        return {
          label: card.label,
          value: "--",
          change: 0,
          changePercent: 0,
          symbol: card.symbol,
          chartType: card.type,
        };
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tổng quan thị trường</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cập nhật lúc {lastUpdate}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Làm mới
          </Button>
        </div>
      </div>

      <section className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">Chỉ số thị trường</h2>
          <AddCardSearch
            placeholder="Tìm chỉ số để thêm..."
            options={ALL_INDEX_CARDS}
            existingIds={indexKeys}
            onAdd={addIndexCard}
          />
        </div>
        {visibleIndexCards.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleIndexCards.map((card) => (
              <MiniChartCard
                key={card.key}
                loading={isLoading}
                onRemove={() => removeIndexCard(card.key)}
                {...getIndexCardProps(card)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            Chưa có chỉ số nào.
          </div>
        )}
      </section>

      <section className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">Hàng hóa</h2>
          <AddCardSearch
            placeholder="Tìm hàng hóa để thêm..."
            options={ALL_COMMODITY_CARDS}
            existingIds={commodityKeys}
            onAdd={addCommodityCard}
          />
        </div>
        {visibleCommodityCards.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {visibleCommodityCards.map((card) => (
              <MiniChartCard
                key={card.key}
                loading={isLoading}
                onRemove={() => removeCommodityCard(card.key)}
                {...getCommodityCardProps(card)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            Chưa có hàng hóa nào.
          </div>
        )}
      </section>

      <section className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">Tiền điện tử</h2>
          <AddCardSearch
            placeholder="Tìm crypto để thêm..."
            options={ALL_CRYPTO_OPTIONS}
            existingIds={cryptoIds}
            onAdd={addCryptoCard}
          />
        </div>
        {cryptoIds.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {cryptoIds.map((id) => (
              <CryptoMiniCard key={id} id={id} data={crypto[id]} onRemove={() => removeCryptoCard(id)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            Chưa có crypto nào.
          </div>
        )}
      </section>

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
    </div>
  );
}
