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
  bitcoin: "#f7931a", ethereum: "#627eea", binancecoin: "#f3ba2f",
  solana: "#9945ff", ripple: "#346aa9", cardano: "#0033ad",
  dogecoin: "#c2a633", tron: "#ef0027", polkadot: "#e6007a",
  avalanche: "#e84142", chainlink: "#2a5ada", uniswap: "#ff007a",
  litecoin: "#bfbbbb", stellar: "#0d98ba",
};

const DEFAULT_COINS = ["bitcoin", "ethereum"];

function useLocalStorage<T>(key: string, def: T) {
  const [v, setV] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; }
  });
  const set = (val: T) => { setV(val); try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
  return [v, set] as const;
}

function CoinSearchModal({ onAdd, onClose, existingIds }: {
  onAdd: (id: string, symbol: string, name: string) => void;
  onClose: () => void;
  existingIds: string[];
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results, isLoading } = useQuery<any[]>({
    queryKey: ["/api/crypto/search", query],
    queryFn: () => query.trim().length > 0
      ? fetchJson(`/api/crypto/search?q=${encodeURIComponent(query)}`)
      : Promise.resolve([]),
    enabled: query.trim().length > 1,
    staleTime: 30000,
  });

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-card-border rounded-2xl p-5 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">Thêm đồng coin</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Tìm Bitcoin, Ethereum, Solana..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9"
            data-testid="input-crypto-search"
          />
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {isLoading && query.length > 1 && (
            <div className="p-3 text-center text-sm text-muted-foreground">Đang tìm...</div>
          )}
          {results?.map(coin => {
            const already = existingIds.includes(coin.id);
            return (
              <button
                key={coin.id}
                disabled={already}
                onClick={() => { onAdd(coin.id, coin.symbol, coin.name); onClose(); }}
                data-testid={`crypto-search-result-${coin.id}`}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
                  already ? "opacity-40 cursor-not-allowed bg-muted" : "hover:bg-muted"
                )}
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
                    {coin.marketCapRank && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">#{coin.marketCapRank}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{coin.name}</p>
                </div>
                {already ? (
                  <span className="text-xs text-muted-foreground">Đã có</span>
                ) : (
                  <Plus className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            );
          })}
          {results?.length === 0 && query.length > 1 && !isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">Không tìm thấy kết quả</p>
          )}
          {query.length <= 1 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nhập ít nhất 2 ký tự để tìm kiếm</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CryptoPage() {
  const [coins, setCoins] = useLocalStorage<Array<{id: string; symbol: string; name: string}>>(
    "crypto_coins",
    DEFAULT_COINS.map(id => ({
      id,
      symbol: id === "bitcoin" ? "BTC" : id === "ethereum" ? "ETH" : id.toUpperCase(),
      name: id === "bitcoin" ? "Bitcoin" : id === "ethereum" ? "Ethereum" : id,
    }))
  );
  const [selected, setSelected] = useState<string | null>(coins[0]?.id || null);
  const [period, setPeriod] = useState<Period>("7");
  const [showSearch, setShowSearch] = useState(false);

  const ids = coins.map(c => c.id).join(",");

  const { data: prices, isLoading, dataUpdatedAt } = useQuery<Record<string, any>>({
    queryKey: ["/api/prices/crypto", ids],
    queryFn: () => ids ? fetchJson(`/api/prices/crypto?ids=${ids}`) : Promise.resolve({}),
    enabled: !!ids,
    refetchInterval: 60_000,
  });

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("vi-VN") : "--";

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/prices/crypto", ids] });

  const selectedCoin = selected ? coins.find(c => c.id === selected) : null;
  const selectedPrice = selected ? prices?.[selected] : null;

  const removeCoin = (id: string) => {
    const next = coins.filter(c => c.id !== id);
    setCoins(next);
    if (selected === id) setSelected(next[0]?.id || null);
  };

  const addCoin = (id: string, symbol: string, name: string) => {
    if (!coins.find(c => c.id === id)) {
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
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowSearch(true)} data-testid="btn-add-crypto">
            <Plus className="w-3.5 h-3.5" />
            Thêm coin
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={refresh}>
            <RefreshCw className="w-3.5 h-3.5" />
            Làm mới
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coin list */}
        <div className="lg:col-span-1 space-y-2">
          {coins.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm mb-3">Chưa có coin nào</p>
              <Button size="sm" onClick={() => setShowSearch(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Thêm coin
              </Button>
            </div>
          )}
          {coins.map(coin => {
            const price = prices?.[coin.id];
            const change = price?.usd_24h_change || 0;
            const isActive = selected === coin.id;
            return (
              <div
                key={coin.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl border transition-all group",
                  isActive
                    ? "border-primary/30 bg-primary/5"
                    : "border-card-border bg-card hover:border-border hover:shadow-sm"
                )}
              >
                <button
                  className="flex items-center gap-3 flex-1 text-left min-w-0"
                  onClick={() => setSelected(isActive ? null : coin.id)}
                  data-testid={`crypto-row-${coin.id}`}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: CRYPTO_COLORS[coin.id] || "#888" }}
                  >
                    {coin.symbol.slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{coin.symbol}</span>
                      {isLoading ? <Skeleton className="h-3 w-12" /> : (
                        <span className={cn("text-xs font-medium", getChangeColor(change))}>
                          {formatPercent(change)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">{coin.name}</span>
                      {isLoading ? <Skeleton className="h-3 w-16" /> : (
                        <span className="text-xs font-bold text-foreground">
                          {price ? formatCurrency(price.usd) : "--"}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => removeCoin(coin.id)}
                  data-testid={`btn-remove-crypto-${coin.id}`}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive shrink-0"
                  title="Xóa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2 space-y-5">
          {selectedCoin && selectedPrice ? (
            <>
              <div
                className="rounded-2xl p-6 border"
                style={{
                  background: `linear-gradient(135deg, ${CRYPTO_COLORS[selectedCoin.id] || "#888"}15, ${CRYPTO_COLORS[selectedCoin.id] || "#888"}05)`,
                  borderColor: `${CRYPTO_COLORS[selectedCoin.id] || "#888"}30`,
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: CRYPTO_COLORS[selectedCoin.id] || "#888" }}
                    >
                      {selectedCoin.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{selectedCoin.symbol}</h2>
                      <p className="text-muted-foreground text-sm">{selectedCoin.name}</p>
                    </div>
                  </div>
                  <span className={cn("px-3 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-1", getChangeBg(selectedPrice.usd_24h_change))}>
                    {selectedPrice.usd_24h_change >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {formatPercent(selectedPrice.usd_24h_change)}
                  </span>
                </div>
                <p className="text-3xl font-bold text-foreground">{formatCurrency(selectedPrice.usd)}</p>
                {selectedPrice.usd_market_cap && (
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/50">
                    <div>
                      <p className="text-xs text-muted-foreground">Market Cap</p>
                      <p className="text-sm font-semibold">${(selectedPrice.usd_market_cap / 1e9).toFixed(2)}B</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Volume 24h</p>
                      <p className="text-sm font-semibold">{selectedPrice.usd_24h_vol ? `$${(selectedPrice.usd_24h_vol / 1e9).toFixed(2)}B` : "--"}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-card border border-card-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Biểu đồ giá {selectedCoin.symbol}</h3>
                  <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                    {(["1", "7", "30"] as Period[]).map(p => (
                      <button
                        key={p}
                        data-testid={`btn-crypto-period-${p}`}
                        onClick={() => setPeriod(p)}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                          period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {p === "1" ? "1N" : p === "7" ? "7N" : "30N"}
                      </button>
                    ))}
                  </div>
                </div>
                <PriceChart
                  type="crypto"
                  symbol={selectedCoin.id}
                  days={days}
                  currentPrice={selectedPrice.usd || undefined}
                  height={200}
                  color={CRYPTO_COLORS[selectedCoin.id] || "#888"}
                />
              </div>

              <div className="bg-card border border-card-border rounded-xl p-4">
                <NewsSection
                  endpoint={`/api/news/crypto?categories=${selectedCoin.symbol}`}
                  title={`Tin tức về ${selectedCoin.symbol}`}
                  maxItems={5}
                />
              </div>
            </>
          ) : (
            <>
              <div className="bg-card border border-card-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Biểu đồ thị trường Crypto</h3>
                  <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                    {(["1", "7", "30"] as Period[]).map(p => (
                      <button key={p} onClick={() => setPeriod(p)} className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                        period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                      )}>
                        {p === "1" ? "1N" : p === "7" ? "7N" : "30N"}
                      </button>
                    ))}
                  </div>
                </div>
                <PriceChart type="crypto" symbol="bitcoin" days={days} height={220} color={CRYPTO_COLORS.bitcoin} />
              </div>
              <div className="bg-card border border-card-border rounded-xl p-4">
                <NewsSection endpoint="/api/news/crypto" title="Tin tức Crypto" maxItems={5} />
              </div>
            </>
          )}
        </div>
      </div>

      {showSearch && (
        <CoinSearchModal
          onAdd={addCoin}
          onClose={() => setShowSearch(false)}
          existingIds={coins.map(c => c.id)}
        />
      )}
    </div>
  );
}
