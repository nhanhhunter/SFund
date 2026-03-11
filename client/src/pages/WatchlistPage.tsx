import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Star,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  X,
  ChevronUp,
  ChevronDown,
  Search,
} from "lucide-react";
import { VN_STOCK_LIST, CRYPTO_LIST, type WatchlistItem, type InsertWatchlistItem } from "@shared/schema";
import { queryClient, fetchJson } from "@/lib/queryClient";
import { addWatchlistItem, listWatchlistItems, removeWatchlistItem } from "@/lib/user-data";
import { cn, formatCurrency, formatPercent, getChangeColor, getChangeBg, assetTypeLabel } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/AuthProvider";
import AuthGate from "@/components/AuthGate";
import PriceChart from "@/components/PriceChart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Period = "1" | "7" | "30";

const EX_BADGE: Record<string, string> = {
  HOSE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  HNX: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  UpCOM: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

function StockSearchInput({
  value,
  onChange,
  onNameChange,
}: {
  value: string;
  onChange: (symbol: string) => void;
  onNameChange: (name: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: results, isLoading } = useQuery<Array<{ symbol: string; name: string; exchange: string }>>({
    queryKey: ["/api/stocks/search", query],
    queryFn: () => fetchJson(`/api/stocks/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 1,
    staleTime: 30_000,
  });

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (symbol: string, name: string) => {
    setQuery(symbol);
    onChange(symbol);
    onNameChange(name.includes(" - ") ? name.split(" - ")[0] : name);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    onChange("");
    onNameChange("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          data-testid="input-watchlist-stock-symbol"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            onChange(e.target.value.toUpperCase());
          }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm mã (VD: VNM, FPT...)"
          className="pl-8 pr-8 uppercase"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      {open && query.length >= 1 && (
        <div className="absolute left-0 top-10 z-50 bg-card border border-card-border rounded-xl shadow-lg w-full py-1 max-h-56 overflow-y-auto">
          {isLoading && <p className="text-xs text-muted-foreground px-3 py-2">Đang tìm...</p>}
          {!isLoading && (!results || results.length === 0) && (
            <p className="text-xs text-muted-foreground px-3 py-2">Không tìm thấy cổ phiếu</p>
          )}
          {results?.map((r) => (
            <button
              key={r.symbol}
              type="button"
              data-testid={`option-watchlist-stock-${r.symbol}`}
              className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
              onClick={() => handleSelect(r.symbol, r.name)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{r.symbol}</span>
                {r.exchange && (
                  <span
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded",
                      EX_BADGE[r.exchange] || "bg-muted text-muted-foreground",
                    )}
                  >
                    {r.exchange}
                  </span>
                )}
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

function DetailDrawer({
  item,
  priceData,
  onClose,
}: {
  item: WatchlistItem;
  priceData: any;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<Period>("7");

  const changePercent =
    item.type === "stock"
      ? priceData?.changePercent || 0
      : item.type === "crypto"
        ? priceData?.usd_24h_change || 0
        : priceData?.changePercent || 0;

  const price =
    item.type === "stock"
      ? priceData?.price
      : item.type === "crypto"
        ? priceData?.usd
        : item.type === "gold"
          ? priceData?.priceVndLuong
          : priceData?.price;

  const displayPrice =
    item.type === "stock"
      ? price
        ? `${(price / 1000).toFixed(1)}K đ`
        : "--"
      : item.type === "gold"
        ? price
          ? `${new Intl.NumberFormat("vi-VN").format(Math.round(price))}đ`
          : "--"
        : price
          ? formatCurrency(price)
          : "--";

  const change = item.type === "stock" ? priceData?.change : item.type === "gold" || item.type === "oil" ? priceData?.change : null;
  const high = item.type === "stock" ? priceData?.high : null;
  const low = item.type === "stock" ? priceData?.low : null;
  const volume = item.type === "stock" ? priceData?.volume : item.type === "crypto" ? priceData?.usd_24h_vol : null;
  const marketCap = item.type === "crypto" ? priceData?.usd_market_cap : null;
  const chartType =
    item.type === "stock" ? "stock" : item.type === "crypto" ? "crypto" : item.type === "gold" ? "gold" : "oil";

  return (
    <div className="bg-card border border-card-border rounded-2xl p-5 mb-4" data-testid={`detail-watchlist-${item.id}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-foreground">{item.symbol.toUpperCase()}</h3>
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
              {assetTypeLabel(item.type)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{item.name}</p>
        </div>
        <button
          data-testid={`btn-close-watchlist-detail-${item.id}`}
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-3xl font-bold text-foreground">{displayPrice}</span>
        <span className={cn("inline-flex items-center gap-0.5 text-base font-semibold px-2 py-0.5 rounded-lg", getChangeBg(changePercent))}>
          {changePercent >= 0 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {formatPercent(changePercent)}
        </span>
      </div>

      {(high || low || volume || change !== null || marketCap) ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4 text-xs">
          {change !== null && change !== undefined && (
            <div className="bg-muted/50 rounded-lg px-2 py-1.5">
              <p className="text-muted-foreground">Thay đổi</p>
              <p className={cn("font-bold", getChangeColor(change))}>
                {item.type === "stock" ? `${change >= 0 ? "+" : ""}${(change / 1000).toFixed(1)}K đ` : `${change >= 0 ? "+" : ""}${change}`}
              </p>
            </div>
          )}
          {high ? (
            <div className="bg-muted/50 rounded-lg px-2 py-1.5">
              <p className="text-muted-foreground">Cao nhất</p>
              <p className="font-bold">{`${(high / 1000).toFixed(1)}K`}</p>
            </div>
          ) : null}
          {low ? (
            <div className="bg-muted/50 rounded-lg px-2 py-1.5">
              <p className="text-muted-foreground">Thấp nhất</p>
              <p className="font-bold">{`${(low / 1000).toFixed(1)}K`}</p>
            </div>
          ) : null}
          {volume ? (
            <div className="bg-muted/50 rounded-lg px-2 py-1.5">
              <p className="text-muted-foreground">Khối lượng</p>
              <p className="font-bold">{new Intl.NumberFormat("vi-VN", { notation: "compact" }).format(volume)}</p>
            </div>
          ) : null}
          {marketCap ? (
            <div className="bg-muted/50 rounded-lg px-2 py-1.5">
              <p className="text-muted-foreground">Vốn hóa</p>
              <p className="font-bold">{formatCurrency(marketCap, "compact")}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-1 mb-3">
        {(["1", "7", "30"] as Period[]).map((p) => (
          <button
            key={p}
            data-testid={`btn-watchlist-period-${p}`}
            onClick={() => setPeriod(p)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-lg transition-colors",
              period === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {p === "1" ? "1 ngày" : p === "7" ? "7 ngày" : "30 ngày"}
          </button>
        ))}
      </div>

      <PriceChart
        type={chartType}
        symbol={item.symbol}
        days={period === "1" ? 1 : period === "7" ? 7 : 30}
        currentPrice={price || undefined}
        height={200}
      />
    </div>
  );
}

export default function WatchlistPage() {
  const { user, loading, enabled } = useAuth();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState("stock");
  const [addSymbol, setAddSymbol] = useState("");
  const [addName, setAddName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: watchlist, isLoading } = useQuery<WatchlistItem[]>({
    queryKey: ["watchlist", user?.uid],
    queryFn: () => listWatchlistItems(user!.uid),
    enabled: !!user && enabled,
  });

  const { data: vnPrices } = useQuery<Record<string, any>>({
    queryKey: ["/api/prices/vn-batch", watchlist?.map((w) => w.symbol).join(",")],
    queryFn: () => {
      const syms = (watchlist || []).filter((w) => w.type === "stock").map((w) => w.symbol).join(",");
      if (!syms) return Promise.resolve({});
      return fetchJson(`/api/prices/vn-batch?symbols=${syms}`);
    },
    enabled: !!watchlist?.some((w) => w.type === "stock"),
    refetchInterval: 60_000,
  });

  const { data: cryptoPrices } = useQuery<Record<string, any>>({
    queryKey: ["/api/prices/crypto", watchlist?.map((w) => w.symbol).join(",")],
    queryFn: () => {
      const ids = (watchlist || []).filter((w) => w.type === "crypto").map((w) => w.symbol).join(",");
      if (!ids) return Promise.resolve({});
      return fetchJson(`/api/prices/crypto?ids=${ids}`);
    },
    enabled: !!watchlist?.some((w) => w.type === "crypto"),
    refetchInterval: 60_000,
  });

  const { data: goldData } = useQuery<any>({
    queryKey: ["/api/prices/gold"],
    refetchInterval: 60_000,
  });

  const { data: oilData } = useQuery<any>({
    queryKey: ["/api/prices/oil"],
    refetchInterval: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: async (item: InsertWatchlistItem) => {
      if (!user) throw new Error("Bạn cần đăng nhập để thêm theo dõi.");
      return addWatchlistItem(user.uid, item);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["watchlist", user.uid] });
      }
      toast({ title: "Đã thêm vào danh sách theo dõi" });
      setAddOpen(false);
      setAddSymbol("");
      setAddName("");
    },
    onError: (err: Error) => {
      toast({ title: "Lỗi", description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Bạn cần đăng nhập để xóa theo dõi.");
      await removeWatchlistItem(user.uid, id);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["watchlist", user.uid] });
      }
      toast({ title: "Đã xóa khỏi danh sách" });
    },
  });

  const getPrice = (item: WatchlistItem) => {
    if (item.type === "stock") return vnPrices?.[item.symbol];
    if (item.type === "crypto") return cryptoPrices?.[item.symbol];
    if (item.type === "gold") return goldData?.XAU;
    if (item.type === "oil") return item.symbol === "BRENT" ? oilData?.BRENT : oilData?.WTI;
    return null;
  };

  const formatPrice = (item: WatchlistItem, priceData: any) => {
    if (!priceData) return "--";
    if (item.type === "stock") return `${(priceData.price / 1000).toFixed(1)}K đ`;
    if (item.type === "crypto") return formatCurrency(priceData.usd);
    if (item.type === "gold") return `${new Intl.NumberFormat("vi-VN").format(Math.round(priceData.priceVndLuong))}đ`;
    if (item.type === "oil") return formatCurrency(priceData.price);
    return "--";
  };

  const getChangePercent = (item: WatchlistItem, priceData: any): number => {
    if (!priceData) return 0;
    if (item.type === "stock") return priceData.changePercent || 0;
    if (item.type === "crypto") return priceData.usd_24h_change || 0;
    return priceData.changePercent || 0;
  };

  const handleAddSubmit = () => {
    if (!addSymbol) return;

    let name = addSymbol;
    if (addType === "stock") {
      name = addName || VN_STOCK_LIST.find((s) => s.symbol === addSymbol)?.name || addSymbol;
    } else if (addType === "crypto") {
      name = CRYPTO_LIST.find((c) => c.symbol === addSymbol)?.name || addSymbol;
    } else if (addType === "gold") {
      name = "Vàng 24K";
    } else if (addType === "oil") {
      name = addSymbol === "BRENT" ? "Dầu Brent" : "Dầu WTI";
    }

    addMutation.mutate({ symbol: addSymbol, name, type: addType as InsertWatchlistItem["type"] });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthGate
        title="Đăng nhập để đồng bộ watchlist"
        description="Danh sách theo dõi sẽ được lưu trong Firestore riêng cho tài khoản Google của bạn."
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Danh sách theo dõi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{watchlist?.length || 0} tài sản đang theo dõi</p>
        </div>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-watchlist" className="gap-2">
          <Plus className="w-4 h-4" />
          Thêm tài sản
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : !watchlist?.length ? (
        <div className="text-center py-16">
          <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
          <p className="text-muted-foreground">Chưa có tài sản nào trong danh sách</p>
          <Button onClick={() => setAddOpen(true)} className="mt-4 gap-2">
            <Plus className="w-4 h-4" />
            Thêm tài sản đầu tiên
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchlist.map((item) => {
              const priceData = getPrice(item);
              const changePercent = getChangePercent(item, priceData);
              const isExpanded = expandedId === item.id;

              return (
                <div key={item.id} className="flex flex-col">
                  <div
                    data-testid={`watchlist-item-${item.id}`}
                    onClick={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                    className={cn(
                      "bg-card border border-card-border rounded-xl p-4 cursor-pointer hover:shadow-sm transition-all group",
                      isExpanded && "border-primary ring-2 ring-primary/10",
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{item.symbol.toUpperCase()}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                            {assetTypeLabel(item.type)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.name}</p>
                      </div>
                      <button
                        data-testid={`button-remove-watchlist-${item.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMutation.mutate(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <p className="text-xl font-bold text-foreground">{formatPrice(item, priceData)}</p>
                        <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 mt-1", getChangeBg(changePercent))}>
                          {changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {formatPercent(changePercent)}
                        </span>
                      </div>
                    </div>

                    <div className="h-14">
                      <PriceChart
                        type={item.type === "stock" ? "stock" : item.type === "crypto" ? "crypto" : item.type === "gold" ? "gold" : "oil"}
                        symbol={item.symbol}
                        days={14}
                        height={56}
                        mini
                      />
                    </div>

                    <p className="text-xs text-muted-foreground mt-2 text-center opacity-50">
                      {isExpanded ? "Nhấn để thu gọn" : "Nhấn để xem chi tiết"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {expandedId && (() => {
            const item = watchlist.find((w) => w.id === expandedId);
            if (!item) return null;

            return (
              <DetailDrawer
                key={expandedId}
                item={item}
                priceData={getPrice(item)}
                onClose={() => setExpandedId(null)}
              />
            );
          })()}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Thêm vào danh sách theo dõi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">Loại tài sản</Label>
              <Select
                value={addType}
                onValueChange={(value) => {
                  setAddType(value);
                  setAddSymbol("");
                  setAddName("");
                }}
              >
                <SelectTrigger data-testid="select-watchlist-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Cổ phiếu VN</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="gold">Vàng</SelectItem>
                  <SelectItem value="oil">Dầu thô</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm mb-2 block">Tài sản</Label>
              {addType === "stock" ? (
                <StockSearchInput
                  value={addSymbol}
                  onChange={setAddSymbol}
                  onNameChange={setAddName}
                />
              ) : addType === "crypto" ? (
                <Select value={addSymbol} onValueChange={setAddSymbol}>
                  <SelectTrigger data-testid="select-watchlist-symbol">
                    <SelectValue placeholder="Chọn coin" />
                  </SelectTrigger>
                  <SelectContent>
                    {CRYPTO_LIST.map((c) => (
                      <SelectItem key={c.symbol} value={c.symbol}>
                        {c.ticker} - {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : addType === "gold" ? (
                <Select value={addSymbol} onValueChange={setAddSymbol}>
                  <SelectTrigger>
                    <SelectValue placeholder="Loại vàng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAU">Vàng 24K</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select value={addSymbol} onValueChange={setAddSymbol}>
                  <SelectTrigger>
                    <SelectValue placeholder="Loại dầu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WTI">WTI Crude</SelectItem>
                    <SelectItem value="BRENT">Brent Crude</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Hủy
              </Button>
              <Button onClick={handleAddSubmit} disabled={!addSymbol || addMutation.isPending}>
                {addMutation.isPending ? "Đang thêm..." : "Thêm vào danh sách"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
