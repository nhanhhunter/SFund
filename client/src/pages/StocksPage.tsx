import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, fetchJson } from "@/lib/queryClient";
import { RefreshCw, Plus, X, Search, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import PriceChart from "@/components/PriceChart";
import NewsSection from "@/components/NewsSection";

// ─── Constants ──────────────────────────────────────────────────────────────

const ALL_INDICES = [
  { symbol: "VNINDEX", name: "VN-Index", description: "Sàn HOSE tổng hợp" },
  { symbol: "HNXINDEX", name: "HNX-Index", description: "Sàn HNX tổng hợp" },
  { symbol: "UPCOMINDEX", name: "UPCOM", description: "Sàn UpCOM tổng hợp" },
  { symbol: "VN30", name: "VN30", description: "30 cổ phiếu vốn hóa lớn HOSE" },
  { symbol: "HNX30", name: "HNX30", description: "30 cổ phiếu hàng đầu HNX" },
  { symbol: "VN100", name: "VN100", description: "100 cổ phiếu hàng đầu HOSE" },
  { symbol: "VNSmallCap", name: "VNSmallCap", description: "Cổ phiếu vốn hóa nhỏ" },
  { symbol: "VNMidCap", name: "VNMidCap", description: "Cổ phiếu vốn hóa vừa" },
  { symbol: "VNAllShare", name: "VNAllShare", description: "Toàn bộ cổ phiếu HOSE" },
  { symbol: "VNDiamond", name: "VNDiamond", description: "Cổ phiếu room ngoại cao" },
];

const DEFAULT_INDICES = ["VNINDEX", "HNXINDEX", "UPCOMINDEX", "VN30", "HNX30", "VN100"];
const DEFAULT_PINNED = [
  { symbol: "VNM", name: "Vinamilk" },
  { symbol: "FPT", name: "FPT Corporation" },
  { symbol: "VCB", name: "Vietcombank" },
  { symbol: "HPG", name: "Hòa Phát" },
  { symbol: "ACB", name: "ACB" },
];

type Period = "1" | "7" | "30";

function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const set = useCallback((v: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [value, set] as const;
}

function useStockSearch(query: string) {
  return useQuery<Array<{ symbol: string; name: string; exchange: string }>>({
    queryKey: ["/api/stocks/search", query],
    queryFn: () => fetchJson(`/api/stocks/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 1,
    staleTime: 30_000,
  });
}

// ─── Change Chip ──────────────────────────────────────────────────────────

function ChangeChip({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-xs font-semibold",
      up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
    )}>
      {up ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

// ─── Exchange badge ───────────────────────────────────────────────────────

const EX_BADGE: Record<string, string> = {
  HOSE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  HNX: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  UpCOM: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

// ─── IndexCard ────────────────────────────────────────────────────────────

function IndexCard({ symbol, name, data, period, onRemove, onSelect, selected }: {
  symbol: string; name: string; data: any; period: Period;
  onRemove: () => void; onSelect: () => void; selected: boolean;
}) {
  const price = data?.price ?? 0;
  const changePercent = data?.changePercent ?? 0;
  const change = data?.change ?? 0;
  const up = changePercent >= 0;

  return (
    <div
      data-testid={`card-index-${symbol}`}
      onClick={onSelect}
      className={cn(
        "group relative bg-card border rounded-xl p-4 cursor-pointer transition-all duration-150",
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-card-border hover:border-muted-foreground/40 hover:shadow-sm",
      )}
    >
      <button
        data-testid={`btn-remove-index-${symbol}`}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
        aria-label="Xóa chỉ số"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      <div className="flex items-start justify-between mb-1 pr-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{name}</p>
        {data ? <ChangeChip value={changePercent} /> : <Skeleton className="h-4 w-14" />}
      </div>

      {data ? (
        <p className="text-xl font-bold text-foreground mb-0.5">
          {price.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}
        </p>
      ) : (
        <Skeleton className="h-7 w-24 mb-1" />
      )}

      {data ? (
        <p className={cn("text-xs mb-2", up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500")}>
          {up ? "+" : ""}{change.toFixed(2)} điểm
        </p>
      ) : <div className="mb-2" />}

      <PriceChart
        type="index"
        symbol={symbol}
        days={period === "1" ? 1 : period === "7" ? 7 : 30}
        currentPrice={price || undefined}
        mini
        height={52}
      />
    </div>
  );
}

// ─── StockRow ─────────────────────────────────────────────────────────────

function StockRow({ symbol, data, onRemove, onSelect, selected }: {
  symbol: string; data: any; onRemove: () => void; onSelect: () => void; selected: boolean;
}) {
  const name = data?.name || symbol;
  const shortName = name.includes(" - ") ? name.split(" - ")[0] : name;
  const price = data?.price ?? 0;
  const changePercent = data?.changePercent ?? 0;
  const exchange = data?.exchange || "";

  return (
    <div
      data-testid={`row-stock-${symbol}`}
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
        selected ? "bg-primary/5" : "hover:bg-muted/40",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-foreground">{symbol}</span>
          {exchange && (
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", EX_BADGE[exchange] || "bg-muted text-muted-foreground")}>
              {exchange}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{shortName}</p>
      </div>

      <div className="w-16 h-8 shrink-0">
        {data && price ? (
          <PriceChart type="stock" symbol={symbol} days={7} currentPrice={price} mini height={32} />
        ) : null}
      </div>

      <div className="text-right min-w-[80px]">
        {data ? (
          <>
            <p className="text-sm font-semibold text-foreground">{(price / 1000).toFixed(1)}K</p>
            <ChangeChip value={changePercent} />
          </>
        ) : (
          <Skeleton className="h-8 w-16" />
        )}
      </div>
      <button
        data-testid={`btn-remove-stock-${symbol}`}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted ml-1 shrink-0"
        aria-label="Xóa cổ phiếu"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

// ─── Add Index Dropdown ───────────────────────────────────────────────────

function AddIndexDropdown({ existing, onAdd }: { existing: string[]; onAdd: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const available = ALL_INDICES.filter(i => !existing.includes(i.symbol));

  return (
    <div ref={ref} className="relative">
      <Button data-testid="btn-add-index" variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setOpen(v => !v)}>
        <Plus className="w-3.5 h-3.5" />
        Thêm chỉ số
      </Button>
      {open && (
        <div className="absolute right-0 top-9 z-50 bg-card border border-card-border rounded-xl shadow-lg w-64 py-1 max-h-72 overflow-y-auto">
          {available.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2">Đã thêm tất cả chỉ số</p>
          ) : available.map(i => (
            <button
              key={i.symbol}
              data-testid={`option-index-${i.symbol}`}
              className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
              onClick={() => { onAdd(i.symbol); setOpen(false); }}
            >
              <p className="text-sm font-semibold text-foreground">{i.name}</p>
              <p className="text-xs text-muted-foreground">{i.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add Stock Search ─────────────────────────────────────────────────────

function AddStockInput({ existing, onAdd }: { existing: string[]; onAdd: (symbol: string, name: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: results, isLoading } = useStockSearch(query);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (symbol: string, name: string) => {
    if (!existing.includes(symbol)) onAdd(symbol, name);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative w-64">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          data-testid="input-stock-search"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm cổ phiếu để thêm..."
          className="pl-8 h-8 text-sm"
        />
      </div>
      {open && query.length >= 1 && (
        <div className="absolute left-0 top-9 z-50 bg-card border border-card-border rounded-xl shadow-lg w-full py-1 max-h-64 overflow-y-auto">
          {isLoading && <p className="text-xs text-muted-foreground px-3 py-2">Đang tìm...</p>}
          {!isLoading && (!results || results.length === 0) && (
            <p className="text-xs text-muted-foreground px-3 py-2">Không tìm thấy kết quả</p>
          )}
          {results?.map(r => (
            <button
              key={r.symbol}
              data-testid={`option-stock-${r.symbol}`}
              disabled={existing.includes(r.symbol)}
              className={cn(
                "w-full text-left px-3 py-2 hover:bg-muted transition-colors",
                existing.includes(r.symbol) && "opacity-40 cursor-not-allowed"
              )}
              onClick={() => handleSelect(r.symbol, r.name)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{r.symbol}</span>
                {r.exchange && (
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", EX_BADGE[r.exchange] || "bg-muted text-muted-foreground")}>
                    {r.exchange}
                  </span>
                )}
                {existing.includes(r.symbol) && <span className="text-xs text-muted-foreground ml-auto">Đã thêm</span>}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {r.name.includes(" - ") ? r.name.split(" - ").slice(1).join(" - ") : r.name}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────

function DetailPanel({ item, type, onClose }: {
  item: { symbol: string; name?: string; data: any };
  type: "index" | "stock";
  onClose: () => void;
}) {
  const [localPeriod, setLocalPeriod] = useState<Period>("7");
  const price = item.data?.price ?? 0;
  const changePercent = item.data?.changePercent ?? 0;
  const change = item.data?.change ?? 0;
  const ceiling = item.data?.ceiling;
  const floor = item.data?.floor;
  const refPrice = item.data?.refPrice;
  const exchange = item.data?.exchange;
  const up = changePercent >= 0;
  const displayName = item.name || item.symbol;
  const shortName = displayName.includes(" - ") ? displayName.split(" - ")[0] : displayName;

  return (
    <div className="bg-card border border-card-border rounded-2xl p-5 mb-4" data-testid="panel-detail">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-foreground">{item.symbol}</h3>
            {type === "stock" && exchange && (
              <Badge variant="outline" className="text-xs">{exchange}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{shortName}</p>
        </div>
        <button
          data-testid="btn-close-detail"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-3xl font-bold text-foreground">
          {type === "stock"
            ? `${(price / 1000).toFixed(1)}K đ`
            : price.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}
        </span>
        <span className={cn("text-base font-semibold", up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500")}>
          {up ? "+" : ""}
          {type === "stock" ? `${(change / 1000).toFixed(1)}K` : change.toFixed(2)}
          {" "}({up ? "+" : ""}{changePercent.toFixed(2)}%)
        </span>
      </div>

      {type === "stock" && (ceiling || floor || refPrice) ? (
        <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 rounded-lg px-2 py-1.5 text-center">
            <p className="text-rose-600 dark:text-rose-400 font-medium">Trần</p>
            <p className="font-bold text-rose-700 dark:text-rose-300">{((ceiling || 0) / 1000).toFixed(1)}K</p>
          </div>
          <div className="bg-muted/50 rounded-lg px-2 py-1.5 text-center">
            <p className="text-muted-foreground font-medium">Tham chiếu</p>
            <p className="font-bold text-foreground">{((refPrice || 0) / 1000).toFixed(1)}K</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded-lg px-2 py-1.5 text-center">
            <p className="text-blue-600 dark:text-blue-400 font-medium">Sàn</p>
            <p className="font-bold text-blue-700 dark:text-blue-300">{((floor || 0) / 1000).toFixed(1)}K</p>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-1 mb-3">
        {(["1", "7", "30"] as Period[]).map(p => (
          <button
            key={p}
            data-testid={`btn-detail-period-${p}`}
            onClick={() => setLocalPeriod(p)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-lg transition-colors",
              localPeriod === p
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {p === "1" ? "1 ngày" : p === "7" ? "7 ngày" : "30 ngày"}
          </button>
        ))}
      </div>

      <PriceChart
        type={type}
        symbol={item.symbol}
        days={localPeriod === "1" ? 1 : localPeriod === "7" ? 7 : 30}
        currentPrice={price || undefined}
        height={200}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function StocksPage() {
  const [period, setPeriod] = useState<Period>("7");
  const [selectedItem, setSelectedItem] = useState<{ symbol: string; type: "index" | "stock" } | null>(null);
  const [indices, setIndices] = useLocalStorage<string[]>("vn_indices_pins", DEFAULT_INDICES);
  const [pinnedStocks, setPinnedStocks] = useLocalStorage<Array<{ symbol: string; name: string }>>(
    "vn_stocks_pins",
    DEFAULT_PINNED,
  );

  const { data: indicesData, isLoading: loadingIndices, dataUpdatedAt } = useQuery<any>({
    queryKey: ["/api/prices/indices"],
    refetchInterval: 60_000,
  });

  const pinnedSymbols = pinnedStocks.map(s => s.symbol);
  const { data: stockPrices } = useQuery<any>({
    queryKey: ["/api/prices/vn-batch", pinnedSymbols.join(",")],
    queryFn: () => fetchJson(`/api/prices/vn-batch?symbols=${pinnedSymbols.join(",")}`),
    enabled: pinnedSymbols.length > 0,
    refetchInterval: 60_000,
  });

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("vi-VN") : "--";

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/prices/indices"] });
    queryClient.invalidateQueries({ queryKey: ["/api/prices/vn-batch"] });
  };

  const addIndex = (symbol: string) =>
    setIndices(prev => prev.includes(symbol) ? prev : [...prev, symbol]);

  const removeIndex = (symbol: string) => {
    setIndices(prev => prev.filter(s => s !== symbol));
    if (selectedItem?.symbol === symbol) setSelectedItem(null);
  };

  const addStock = (symbol: string, name: string) =>
    setPinnedStocks(prev => prev.some(s => s.symbol === symbol) ? prev : [...prev, { symbol, name }]);

  const removeStock = (symbol: string) => {
    setPinnedStocks(prev => prev.filter(s => s.symbol !== symbol));
    if (selectedItem?.symbol === symbol) setSelectedItem(null);
  };

  const selectItem = (symbol: string, type: "index" | "stock") =>
    setSelectedItem(prev => prev?.symbol === symbol ? null : { symbol, type });

  const selectedData = selectedItem
    ? selectedItem.type === "index"
      ? {
          symbol: selectedItem.symbol,
          name: ALL_INDICES.find(i => i.symbol === selectedItem.symbol)?.name || selectedItem.symbol,
          data: indicesData?.[selectedItem.symbol],
        }
      : {
          symbol: selectedItem.symbol,
          name: pinnedStocks.find(s => s.symbol === selectedItem.symbol)?.name || selectedItem.symbol,
          data: stockPrices?.[selectedItem.symbol],
        }
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Thị trường Chứng khoán VN</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cập nhật lúc {lastUpdate} · Tự động làm mới mỗi 60 giây
          </p>
        </div>
        <Button data-testid="btn-refresh" variant="outline" size="sm" className="gap-2" onClick={refresh}>
          <RefreshCw className="w-3.5 h-3.5" />
          Làm mới
        </Button>
      </div>

      {/* Market Indices */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">Chỉ số thị trường</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
              {(["1", "7", "30"] as Period[]).map(p => (
                <button
                  key={p}
                  data-testid={`btn-global-period-${p}`}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                    period === p
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p === "1" ? "1N" : p === "7" ? "7N" : "30N"}
                </button>
              ))}
            </div>
            <AddIndexDropdown existing={indices} onAdd={addIndex} />
          </div>
        </div>

        {indices.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            Chưa có chỉ số nào. Nhấn &ldquo;Thêm chỉ số&rdquo; để bắt đầu.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {indices.map(symbol => {
              const meta = ALL_INDICES.find(i => i.symbol === symbol) || { name: symbol };
              return (
                <IndexCard
                  key={symbol}
                  symbol={symbol}
                  name={meta.name}
                  data={loadingIndices ? null : indicesData?.[symbol]}
                  period={period}
                  onRemove={() => removeIndex(symbol)}
                  onSelect={() => selectItem(symbol, "index")}
                  selected={selectedItem?.symbol === symbol}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Pinned Stocks - moved ABOVE detail panel/chart */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">Cổ phiếu quan tâm</h2>
          <AddStockInput existing={pinnedSymbols} onAdd={addStock} />
        </div>

        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          {pinnedStocks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Chưa có cổ phiếu nào. Tìm kiếm để thêm cổ phiếu quan tâm.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pinnedStocks.map(({ symbol, name }) => {
                const priceData = stockPrices?.[symbol];
                return (
                  <StockRow
                    key={symbol}
                    symbol={symbol}
                    data={priceData ? { ...priceData, name } : null}
                    onRemove={() => removeStock(symbol)}
                    onSelect={() => selectItem(symbol, "stock")}
                    selected={selectedItem?.symbol === symbol}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel (appears below stocks list) */}
      {selectedData && (
        <DetailPanel
          item={selectedData}
          type={selectedItem!.type}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* News */}
      <div className="mt-6">
        <div className="bg-card border border-card-border rounded-xl p-4">
          <NewsSection endpoint="/api/news/stocks" title="Tin tức thị trường cổ phiếu" maxItems={8} />
        </div>
      </div>
    </div>
  );
}
