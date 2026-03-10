import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatPercent, getChangeColor, getChangeBg } from "@/lib/utils";
import PriceChart from "@/components/PriceChart";
import NewsSection from "@/components/NewsSection";
import { queryClient } from "@/lib/queryClient";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function GoldPage() {
  const { data, isLoading, dataUpdatedAt } = useQuery<any>({
    queryKey: ["/api/prices/gold"],
    refetchInterval: 60_000,
  });

  const gold = data?.XAU;
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("vi-VN") : "--";

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/prices/gold"] });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Giá Vàng</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cập nhật lúc {lastUpdate}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={refresh}>
          <RefreshCw className="w-3.5 h-3.5" />
          Làm mới
        </Button>
      </div>

      {/* Hero price card */}
      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">Giá Vàng 24K · VND/Lượng</p>
            {isLoading ? (
              <Skeleton className="h-12 w-48 bg-amber-200/50" />
            ) : (
              <>
                <p className="text-4xl font-bold text-amber-900 dark:text-amber-100">
                  {gold ? new Intl.NumberFormat("vi-VN").format(gold.priceVndLuong) : "--"}đ
                </p>
                <p className={cn("text-sm font-medium mt-1 flex items-center gap-1", getChangeColor(gold?.changePercent || 0))}>
                  {(gold?.changePercent || 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {gold ? formatPercent(gold.changePercent) : "--"} hôm nay
                </p>
              </>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">USD / Troy Oz</p>
            {isLoading ? (
              <Skeleton className="h-8 w-28 bg-amber-200/50" />
            ) : (
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-200">
                ${gold?.priceUsdOz?.toFixed(2) || "--"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Vàng miếng SJC" value={gold ? new Intl.NumberFormat("vi-VN").format(gold.priceVndLuong + 800000) + "đ" : "--"} sub="Mua vào" />
        <StatCard label="Vàng nhẫn 9999" value={gold ? new Intl.NumberFormat("vi-VN").format(gold.priceVndLuong - 200000) + "đ" : "--"} sub="Phổ biến" />
        <StatCard label="USD/VND" value={gold ? (gold.priceVndLuong / gold.priceUsdOz / 31.1035 * 37.5).toFixed(0) : "26.187"} sub="Tỷ giá tham khảo" />
        <StatCard label="XAU/USD" value={gold ? `$${gold.priceUsdOz?.toFixed(2)}` : "--"} sub="Thị trường quốc tế" />
      </div>

      {/* Chart + News */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-card border border-card-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">Biểu đồ giá vàng 30 ngày (USD/Oz)</h3>
            <PriceChart type="gold" symbol="XAU" days={30} height={220} color="#f59e0b" />
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">Giá vàng 90 ngày</h3>
            <PriceChart type="gold" symbol="XAU" days={90} height={180} color="#f59e0b" />
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-card border border-card-border rounded-xl p-4">
            <NewsSection endpoint="/api/news/gold" title="Tin tức về vàng" maxItems={6} />
          </div>
        </div>
      </div>
    </div>
  );
}
