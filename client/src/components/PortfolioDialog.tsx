import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertPortfolioItemSchema, CRYPTO_LIST, type InsertPortfolioItem, type PortfolioItem } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = insertPortfolioItemSchema.extend({
  quantity: z.coerce.number().positive("Phải lớn hơn 0"),
  avgBuyPrice: z.coerce.number().positive("Phải lớn hơn 0"),
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editItem?: PortfolioItem;
}

const EX_BADGE: Record<string, string> = {
  HOSE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  HNX: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  UpCOM: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

function StockSearchInput({
  value,
  onChange,
  onNameChange,
}: {
  value: string;
  onChange: (symbol: string) => void;
  onNameChange: (name: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: results, isLoading } = useQuery<Array<{ symbol: string; name: string; exchange: string }>>({
    queryKey: ["/api/stocks/search", query],
    queryFn: () => fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`).then(r => r.json()),
    enabled: query.length >= 1,
    staleTime: 30_000,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (symbol: string, name: string) => {
    setQuery(symbol);
    onChange(symbol);
    onNameChange(name.includes(" - ") ? name.split(" - ")[0] : name);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    onChange("");
    onNameChange("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          data-testid="input-stock-symbol"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); onChange(e.target.value.toUpperCase()); }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm mã (VD: VNM, FPT...)"
          className="pl-8 pr-8 uppercase"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      {open && query.length >= 1 && (
        <div className="absolute left-0 top-10 z-50 bg-card border border-card-border rounded-xl shadow-lg w-full py-1 max-h-56 overflow-y-auto">
          {isLoading && <p className="text-xs text-muted-foreground px-3 py-2">Đang tìm...</p>}
          {!isLoading && (!results || results.length === 0) && (
            <p className="text-xs text-muted-foreground px-3 py-2">Không tìm thấy cổ phiếu</p>
          )}
          {results?.map(r => (
            <button
              key={r.symbol}
              type="button"
              data-testid={`option-stock-${r.symbol}`}
              className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
              onClick={() => handleSelect(r.symbol, r.name)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{r.symbol}</span>
                {r.exchange && (
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", EX_BADGE[r.exchange] || "bg-muted text-muted-foreground")}>
                    {r.exchange}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {r.name.includes(" - ") ? r.name.split(" - ").slice(1).join(" - ") : r.name}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PortfolioDialog({ open, onOpenChange, editItem }: Props) {
  const { toast } = useToast();
  const isEdit = !!editItem;

  const form = useForm<InsertPortfolioItem>({
    resolver: zodResolver(formSchema),
    defaultValues: editItem || {
      symbol: "",
      name: "",
      type: "stock",
      quantity: 0,
      avgBuyPrice: 0,
      notes: "",
    },
  });

  const assetType = form.watch("type");

  const mutation = useMutation({
    mutationFn: async (data: InsertPortfolioItem) => {
      if (isEdit) {
        const res = await apiRequest("PUT", `/api/portfolio/${editItem.id}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/portfolio", data);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      toast({ title: isEdit ? "Đã cập nhật" : "Đã thêm vào danh mục" });
      onOpenChange(false);
      form.reset();
    },
    onError: (err: any) => {
      toast({ title: "Lỗi", description: err.message, variant: "destructive" });
    },
  });

  const onTypeChange = (value: string) => {
    form.setValue("type", value as any);
    form.setValue("symbol", "");
    form.setValue("name", "");
  };

  const onSymbolChange = (value: string) => {
    form.setValue("symbol", value);
    if (assetType === "crypto") {
      const crypto = CRYPTO_LIST.find(c => c.symbol === value);
      if (crypto) form.setValue("name", crypto.name);
    } else if (assetType === "gold") {
      form.setValue("name", "Vàng 24K");
    } else if (assetType === "oil") {
      form.setValue("name", value === "BRENT" ? "Dầu Brent" : "Dầu WTI");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Chỉnh sửa tài sản" : "Thêm tài sản vào danh mục"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loại tài sản</FormLabel>
                  <Select value={field.value} onValueChange={onTypeChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-asset-type">
                        <SelectValue placeholder="Chọn loại" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="stock">Cổ phiếu VN</SelectItem>
                      <SelectItem value="crypto">Crypto</SelectItem>
                      <SelectItem value="gold">Vàng</SelectItem>
                      <SelectItem value="oil">Dầu thô</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="symbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mã / Symbol</FormLabel>
                    {assetType === "stock" ? (
                      <StockSearchInput
                        value={field.value}
                        onChange={(v) => {
                          field.onChange(v);
                        }}
                        onNameChange={(name) => {
                          if (name) form.setValue("name", name);
                        }}
                      />
                    ) : assetType === "crypto" ? (
                      <Select value={field.value} onValueChange={onSymbolChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-symbol">
                            <SelectValue placeholder="Chọn coin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CRYPTO_LIST.map(c => (
                            <SelectItem key={c.symbol} value={c.symbol}>{c.ticker} - {c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : assetType === "gold" ? (
                      <Select value={field.value} onValueChange={onSymbolChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Loại vàng" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="XAU">Vàng 24K (Lượng)</SelectItem>
                          <SelectItem value="XAU_SJC">Vàng SJC</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select value={field.value} onValueChange={onSymbolChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Loại dầu" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="WTI">WTI Crude</SelectItem>
                          <SelectItem value="BRENT">Brent Crude</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên</FormLabel>
                    <FormControl>
                      <Input data-testid="input-name" placeholder="Tên tài sản" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Số lượng</FormLabel>
                    <FormControl>
                      <Input data-testid="input-quantity" type="number" step="any" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="avgBuyPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giá mua TB</FormLabel>
                    <FormControl>
                      <Input data-testid="input-price" type="number" step="any" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea data-testid="input-notes" placeholder="Ghi chú..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" data-testid="button-submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Đang lưu..." : isEdit ? "Cập nhật" : "Thêm vào danh mục"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
