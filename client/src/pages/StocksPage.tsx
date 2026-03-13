import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, fetchJson } from "@/lib/queryClient";
import { RefreshCw, Plus, X, Search, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber, formatPercent, formatVnd } from "@/lib/utils";
import PriceChart from "@/components/PriceChart";
import NewsSection from "@/components/NewsSection";
import { useAuth } from "@/components/AuthProvider";
import { addWatchlistItem, listWatchlistItems, removeWatchlistItem } from "@/lib/user-data";
import { useToast } from "@/hooks/use-toast";

const ALL_INDICES = [
  { symbol: "VNINDEX", name: "VN-Index", description: "Sàn HOSE tổng hợp" },
  { symbol: "HNXINDEX", name: "HNX-Index", description: "Sàn HNX tổng hợp" },
  { symbol: "UPCOMINDEX", name: "UPCOM", description: "Sàn UPCOM tổng hợp" },
  { symbol: "^GSPC", name: "S&P 500", description: "Chỉ số vốn hóa lớn của Mỹ" },
  { symbol: "^DJI", name: "Dow Jones", description: "30 blue-chip công nghiệp Mỹ" },
  { symbol: "^IXIC", name: "Nasdaq Composite", description: "Chỉ số tổng hợp sàn Nasdaq" },
];

const DEFAULT_INDICES = ["VNINDEX", "HNXINDEX", "UPCOMINDEX", "^GSPC", "^DJI", "^IXIC"];
const MARKET_REFRESH_INTERVAL = 180_000;
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
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
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

