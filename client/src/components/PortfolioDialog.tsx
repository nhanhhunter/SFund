import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Search, Trash2, X } from "lucide-react";
import {
  CRYPTO_LIST,
  defaultPortfolioCurrency,
  insertPortfolioItemSchema,
  type InsertPortfolioItem,
  type PortfolioItem,
} from "@shared/schema";
import { queryClient, fetchJson } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { addPortfolioItem, updatePortfolioItem } from "@/lib/user-data";
import { useAuth } from "@/components/AuthProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const formSchema = insertPortfolioItemSchema.extend({
  quantity: z.coerce.number().nonnegative(),
  avgBuyPrice: z.coerce.number().nonnegative(),
  purchaseLots: z.array(z.object({
    quantity: z.coerce.number().positive("Phải lớn hơn 0"),
    price: z.coerce.number().positive("Phải lớn hơn 0"),
    boughtAt: z.string().min(1, "Chọn thời gian mua"),
  })).min(1, "Cần ít nhất 1 lần mua"),
  dividends: z.array(z.object({
    amount: z.coerce.number().positive("Phải lớn hơn 0"),
    receivedAt: z.string().min(1, "Chọn ngày nhận"),
  })).default([]),
});

function toDateTimeLocal(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function buildPurchaseLot(quantity = 0, price = 0, boughtAt?: string) {
  return {
    quantity,
    price,
    boughtAt: toDateTimeLocal(boughtAt),
  };
}

function buildDividend(amount = 0, receivedAt?: string) {
  return {
    amount,
    receivedAt: toDateTimeLocal(receivedAt),
  };
}

function sanitizeFormattedNumberInput(value: string) {
  const stripped = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const [integerPart = "", ...fractionParts] = stripped.split(".");
  return {
    integerPart,
    fractionPart: fractionParts.join(""),
    hasTrailingDot: stripped.endsWith("."),
  };
}

function formatEditableNumber(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") return "";
  const raw = typeof value === "number" ? value.toString() : value;
  const { integerPart, fractionPart, hasTrailingDot } = sanitizeFormattedNumberInput(raw);
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "") || "0";
  const groupedInteger = normalizedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (hasTrailingDot) return `${groupedInteger}.`;
  if (fractionPart) return `${groupedInteger}.${fractionPart}`;
  return groupedInteger;
}

