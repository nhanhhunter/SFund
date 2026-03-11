import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, RefreshCw, Plus, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatPercent, getChangeColor, getChangeBg } from "@/lib/utils";
import PriceChart from "@/components/PriceChart";
import NewsSection from "@/components/NewsSection";
import { queryClient, fetchJson } from "@/lib/queryClient";

type Period = "1" | "7" | "30";

const CRYPTO_COLORS: Record<string, string> = {
  bitcoin: "#f7931a",
  ethereum: "#627eea",
  binancecoin: "#f3ba2f",
  solana: "#9945ff",
  ripple: "#346aa9",
  cardano: "#0033ad",
  dogecoin: "#c2a633",
  tron: "#ef0027",
  polkadot: "#e6007a",
  avalanche: "#e84142",
  chainlink: "#2a5ada",
  uniswap: "#ff007a",
  litecoin: "#bfbbbb",
  stellar: "#0d98ba",
};

const DEFAULT_COINS = ["bitcoin", "ethereum"];

function useLocalStorage<T>(key: string, def: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : def;
    } catch {
      return def;
    }
  });

  const set = (val: T) => {
    setV(val);
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  };

  return [v, set] as const;
}

function CoinSearchModal({
  onAdd,
  onClose,
  existingIds,
}: {
  onAdd: (id: string, symbol: string, name: string) => void;
  onClose: () => void;
  existingIds: string[];
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results, isLoading } = useQuery<any[]>({
    queryKey: ["/api/crypto/search", query],
    queryFn: () => (query.trim().length > 0 ? fetchJson(`/api/crypto/search?q=${encodeURIComponent(query)}`) : Promise.resolve([])),
    enabled: query.trim().length > 1,
    staleTime: 30_000,
  });

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-card-border rounded-2xl p-5 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">Thêm đồng coin</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Tìm Bitcoin, Ethereum, Solana..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {isLoading && query.length > 1 && <div className="p-3 text-center text-sm text-muted-foreground">Đang tìm...</div>}
          {results?.map((coin) => {
            const already = existingIds.includes(coin.id);
            return (
              <button
                key={coin.id}
                disabled={already}
                onClick={() => {
                  onAdd(coin.id, coin.symbol, coin.name);
                  onClose();
                }}
                className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors", already ? "opacity-40 cursor-not-allowed bg-muted" : "hover:bg-muted")}
              >
                {coin.thumb ? (
                  <img src={coin.thumb} className="w-7 h-7 rounded-full" alt={coin.symbol} />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-muted-foreground/20 flex items-center justify-center text-xs font-bold">
                    {coin.symbol?.slice(0, 2)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{coin.symbol}</span>
                    {coin.marketCapRank && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">#{coin.marketCapRank}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{coin.name}</p>
                </div>
                {already ? <span className="text-xs text-muted-foreground">Đã có</span> : <Plus className="w-4 h-4 text-muted-foreground" />}
              </button>
            );
          })}
          {results?.length === 0 && query.length > 1 && !isLoading && <p className="text-sm text-muted-foreground text-center py-4">Không tìm thấy kết quả</p>}
          {query.length <= 1 && <p className="text-sm text-muted-foreground text-center py-4">Nhập ít nhất 2 ký tự để tìm kiếm</p>}
        </div>
      </div>
    </div>
  );
}

function formatCompactUsd(value?: number) {
  if (!value) return "--";
  return formatCurrency(value, "compact");
}

export default function CryptoPage() {
  const [coins, setCoins] = useLocalStorage<Array<{ id: string; symbol: string; name: string }>>(
    "crypto_coins",
    DEFAULT_COINS.map((id) => ({
      id,
      symbol: id === "bitcoin" ? "BTC" : id === "ethereum" ? "ETH" : id.toUpperCase(),
      name: id === "bitcoin" ? "Bitcoin" : id === "ethereum" ? "Ethereum" : id,
    })),
  );
  const [selected, setSelected] = useState<string | null>(coins[0]?.id || null);
  const [period, setPeriod] = useState<Period>("7");
  const [showSearch, setShowSearch] = useState(false);

  const ids = coins.map((c) => c.id).join(",");

  const { data: prices, isLoading, dataUpdatedAt } = useQuery<Record<string, any>>({
    queryKey: ["/api/prices/crypto", ids],
    queryFn: () => (ids ? fetchJson(`/api/prices/crypto?ids=${ids}`) : Promise.resolve({})),
    enabled: !!ids,
    refetchInterval: 60_000,
  });

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("vi-VN") : "--";
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/prices/crypto", ids] });

  const selectedCoin = selected ? coins.find((c) => c.id === selected) : null;
  const selectedPrice = selected ? prices?.[selected] : null;

  const removeCoin = (id: string) => {
    const next = coins.filter((c) => c.id !== id);
    setCoins(next);
    if (selected === id) setSelected(next[0]?.id || null);
  };

  const addCoin = (id: string, symbol: string, name: string) => {
    if (!coins.find((c) => c.id === id)) {
      const next = [...coins, { id, symbol, name }];
      setCoins(next);
      setSelected(id);
    }
  };

  const days = period === "1" ? 1 : period === "7" ? 7 : 30;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tiền điện tử</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cập nhật lúc {lastUpdate} · 60 giây/lần</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowSearch(true)}>
            <Plus className="w-3.5 h-3.5" />
            Thêm coin
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={refresh}>
            <RefreshCw className="w-3.5 h-3.5" />
            Làm mới
          </Button>
        </div>
      </div>

      <section className="mb-6">
        {coins.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm mb-3">Chưa có coin nào</p>
            <Button size="sm" onClick={() => setShowSearch(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Thêm coin
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {coins.map((coin) => {
              const price = prices?.[coin.id];
              const change = price?.usd_24h_change || 0;
              const isActive = selected === coin.id;

              return (
                <div
                  key={coin.id}
                  onClick={() => setSelected(isActive ? null : coin.id)}
                  className={cn(
                    "rounded-xl border p-4 cursor-pointer transition-all group",
                    isActive ? "border-primary/30 bg-primary/5" : "border-card-border bg-card hover:border-border hover:shadow-sm",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: CRYPTO_COLORS[coin.id] || "#888" }}
                      >
                        {coin.symbol.slice(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{coin.symbol}</p>
                        <p className="text-xs text-muted-foreground truncate">{coin.name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isLoading && (
                        <span className={cn("px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1", getChangeBg(change))}>
                          {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {formatPercent(change)}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCoin(coin.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                        title="Xóa"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    {isLoading ? <Skeleton className="h-7 w-24" /> : <p className="text-xl font-bold text-foreground">{price ? formatCurrency(price.usd) : "--"}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-muted-foreground mb-1">Market Cap</p>
                      <p className="font-semibold text-foreground">{formatCompactUsd(price?.usd_market_cap)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-muted-foreground mb-1">Volume 24h</p>
                      <p className="font-semibold text-foreground">{formatCompactUsd(price?.usd_24h_vol)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="space-y-5">
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">
              {selectedCoin ? `Biểu đồ giá ${selectedCoin.symbol}` : "Biểu đồ thị trường Crypto"}
            </h3>
            <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
              {(["1", "7", "30"] as Period[]).map((p) => (
                <button
                  key={p}
                  data-testid={`btn-crypto-period-${p}`}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                    period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p === "1" ? "1N" : p === "7" ? "7N" : "30N"}
                </button>
              ))}
            </div>
          </div>
          <PriceChart
            type="crypto"
            symbol={selectedCoin?.id || "bitcoin"}
            days={days}
            currentPrice={selectedPrice?.usd || undefined}
            height={220}
            color={CRYPTO_COLORS[selectedCoin?.id || "bitcoin"] || "#888"}
          />
        </div>

        <div className="bg-card border border-card-border rounded-xl p-4">
          <NewsSection
            endpoint={selectedCoin ? `/api/news/crypto?categories=${selectedCoin.symbol}` : "/api/news/crypto"}
            title={selectedCoin ? `Tin tức về ${selectedCoin.symbol}` : "Tin tức Crypto"}
            maxItems={5}
          />
        </div>
      </div>

      {showSearch && (
        <CoinSearchModal onAdd={addCoin} onClose={() => setShowSearch(false)} existingIds={coins.map((c) => c.id)} />
      )}
    </div>
  );
}
