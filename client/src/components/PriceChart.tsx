import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { HistoricalPrice } from "@shared/schema";

interface Props {
  type: string;
  symbol: string;
  days?: number;
  color?: string;
  height?: number;
  mini?: boolean;
  currentPrice?: number;
}

const CustomTooltip = ({ active, payload, label, currency }: any) => {
  if (active && payload?.length) {
    const val = payload[0]?.value;
    const formatted = currency === "VND"
      ? new Intl.NumberFormat("vi-VN").format(val) + "đ"
      : `$${Number(val).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    return (
      <div className="bg-card border border-card-border rounded-lg p-2.5 shadow-md text-xs">
        <p className="text-muted-foreground mb-0.5">{new Date(label * 1000).toLocaleDateString("vi-VN")}</p>
        <p className="font-semibold text-foreground">{formatted}</p>
      </div>
    );
  }
  return null;
};

export default function PriceChart({ type, symbol, days = 30, color = "#1A73E8", height = 160, mini = false, currentPrice }: Props) {
  const priceParam = currentPrice ? `&currentPrice=${currentPrice}` : "";
  const { data, isLoading } = useQuery<HistoricalPrice[]>({
    queryKey: [`/api/historical/${type}/${symbol}`, days, currentPrice],
    queryFn: () => fetch(`/api/historical/${type}/${symbol}?days=${days}${priceParam}`).then(r => r.json()),
    refetchInterval: 120_000,
  });

  if (isLoading) return <Skeleton style={{ height }} className="rounded-xl w-full" />;

  if (!data?.length) return (
    <div style={{ height }} className="flex items-center justify-center text-muted-foreground text-xs">
      Không có dữ liệu
    </div>
  );

  const currency = type === "stock" ? "VND" : "USD";
  const chartData = data.map((d) => ({ time: d.time, price: d.close }));
  const minVal = Math.min(...chartData.map(d => d.price));
  const maxVal = Math.max(...chartData.map(d => d.price));
  const isUp = chartData[chartData.length - 1]?.price >= chartData[0]?.price;
  const chartColor = isUp ? "#10b981" : "#f43f5e";

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
          <YAxis domain={[minVal * 0.998, maxVal * 1.002]} hide />
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
          tickFormatter={(t) => {
            const d = new Date(t * 1000);
            return `${d.getDate()}/${d.getMonth() + 1}`;
          }}
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minVal * 0.996, maxVal * 1.004]}
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={currency === "VND" ? 70 : 60}
          tickFormatter={(v) => currency === "VND" ? `${(v / 1000).toFixed(0)}K` : `$${v.toFixed(0)}`}
        />
        <Tooltip content={<CustomTooltip currency={currency} />} />
        <Area type="monotone" dataKey="price" stroke={chartColor} strokeWidth={2} fill={`url(#grad-${symbol})`} dot={false} activeDot={{ r: 4, fill: chartColor, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
