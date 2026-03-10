import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatPercent, getChangeColor } from "@/lib/utils";
import PriceChart from "@/components/PriceChart";
import NewsSection from "@/components/NewsSection";
import { queryClient } from "@/lib/queryClient";

export default function OilPage() {
  const { data, isLoading, dataUpdatedAt } = useQuery<any>({
    queryKey: ["/api/prices/oil"],
    refetchInterval: 60_000,
  });

  const wti = data?.WTI;
  const brent = data?.BRENT;
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("vi-VN") : "--";

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/prices/oil"] });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Giá Dầu thô</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cập nhật lúc {lastUpdate}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={refresh}>
          <RefreshCw className="w-3.5 h-3.5" />
          Làm mới
        </Button>
      </div>

      {/* Hero cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* WTI */}
        <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 dark:from-slate-900/50 dark:to-blue-950/20 border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">WTI Crude · USD/bbl</p>
          {isLoading ? (
            <Skeleton className="h-12 w-40" />
          ) : (
            <>
              <p className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                ${wti?.price?.toFixed(2) || "--"}
              </p>
              <p className={cn("text-sm font-medium mt-1 flex items-center gap-1", getChangeColor(wti?.changePercent || 0))}>
                {(wti?.changePercent || 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {wti ? formatPercent(wti.changePercent) : "--"} hôm nay
              </p>
              <p className={cn("text-xs mt-0.5", getChangeColor(wti?.change || 0))}>
                {wti?.change ? `${wti.change >= 0 ? "+" : ""}${wti.change.toFixed(2)} USD` : ""}
              </p>
            </>
          )}
        </div>

        {/* Brent */}
        <div className="bg-gradient-to-br from-stone-50 to-orange-50/40 dark:from-stone-900/50 dark:to-orange-950/20 border border-stone-200 dark:border-stone-700/40 rounded-2xl p-6">
          <p className="text-sm font-medium text-stone-600 dark:text-stone-400 mb-2">Brent Crude · USD/bbl</p>
          {isLoading ? (
            <Skeleton className="h-12 w-40" />
          ) : (
            <>
              <p className="text-4xl font-bold text-stone-900 dark:text-stone-100">
                ${brent?.price?.toFixed(2) || "--"}
              </p>
              <p className={cn("text-sm font-medium mt-1 flex items-center gap-1", getChangeColor(brent?.changePercent || 0))}>
                {(brent?.changePercent || 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {brent ? formatPercent(brent.changePercent) : "--"} hôm nay
              </p>
              <p className={cn("text-xs mt-0.5", getChangeColor(brent?.change || 0))}>
                {brent?.change ? `${brent.change >= 0 ? "+" : ""}${brent.change.toFixed(2)} USD` : ""}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Spread info */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-card-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Spread Brent-WTI</p>
          <p className="text-base font-bold">{wti && brent ? `$${(brent.price - wti.price).toFixed(2)}` : "--"}</p>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">WTI (VND/lít)</p>
          <p className="text-base font-bold">{wti ? `${((wti.price / 158.987) * 25000).toFixed(0)}đ` : "--"}</p>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Thị trường</p>
          <p className="text-base font-bold text-emerald-600">Đang mở</p>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Sàn giao dịch</p>
          <p className="text-base font-bold">NYMEX · ICE</p>
        </div>
      </div>

      {/* Charts + News */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-card border border-card-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">Biểu đồ WTI 30 ngày (USD/bbl)</h3>
            <PriceChart type="oil" symbol="WTI" days={30} height={200} color="#64748b" />
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">Biểu đồ Brent 30 ngày (USD/bbl)</h3>
            <PriceChart type="oil" symbol="BRENT" days={30} height={180} color="#ea580c" />
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-card border border-card-border rounded-xl p-4">
            <NewsSection endpoint="/api/news/oil" title="Tin tức về dầu" maxItems={6} />
          </div>
        </div>
      </div>
    </div>
  );
}
