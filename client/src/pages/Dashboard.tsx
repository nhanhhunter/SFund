import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, RefreshCw, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";
import PriceChart from "@/components/PriceChart";
import NewsSection from "@/components/NewsSection";
import { queryClient } from "@/lib/queryClient";

function IndexCard({ label, value, change, changePercent, loading }: any) {
  if (loading) return <Skeleton className="h-24 rounded-xl" />;
  const up = changePercent >= 0;
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <span className={cn("flex items-center gap-0.5 text-xs font-semibold", getChangeColor(changePercent))}>
          {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {formatPercent(changePercent)}
        </span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className={cn("text-xs mt-0.5", getChangeColor(change))}>
        {change >= 0 ? "+" : ""}{typeof change === "number" ? change.toFixed(2) : change}
      </p>
    </div>
  );
}

function CryptoMiniCard({ id, data }: { id: string; data: any }) {
  const names: Record<string, string> = {
    bitcoin: "BTC", ethereum: "ETH", binancecoin: "BNB", solana: "SOL",
    ripple: "XRP", cardano: "ADA", dogecoin: "DOGE", tron: "TRX",
  };
  if (!data) return <Skeleton className="h-16 rounded-xl" />;
  const change = data.usd_24h_change || 0;
  return (
    <div className="bg-card border border-card-border rounded-xl px-3 py-2.5 hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-foreground">{names[id] || id}</span>
        <span className={cn("text-xs font-medium", getChangeColor(change))}>
          {formatPercent(change)}
        </span>
      </div>
      <p className="text-sm font-bold text-foreground mt-0.5">{formatCurrency(data.usd)}</p>
    </div>
  );
}

export default function Dashboard() {
  const { data: overview, isLoading, dataUpdatedAt } = useQuery<any>({
    queryKey: ["/api/market-overview"],
    refetchInterval: 60_000,
  });

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("vi-VN") : "--:--";

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/market-overview"] });
  };

  const vnIndex = overview?.vnIndex;
  const gold = overview?.gold?.XAU;
  const oil = overview?.oil;
  const crypto = overview?.crypto || {};

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tổng quan thị trường</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cập nhật lúc {lastUpdate}</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Làm mới
        </Button>
      </div>

      {/* Market Indices */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Chỉ số thị trường</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <IndexCard
            label="VN-Index"
            value={vnIndex ? vnIndex.price.toFixed(2) : "--"}
            change={vnIndex?.change || 0}
            changePercent={vnIndex?.changePercent || 0}
            loading={isLoading}
          />
          <IndexCard
            label="HNX-Index"
            value={overview?.hn30 ? overview.hn30.price.toFixed(2) : "--"}
            change={overview?.hn30?.change || 0}
            changePercent={overview?.hn30?.changePercent || 0}
            loading={isLoading}
          />
          <IndexCard
            label="UPCOM"
            value={overview?.upcom ? overview.upcom.price.toFixed(2) : "--"}
            change={overview?.upcom?.change || 0}
            changePercent={overview?.upcom?.changePercent || 0}
            loading={isLoading}
          />
        </div>
      </section>

      {/* Commodities */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Hàng hóa</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <IndexCard
            label="Vàng (VND/Lượng)"
            value={gold ? new Intl.NumberFormat("vi-VN").format(gold.priceVndLuong) : "--"}
            change={gold?.change || 0}
            changePercent={gold?.changePercent || 0}
            loading={isLoading}
          />
          <IndexCard
            label="Vàng (USD/Oz)"
            value={gold ? `$${gold.priceUsdOz.toFixed(2)}` : "--"}
            change={gold?.changePercent ? gold.priceUsdOz * 0.001 : 0}
            changePercent={gold?.changePercent || 0}
            loading={isLoading}
          />
          <IndexCard
            label="Dầu WTI (USD/bbl)"
            value={oil?.WTI ? `$${oil.WTI.price.toFixed(2)}` : "--"}
            change={oil?.WTI?.change || 0}
            changePercent={oil?.WTI?.changePercent || 0}
            loading={isLoading}
          />
          <IndexCard
            label="Dầu Brent (USD/bbl)"
            value={oil?.BRENT ? `$${oil.BRENT.price.toFixed(2)}` : "--"}
            change={oil?.BRENT?.change || 0}
            changePercent={oil?.BRENT?.changePercent || 0}
            loading={isLoading}
          />
        </div>
      </section>

      {/* Crypto */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Tiền điện tử</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {["bitcoin", "ethereum", "binancecoin", "solana", "ripple", "cardano", "dogecoin", "tron"].map((id) => (
            <CryptoMiniCard key={id} id={id} data={crypto[id]} />
          ))}
        </div>
      </section>

      {/* Charts */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Biểu đồ VN-Index</h2>
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">VN-Index 30 ngày</span>
          </div>
          <PriceChart type="stock" symbol="VN_INDEX" days={30} height={200} />
        </div>
      </section>

      {/* News */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <NewsSection endpoint="/api/news/stocks" title="Tin tức thị trường chứng khoán" maxItems={5} />
          <NewsSection endpoint="/api/news/crypto" title="Tin tức Crypto" maxItems={5} />
        </div>
      </section>
    </div>
  );
}
