import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatPercent, formatVolume, getChangeColor, getChangeBg } from "@/lib/utils";
import { VN_STOCK_LIST } from "@shared/schema";
import PriceChart from "@/components/PriceChart";
import NewsSection from "@/components/NewsSection";
import { queryClient } from "@/lib/queryClient";

export default function StocksPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const symbols = VN_STOCK_LIST.map(s => s.symbol).join(",");

  const { data: prices, isLoading, dataUpdatedAt } = useQuery<Record<string, any>>({
    queryKey: ["/api/prices/vn-batch", symbols],
    queryFn: () => fetch(`/api/prices/vn-batch?symbols=${symbols}`).then(r => r.json()),
    refetchInterval: 60_000,
  });

  const filtered = VN_STOCK_LIST.filter(s =>
    s.symbol.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedStock = selected ? VN_STOCK_LIST.find(s => s.symbol === selected) : null;
  const selectedPrice = selected ? prices?.[selected] : null;
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("vi-VN") : "--";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cổ phiếu Việt Nam</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cập nhật lúc {lastUpdate}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/prices/vn-batch", symbols] })}>
          <RefreshCw className="w-3.5 h-3.5" />
          Làm mới
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: stock list */}
        <div className="lg:col-span-1">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-search-stock"
              className="pl-9 text-sm"
              placeholder="Tìm cổ phiếu..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
            {filtered.map(stock => {
              const price = prices?.[stock.symbol];
              const change = price?.changePercent || 0;
              const isActive = selected === stock.symbol;
              return (
                <button
                  key={stock.symbol}
                  data-testid={`stock-row-${stock.symbol}`}
                  onClick={() => setSelected(stock.symbol === selected ? null : stock.symbol)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left",
                    isActive
                      ? "border-primary/30 bg-primary/5"
                      : "border-card-border bg-card hover:border-border hover:shadow-sm"
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{stock.symbol}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-md font-medium", getChangeBg(change))}>
                        {formatPercent(change)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{stock.name}</p>
                  </div>
                  <div className="text-right">
                    {isLoading ? (
                      <Skeleton className="h-4 w-16" />
                    ) : (
                      <>
                        <p className="text-sm font-bold text-foreground">
                          {price ? `${(price.price / 1000).toFixed(1)}K` : "--"}
                        </p>
                        <p className={cn("text-xs", getChangeColor(change))}>
                          {price ? (change >= 0 ? "+" : "") + change.toFixed(2) + "%" : ""}
                        </p>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: detail */}
        <div className="lg:col-span-2 space-y-5">
          {selectedStock && selectedPrice ? (
            <>
              {/* Stock header */}
              <div className="bg-card border border-card-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">{selectedStock.symbol}</h2>
                    <p className="text-muted-foreground text-sm">{selectedStock.name} · {selectedStock.exchange}</p>
                  </div>
                  <span className={cn("px-3 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-1.5", getChangeBg(selectedPrice.changePercent))}>
                    {selectedPrice.changePercent >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {formatPercent(selectedPrice.changePercent)}
                  </span>
                </div>
                <p className="text-3xl font-bold text-foreground mb-1">
                  {new Intl.NumberFormat("vi-VN").format(selectedPrice.price)}đ
                </p>
                <p className={cn("text-sm font-medium", getChangeColor(selectedPrice.change))}>
                  {selectedPrice.change >= 0 ? "+" : ""}{new Intl.NumberFormat("vi-VN").format(selectedPrice.change)}đ
                </p>
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Cao nhất</p>
                    <p className="text-sm font-semibold text-foreground">{selectedPrice.high ? `${(selectedPrice.high / 1000).toFixed(1)}K` : "--"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Thấp nhất</p>
                    <p className="text-sm font-semibold text-foreground">{selectedPrice.low ? `${(selectedPrice.low / 1000).toFixed(1)}K` : "--"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Khối lượng</p>
                    <p className="text-sm font-semibold text-foreground">{selectedPrice.volume ? formatVolume(selectedPrice.volume) : "--"}</p>
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-4">Biểu đồ giá 30 ngày</h3>
                <PriceChart type="stock" symbol={selectedStock.symbol} days={30} height={200} />
              </div>

              {/* News */}
              <div className="bg-card border border-card-border rounded-xl p-4">
                <NewsSection
                  endpoint={`/api/news/stocks?topic=financial_markets&tickers=${selectedStock.symbol}`}
                  title={`Tin tức về ${selectedStock.symbol}`}
                  maxItems={5}
                />
              </div>
            </>
          ) : (
            <div>
              <div className="bg-card border border-card-border rounded-xl p-4 mb-5">
                <h3 className="text-sm font-semibold mb-4">Top cổ phiếu hôm nay</h3>
                <div className="grid grid-cols-2 gap-3">
                  {VN_STOCK_LIST.slice(0, 6).map(s => {
                    const p = prices?.[s.symbol];
                    return (
                      <button
                        key={s.symbol}
                        onClick={() => setSelected(s.symbol)}
                        className="bg-background border border-border rounded-xl p-3 text-left hover:shadow-sm transition-all hover:border-primary/20"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-sm">{s.symbol}</span>
                          {p && (
                            <span className={cn("text-xs font-medium", getChangeColor(p.changePercent))}>
                              {formatPercent(p.changePercent)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{s.name}</p>
                        <div className="h-12 mt-2">
                          <PriceChart type="stock" symbol={s.symbol} days={14} height={48} mini />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="bg-card border border-card-border rounded-xl p-4">
                <NewsSection endpoint="/api/news/stocks" title="Tin tức thị trường chứng khoán" maxItems={5} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
