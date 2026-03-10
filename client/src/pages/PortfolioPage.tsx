import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, BarChart3, PieChart, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn, formatCurrency, formatPercent, getChangeColor, getChangeBg, assetTypeLabel } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { PortfolioItem } from "@shared/schema";
import PortfolioDialog from "@/components/PortfolioDialog";
import { useToast } from "@/hooks/use-toast";
import { PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import PriceChart from "@/components/PriceChart";
import NewsSection from "@/components/NewsSection";

const PIE_COLORS = ["#1A73E8", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#06b6d4"];
type Period = "1" | "7" | "30";

type EnrichedItem = PortfolioItem & {
  currentPrice: number;
  costBasis: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
};

function AssetDetailPanel({ item, onClose }: { item: EnrichedItem; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("7");
  const days = period === "1" ? 1 : period === "7" ? 7 : 30;

  const chartType = item.type === "stock" ? "stock"
    : item.type === "crypto" ? "crypto"
    : item.type === "gold" ? "gold"
    : "oil";

  const chartSymbol = item.type === "gold" ? "XAU" : item.symbol;

  const newsEndpoint = item.type === "stock" ? `/api/news/stocks?tickers=${item.symbol}`
    : item.type === "crypto" ? `/api/news/crypto?categories=${item.symbol.toUpperCase()}`
    : item.type === "gold" ? "/api/news/gold"
    : "/api/news/oil";

  const fmtPrice = (val: number) => {
    if (item.type === "stock" || item.type === "gold") {
      return new Intl.NumberFormat("vi-VN").format(Math.round(val)) + "đ";
    }
    return formatCurrency(val);
  };

  return (
    <div className="lg:col-span-1 space-y-4">
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="font-bold text-sm text-foreground">{item.symbol.toUpperCase()}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[180px]">{item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* P&L breakdown */}
        <div className="px-4 py-3 grid grid-cols-2 gap-3 border-b border-card-border">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Giá hiện tại</p>
            <p className="font-bold text-sm text-foreground">{fmtPrice(item.currentPrice)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Giá mua TB</p>
            <p className="font-bold text-sm text-foreground">{fmtPrice(item.avgBuyPrice)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Số lượng</p>
            <p className="font-bold text-sm text-foreground">{item.quantity}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Giá trị đầu tư</p>
            <p className="font-bold text-sm text-foreground">{fmtPrice(item.costBasis)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Giá trị hiện tại</p>
            <p className="font-bold text-sm text-foreground">{fmtPrice(item.currentValue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Lãi/Lỗ</p>
            <p className={cn("font-bold text-sm", getChangeColor(item.pnl))}>
              {item.pnl >= 0 ? "+" : ""}{fmtPrice(Math.abs(item.pnl))}
            </p>
          </div>
        </div>

        {/* ROI badge */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-card-border">
          <span className="text-xs text-muted-foreground">Tổng ROI</span>
          <span className={cn("px-2.5 py-1 rounded-xl text-sm font-semibold", getChangeBg(item.pnlPercent))}>
            {item.pnl >= 0 ? "+" : ""}{formatPercent(item.pnlPercent)}
          </span>
        </div>

        {/* Chart */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold">Biểu đồ giá</p>
            <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
              {(["1", "7", "30"] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  data-testid={`btn-detail-period-${p}`}
                  className={cn(
                    "px-2 py-0.5 text-xs font-medium rounded-md transition-colors",
                    period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  )}
                >
                  {p === "1" ? "1N" : p === "7" ? "7N" : "30N"}
                </button>
              ))}
            </div>
          </div>
          <PriceChart
            type={chartType as any}
            symbol={chartSymbol}
            days={days}
            currentPrice={item.currentPrice || undefined}
            height={140}
          />
        </div>
      </div>

      {/* Related news */}
      <div className="bg-card border border-card-border rounded-xl p-4">
        <NewsSection endpoint={newsEndpoint} title="Tin liên quan" maxItems={4} />
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<PortfolioItem | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: portfolio, isLoading } = useQuery<PortfolioItem[]>({
    queryKey: ["/api/portfolio"],
    refetchInterval: 60_000,
  });

  const { data: cryptoPrices } = useQuery<Record<string, any>>({
    queryKey: ["/api/prices/crypto"],
    queryFn: () => fetch("/api/prices/crypto?ids=bitcoin,ethereum,binancecoin,solana,ripple,cardano,dogecoin,tron").then(r => r.json()),
    refetchInterval: 60_000,
  });

  const { data: goldData } = useQuery<any>({ queryKey: ["/api/prices/gold"], refetchInterval: 60_000 });
  const { data: oilData } = useQuery<any>({ queryKey: ["/api/prices/oil"], refetchInterval: 60_000 });

  const stockSymbols = useMemo(() => {
    return (portfolio || []).filter(i => i.type === "stock").map(i => i.symbol).join(",");
  }, [portfolio]);

  const { data: vnStockPrices } = useQuery<Record<string, any>>({
    queryKey: ["/api/prices/vn-batch", stockSymbols],
    queryFn: () => stockSymbols ? fetch(`/api/prices/vn-batch?symbols=${stockSymbols}`).then(r => r.json()) : Promise.resolve({}),
    enabled: !!stockSymbols,
    refetchInterval: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/portfolio/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      toast({ title: "Đã xóa khỏi danh mục" });
      setDeleteId(null);
    },
    onError: (err: any) => toast({ title: "Lỗi", description: err.message, variant: "destructive" }),
  });

  const enriched: EnrichedItem[] = useMemo(() => {
    function getCurrentPrice(item: PortfolioItem): number {
      if (item.type === "crypto") return cryptoPrices?.[item.symbol]?.usd || 0;
      if (item.type === "gold") return goldData?.XAU?.priceVndLuong || item.avgBuyPrice;
      if (item.type === "oil") return (item.symbol === "BRENT" ? oilData?.BRENT : oilData?.WTI)?.price || item.avgBuyPrice;
      if (item.type === "stock") return vnStockPrices?.[item.symbol]?.price || item.avgBuyPrice;
      return item.avgBuyPrice;
    }
    return (portfolio || []).map(item => {
      const currentPrice = getCurrentPrice(item);
      const costBasis = item.quantity * item.avgBuyPrice;
      const currentValue = item.quantity * currentPrice;
      const pnl = currentValue - costBasis;
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      return { ...item, currentPrice, costBasis, currentValue, pnl, pnlPercent };
    });
  }, [portfolio, cryptoPrices, goldData, oilData, vnStockPrices]);

  const totalValue = enriched.reduce((s, i) => s + i.currentValue, 0);
  const totalCost = enriched.reduce((s, i) => s + i.costBasis, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const byType = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const item of enriched) { groups[item.type] = (groups[item.type] || 0) + item.currentValue; }
    return Object.entries(groups).map(([name, value]) => ({ name: assetTypeLabel(name), value: Math.round(value) }));
  }, [enriched]);

  const formatValue = (item: EnrichedItem) => {
    if (item.type === "stock" || item.type === "gold") {
      return new Intl.NumberFormat("vi-VN").format(Math.round(item.currentValue)) + "đ";
    }
    return formatCurrency(item.currentValue);
  };

  const selectedItem = selectedId ? enriched.find(i => i.id === selectedId) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Danh mục đầu tư</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{portfolio?.length || 0} tài sản</p>
        </div>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-portfolio" className="gap-2">
          <Plus className="w-4 h-4" />
          Thêm tài sản
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-card-border rounded-xl p-4 lg:col-span-2">
          <p className="text-xs text-muted-foreground mb-1">Tổng giá trị danh mục</p>
          <div className="text-2xl font-bold text-foreground">
            {isLoading ? <Skeleton className="h-8 w-32" /> : `~${formatCurrency(totalValue)}`}
          </div>
          <p className={cn("text-sm font-medium mt-1 flex items-center gap-1", getChangeColor(totalPnl))}>
            {totalPnl >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {totalPnl >= 0 ? "+" : ""}{formatCurrency(Math.abs(totalPnl))} ({formatPercent(totalPnlPct)})
          </p>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Lãi/Lỗ</p>
          <p className={cn("text-xl font-bold", getChangeColor(totalPnl))}>
            {totalPnl >= 0 ? "+" : ""}{formatPercent(totalPnlPct)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Tổng ROI</p>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Số tài sản</p>
          <p className="text-xl font-bold text-foreground">{portfolio?.length || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Trong danh mục</p>
        </div>
      </div>

      <div className={cn("grid gap-6", selectedItem ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 lg:grid-cols-3")}>
        {/* Portfolio table */}
        <div className={cn(selectedItem ? "lg:col-span-2" : "lg:col-span-2")}>
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-card-border">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Danh sách tài sản
                {selectedItem && <span className="text-xs text-muted-foreground ml-1">(nhấn vào hàng để xem chi tiết)</span>}
              </h3>
            </div>
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
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
                {enriched.map(item => (
                  <div
                    key={item.id}
                    data-testid={`portfolio-item-${item.id}`}
                    onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 hover:bg-background/50 transition-colors group cursor-pointer",
                      item.id === selectedId && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm text-foreground">{item.symbol.toUpperCase()}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">{assetTypeLabel(item.type)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} × {item.type === "stock" || item.type === "gold"
                          ? new Intl.NumberFormat("vi-VN").format(Math.round(item.avgBuyPrice)) + "đ"
                          : formatCurrency(item.avgBuyPrice)
                        }
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{formatValue(item)}</p>
                      <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-md", getChangeBg(item.pnlPercent))}>
                        {formatPercent(item.pnlPercent)}
                      </span>
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        data-testid={`button-edit-${item.id}`}
                        onClick={e => { e.stopPropagation(); setEditItem(item); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        data-testid={`button-delete-${item.id}`}
                        onClick={e => { e.stopPropagation(); setDeleteId(item.id); }}
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

        {/* Right column: detail panel or pie chart */}
        {selectedItem ? (
          <AssetDetailPanel item={selectedItem} onClose={() => setSelectedId(null)} />
        ) : (
          <div className="lg:col-span-1">
            <div className="bg-card border border-card-border rounded-xl p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4 text-primary" />
                Phân bổ danh mục
              </h3>
              {byType.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <RechartsPie>
                    <Pie data={byType} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                      {byType.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(0)}`, "Giá trị"]} />
                    <Legend formatter={(value) => <span className="text-xs text-foreground">{value}</span>} />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  Chưa có dữ liệu
                </div>
              )}
            </div>

            {enriched.length > 0 && (
              <div className="bg-card border border-card-border rounded-xl p-4 mt-4">
                <h3 className="text-sm font-semibold mb-3">Hiệu suất tốt nhất</h3>
                <div className="space-y-2">
                  {[...enriched].sort((a, b) => b.pnlPercent - a.pnlPercent).slice(0, 4).map(item => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-foreground">{item.symbol.toUpperCase()}</span>
                        <p className="text-xs text-muted-foreground">{item.name}</p>
                      </div>
                      <span className={cn("text-sm font-semibold", getChangeColor(item.pnlPercent))}>
                        {formatPercent(item.pnlPercent)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <PortfolioDialog open={addOpen} onOpenChange={setAddOpen} />
      <PortfolioDialog open={!!editItem} onOpenChange={(v) => { if (!v) setEditItem(undefined); }} editItem={editItem} />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
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