function ChangeChip({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400")}>
      {up ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

const EX_BADGE: Record<string, string> = {
  HOSE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  HNX: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  UpCOM: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

function IndexCard({ symbol, name, data, period, onRemove, onSelect, selected }: {
  symbol: string; name: string; data: any; period: Period; onRemove: () => void; onSelect: () => void; selected: boolean;
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
        selected ? "border-primary ring-2 ring-primary/20" : "border-card-border hover:border-muted-foreground/40 hover:shadow-sm",
      )}
    >
      <button
        data-testid={`btn-remove-index-${symbol}`}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      <div className="flex items-start justify-between mb-1 pr-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{name}</p>
        {data ? <ChangeChip value={changePercent} /> : <Skeleton className="h-4 w-14" />}
      </div>

      {data ? <p className="text-xl font-bold text-foreground mb-0.5">{formatNumber(price, { maximumFractionDigits: 2 })}</p> : <Skeleton className="h-7 w-24 mb-1" />}
      {data ? <p className={cn("text-xs mb-2", up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500")}>{up ? "+" : ""}{formatNumber(change, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} điểm</p> : <div className="mb-2" />}

      <PriceChart type="index" symbol={symbol} days={period === "1" ? 1 : period === "7" ? 7 : 30} currentPrice={price || undefined} mini height={52} />
    </div>
  );
}

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
      className={cn("group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors", selected ? "bg-primary/5" : "hover:bg-muted/40")}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-foreground">{symbol}</span>
          {exchange && <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", EX_BADGE[exchange] || "bg-muted text-muted-foreground")}>{exchange}</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{shortName}</p>
      </div>

      <div className="w-16 h-8 shrink-0">
        {data && price ? <PriceChart type="stock" symbol={symbol} days={7} currentPrice={price} mini height={32} /> : null}
      </div>

      <div className="text-right min-w-[96px]">
        {data ? (
          <>
            <p className="text-sm font-semibold text-foreground">{formatVnd(price)}</p>
            <ChangeChip value={changePercent} />
          </>
        ) : <Skeleton className="h-8 w-16" />}
      </div>

      <button
        data-testid={`btn-remove-stock-${symbol}`}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted ml-1 shrink-0"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

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

  const available = ALL_INDICES.filter((i) => !existing.includes(i.symbol));

  return (
    <div ref={ref} className="relative">
      <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setOpen((v) => !v)}>
        <Plus className="w-3.5 h-3.5" />
        Thêm chỉ số
      </Button>
      {open && (
        <div className="absolute right-0 top-9 z-50 bg-card border border-card-border rounded-xl shadow-lg w-64 py-1 max-h-72 overflow-y-auto">
          {available.length === 0 ? <p className="text-xs text-muted-foreground px-3 py-2">Đã thêm tất cả chỉ số</p> : available.map((i) => (
            <button
              key={i.symbol}
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
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm cổ phiếu để thêm..."
          className="pl-8 h-8 text-sm"
        />
      </div>
      {open && query.length >= 1 && (
        <div className="absolute left-0 top-9 z-50 bg-card border border-card-border rounded-xl shadow-lg w-full py-1 max-h-64 overflow-y-auto">
          {isLoading && <p className="text-xs text-muted-foreground px-3 py-2">Đang tìm...</p>}
          {!isLoading && (!results || results.length === 0) && <p className="text-xs text-muted-foreground px-3 py-2">Không tìm thấy kết quả</p>}
          {results?.map((r) => (
            <button
              key={r.symbol}
              disabled={existing.includes(r.symbol)}
              className={cn("w-full text-left px-3 py-2 hover:bg-muted transition-colors", existing.includes(r.symbol) && "opacity-40 cursor-not-allowed")}
              onClick={() => handleSelect(r.symbol, r.name)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{r.symbol}</span>
                {r.exchange && <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", EX_BADGE[r.exchange] || "bg-muted text-muted-foreground")}>{r.exchange}</span>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{r.name}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailPanel({ item, type, onClose }: { item: { symbol: string; name?: string; data: any }; type: "index" | "stock"; onClose: () => void; }) {
  const [localPeriod, setLocalPeriod] = useState<Period>("7");
  const price = item.data?.price ?? 0;
  const changePercent = item.data?.changePercent ?? 0;
  const change = item.data?.change ?? 0;
  const exchange = item.data?.exchange;
  const up = changePercent >= 0;
  const displayName = item.name || item.symbol;
  const shortName = displayName.includes(" - ") ? displayName.split(" - ")[0] : displayName;

  return (
    <div className="bg-card border border-card-border rounded-2xl p-5 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-foreground">{item.symbol}</h3>
            {type === "stock" && exchange && <Badge variant="outline" className="text-xs">{exchange}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{shortName}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-3xl font-bold text-foreground">
          {type === "stock" ? formatVnd(price) : formatNumber(price, { maximumFractionDigits: 2 })}
        </span>
        <span className={cn("text-base font-semibold", up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500")}>
          {up ? "+" : ""}{type === "stock" ? formatVnd(Math.abs(change)) : formatNumber(change, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({up ? "+" : ""}{changePercent.toFixed(2)}%)
        </span>
      </div>

      <div className="flex items-center gap-1 mb-3">
        {(["1", "7", "30"] as Period[]).map((p) => (
          <button key={p} onClick={() => setLocalPeriod(p)} className={cn("px-3 py-1 text-xs font-medium rounded-lg transition-colors", localPeriod === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
            {p === "1" ? "1N" : p === "7" ? "7N" : "30N"}
          </button>
        ))}
      </div>

      <PriceChart type={type} symbol={item.symbol} days={localPeriod === "1" ? 1 : localPeriod === "7" ? 7 : 30} currentPrice={price || undefined} height={200} />
    </div>
  );
}

export default function StocksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("7");
  const [selectedItem, setSelectedItem] = useState<{ symbol: string; type: "index" | "stock" } | null>(null);
  const [indices, setIndices] = useLocalStorage<string[]>("vn_indices_pins", DEFAULT_INDICES);
  const validIndexSymbols = new Set(ALL_INDICES.map((item) => item.symbol));
  const activeIndices = indices.filter((symbol) => validIndexSymbols.has(symbol));

  const { data: indicesData, isLoading: loadingIndices } = useQuery<any>({
    queryKey: ["/api/prices/indices"],
    queryFn: () => fetchJson("/api/prices/indices"),
    refetchInterval: MARKET_REFRESH_INTERVAL,
  });

  const { data: watchlistStocks = [] } = useQuery<Array<{ id: string; symbol: string; name: string }>>({
    queryKey: ["watchlist", user?.uid, "stocks-page"],
    queryFn: async () => {
      const items = await listWatchlistItems(user!.uid);
      return items.filter((item) => item.type === "stock").map((item) => ({ id: item.id, symbol: item.symbol, name: item.name }));
    },
    enabled: !!user,
  });

  const pinnedSymbols = watchlistStocks.map((s) => s.symbol);
  const { data: stockPrices } = useQuery<any>({
    queryKey: ["/api/prices/vn-batch", pinnedSymbols.join(",")],
    queryFn: () => fetchJson(`/api/prices/vn-batch?symbols=${pinnedSymbols.join(",")}`),
    enabled: pinnedSymbols.length > 0,
    refetchInterval: MARKET_REFRESH_INTERVAL,
  });

  const addStockMutation = useMutation({
    mutationFn: async ({ symbol, name }: { symbol: string; name: string }) => {
      if (!user) throw new Error("Bạn cần đăng nhập để thêm cổ phiếu quan tâm.");
      return addWatchlistItem(user.uid, { symbol, name, type: "stock" });
    },
    onSuccess: () => {
      if (user) queryClient.invalidateQueries({ queryKey: ["watchlist", user.uid] });
    },
    onError: (err: Error) => {
      toast({ title: "Lỗi", description: err.message, variant: "destructive" });
    },
  });

  const removeStockMutation = useMutation({
    mutationFn: async (watchlistId: string) => {
      if (!user) throw new Error("Bạn cần đăng nhập để xóa cổ phiếu quan tâm.");
      await removeWatchlistItem(user.uid, watchlistId);
    },
    onSuccess: () => {
      if (user) queryClient.invalidateQueries({ queryKey: ["watchlist", user.uid] });
    },
    onError: (err: Error) => {
      toast({ title: "Lỗi", description: err.message, variant: "destructive" });
    },
  });

  const marketSource = "KBS + Yahoo Finance";
  const lastUpdate = Object.values(indicesData || {}).map((item: any) => item?.lastUpdated).filter(Boolean).sort().at(-1);
  const lastUpdateLabel = lastUpdate ? new Date(lastUpdate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--";

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/prices/indices"] });
    queryClient.invalidateQueries({ queryKey: ["/api/prices/vn-batch"] });
    if (user) queryClient.invalidateQueries({ queryKey: ["watchlist", user.uid] });
  };

  const addIndex = (symbol: string) => setIndices((prev) => (prev.includes(symbol) ? prev : [...prev.filter((item) => validIndexSymbols.has(item)), symbol]));
  const removeIndex = (symbol: string) => {
    setIndices((prev) => prev.filter((s) => s !== symbol));
    if (selectedItem?.symbol === symbol) setSelectedItem(null);
  };
  const removeStock = (symbol: string) => {
    const existing = watchlistStocks.find((s) => s.symbol === symbol);
    if (existing?.id) removeStockMutation.mutate(existing.id);
    if (selectedItem?.symbol === symbol) setSelectedItem(null);
  };
  const selectItem = (symbol: string, type: "index" | "stock") => {
    setSelectedItem((prev) => (prev?.symbol === symbol ? null : { symbol, type }));
  };

  const selectedData = selectedItem
    ? selectedItem.type === "index"
      ? { symbol: selectedItem.symbol, name: ALL_INDICES.find((i) => i.symbol === selectedItem.symbol)?.name || selectedItem.symbol, data: indicesData?.[selectedItem.symbol] }
      : { symbol: selectedItem.symbol, name: watchlistStocks.find((s) => s.symbol === selectedItem.symbol)?.name || selectedItem.symbol, data: stockPrices?.[selectedItem.symbol] }
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Thị trường Chứng khoán</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Nguồn: {marketSource} • Cập nhật {lastUpdateLabel} • Tự động mới 3 phút</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={refresh}>
          <RefreshCw className="w-3.5 h-3.5" />
          Làm mới
        </Button>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">Chỉ số thị trường</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
              {(["1", "7", "30"] as Period[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={cn("px-2.5 py-1 text-xs font-medium rounded-md transition-colors", period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {p === "1" ? "1N" : p === "7" ? "7N" : "30N"}
                </button>
              ))}
            </div>
            <AddIndexDropdown existing={activeIndices} onAdd={addIndex} />
          </div>
        </div>

        {activeIndices.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">Chưa có chỉ số nào.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {activeIndices.map((symbol) => {
              const meta = ALL_INDICES.find((i) => i.symbol === symbol) || { name: symbol };
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

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">Cổ phiếu quan tâm</h2>
          <AddStockInput existing={pinnedSymbols} onAdd={(symbol, name) => addStockMutation.mutate({ symbol, name })} />
        </div>

        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          {watchlistStocks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Chưa có cổ phiếu nào.</div>
          ) : (
            <div className="divide-y divide-border">
              {watchlistStocks.map(({ symbol, name }) => {
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

      {selectedData && <DetailPanel item={selectedData} type={selectedItem!.type} onClose={() => setSelectedItem(null)} />}

      <div className="mt-6">
        <div className="bg-card border border-card-border rounded-xl p-4">
          <NewsSection endpoint="/api/news/stocks" title="Tin tức thị trường cổ phiếu" maxItems={8} />
        </div>
      </div>
    </div>
  );
}

