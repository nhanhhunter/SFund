import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, RefreshCw, Settings, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatPercent, getChangeColor } from "@/lib/utils";
import PriceChart from "@/components/PriceChart";
import NewsSection from "@/components/NewsSection";
import { queryClient } from "@/lib/queryClient";

type Period = "1" | "7" | "30";

const DEFAULT_SETTINGS = {
  shippingPerOz: 0.5,
  insurancePerOz: 0.2,
  importTaxPct: 0,
  processingFeePerLuong: 140000,
  sjcPremiumPerLuong: 5000000,
  luongPerOz: 1.205652996,
};

function useLocalStorage<T>(key: string, def: T) {
  const [v, setV] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; }
  });
  const set = (val: T) => { setV(val); try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
  return [v, set] as const;
}

function SettingsPanel({ settings, onChange, onClose }: {
  settings: typeof DEFAULT_SETTINGS;
  onChange: (s: typeof DEFAULT_SETTINGS) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState(settings);
  const field = (key: keyof typeof DEFAULT_SETTINGS, label: string, unit: string, step = "0.01") => (
    <div className="grid grid-cols-2 gap-2 items-center">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          step={step}
          value={local[key] as number}
          onChange={e => setLocal({ ...local, [key]: parseFloat(e.target.value) || 0 })}
          className="h-7 text-xs"
        />
        <span className="text-xs text-muted-foreground shrink-0 w-12">{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">Cài đặt quy đổi vàng</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3 mb-5">
          {field("luongPerOz", "Lượng/Ounce", "lượng/oz", "0.000001")}
          {field("shippingPerOz", "Phí vận chuyển", "$/oz")}
          {field("insurancePerOz", "Bảo hiểm", "$/oz")}
          {field("importTaxPct", "Thuế nhập khẩu", "%")}
          {field("processingFeePerLuong", "Phí gia công", "đ/lượng", "10000")}
          {field("sjcPremiumPerLuong", "Phụ trội SJC", "đ/lượng", "100000")}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Hủy</Button>
          <Button className="flex-1" onClick={() => { onChange(local); onClose(); }}>Lưu</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Tỷ giá USD/VND lấy từ dữ liệu thị trường
        </p>
      </div>
    </div>
  );
}

export default function GoldPage() {
  const [period, setPeriod] = useState<Period>("7");
  const [showSettings, setShowSettings] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [settings, setSettings] = useLocalStorage("gold_settings", DEFAULT_SETTINGS);

  const { data, isLoading, dataUpdatedAt } = useQuery<any>({
    queryKey: ["/api/prices/gold"],
    refetchInterval: 60_000,
  });

  const gold = data?.XAU;
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("vi-VN") : "--";
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/prices/gold"] });

  const usdOz = gold?.priceUsdOz || 0;
  const usdToVnd = gold?.usdToVnd || 26200;

  const { luongPerOz, shippingPerOz, insurancePerOz, importTaxPct, processingFeePerLuong, sjcPremiumPerLuong } = settings;

  const giaNhanRaw = (usdOz + shippingPerOz + insurancePerOz) * (1 + importTaxPct / 100) * luongPerOz * usdToVnd + processingFeePerLuong;
  const giaNhan = Math.round(giaNhanRaw / 1000) * 1000;
  const giaSJC = giaNhan + sjcPremiumPerLuong;
  const chenhLech = giaSJC - giaNhan;
  const chenhLechPct = giaNhan > 0 ? (chenhLech / giaNhan) * 100 : 0;

  const fmt = (v: number) => new Intl.NumberFormat("vi-VN").format(Math.round(v));
  const fmtUsd = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Giá Vàng</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cập nhật lúc {lastUpdate} · 60 giây/lần</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowSettings(true)}>
            <Settings className="w-3.5 h-3.5" />
            Cài đặt
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={refresh}>
            <RefreshCw className="w-3.5 h-3.5" />
            Làm mới
          </Button>
        </div>
      </div>

      {/* World gold + VN prices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* World gold - USD */}
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-6">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">Vàng thế giới · XAU/USD</p>
          {isLoading ? <Skeleton className="h-10 w-44 mb-2 bg-amber-200/50" /> : (
            <>
              <p className="text-4xl font-bold text-amber-900 dark:text-amber-100">
                ${fmtUsd(usdOz)}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">per troy ounce</p>
              <p className={cn("text-sm font-medium mt-2 flex items-center gap-1", getChangeColor(gold?.changePercent || 0))}>
                {(gold?.changePercent || 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {gold ? formatPercent(gold.changePercent) : "--"} hôm nay
              </p>
            </>
          )}
          <div className="mt-3 pt-3 border-t border-amber-200/60 dark:border-amber-700/30 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-amber-600 dark:text-amber-400">Tỷ giá USD/VND</p>
              <p className="font-bold text-amber-800 dark:text-amber-200">{usdToVnd.toLocaleString("vi-VN")}</p>
            </div>
            <div>
              <p className="text-amber-600 dark:text-amber-400">Per lượng (troy)</p>
              <p className="font-bold text-amber-800 dark:text-amber-200">${fmtUsd(usdOz * luongPerOz)}</p>
            </div>
          </div>
        </div>

        {/* VN Gold prices */}
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border border-yellow-200 dark:border-yellow-800/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-400 uppercase tracking-wide">Giá Vàng VN · VND/lượng</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-500">Quy đổi công thức</p>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-48 bg-yellow-200/50" />
              <Skeleton className="h-8 w-40 bg-yellow-200/50" />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-0.5">Vàng nhẫn 9999</p>
                <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">{fmt(giaNhan)}đ</p>
              </div>
              <div className="border-t border-yellow-200/60 dark:border-yellow-700/30 pt-2">
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-0.5">Vàng miếng SJC (ước tính)</p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{fmt(giaSJC)}đ</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-0.5">
                  Phụ trội: +{fmt(sjcPremiumPerLuong)}đ ({chenhLechPct.toFixed(1)}%)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Formula breakdown (collapsible) */}
      <div className="bg-card border border-card-border rounded-xl mb-6 overflow-hidden">
        <button
          onClick={() => setShowFormula(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
          data-testid="btn-toggle-formula"
        >
          <span className="text-sm font-semibold">Công thức quy đổi giá vàng thế giới → VN</span>
          {showFormula ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showFormula && (
          <div className="px-4 pb-4 border-t border-border">
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <span className="text-muted-foreground">Lượng/Ounce:</span>
              <span className="font-medium">{luongPerOz}</span>
              <span className="text-muted-foreground">Phí vận chuyển:</span>
              <span className="font-medium">{shippingPerOz} $/oz</span>
              <span className="text-muted-foreground">Bảo hiểm:</span>
              <span className="font-medium">{insurancePerOz} $/oz</span>
              <span className="text-muted-foreground">Thuế nhập khẩu:</span>
              <span className="font-medium">{importTaxPct}%</span>
              <span className="text-muted-foreground">Phí gia công:</span>
              <span className="font-medium">{fmt(processingFeePerLuong)} đ/lượng</span>
              <span className="text-muted-foreground">Giá thế giới:</span>
              <span className="font-medium">${fmtUsd(usdOz)}/oz</span>
              <span className="text-muted-foreground">Tỷ giá USD/VND:</span>
              <span className="font-medium">{usdToVnd.toLocaleString("vi-VN")}</span>
            </div>
            <div className="mt-3 bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Công thức:</p>
              <p>Giá VN = (Giá TG + phí VC + phí BH) × (1 + thuế NK) × {luongPerOz} × tỷ giá + phí gia công</p>
              <p className="mt-1.5 font-semibold text-foreground">
                = ({fmtUsd(usdOz)} + {shippingPerOz} + {insurancePerOz}) × {(1 + importTaxPct / 100).toFixed(2)} × {luongPerOz} × {usdToVnd.toLocaleString("vi-VN")} + {fmt(processingFeePerLuong)}
              </p>
              <p className="mt-0.5 font-bold text-foreground">= {fmt(giaNhanRaw)} ≈ {fmt(giaNhan)}đ</p>
            </div>
          </div>
        )}
      </div>

      {/* Chênh lệch SJC vs Thế giới */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-card-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Chênh lệch SJC/TG</p>
          <p className="text-base font-bold text-amber-600">+{fmt(sjcPremiumPerLuong)}đ</p>
          <p className="text-xs text-muted-foreground">{chenhLechPct.toFixed(1)}% premium</p>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">XAU/USD</p>
          <p className="text-base font-bold">${fmtUsd(usdOz)}</p>
          <p className="text-xs text-muted-foreground">Troy ounce</p>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">USD/VND</p>
          <p className="text-base font-bold">{usdToVnd.toLocaleString("vi-VN")}</p>
          <p className="text-xs text-muted-foreground">Tỷ giá tham chiếu</p>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Thay đổi 24h</p>
          <p className={cn("text-base font-bold", getChangeColor(gold?.changePercent || 0))}>
            {gold ? formatPercent(gold.changePercent) : "--"}
          </p>
          <p className="text-xs text-muted-foreground">{gold?.change ? `${gold.change >= 0 ? "+" : ""}${fmt(gold.change)}đ` : ""}</p>
        </div>
      </div>

      {/* Chart + News */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-card border border-card-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Biểu đồ giá vàng (USD/Oz)</h3>
              <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                {(["1", "7", "30"] as Period[]).map(p => (
                  <button
                    key={p}
                    data-testid={`btn-gold-period-${p}`}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                      period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p === "1" ? "1N" : p === "7" ? "7N" : "30N"}
                  </button>
                ))}
              </div>
            </div>
            <PriceChart
              type="gold"
              symbol="XAU"
              days={period === "1" ? 1 : period === "7" ? 7 : 30}
              currentPrice={usdOz || undefined}
              height={220}
              color="#f59e0b"
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-card border border-card-border rounded-xl p-4">
            <NewsSection endpoint="/api/news/gold" title="Tin tức về vàng" maxItems={6} />
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
