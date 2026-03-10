import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Star, Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency, formatPercent, getChangeColor, getChangeBg, assetTypeLabel } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { VN_STOCK_LIST, CRYPTO_LIST, type WatchlistItem, type InsertWatchlistItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import PriceChart from "@/components/PriceChart";

export default function WatchlistPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState("stock");
  const [addSymbol, setAddSymbol] = useState("");
  const { toast } = useToast();

  const { data: watchlist, isLoading } = useQuery<WatchlistItem[]>({
    queryKey: ["/api/watchlist"],
  });

  const { data: vnPrices } = useQuery<Record<string, any>>({
    queryKey: ["/api/prices/vn-batch"],
    queryFn: () => {
      const syms = (watchlist || []).filter(w => w.type === "stock").map(w => w.symbol).join(",");
      if (!syms) return Promise.resolve({});
      return fetch(`/api/prices/vn-batch?symbols=${syms}`).then(r => r.json());
    },
    enabled: !!(watchlist?.some(w => w.type === "stock")),
    refetchInterval: 60_000,
  });

  const { data: cryptoPrices } = useQuery<Record<string, any>>({
    queryKey: ["/api/prices/crypto"],
    queryFn: () => {
      const ids = (watchlist || []).filter(w => w.type === "crypto").map(w => w.symbol).join(",");
      if (!ids) return Promise.resolve({});
      return fetch(`/api/prices/crypto?ids=${ids}`).then(r => r.json());
    },
    enabled: !!(watchlist?.some(w => w.type === "crypto")),
    refetchInterval: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: async (item: InsertWatchlistItem) => {
      const res = await apiRequest("POST", "/api/watchlist", item);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "Đã thêm vào danh sách theo dõi" });
      setAddOpen(false);
      setAddSymbol("");
    },
    onError: (err: any) => toast({ title: "Lỗi", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/watchlist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "Đã xóa khỏi danh sách" });
    },
  });

  function getPrice(item: WatchlistItem) {
    if (item.type === "stock") return vnPrices?.[item.symbol];
    if (item.type === "crypto") return cryptoPrices?.[item.symbol];
    return null;
  }

  function formatPrice(item: WatchlistItem, priceData: any) {
    if (!priceData) return "--";
    if (item.type === "stock") return `${(priceData.price / 1000).toFixed(1)}K đ`;
    if (item.type === "crypto") return formatCurrency(priceData.usd);
    return "--";
  }

  function getChangePercent(item: WatchlistItem, priceData: any): number {
    if (!priceData) return 0;
    if (item.type === "stock") return priceData.changePercent || 0;
    if (item.type === "crypto") return priceData.usd_24h_change || 0;
    return 0;
  }

  const handleAddSubmit = () => {
    if (!addSymbol) return;
    let name = addSymbol;
    if (addType === "stock") {
      name = VN_STOCK_LIST.find(s => s.symbol === addSymbol)?.name || addSymbol;
    } else if (addType === "crypto") {
      name = CRYPTO_LIST.find(c => c.symbol === addSymbol)?.name || addSymbol;
    }
    addMutation.mutate({ symbol: addSymbol, name, type: addType as any });
  };

  const typeOptions = { stock: VN_STOCK_LIST, crypto: CRYPTO_LIST };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Danh sách theo dõi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{watchlist?.length || 0} tài sản đang theo dõi</p>
        </div>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-watchlist" className="gap-2">
          <Plus className="w-4 h-4" />
          Thêm theo dõi
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : !watchlist?.length ? (
        <div className="text-center py-16">
          <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
          <p className="text-muted-foreground">Chưa có tài sản nào trong danh sách</p>
          <Button onClick={() => setAddOpen(true)} className="mt-4 gap-2">
            <Plus className="w-4 h-4" />
            Thêm tài sản đầu tiên
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlist.map(item => {
            const priceData = getPrice(item);
            const changePercent = getChangePercent(item, priceData);
            return (
              <div
                key={item.id}
                data-testid={`watchlist-item-${item.id}`}
                className="bg-card border border-card-border rounded-xl p-4 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{item.symbol.toUpperCase()}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {assetTypeLabel(item.type)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.name}</p>
                  </div>
                  <button
                    data-testid={`button-remove-watchlist-${item.id}`}
                    onClick={() => removeMutation.mutate(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-end justify-between mb-2">
                  <div>
                    <p className="text-xl font-bold text-foreground">{formatPrice(item, priceData)}</p>
                    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 mt-1", getChangeBg(changePercent))}>
                      {changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {formatPercent(changePercent)}
                    </span>
                  </div>
                </div>

                <div className="h-14">
                  <PriceChart
                    type={item.type === "stock" ? "stock" : item.type === "crypto" ? "crypto" : "gold"}
                    symbol={item.symbol}
                    days={14}
                    height={56}
                    mini
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Thêm vào danh sách theo dõi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">Loại tài sản</Label>
              <Select value={addType} onValueChange={(v) => { setAddType(v); setAddSymbol(""); }}>
                <SelectTrigger data-testid="select-watchlist-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Cổ phiếu VN</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="gold">Vàng</SelectItem>
                  <SelectItem value="oil">Dầu thô</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm mb-2 block">Tài sản</Label>
              {addType === "stock" ? (
                <Select value={addSymbol} onValueChange={setAddSymbol}>
                  <SelectTrigger data-testid="select-watchlist-symbol">
                    <SelectValue placeholder="Chọn cổ phiếu" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {VN_STOCK_LIST.map(s => (
                      <SelectItem key={s.symbol} value={s.symbol}>{s.symbol} - {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : addType === "crypto" ? (
                <Select value={addSymbol} onValueChange={setAddSymbol}>
                  <SelectTrigger data-testid="select-watchlist-symbol">
                    <SelectValue placeholder="Chọn coin" />
                  </SelectTrigger>
                  <SelectContent>
                    {CRYPTO_LIST.map(c => (
                      <SelectItem key={c.symbol} value={c.symbol}>{c.ticker} - {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : addType === "gold" ? (
                <Select value={addSymbol} onValueChange={setAddSymbol}>
                  <SelectTrigger>
                    <SelectValue placeholder="Loại vàng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAU">Vàng 24K</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select value={addSymbol} onValueChange={setAddSymbol}>
                  <SelectTrigger>
                    <SelectValue placeholder="Loại dầu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WTI">WTI Crude</SelectItem>
                    <SelectItem value="BRENT">Brent Crude</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Hủy</Button>
              <Button onClick={handleAddSubmit} disabled={!addSymbol || addMutation.isPending}>
                {addMutation.isPending ? "Đang thêm..." : "Thêm vào danh sách"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
