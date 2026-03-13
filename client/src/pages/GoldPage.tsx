import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Settings, TrendingDown, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatNumber, formatPercent, formatVnd, getChangeColor } from "@/lib/utils";
import PriceChart from "@/components/PriceChart";
import NewsSection from "@/components/NewsSection";
import { queryClient } from "@/lib/queryClient";

type Period = "1" | "7" | "30";
type GoldType = "sjc" | "nhan";
const FIXED_LUONG_PER_OUNCE = 1.205652996;
const MARKET_REFRESH_INTERVAL = 180_000;

const DEFAULT_SETTINGS = {
  shippingPerOz: 0.5,
  insurancePerOz: 0.2,
  importTaxPct: 0,
  processingFeePerLuong: 140000,
};

function useLocalStorage<T>(key: string, def: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : def;
    } catch {
      return def;
    }
  });

  const set = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };

  return [value, set] as const;
}

function SettingsPanel({
  settings,
  worldGoldPrice,
  usdToVnd,
  convertedPriceRaw,
  convertedPriceRounded,
  onChange,
  onClose,
}: {
  settings: typeof DEFAULT_SETTINGS;
  worldGoldPrice: number;
  usdToVnd: number;
  convertedPriceRaw: number;
  convertedPriceRounded: number;
  onChange: (s: typeof DEFAULT_SETTINGS) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState(settings);

  const field = (key: keyof typeof DEFAULT_SETTINGS, label: string, unit: string, step = "0.01") => (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,188px)] gap-4 items-center">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          step={step}
          value={local[key] as number}
          onChange={(e) => setLocal({ ...local, [key]: parseFloat(e.target.value) || 0 })}
          className="h-8 text-xs"
        />
        <span className="w-14 shrink-0 text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );

  const formulaBeforeTax = (worldGoldPrice + local.shippingPerOz + local.insurancePerOz) * FIXED_LUONG_PER_OUNCE * usdToVnd;
  const formulaAfterTax = formulaBeforeTax * (1 + local.importTaxPct / 100);
  const formulaFinal = formulaAfterTax + local.processingFeePerLuong;
  const fmt = (value: number) => formatNumber(Math.round(value), { maximumFractionDigits: 0 });
  const fmtUsd = (value: number) => formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-card-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Cài đặt quy đổi vàng</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Tỷ giá USD/VND lấy từ Vietcombank một lần trong mỗi phiên app và dùng lại cho toàn bộ phép quy đổi.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="space-y-3">
            {field("shippingPerOz", "Phí vận chuyển", "$/oz")}
            {field("insurancePerOz", "Bảo hiểm", "$/oz")}
            {field("importTaxPct", "Thuế nhập khẩu", "%")}
            {field("processingFeePerLuong", "Phí gia công", "đ/lượng", "10000")}
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              Lượng/Ounce cố định: <span className="font-semibold text-foreground">{FIXED_LUONG_PER_OUNCE}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-sm font-semibold text-foreground">Công thức quy đổi</p>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <span className="text-muted-foreground">Giá thế giới</span>
              <span className="font-medium">${fmtUsd(worldGoldPrice)}/oz</span>
              <span className="text-muted-foreground">Tỷ giá USD/VND</span>
              <span className="font-medium">{formatNumber(usdToVnd, { maximumFractionDigits: 0 })}</span>
              <span className="text-muted-foreground">Sau phí vận chuyển + BH</span>
              <span className="font-medium">{fmt(formulaBeforeTax)}đ</span>
              <span className="text-muted-foreground">Sau thuế nhập khẩu</span>
              <span className="font-medium">{fmt(formulaAfterTax)}đ</span>
              <span className="text-muted-foreground">Sau phí gia công</span>
              <span className="font-medium">{fmt(formulaFinal)}đ</span>
            </div>
            <div className="mt-3 rounded-lg bg-background/80 p-3 text-xs text-muted-foreground">
              <p>
                Giá quy đổi = (Giá TG + phí VC + phí BH) × (1 + thuế NK) × lượng/oz × tỷ giá + phí gia công
              </p>
              <p className="mt-2 font-medium text-foreground">
                = ({fmtUsd(worldGoldPrice)} + {local.shippingPerOz} + {local.insurancePerOz}) ×{" "}
                {(1 + local.importTaxPct / 100).toFixed(2)} × {FIXED_LUONG_PER_OUNCE} × {formatNumber(usdToVnd, { maximumFractionDigits: 0 })} +{" "}
                {fmt(local.processingFeePerLuong)}
              </p>
              <p className="mt-1 font-bold text-foreground">
                = {fmt(convertedPriceRaw)} ≈ {fmt(convertedPriceRounded)}đ/lượng
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Hủy
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onChange(local);
              onClose();
            }}
          >
            Lưu
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function GoldPage() {
  const [worldPeriod, setWorldPeriod] = useState<Period>("7");
  const [vnPeriod, setVnPeriod] = useState<Period>("7");
  const [goldType, setGoldType] = useState<GoldType>("sjc");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useLocalStorage("gold_settings", DEFAULT_SETTINGS);

  const { data, isLoading, dataUpdatedAt } = useQuery<any>({
    queryKey: ["/api/prices/gold"],
    refetchInterval: MARKET_REFRESH_INTERVAL,
  });

  const { data: usdVndData } = useQuery<{ rate: number; source: string; lastUpdated: string }>({
    queryKey: ["/api/exchange-rates/usd-vnd"],
  });

  const gold = data?.XAU;
  const sjc = data?.SJC;
  const nhan = data?.NHAN9999;
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("vi-VN") : "--";
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/prices/gold"] });
  const fxSource = usdVndData?.source || "Vietcombank";

  const usdOz = gold?.priceUsdOz || 0;
  const usdToVnd = usdVndData?.rate || gold?.usdToVnd || 26315;
  const { shippingPerOz, insurancePerOz, importTaxPct, processingFeePerLuong } = settings;

  const convertedWorldPriceRaw =
    (usdOz + shippingPerOz + insurancePerOz) *
      (1 + importTaxPct / 100) *
      FIXED_LUONG_PER_OUNCE *
      usdToVnd +
    processingFeePerLuong;
  const convertedWorldPrice = Math.round(convertedWorldPriceRaw / 1000) * 1000;

  const sjcPrice = sjc?.sell || 0;
  const nhanPrice = nhan?.sell || 0;
  const sjcSpread = sjcPrice - convertedWorldPrice;
  const nhanSpread = nhanPrice - convertedWorldPrice;
  const sjcSpreadPct = convertedWorldPrice > 0 ? (sjcSpread / convertedWorldPrice) * 100 : 0;
  const nhanSpreadPct = convertedWorldPrice > 0 ? (nhanSpread / convertedWorldPrice) * 100 : 0;

  const fmt = (value: number) => formatNumber(Math.round(value), { maximumFractionDigits: 0 });
  const fmtUsd = (value: number) => formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const vietnamChartPrice = goldType === "sjc" ? sjcPrice : nhanPrice;
  const activeSpread = goldType === "sjc" ? sjcSpread : nhanSpread;
  const activeSpreadPct = goldType === "sjc" ? sjcSpreadPct : nhanSpreadPct;
  const worldUpdated = gold?.lastUpdated ? new Date(gold.lastUpdated).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--";
  const vietnamUpdatedSource = goldType === "sjc" ? sjc?.lastUpdated : nhan?.lastUpdated;
  const vietnamUpdated = vietnamUpdatedSource
    ? new Date(vietnamUpdatedSource).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : "--";
  const worldDays = worldPeriod === "1" ? 1 : worldPeriod === "7" ? 7 : 30;
  const vnDays = vnPeriod === "1" ? 1 : vnPeriod === "7" ? 7 : 30;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Giá Vàng</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Cập nhật lúc {lastUpdate} · Thế giới {worldUpdated} · Việt Nam {vietnamUpdated} · Nguồn: vang.today, {fxSource} · Làm mới mỗi 3 phút
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowSettings(true)}>
            <Settings className="h-3.5 w-3.5" />
            Cài đặt
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5" />
            Làm mới
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-6 dark:border-amber-800/30 dark:from-amber-950/30 dark:to-yellow-950/20">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Vàng thế giới · XAU/USD
          </p>
          {isLoading ? (
            <Skeleton className="mb-2 h-10 w-44 bg-amber-200/50" />
          ) : (
            <>
              <p className="text-4xl font-bold text-amber-900 dark:text-amber-100">${fmtUsd(usdOz)}</p>
              <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">mỗi ounce</p>
              <p className={cn("mt-2 flex items-center gap-1 text-sm font-medium", getChangeColor(gold?.changePercent || 0))}>
                {(gold?.changePercent || 0) >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {gold ? formatPercent(gold.changePercent) : "--"} hôm nay
              </p>
            </>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-amber-200/60 pt-3 text-xs dark:border-amber-700/30">
            <div>
              <p className="text-amber-600 dark:text-amber-400">Tỷ giá USD/VND</p>
              <p className="font-bold text-amber-800 dark:text-amber-200">
                {formatNumber(usdToVnd, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-amber-600 dark:text-amber-400">Giá quy đổi mỗi lượng</p>
              <p className="font-bold text-amber-800 dark:text-amber-200">{formatVnd(convertedWorldPrice)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50 p-6 dark:border-yellow-800/30 dark:from-yellow-950/20 dark:to-orange-950/20">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-yellow-800 dark:text-yellow-400">
              Giá Vàng VN · VND/lượng
            </p>
            <div className="flex items-center rounded-lg bg-yellow-200/50 p-0.5 dark:bg-yellow-800/30">
              <button
                onClick={() => setGoldType("sjc")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  goldType === "sjc"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-yellow-700 hover:text-foreground dark:text-yellow-400",
                )}
              >
                SJC 9999
              </button>
              <button
                onClick={() => setGoldType("nhan")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  goldType === "nhan"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-yellow-700 hover:text-foreground dark:text-yellow-400",
                )}
              >
                Nhẫn SJC
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-48 bg-yellow-200/50" />
              <Skeleton className="h-8 w-40 bg-yellow-200/50" />
            </div>
          ) : goldType === "sjc" ? (
            <div>
              <p className="mb-0.5 text-xs text-yellow-700 dark:text-yellow-400">
                SJC 9999
              </p>
              <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">{formatVnd(sjcPrice)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-yellow-700 dark:text-yellow-400">
                <span>Mua vào: {formatVnd(sjc?.buy || 0)}</span>
                <span>Quy đổi TG: {formatVnd(convertedWorldPrice)}</span>
                <span className={cn("font-semibold", activeSpread >= 0 ? "text-amber-700" : "text-emerald-700")}>
                  Chênh lệch: {activeSpread >= 0 ? "+" : ""}
                  {formatVnd(Math.abs(activeSpread))} ({activeSpreadPct.toFixed(1)}%)
                </span>
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-0.5 text-xs text-yellow-700 dark:text-yellow-400">
                Nhẫn SJC
              </p>
              <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">{formatVnd(nhanPrice)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-yellow-700 dark:text-yellow-400">
                <span>Mua vào: {formatVnd(nhan?.buy || 0)}</span>
                <span>Quy đổi TG: {formatVnd(convertedWorldPrice)}</span>
                <span className={cn("font-semibold", activeSpread >= 0 ? "text-amber-700" : "text-emerald-700")}>
                  Chênh lệch: {activeSpread >= 0 ? "+" : ""}
                  {formatVnd(Math.abs(activeSpread))} ({activeSpreadPct.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}

        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-card-border bg-card p-3">
          <p className="mb-1 text-xs text-muted-foreground">Thay đổi 24h XAU</p>
          <p className={cn("text-base font-bold", getChangeColor(gold?.changeUsdOz || 0))}>
            {gold ? `${gold.changeUsdOz >= 0 ? "+$" : "-$"}${fmtUsd(Math.abs(gold.changeUsdOz))} / oz` : "--"}
          </p>
          <p className="text-xs text-muted-foreground">
            {gold ? `${gold.change >= 0 ? "+" : ""}${formatNumber(Math.abs(gold.change), { maximumFractionDigits: 0 })} đ/lượng` : ""}
          </p>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-3">
          <p className="mb-1 text-xs text-muted-foreground">Chênh lệch SJC 9999</p>
          <p className={cn("text-base font-bold", getChangeColor(sjcSpread))}>
            {sjcSpread >= 0 ? "+" : ""}
            {formatVnd(Math.abs(sjcSpread))}
          </p>
          <p className="text-xs text-muted-foreground">{sjcSpreadPct.toFixed(1)}% so với quy đổi</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-3">
          <p className="mb-1 text-xs text-muted-foreground">Chênh lệch Nhẫn SJC</p>
          <p className={cn("text-base font-bold", getChangeColor(nhanSpread))}>
            {nhanSpread >= 0 ? "+" : ""}
            {formatVnd(Math.abs(nhanSpread))}
          </p>
          <p className="text-xs text-muted-foreground">{nhanSpreadPct.toFixed(1)}% so với quy đổi</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-3">
          <p className="mb-1 text-xs text-muted-foreground">USD/VND</p>
          <p className="text-base font-bold">{formatNumber(usdToVnd, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-muted-foreground">Tỷ giá VCB bán ra</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-card-border bg-card p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Biểu đồ vàng thế giới (XAU/USD)</h3>
              <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
                {(["1", "7", "30"] as Period[]).map((item) => (
                  <button
                    key={`world-${item}`}
                    onClick={() => setWorldPeriod(item)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      worldPeriod === item ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item === "1" ? "1N" : item === "7" ? "7N" : "30N"}
                  </button>
                ))}
              </div>
            </div>
            <PriceChart
              type="gold"
              symbol="XAU_USD"
              days={worldDays}
              currentPrice={usdOz || undefined}
              height={220}
              color="#d97706"
            />
          </div>

          <div className="rounded-xl border border-card-border bg-card p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-sm font-semibold">
                  Biểu đồ {goldType === "sjc" ? "SJC 9999" : "Nhẫn SJC"} (VND/lượng)
                </h3>
                <div className="flex items-center rounded-lg bg-yellow-200/40 p-0.5 dark:bg-yellow-800/20">
                  <button
                    onClick={() => setGoldType("sjc")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      goldType === "sjc"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    SJC 9999
                  </button>
                  <button
                    onClick={() => setGoldType("nhan")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      goldType === "nhan"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Nhẫn SJC
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
                {(["1", "7", "30"] as Period[]).map((item) => (
                  <button
                    key={`vn-${item}`}
                    onClick={() => setVnPeriod(item)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      vnPeriod === item ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item === "1" ? "1N" : item === "7" ? "7N" : "30N"}
                  </button>
                ))}
              </div>
            </div>
            <PriceChart
              type="gold"
              symbol={goldType === "sjc" ? "SJC_VND" : "NHAN_VND"}
              days={vnDays}
              currentPrice={vietnamChartPrice || undefined}
              height={220}
              color={goldType === "sjc" ? "#f59e0b" : "#f97316"}
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-xl border border-card-border bg-card p-4">
            <NewsSection endpoint="/api/news/gold" title="Tin tức về vàng" maxItems={6} />
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          worldGoldPrice={usdOz}
          usdToVnd={usdToVnd}
          convertedPriceRaw={convertedWorldPriceRaw}
          convertedPriceRounded={convertedWorldPrice}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
