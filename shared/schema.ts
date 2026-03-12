import { z } from "zod";

export const assetTypeEnum = z.enum(["stock", "gold", "oil", "crypto"]);
export type AssetType = z.infer<typeof assetTypeEnum>;
export const assetCurrencyEnum = z.enum(["VND", "USD"]);
export type AssetCurrency = z.infer<typeof assetCurrencyEnum>;

export function defaultPortfolioCurrency(type: AssetType): AssetCurrency {
  return type === "stock" || type === "gold" ? "VND" : "USD";
}

export const portfolioPurchaseSchema = z.object({
  quantity: z.number(),
  price: z.number(),
  boughtAt: z.string(),
});

export const portfolioDividendSchema = z.object({
  amount: z.number(),
  receivedAt: z.string(),
});

export type PortfolioPurchase = z.infer<typeof portfolioPurchaseSchema>;
export type PortfolioDividend = z.infer<typeof portfolioDividendSchema>;

export const portfolioItemSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  type: assetTypeEnum,
  currency: assetCurrencyEnum,
  purchaseLots: z.array(portfolioPurchaseSchema).min(1),
  dividends: z.array(portfolioDividendSchema).default([]),
  quantity: z.number(),
  avgBuyPrice: z.number(),
  notes: z.string().optional(),
  addedAt: z.string(),
});

export const insertPortfolioItemSchema = portfolioItemSchema.omit({ id: true, addedAt: true });

export type PortfolioItem = z.infer<typeof portfolioItemSchema>;
export type InsertPortfolioItem = z.infer<typeof insertPortfolioItemSchema>;

export const priceDataSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  price: z.number(),
  change: z.number(),
  changePercent: z.number(),
  volume: z.number().optional(),
  high: z.number().optional(),
  low: z.number().optional(),
  open: z.number().optional(),
  currency: z.string(),
  lastUpdated: z.string(),
  exchange: z.string().optional(),
});

export type PriceData = z.infer<typeof priceDataSchema>;

export const newsItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  url: z.string(),
  source: z.string(),
  publishedAt: z.string(),
  imageUrl: z.string().optional(),
  sentiment: z.string().optional(),
  topics: z.array(z.string()).optional(),
});

export type NewsItem = z.infer<typeof newsItemSchema>;

export const historicalPriceSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().optional(),
});

export type HistoricalPrice = z.infer<typeof historicalPriceSchema>;

export const watchlistItemSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  type: assetTypeEnum,
  addedAt: z.string(),
});

export const insertWatchlistItemSchema = watchlistItemSchema.omit({ id: true, addedAt: true });

export type WatchlistItem = z.infer<typeof watchlistItemSchema>;
export type InsertWatchlistItem = z.infer<typeof insertWatchlistItemSchema>;

export const VN_STOCK_LIST = [
  // HOSE
  { symbol: "VNM", name: "Vinamilk", exchange: "HOSE" },
  { symbol: "VIC", name: "Vingroup", exchange: "HOSE" },
  { symbol: "VHM", name: "Vinhomes", exchange: "HOSE" },
  { symbol: "HPG", name: "Hòa Phát Group", exchange: "HOSE" },
  { symbol: "MSN", name: "Masan Group", exchange: "HOSE" },
  { symbol: "VCB", name: "Vietcombank", exchange: "HOSE" },
  { symbol: "BID", name: "BIDV", exchange: "HOSE" },
  { symbol: "TCB", name: "Techcombank", exchange: "HOSE" },
  { symbol: "CTG", name: "VietinBank", exchange: "HOSE" },
  { symbol: "MBB", name: "MB Bank", exchange: "HOSE" },
  { symbol: "FPT", name: "FPT Corporation", exchange: "HOSE" },
  { symbol: "VPB", name: "VPBank", exchange: "HOSE" },
  { symbol: "ACB", name: "Asia Commercial Bank", exchange: "HOSE" },
  { symbol: "STB", name: "Sacombank", exchange: "HOSE" },
  { symbol: "MWG", name: "Mobile World Group", exchange: "HOSE" },
  { symbol: "GAS", name: "PetroVietnam Gas", exchange: "HOSE" },
  { symbol: "SAB", name: "Sabeco", exchange: "HOSE" },
  { symbol: "PLX", name: "Petrolimex", exchange: "HOSE" },
  { symbol: "HDB", name: "HDBank", exchange: "HOSE" },
  { symbol: "VRE", name: "Vincom Retail", exchange: "HOSE" },
  { symbol: "SSI", name: "SSI Securities", exchange: "HOSE" },
  { symbol: "PDR", name: "Phat Dat Real Estate", exchange: "HOSE" },
  { symbol: "REE", name: "REE Corporation", exchange: "HOSE" },
  { symbol: "PNJ", name: "Phu Nhuan Jewelry", exchange: "HOSE" },
  { symbol: "DXG", name: "Dat Xanh Group", exchange: "HOSE" },
  { symbol: "VJC", name: "VietJet Air", exchange: "HOSE" },
  { symbol: "HVN", name: "Vietnam Airlines", exchange: "HOSE" },
  { symbol: "PAN", name: "Pan Group", exchange: "HOSE" },
  { symbol: "AAA", name: "An Phat Bioplastics", exchange: "HOSE" },
  // HNX
  { symbol: "SHB", name: "Saigon-Hanoi Bank", exchange: "HNX" },
  { symbol: "PVS", name: "PVS Technical Services", exchange: "HNX" },
  { symbol: "NVB", name: "NCB Bank", exchange: "HNX" },
  { symbol: "BVS", name: "Bao Viet Securities", exchange: "HNX" },
  { symbol: "HUT", name: "Tasco Corporation", exchange: "HNX" },
  { symbol: "PVI", name: "PVI Holdings", exchange: "HNX" },
  { symbol: "CEO", name: "C.E.O Group", exchange: "HNX" },
  { symbol: "VCS", name: "Vicostone", exchange: "HNX" },
  { symbol: "IDC", name: "Idico Corporation", exchange: "HNX" },
  { symbol: "HBC", name: "Hoa Binh Construction", exchange: "HNX" },
  // UpCOM
  { symbol: "BSR", name: "Binh Son Refining", exchange: "UpCOM" },
  { symbol: "OIL", name: "PV Oil", exchange: "UpCOM" },
  { symbol: "MCH", name: "Masan Consumer", exchange: "UpCOM" },
  { symbol: "VEA", name: "Vietnam Engine & Agricultural Machinery", exchange: "UpCOM" },
  { symbol: "QNS", name: "Quang Ngai Sugar", exchange: "UpCOM" },
  { symbol: "VGT", name: "Vinatex", exchange: "UpCOM" },
  { symbol: "ABI", name: "ABI Insurance", exchange: "UpCOM" },
  { symbol: "VTP", name: "Viettel Post", exchange: "UpCOM" },
];

export const CRYPTO_LIST = [
  { symbol: "bitcoin", name: "Bitcoin", ticker: "BTC" },
  { symbol: "ethereum", name: "Ethereum", ticker: "ETH" },
  { symbol: "binancecoin", name: "BNB", ticker: "BNB" },
  { symbol: "solana", name: "Solana", ticker: "SOL" },
  { symbol: "ripple", name: "XRP", ticker: "XRP" },
  { symbol: "cardano", name: "Cardano", ticker: "ADA" },
  { symbol: "dogecoin", name: "Dogecoin", ticker: "DOGE" },
  { symbol: "tron", name: "TRON", ticker: "TRX" },
];