function parseFormattedNumber(value: string) {
  const { integerPart, fractionPart } = sanitizeFormattedNumberInput(value);
  if (!integerPart && !fractionPart) return 0;
  const normalized = fractionPart ? `${integerPart || "0"}.${fractionPart}` : integerPart || "0";
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatHoldingQuantity(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function FormattedNumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | string | undefined;
  onChange: (value: number) => void;
  placeholder?: string;
}) {
  const [displayValue, setDisplayValue] = useState(() => formatEditableNumber(value));

  useEffect(() => {
    setDisplayValue(formatEditableNumber(value));
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={displayValue}
      onChange={(event) => {
        const nextDisplay = formatEditableNumber(event.target.value);
        setDisplayValue(nextDisplay);
        onChange(parseFormattedNumber(event.target.value));
      }}
    />
  );
}

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

  const { data: results, isLoading } = useQuery<
    Array<{ symbol: string; name: string; exchange: string }>
  >({
    queryKey: ["/api/stocks/search", query],
    queryFn: () => fetchJson(`/api/stocks/search?q=${encodeURIComponent(query)}`),
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
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            onChange(e.target.value.toUpperCase());
          }}
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
          {results?.map((r) => (
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
                  <span
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded",
                      EX_BADGE[r.exchange] || "bg-muted text-muted-foreground",
                    )}
                  >
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
  const { user } = useAuth();
  const isEdit = !!editItem;

  const form = useForm<InsertPortfolioItem>({
    resolver: zodResolver(formSchema),
    defaultValues: editItem || {
      symbol: "",
      name: "",
      type: "stock",
      currency: defaultPortfolioCurrency("stock"),
      purchaseLots: [buildPurchaseLot()],
      dividends: [],
      quantity: 0,
      avgBuyPrice: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (editItem) {
      form.reset({
        ...editItem,
        purchaseLots: editItem.purchaseLots.map((lot) => buildPurchaseLot(lot.quantity, lot.price, lot.boughtAt)),
        dividends: editItem.dividends.map((dividend) => buildDividend(dividend.amount, dividend.receivedAt)),
      });
      return;
    }

    form.reset({
      symbol: "",
      name: "",
      type: "stock",
      currency: defaultPortfolioCurrency("stock"),
      purchaseLots: [buildPurchaseLot()],
      dividends: [],
      quantity: 0,
      avgBuyPrice: 0,
      notes: "",
    });
  }, [editItem, form, open]);

  const assetType = form.watch("type");
  const assetCurrency = form.watch("currency");
  const purchaseLots = form.watch("purchaseLots");
  const dividends = form.watch("dividends");
  const { fields: purchaseFields, append: appendPurchase, remove: removePurchase } = useFieldArray({
    control: form.control,
    name: "purchaseLots",
  });
  const { fields: dividendFields, append: appendDividend, remove: removeDividend } = useFieldArray({
    control: form.control,
    name: "dividends",
  });

  useEffect(() => {
    const totalQuantity = (purchaseLots || []).reduce((sum, lot) => sum + (Number(lot?.quantity) || 0), 0);
    const totalCost = (purchaseLots || []).reduce(
      (sum, lot) => sum + (Number(lot?.quantity) || 0) * (Number(lot?.price) || 0),
      0,
    );
    const avgBuyPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;

    form.setValue("quantity", totalQuantity, { shouldValidate: false, shouldDirty: false });
    form.setValue("avgBuyPrice", avgBuyPrice, { shouldValidate: false, shouldDirty: false });
  }, [form, purchaseLots]);

  const mutation = useMutation({
    mutationFn: async (data: InsertPortfolioItem) => {
      if (!user) throw new Error("Bạn cần đăng nhập để lưu danh mục.");
      const normalized: InsertPortfolioItem = {
        ...data,
        purchaseLots: data.purchaseLots.map((lot) => ({
          ...lot,
          boughtAt: new Date(lot.boughtAt).toISOString(),
        })),
        dividends: data.dividends.map((dividend) => ({
          ...dividend,
          receivedAt: new Date(dividend.receivedAt).toISOString(),
        })),
      };
      if (isEdit && editItem) {
        return updatePortfolioItem(user.uid, editItem.id, normalized, editItem.addedAt);
      }

      return addPortfolioItem(user.uid, normalized);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["portfolio", user.uid] });
      }
      toast({ title: isEdit ? "Đã cập nhật" : "Đã thêm vào danh mục" });
      onOpenChange(false);
      form.reset();
    },
    onError: (err: Error) => {
      toast({ title: "Lỗi", description: err.message, variant: "destructive" });
    },
  });

  const onTypeChange = (value: string) => {
    const nextType = value as InsertPortfolioItem["type"];
    form.setValue("type", nextType);
    form.setValue("currency", defaultPortfolioCurrency(nextType));
    form.setValue("symbol", "");
    form.setValue("name", "");
    if (nextType !== "stock") {
      form.setValue("dividends", []);
    }
  };

  const onSymbolChange = (value: string) => {
    form.setValue("symbol", value);

    if (assetType === "crypto") {
      const crypto = CRYPTO_LIST.find((c) => c.symbol === value);
      if (crypto) form.setValue("name", crypto.name);
    } else if (assetType === "gold") {
      form.setValue("name", value === "XAU_SJC" ? "Vàng SJC" : "Vàng 24K");
    } else if (assetType === "oil") {
      form.setValue("name", value === "BRENT" ? "Dầu Brent" : "Dầu WTI");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Chỉnh sửa tài sản" : "Thêm tài sản vào danh mục"}
          </DialogTitle>
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
                        onChange={field.onChange}
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
                          {CRYPTO_LIST.map((c) => (
                            <SelectItem key={c.symbol} value={c.symbol}>
                              {c.ticker} - {c.name}
                            </SelectItem>
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
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loại tiền</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-currency">
                          <SelectValue placeholder="Chọn đơn vị" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="VND">đ</SelectItem>
                        <SelectItem value="USD">$</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="rounded-xl border border-card-border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Tổng hợp</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  Tổng Số lượng {formatHoldingQuantity((purchaseLots || []).reduce((sum, lot) => sum + (Number(lot?.quantity) || 0), 0))}
                </p>
                <p className="text-xs text-muted-foreground">
                  Giá trung bình {assetCurrency === "USD" ? "$" : "đ"}{" "}
                  {(
                    (purchaseLots || []).reduce((sum, lot) => sum + (Number(lot?.quantity) || 0) * (Number(lot?.price) || 0), 0) /
                    Math.max(1, (purchaseLots || []).reduce((sum, lot) => sum + (Number(lot?.quantity) || 0), 0))
                  ).toLocaleString("en-US", { maximumFractionDigits: assetCurrency === "USD" ? 2 : 0 })}
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-card-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Các lần mua</p>
                  <p className="text-xs text-muted-foreground">Hệ thống tự tính số lượng tổng và giá mua trung bình.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => appendPurchase(buildPurchaseLot())}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm lần mua
                </Button>
              </div>

              {purchaseFields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_1fr_1.4fr_auto] gap-2">
                  <FormField
                    control={form.control}
                    name={`purchaseLots.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Số lượng</FormLabel>
                        <FormControl>
                          <FormattedNumberInput value={field.value} onChange={field.onChange} placeholder="0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`purchaseLots.${index}.price`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Giá ({assetCurrency === "USD" ? "$" : "đ"})</FormLabel>
                        <FormControl>
                          <FormattedNumberInput value={field.value} onChange={field.onChange} placeholder="0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`purchaseLots.${index}.boughtAt`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Thời gian mua</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={purchaseFields.length === 1}
                      onClick={() => removePurchase(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {assetType === "stock" && (
              <div className="space-y-3 rounded-xl border border-card-border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Cổ tức đã nhận</p>
                    <p className="text-xs text-muted-foreground">Cổ tức được cộng vào để tính ROI của cổ phiếu.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => appendDividend(buildDividend())}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm cổ tức
                  </Button>
                </div>

                {!dividendFields.length && (
                  <p className="text-xs text-muted-foreground">Chưa có khoản cổ tức nào.</p>
                )}

                {dividendFields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-[1fr_1.3fr_auto] gap-2">
                    <FormField
                      control={form.control}
                      name={`dividends.${index}.amount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Số cổ tức ({assetCurrency === "USD" ? "$" : "đ"})</FormLabel>
                          <FormControl>
                            <FormattedNumberInput value={field.value} onChange={field.onChange} placeholder="0" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`dividends.${index}.receivedAt`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Ngày nhận</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDividend(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button
                type="submit"
                data-testid="button-submit"
                disabled={mutation.isPending || !user}
              >
                {mutation.isPending
                  ? "Đang lưu..."
                  : isEdit
                    ? "Cập nhật"
                    : "Thêm vào danh mục"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
