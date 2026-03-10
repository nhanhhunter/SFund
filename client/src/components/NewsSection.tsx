import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatTime, getSentimentColor } from "@/lib/utils";
import type { NewsItem } from "@shared/schema";

interface Props {
  endpoint: string;
  title?: string;
  maxItems?: number;
}

function SentimentIcon({ sentiment }: { sentiment?: string }) {
  const s = sentiment?.toLowerCase() || "";
  if (s.includes("bullish")) return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (s.includes("bearish")) return <TrendingDown className="w-3 h-3 text-rose-500" />;
  return <Minus className="w-3 h-3 text-amber-500" />;
}

export default function NewsSection({ endpoint, title = "Tin tức", maxItems = 6 }: Props) {
  const { data: news, isLoading } = useQuery<NewsItem[]>({
    queryKey: [endpoint],
    queryFn: () => fetch(endpoint).then(r => r.json()),
    refetchInterval: 300_000,
    staleTime: 240_000,
  });

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div className="space-y-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-xl border border-card-border bg-card">
                <Skeleton className="w-16 h-14 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))
          : !news?.length
          ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Không có tin tức
            </div>
          )
          : news.slice(0, maxItems).map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`news-item-${item.id?.slice(0, 20)}`}
              className="flex gap-3 p-3 rounded-xl border border-card-border bg-card hover:border-border hover:shadow-sm transition-all group block"
            >
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt=""
                  className="w-16 h-14 object-cover rounded-lg shrink-0 bg-muted"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">{item.source}</span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className="text-xs text-muted-foreground">{formatTime(item.publishedAt)}</span>
                  {item.sentiment && (
                    <>
                      <span className="text-muted-foreground text-xs">·</span>
                      <span className={`text-xs flex items-center gap-0.5 ${getSentimentColor(item.sentiment)}`}>
                        <SentimentIcon sentiment={item.sentiment} />
                        {item.sentiment}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))
        }
      </div>
    </div>
  );
}
