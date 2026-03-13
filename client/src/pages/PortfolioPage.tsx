import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Info,
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  RefreshCw,
  X,
} from "lucide-react";
import { PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  defaultPortfolioCurrency,
  type AssetCurrency,
  type PortfolioItem,
  type PortfolioPurchase,
  type PortfolioDividend,
} from "@shared/schema";
import { queryClient, fetchJson } from "@/lib/queryClient";
import { deletePortfolioItem, listPortfolioItems } from "@/lib/user-data";
import {
  cn,
  formatCurrency,
  formatPercent,
  formatVnd,
  getChangeBg,
  getChangeColor,
  assetTypeLabel,
} from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/AuthProvider";
import AuthGate from "@/components/AuthGate";
import PortfolioDialog from "@/components/PortfolioDialog";
import PriceChart from "@/components/PriceChart";
import NewsSection from "@/components/NewsSection";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PIE_COLORS = ["#1A73E8", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#06b6d4"];
const MARKET_REFRESH_INTERVAL = 180_000;

type Period = "1" | "7" | "30";

type EnrichedItem = PortfolioItem & {
  marketCurrency: AssetCurrency;
  currentPrice: number;
  currentPriceVnd: number;
  costBasis: number;
  costBasisVnd: number;
  currentValue: number;
  currentValueVnd: number;
  pricePnl: number;
  pricePnlVnd: number;
  dividendsTotal: number;
  dividendsTotalVnd: number;
  totalReturn: number;
  totalReturnVnd: number;
  pricePnlPercent: number;
  totalReturnPercent: number;
  dayPnl: number;
  dayPnlVnd: number;
  dayPnlPercent: number;
  latestPurchaseAt: string;
  latestModifiedAt: string;
};

type PortfolioSortKey = "value" | "type" | "latestPurchase" | "latestModified" | "currency";

function convertPrice(value: number, from: AssetCurrency, to: AssetCurrency, usdToVnd: number) {
  if (!Number.isFinite(value)) return 0;
  if (from === to) return value;
  if (from === "USD" && to === "VND") return value * usdToVnd;
  if (from === "VND" && to === "USD") return usdToVnd > 0 ? value / usdToVnd : 0;
  return value;
}

function formatMoney(value: number, currency: AssetCurrency) {
  return currency === "VND" ? formatVnd(Math.round(value)) : formatCurrency(value);
}

function formatDividendMoney(value: number, currency: AssetCurrency) {
  return currency === "VND" ? formatVnd(Math.round(value)) : formatCurrency(Number(value.toFixed(2)));
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AssetHistoryDialog({
  item,
  open,
  onOpenChange,
}: {
  item: EnrichedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lịch sử giao dịch {item?.symbol?.toUpperCase() || ""}</DialogTitle>
        </DialogHeader>

        {!item ? null : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Các lần mua</p>
              <div className="mt-2 space-y-2">
                {item.purchaseLots.map((lot: PortfolioPurchase, index: number) => (
                  <div key={`${lot.boughtAt}-${index}`} className="grid grid-cols-3 gap-2 rounded-lg border border-card-border p-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Số lượng</p>
                      <p className="font-medium text-foreground">{lot.quantity}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Giá mua</p>
                      <p className="font-medium text-foreground">{formatMoney(lot.price, item.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Thời gian mua</p>
                      <p className="font-medium text-foreground">{formatDateTime(lot.boughtAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {item.type === "stock" && (
              <div>
                <p className="text-sm font-semibold text-foreground">Cổ tức đã nhận</p>
                <div className="mt-2 space-y-2">
                  {item.dividends.length ? (
                    item.dividends.map((dividend: PortfolioDividend, index: number) => (
                      <div key={`${dividend.receivedAt}-${index}`} className="grid grid-cols-2 gap-2 rounded-lg border border-card-border p-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Giá trị</p>
                          <p className="font-medium text-foreground">{formatDividendMoney(dividend.amount, item.currency)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Ngày nhận</p>
                          <p className="font-medium text-foreground">{formatDateTime(dividend.receivedAt)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Chưa có khoản cổ tức nào.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AssetDetailPanel({
  item,
  onShowHistory,
}: {
  item: EnrichedItem;
  onShowHistory: () => void;
}) {
  const formatAssetPrice = (value: number) => {
    return formatMoney(value, item.currency);
  };

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
        <div className="flex items-center gap-2">
          <div>
            <p className="font-bold text-sm text-foreground">{item.symbol.toUpperCase()}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{item.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onShowHistory} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <Info className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 grid grid-cols-2 gap-3 border-b border-card-border">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Giá hiện tại</p>
          <p className="font-bold text-sm text-foreground">{formatAssetPrice(item.currentPrice)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Giá trị hiện tại</p>
          <p className="font-bold text-sm text-foreground">{formatAssetPrice(item.currentValue)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Giá mua TB</p>
          <p className="font-bold text-sm text-foreground">{formatAssetPrice(item.avgBuyPrice)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Giá vốn</p>
          <p className="font-bold text-sm text-foreground">{formatAssetPrice(item.costBasis)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Số lượng</p>
          <p className="font-bold text-sm text-foreground">{item.quantity}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Lãi/Lỗ</p>
          <p className={cn("font-bold text-sm", getChangeColor(item.pricePnl))}>
            {item.pricePnl >= 0 ? "+" : ""}
            {formatAssetPrice(Math.abs(item.pricePnl))} ({formatPercent(item.pricePnlPercent)})
          </p>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-card-border">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Tổng ROI</span>
          <span className={cn("px-2.5 py-1 rounded-xl text-sm font-semibold", getChangeBg(item.totalReturnPercent))}>
            {formatPercent(item.totalReturnPercent)}
          </span>
        </div>
        <p className={cn("mt-2 text-sm font-bold", getChangeColor(item.totalReturn))}>
          {item.totalReturn >= 0 ? "+" : ""}
          {formatAssetPrice(Math.abs(item.totalReturn))} ({formatPercent(item.totalReturnPercent)})
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Gồm {formatDividendMoney(item.dividendsTotal, item.currency)} cổ tức, tương ứng{" "}
          {formatPercent(item.costBasis > 0 ? (item.dividendsTotal / item.costBasis) * 100 : 0)}
        </p>
      </div>
    </div>
  );
}

function AssetPriceChartCard({ item }: { item: EnrichedItem }) {
  const [period, setPeriod] = useState<Period>("7");
  const days = period === "1" ? 1 : period === "7" ? 7 : 30;
  const chartType =
    item.type === "stock" ? "stock" : item.type === "crypto" ? "crypto" : item.type === "gold" ? "gold" : "oil";
  const chartSymbol = item.type === "gold" ? "XAU" : item.symbol;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Biểu đồ giá {item.symbol.toUpperCase()}
        </h3>
        <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
          {(["1", "7", "30"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              data-testid={`btn-detail-period-${p}`}
              className={cn(
                "px-2 py-0.5 text-xs font-medium rounded-md transition-colors",
                period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {p === "1" ? "1N" : p === "7" ? "7N" : "30N"}
            </button>
          ))}
        </div>
      </div>
      <PriceChart
        type={chartType}
        symbol={chartSymbol}
        days={days}
        currentPrice={item.currentPrice || undefined}
        height={180}
      />
    </div>
  );
}

export default function PortfolioPage() {
  const { user, loading, enabled } = useAuth();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<PortfolioItem | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<PortfolioSortKey>("value");

  const { data: portfolio, isLoading } = useQuery<PortfolioItem[]>({
    queryKey: ["portfolio", user?.uid],
    queryFn: () => listPortfolioItems(user!.uid),
    enabled: !!user && enabled,
    refetchInterval: MARKET_REFRESH_INTERVAL,
  });

  const { data: cryptoPrices } = useQuery<Record<string, any>>({
    queryKey: ["/api/prices/crypto"],
    queryFn: () =>
      fetchJson("/api/prices/crypto?ids=bitcoin,ethereum,binancecoin,solana,ripple,cardano,dogecoin,tron"),
    refetchInterval: MARKET_REFRESH_INTERVAL,
  });

  const { data: goldData } = useQuery<any>({
    queryKey: ["/api/prices/gold"],
    refetchInterval: MARKET_REFRESH_INTERVAL,
  });

  const { data: oilData } = useQuery<any>({
    queryKey: ["/api/prices/oil"],
    refetchInterval: MARKET_REFRESH_INTERVAL,
  });

  const { data: usdVndData } = useQuery<{ rate: number }>({
    queryKey: ["/api/exchange-rates/usd-vnd"],
  });

  const stockSymbols = useMemo(
    () => (portfolio || []).filter((item) => item.type === "stock").map((item) => item.symbol).join(","),
    [portfolio],
  );

  const { data: vnStockPrices } = useQuery<Record<string, any>>({
    queryKey: ["/api/prices/vn-batch", stockSymbols],
    queryFn: () => (stockSymbols ? fetchJson(`/api/prices/vn-batch?symbols=${stockSymbols}`) : Promise.resolve({})),
    enabled: !!stockSymbols,
    refetchInterval: MARKET_REFRESH_INTERVAL,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Bạn cần đăng nhập để xóa tài sản.");
      await deletePortfolioItem(user.uid, id);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["portfolio", user.uid] });
      }
      toast({ title: "Đã xóa khỏi danh mục" });
      setDeleteId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Lỗi", description: err.message, variant: "destructive" });
    },
  });

  const usdToVnd = usdVndData?.rate || goldData?.XAU?.usdToVnd || 26315;

  const enriched: EnrichedItem[] = useMemo(() => {
    const getMarketPrice = (item: PortfolioItem): { price: number; currency: AssetCurrency } => {
      if (item.type === "crypto") {
        return { price: cryptoPrices?.[item.symbol]?.usd || 0, currency: "USD" };
      }
      if (item.type === "gold") {
        if (item.symbol === "XAU_SJC") {
          return { price: goldData?.SJC?.sell || 0, currency: "VND" };
        }
        return { price: goldData?.XAU?.priceVndLuong || 0, currency: "VND" };
      }
      if (item.type === "oil") {
        return { price: (item.symbol === "BRENT" ? oilData?.BRENT : oilData?.WTI)?.price || 0, currency: "USD" };
      }
      if (item.type === "stock") {
        return { price: vnStockPrices?.[item.symbol]?.price || 0, currency: "VND" };
      }
      return { price: item.avgBuyPrice, currency: item.currency };
    };

    const getDailyChange = (item: PortfolioItem): { change: number; currency: AssetCurrency } => {
      if (item.type === "stock") {
        return { change: (vnStockPrices?.[item.symbol]?.change as number) || 0, currency: "VND" };
      }
      if (item.type === "crypto") {
        const price = cryptoPrices?.[item.symbol]?.usd || 0;
        const percent = (cryptoPrices?.[item.symbol]?.usd_24h_change as number) || 0;
        return { change: price * (percent / 100), currency: "USD" };
      }
      if (item.type === "gold") {
        if (item.symbol === "XAU_SJC") {
          return { change: 0, currency: "VND" };
        }
        return { change: (goldData?.XAU?.change as number) || 0, currency: "VND" };
      }
      if (item.type === "oil") {
        const oilEntry = item.symbol === "BRENT" ? oilData?.BRENT : oilData?.WTI;
        return { change: (oilEntry?.change as number) || 0, currency: "USD" };
      }
      return { change: 0, currency: item.currency };
    };

    return (portfolio || []).map((item) => {
      const currency = item.currency || defaultPortfolioCurrency(item.type);
      const market = getMarketPrice(item);
      const fallbackMarketPrice = convertPrice(item.avgBuyPrice, currency, market.currency, usdToVnd);
      const effectiveMarketPrice = market.price || fallbackMarketPrice;
      const currentPrice = convertPrice(effectiveMarketPrice, market.currency, currency, usdToVnd);
      const currentPriceVnd = convertPrice(currentPrice, currency, "VND", usdToVnd);
      const costBasis = item.quantity * item.avgBuyPrice;
      const costBasisVnd = convertPrice(costBasis, currency, "VND", usdToVnd);
      const currentValue = item.quantity * currentPrice;
      const currentValueVnd = convertPrice(currentValue, currency, "VND", usdToVnd);
      const pricePnl = currentValue - costBasis;
      const pricePnlVnd = currentValueVnd - costBasisVnd;
      const dividendsTotal = (item.dividends || []).reduce(
        (sum, dividend) => sum + (Number(dividend.amount) || 0),
        0,
      );
      const dividendsTotalVnd = convertPrice(dividendsTotal, currency, "VND", usdToVnd);
      const totalReturn = pricePnl + dividendsTotal;
      const totalReturnVnd = pricePnlVnd + dividendsTotalVnd;
      const pricePnlPercent = costBasis > 0 ? (pricePnl / costBasis) * 100 : 0;
      const totalReturnPercent = costBasis > 0 ? (totalReturn / costBasis) * 100 : 0;
      const daily = getDailyChange(item);
      const dayChangePerUnit = convertPrice(daily.change, daily.currency, currency, usdToVnd);
      const dayPnl = item.quantity * dayChangePerUnit;
      const dayPnlVnd = convertPrice(dayPnl, currency, "VND", usdToVnd);
      const previousValue = currentValue - dayPnl;
      const dayPnlPercent = previousValue !== 0 ? (dayPnl / previousValue) * 100 : 0;
      const latestPurchaseAt = [...item.purchaseLots]
        .map((lot) => lot.boughtAt)
        .filter(Boolean)
        .sort()
        .at(-1) || item.addedAt;
      const latestModifiedAt = item.updatedAt || item.addedAt;

      return {
        ...item,
        currency,
        marketCurrency: market.currency,
        currentPrice,
        currentPriceVnd,
        costBasis,
        costBasisVnd,
        currentValue,
        currentValueVnd,
        pricePnl,
        pricePnlVnd,
        dividendsTotal,
        dividendsTotalVnd,
        totalReturn,
        totalReturnVnd,
        pricePnlPercent,
        totalReturnPercent,
        dayPnl,
        dayPnlVnd,
        dayPnlPercent,
        latestPurchaseAt,
        latestModifiedAt,
      };
    });
  }, [portfolio, cryptoPrices, goldData, oilData, usdToVnd, vnStockPrices]);

  const totalValue = enriched.reduce((sum, item) => sum + item.currentValueVnd, 0);
  const totalCost = enriched.reduce((sum, item) => sum + item.costBasisVnd, 0);
  const totalDividends = enriched.reduce((sum, item) => sum + item.dividendsTotalVnd, 0);
  const totalPricePnl = enriched.reduce((sum, item) => sum + item.pricePnlVnd, 0);
  const totalPricePnlPct = totalCost > 0 ? (totalPricePnl / totalCost) * 100 : 0;
  const totalRoi = totalPricePnl + totalDividends;
  const totalRoiPct = totalCost > 0 ? (totalRoi / totalCost) * 100 : 0;
  const totalDayPnl = enriched.reduce((sum, item) => sum + item.dayPnlVnd, 0);
  const totalPreviousValue = totalValue - totalDayPnl;
  const totalDayPnlPct = totalPreviousValue !== 0 ? (totalDayPnl / totalPreviousValue) * 100 : 0;
  const stockLastUpdated = Object.values(vnStockPrices || {})
    .map((item: any) => item?.lastUpdated)
    .filter(Boolean)
    .sort()
    .at(-1);
  const stockUpdatedLabel = stockLastUpdated
    ? new Date(stockLastUpdated).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "--";

  const byType = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const item of enriched) groups[item.type] = (groups[item.type] || 0) + item.currentValueVnd;
    return Object.entries(groups).map(([name, value]) => ({
      name: assetTypeLabel(name),
      value: Math.round(value),
    }));
  }, [enriched]);

  const formatValue = (item: EnrichedItem) => {
    return formatMoney(item.currentValue, item.currency);
  };

  const performanceLeaders = useMemo(
    () => [...enriched].sort((a, b) => b.totalReturnPercent - a.totalReturnPercent).slice(0, 2),
    [enriched],
  );

  const performanceLaggards = useMemo(
    () => [...enriched].sort((a, b) => a.totalReturnPercent - b.totalReturnPercent).slice(0, 2),
    [enriched],
  );

  const sortedEnriched = useMemo(() => {
    const items = [...enriched];
    items.sort((a, b) => {
      if (sortKey === "type") {
        return assetTypeLabel(a.type).localeCompare(assetTypeLabel(b.type), "vi");
      }
      if (sortKey === "currency") {
        return a.currency.localeCompare(b.currency, "vi") || a.symbol.localeCompare(b.symbol, "vi");
      }
      if (sortKey === "latestPurchase") {
        return new Date(b.latestPurchaseAt).getTime() - new Date(a.latestPurchaseAt).getTime();
      }
      if (sortKey === "latestModified") {
        return new Date(b.latestModifiedAt).getTime() - new Date(a.latestModifiedAt).getTime();
      }
      return b.currentValueVnd - a.currentValueVnd;
    });
    return items;
  }, [enriched, sortKey]);

  const selectedItem = selectedId ? enriched.find((item) => item.id === selectedId) || null : null;
  const historyItem = historyId ? enriched.find((item) => item.id === historyId) || null : null;
  const relatedNewsEndpoint = selectedItem
    ? selectedItem.type === "stock"
      ? `/api/news/stocks?tickers=${selectedItem.symbol}`
      : selectedItem.type === "crypto"
        ? `/api/news/crypto?categories=${selectedItem.symbol.toUpperCase()}`
        : selectedItem.type === "gold"
          ? "/api/news/gold"
          : "/api/news/oil"
    : "/api/news/stocks";

  const refreshMarketData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/prices/vn-batch"] });
    queryClient.invalidateQueries({ queryKey: ["/api/prices/crypto"] });
    queryClient.invalidateQueries({ queryKey: ["/api/prices/gold"] });
    queryClient.invalidateQueries({ queryKey: ["/api/prices/oil"] });
  };

  const relatedNewsTitle = selectedItem ? `Tin liên quan ${selectedItem.symbol.toUpperCase()}` : "Tin liên quan";

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
        title="Đăng nhập để quản lý danh mục"
        description="Danh mục đầu tư của bạn được lưu trữ an toàn trên Google Cloud Firestore và chỉ đồng bộ trong tài khoản của bạn."
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Danh mục đầu tư</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Nguồn: KBS • Cập nhật {stockUpdatedLabel} • Tự động cập nhật mỗi 3 phút • Tỷ giá USD/VND {usdToVnd.toLocaleString("vi-VN")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refreshMarketData} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Làm mới
          </Button>
          <Button onClick={() => setAddOpen(true)} data-testid="button-add-portfolio" className="gap-2">
            <Plus className="w-4 h-4" />
            Thêm tài sản
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-6">
        <div className="bg-card border border-card-border rounded-xl p-4 lg:col-span-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-primary" />
            Tổng giá trị danh mục
          </h3>
          <div className="text-xl lg:text-2xl font-bold text-foreground">
            {isLoading ? <Skeleton className="h-8 w-32" /> : formatVnd(totalValue)}
          </div>
          <p className={cn("text-xs lg:text-sm font-medium mt-2 flex items-center gap-1", getChangeColor(totalPricePnl))}>
            {totalPricePnl >= 0 ? <TrendingUp className="w-3 h-3 lg:w-3.5 lg:h-3.5" /> : <TrendingDown className="w-3 h-3 lg:w-3.5 lg:h-3.5" />}
            Lãi/lỗ: {totalPricePnl >= 0 ? "+" : "-"}
            {formatVnd(Math.abs(totalPricePnl))} ({formatPercent(totalPricePnlPct)})
          </p>
          <p className={cn("text-xs lg:text-sm font-medium mt-1", getChangeColor(totalRoi))}>
            {totalPricePnl >= 0 ? <TrendingUp className="w-3 h-3 lg:w-3.5 lg:h-3.5" /> : <TrendingDown className="w-3 h-3 lg:w-3.5 lg:h-3.5" />}
            ROI: {totalRoi >= 0 ? "+" : "-"}
            {formatVnd(Math.abs(totalRoi))} ({formatPercent(totalRoiPct)})
          </p>
          <p className={cn("text-xs lg:text-sm mt-1", getChangeColor(totalDayPnl))}>
            Hôm nay: {totalDayPnl >= 0 ? "+" : "-"}
            {formatVnd(Math.abs(totalDayPnl))} ({formatPercent(totalDayPnlPct)})
          </p>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-4 lg:col-span-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <PieChart className="w-4 h-4 text-primary" />
            Phân bổ danh mục ({portfolio?.length || 0})
          </h3>
          {byType.length > 0 ? (
            <ResponsiveContainer width="100%" height={170}>
              <RechartsPie>
                <Pie data={byType} cx="50%" cy="50%" innerRadius={40} outerRadius={66} paddingAngle={2} dataKey="value">
                  {byType.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [formatVnd(Number(value)), "Giá trị"]} />
                <Legend formatter={(value) => <span className="text-xs text-foreground">{value}</span>} />
              </RechartsPie>
            </ResponsiveContainer>
          ) : (
            <div className="h-[170px] flex items-center justify-center text-muted-foreground text-sm">Chưa có dữ liệu</div>
          )}
        </div>
        <div className="lg:col-span-4 space-y-3">
          {selectedItem ? (
            <AssetDetailPanel
              item={selectedItem}
              onShowHistory={() => setHistoryId(selectedItem.id)}
            />
          ) : enriched.length > 0 ? (
            <div className="bg-card border border-card-border rounded-xl p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-primary" />
                Hiệu suất ROI
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <p className="text-sm font-semibold text-foreground">Hiệu suất cao</p>
                  </div>
                  <div className="space-y-2">
                    {performanceLeaders.map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-foreground">{item.symbol.toUpperCase()}</span>
                          <p className="text-xs text-muted-foreground">{item.name}</p>
                        </div>
                        <span className={cn("text-sm font-semibold", getChangeColor(item.totalReturnPercent))}>
                          {formatPercent(item.totalReturnPercent)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-4 h-4 text-rose-600" />
                    <p className="text-sm font-semibold text-foreground">Hiệu suất thấp</p>
                  </div>
                  <div className="space-y-2">
                    {performanceLaggards.map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-foreground">{item.symbol.toUpperCase()}</span>
                          <p className="text-xs text-muted-foreground">{item.name}</p>
                        </div>
                        <span className={cn("text-sm font-semibold", getChangeColor(item.totalReturnPercent))}>
                          {formatPercent(item.totalReturnPercent)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {selectedItem ? <AssetPriceChartCard item={selectedItem} /> : null}
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-card-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Danh sách tài sản
                {!selectedItem && <span className="text-xs text-muted-foreground ml-1">(chọn mã để xem chi tiết)</span>}
              </h3>
              <div className="w-full sm:w-[220px]">
                <Select value={sortKey} onValueChange={(value) => setSortKey(value as PortfolioSortKey)}>
                  <SelectTrigger data-testid="select-portfolio-sort">
                    <SelectValue placeholder="Sắp xếp theo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="value">Giá trị</SelectItem>
                    <SelectItem value="type">Loại tài sản</SelectItem>
                    <SelectItem value="latestPurchase">Ngày mua gần nhất</SelectItem>
                    <SelectItem value="latestModified">Ngày sửa gần nhất</SelectItem>
                    <SelectItem value="currency">Đơn vị tiền tệ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : !enriched.length ? (
              <div className="p-12 text-center">
                <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">Chưa có tài sản nào</p>
                <Button onClick={() => setAddOpen(true)} className="mt-4 gap-2" size="sm">
                  <Plus className="w-4 h-4" />
                  Thêm tài sản đầu tiên
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-card-border">
                {sortedEnriched.map((item) => (
                  <div
                    key={item.id}
                    data-testid={`portfolio-item-${item.id}`}
                    onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 hover:bg-background/50 transition-colors group cursor-pointer",
                      item.id === selectedId && "bg-primary/5 border-l-2 border-l-primary",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm text-foreground">{item.symbol.toUpperCase()}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                          {assetTypeLabel(item.type)}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                          {item.currency === "USD" ? "$" : "đ"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} × {formatMoney(item.avgBuyPrice, item.currency)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{formatValue(item)}</p>
                      <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-md", getChangeBg(item.totalReturnPercent))}>
                        ROI {formatPercent(item.totalReturnPercent)}
                      </span>
                      <p className={cn("text-[11px] mt-1", getChangeColor(item.dayPnl))}>
                        Hôm nay {item.dayPnl >= 0 ? "+" : "-"}
                        {formatMoney(Math.abs(item.dayPnl), item.currency)}
                      </p>
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        data-testid={`button-history-${item.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHistoryId(item.id);
                        }}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        data-testid={`button-edit-${item.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditItem(item);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        data-testid={`button-delete-${item.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(item.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-card border border-card-border rounded-xl p-4">
            <NewsSection endpoint={relatedNewsEndpoint} title={relatedNewsTitle} maxItems={4} />
          </div>
        </div>
      </div>

      <PortfolioDialog open={addOpen} onOpenChange={setAddOpen} />
      <PortfolioDialog
        open={!!editItem}
        onOpenChange={(value) => {
          if (!value) setEditItem(undefined);
        }}
        editItem={editItem}
      />
      <AssetHistoryDialog
        item={historyItem}
        open={!!historyItem}
        onOpenChange={(value) => {
          if (!value) setHistoryId(null);
        }}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(value) => {
          if (!value) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa tài sản?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
