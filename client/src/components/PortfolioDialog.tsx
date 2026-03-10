import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertPortfolioItemSchema, VN_STOCK_LIST, CRYPTO_LIST, type InsertPortfolioItem, type PortfolioItem } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const formSchema = insertPortfolioItemSchema.extend({
  quantity: z.coerce.number().positive("Phải lớn hơn 0"),
  avgBuyPrice: z.coerce.number().positive("Phải lớn hơn 0"),
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editItem?: PortfolioItem;
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
    if (assetType === "stock") {
      const stock = VN_STOCK_LIST.find(s => s.symbol === value);
      if (stock) form.setValue("name", stock.name);
    } else if (assetType === "crypto") {
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
                      <Select value={field.value} onValueChange={onSymbolChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-symbol">
                            <SelectValue placeholder="Chọn mã" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-48">
                          {VN_STOCK_LIST.map(s => (
                            <SelectItem key={s.symbol} value={s.symbol}>{s.symbol} - {s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
