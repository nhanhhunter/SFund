import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { HistoricalPrice } from "@shared/schema";
import { fetchJson } from "@/lib/queryClient";
import { formatCurrency, formatNumber, formatVnd } from "@/lib/utils";

interface Props {
  type: string;
  symbol: string;
  days?: number;
  color?: string;
  height?: number;
  mini?: boolean;
  currentPrice?: number;
}

const REFRESH_INTERVAL = 180_000;

const niceNumber = (value: number, round: boolean) => {
  const exponent = Math.floor(Math.log10(value || 1));
  const fraction = value / 10 ** exponent;
  let niceFraction = 1;

  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }

  return niceFraction * 10 ** exponent;
};

const buildNiceTicks = (minValue: number, maxValue: number, tickCount = 5) => {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) return [0, 1];
  if (minValue === maxValue) {
    const padding = minValue === 0 ? 1 : niceNumber(Math.abs(minValue) * 0.05, true);
    return [minValue - padding, minValue, minValue + padding];
  }

  const range = niceNumber(maxValue - minValue, false);
  const step = niceNumber(range / Math.max(tickCount - 1, 1), true);
  const start = Math.floor(minValue / step) * step;
  const end = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];

  for (let tick = start; tick <= end + step * 0.5; tick += step) {
    ticks.push(Number(tick.toFixed(6)));
  }

  return ticks;
};

const formatYAxisValue = (value: number, currency: "VND" | "USD") =>
  currency === "VND"
    ? formatNumber(value, { maximumFractionDigits: 0 })
    : formatCurrency(value);

const getTimeTickStep = (days: number) => {
  if (days <= 1) return 60 * 60;
  if (days <= 7) return 24 * 60 * 60;
  if (days <= 30) return 5 * 24 * 60 * 60;
  return 10 * 24 * 60 * 60;
};

const buildTimeTicks = (times: number[], days: number) => {
  if (times.length < 2) return times;
  const start = times[0];
  const end = times[times.length - 1];
  const step = getTimeTickStep(days);
  const ticks: number[] = [start];
  let cursor = Math.ceil(start / step) * step;

  while (cursor < end) {
    if (cursor > start) ticks.push(cursor);
    cursor += step;
  }

  if (ticks[ticks.length - 1] !== end) ticks.push(end);
  return ticks;
};

const formatTimeTick = (unix: number, days: number) => {
  const date = new Date(unix * 1000);
  if (days <= 1) {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
};

const CustomTooltip = ({ active, payload, label, currency, days }: any) => {
  if (!active || !payload?.length) return null;

  const val = Number(payload[0]?.value || 0);
  const formatted = currency === "VND" ? formatVnd(val) : formatCurrency(val);
  const date = new Date(Number(label) * 1000);

  return (
    <div className="bg-card border border-card-border rounded-lg p-2.5 shadow-md text-xs">
      <p className="text-muted-foreground mb-0.5">
        {days <= 1
          ? date.toLocaleString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
          : date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
      </p>
      <p className="font-semibold text-foreground">{formatted}</p>
    </div>
  );
};

export default function PriceChart({ type, symbol, days = 30, height = 160, mini = false, currentPrice }: Props) {
  const priceParam = currentPrice ? `&currentPrice=${currentPrice}` : "";
  const { data, isLoading } = useQuery<HistoricalPrice[]>({
    queryKey: [`/api/historical/${type}/${symbol}`, days, currentPrice],
    queryFn: () => fetchJson(`/api/historical/${type}/${symbol}?days=${days}${priceParam}`),
    refetchInterval: REFRESH_INTERVAL,
  });

  if (isLoading) return <Skeleton style={{ height }} className="rounded-xl w-full" />;

  if (!data?.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-muted-foreground text-xs">
        Khong co du lieu
      </div>
    );
  }

  const currency: "VND" | "USD" = type === "stock" || symbol.endsWith("_VND") ? "VND" : "USD";
  const chartData = [...data]
    .map((d) => ({ time: d.time, price: d.close }))
    .sort((a, b) => a.time - b.time);

  const minVal = Math.min(...chartData.map((d) => d.price));
  const maxVal = Math.max(...chartData.map((d) => d.price));
  const isUp = chartData[chartData.length - 1]?.price >= chartData[0]?.price;
  const chartColor = isUp ? "#10b981" : "#f43f5e";
  const yTicks = buildNiceTicks(minVal, maxVal, 5);
  const timeTicks = buildTimeTicks(chartData.map((item) => item.time), days);

  if (mini) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`mini-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.2} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="price" stroke={chartColor} strokeWidth={1.5} fill={`url(#mini-${symbol})`} dot={false} />
          <YAxis domain={[yTicks[0], yTicks[yTicks.length - 1]]} hide />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
            <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          type="number"
          domain={[chartData[0].time, chartData[chartData.length - 1].time]}
          ticks={timeTicks}
          tickFormatter={(t) => formatTimeTick(t, days)}
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          domain={[yTicks[0], yTicks[yTicks.length - 1]]}
          ticks={yTicks}
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={currency === "VND" ? 88 : 68}
          tickFormatter={(v) => formatYAxisValue(v, currency)}
        />
        <Tooltip content={<CustomTooltip currency={currency} days={days} />} />
        <Area type="monotone" dataKey="price" stroke={chartColor} strokeWidth={2} fill={`url(#grad-${symbol})`} dot={false} activeDot={{ r: 4, fill: chartColor, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
