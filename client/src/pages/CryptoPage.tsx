import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatPercent, getChangeColor, getChangeBg } from "@/lib/utils";
import { CRYPTO_LIST } from "@shared/schema";
import PriceChart from "@/components/PriceChart";
import NewsSection from "@/components/NewsSection";
import { queryClient } from "@/lib/queryClient";

const CRYPTO_ICONS: Record<string, string> = {
  bitcoin: "₿", ethereum: "Ξ", binancecoin: "BNB", solana: "◎",
  ripple: "XRP", cardano: "ADA", dogecoin: "Ð", tron: "TRX",
};

const CRYPTO_COLORS: Record<string, string> = {
  bitcoin: "#f7931a", ethereum: "#627eea", binancecoin: "#f3ba2f",
  solana: "#9945ff", ripple: "#346aa9", cardano: "#0033ad",
  dogecoin: "#c2a633", tron: "#ef0027",
};

export default function CryptoPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const ids = CRYPTO_LIST.map(c => c.symbol).join(",");

  const { data: prices, isLoading, dataUpdatedAt } = useQuery<Record<string, any>>({
    queryKey: ["/api/prices/crypto", ids],
    queryFn: () => fetch(`/api/prices/crypto?ids=${ids}`).then(r => r.json()),
    refetchInterval: 60_000,
  });

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("vi-VN") : "--";
  const selectedCrypto = selected ? CRYPTO_LIST.find(c => c.symbol === selected) : null;
  const selectedPrice = selected ? prices?.[selected] : null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/prices/crypto", ids] });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tiền điện tử</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cập nhật lúc {lastUpdate}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={refresh}>
          <RefreshCw className="w-3.5 h-3.5" />
          Làm mới
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Crypto list */}
        <div className="lg:col-span-1 space-y-2">
          {CRYPTO_LIST.map(crypto => {
            const price = prices?.[crypto.symbol];
            const change = price?.usd_24h_change || 0;
            const isActive = selected === crypto.symbol;
            return (
              <button
                key={crypto.symbol}
                data-testid={`crypto-row-${crypto.symbol}`}
                onClick={() => setSelected(crypto.symbol === selected ? null : crypto.symbol)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left",
                  isActive
                    ? "border-primary/30 bg-primary/5"
                    : "border-card-border bg-card hover:border-border hover:shadow-sm"
                )}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: CRYPTO_COLORS[crypto.symbol] || "#888" }}
                >
                  {CRYPTO_ICONS[crypto.symbol] || crypto.ticker.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{crypto.ticker}</span>
                    <span className={cn("text-xs font-medium", getChangeColor(change))}>
                      {formatPercent(change)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-muted-foreground">{crypto.name}</span>
                    {isLoading ? (
                      <Skeleton className="h-3 w-16" />
                    ) : (
                      <span className="text-xs font-bold text-foreground">
                        {price ? formatCurrency(price.usd) : "--"}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2 space-y-5">
          {selectedCrypto && selectedPrice ? (
            <>
              <div
                className="rounded-2xl p-6 border"
                style={{
                  background: `linear-gradient(135deg, ${CRYPTO_COLORS[selectedCrypto.symbol]}15, ${CRYPTO_COLORS[selectedCrypto.symbol]}05)`,
                  borderColor: `${CRYPTO_COLORS[selectedCrypto.symbol]}30`,
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold"
                      style={{ backgroundColor: CRYPTO_COLORS[selectedCrypto.symbol] || "#888" }}
                    >
                      {CRYPTO_ICONS[selectedCrypto.symbol] || selectedCrypto.ticker.slice(0, 2)}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{selectedCrypto.ticker}</h2>
                      <p className="text-muted-foreground text-sm">{selectedCrypto.name}</p>
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
                <h3 className="text-sm font-semibold mb-4">Biểu đồ giá 30 ngày</h3>
                <PriceChart
                  type="crypto"
                  symbol={selectedCrypto.symbol}
                  days={30}
                  height={200}
                  color={CRYPTO_COLORS[selectedCrypto.symbol]}
                />
              </div>

              <div className="bg-card border border-card-border rounded-xl p-4">
                <NewsSection
                  endpoint={`/api/news/crypto?categories=${selectedCrypto.ticker}`}
                  title={`Tin tức về ${selectedCrypto.ticker}`}
                  maxItems={5}
                />
              </div>
            </>
          ) : (
            <>
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-4">Thị trường Crypto - Biểu đồ Bitcoin</h3>
                <PriceChart type="crypto" symbol="bitcoin" days={30} height={220} color={CRYPTO_COLORS.bitcoin} />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {CRYPTO_LIST.slice(0, 4).map(c => {
                  const p = prices?.[c.symbol];
                  return (
                    <button
                      key={c.symbol}
                      onClick={() => setSelected(c.symbol)}
                      className="bg-card border border-card-border rounded-xl p-3 text-left hover:shadow-sm transition-all hover:border-primary/20"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-sm">{c.ticker}</span>
                        {p && <span className={cn("text-xs", getChangeColor(p.usd_24h_change))}>{formatPercent(p.usd_24h_change)}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{p ? formatCurrency(p.usd) : "--"}</p>
                      <div className="h-12 mt-2">
                        <PriceChart type="crypto" symbol={c.symbol} days={14} height={48} mini color={CRYPTO_COLORS[c.symbol]} />
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="bg-card border border-card-border rounded-xl p-4">
                <NewsSection endpoint="/api/news/crypto" title="Tin tức Crypto" maxItems={5} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
