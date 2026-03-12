import { randomUUID } from "crypto";
import {
  defaultPortfolioCurrency,
  type PortfolioItem,
  type InsertPortfolioItem,
  type WatchlistItem,
  type InsertWatchlistItem,
} from "@shared/schema";

export interface IStorage {
  getPortfolio(): Promise<PortfolioItem[]>;
  getPortfolioItem(id: string): Promise<PortfolioItem | undefined>;
  addPortfolioItem(item: InsertPortfolioItem): Promise<PortfolioItem>;
  updatePortfolioItem(id: string, item: Partial<InsertPortfolioItem>): Promise<PortfolioItem | undefined>;
  deletePortfolioItem(id: string): Promise<boolean>;
  getWatchlist(): Promise<WatchlistItem[]>;
  addWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem>;
  removeWatchlistItem(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private portfolio: Map<string, PortfolioItem>;
  private watchlist: Map<string, WatchlistItem>;

  constructor() {
    this.portfolio = new Map();
    this.watchlist = new Map();
    this.seedData();
  }

  private seedData() {
    const items = [
      { symbol: "VNM", name: "Vinamilk", type: "stock", currency: "VND", quantity: 500, avgBuyPrice: 78500, notes: "Cổ phiếu tiêu dùng ổn định" },
      { symbol: "FPT", name: "FPT Corp", type: "stock", currency: "VND", quantity: 300, avgBuyPrice: 135000, notes: "Tăng trưởng công nghệ" },
      { symbol: "VCB", name: "Vietcombank", type: "stock", currency: "VND", quantity: 200, avgBuyPrice: 95000, notes: "Ngân hàng hàng đầu" },
      { symbol: "HPG", name: "Hòa Phát Group", type: "stock", currency: "VND", quantity: 1000, avgBuyPrice: 28000, notes: "Thép & bất động sản" },
      { symbol: "bitcoin", name: "Bitcoin", type: "crypto", currency: "USD", quantity: 0.5, avgBuyPrice: 65000, notes: "Digital gold" },
      { symbol: "ethereum", name: "Ethereum", type: "crypto", currency: "USD", quantity: 2, avgBuyPrice: 3200, notes: "Smart contract platform" },
      { symbol: "XAU", name: "Vàng 24K", type: "gold", currency: "VND", quantity: 5, avgBuyPrice: 7800000, notes: "Lượng vàng (chỉ)" },
      { symbol: "WTI", name: "Dầu WTI", type: "oil", currency: "USD", quantity: 10, avgBuyPrice: 78, notes: "Hợp đồng dầu thô" },
    ] satisfies Omit<InsertPortfolioItem, "purchaseLots" | "dividends">[];

    const seededItems: InsertPortfolioItem[] = items.map((item) => ({
      ...item,
      purchaseLots: [
        {
          quantity: item.quantity,
          price: item.avgBuyPrice,
          boughtAt: new Date().toISOString(),
        },
      ],
      dividends: [],
    }));

    for (const item of seededItems) {
      const id = randomUUID();
      const now = new Date().toISOString();
      const fullItem: PortfolioItem = {
        ...item,
        currency: item.currency || defaultPortfolioCurrency(item.type),
        id,
        addedAt: now,
        updatedAt: now,
      };
      this.portfolio.set(id, fullItem);
    }

    const watchItems: InsertWatchlistItem[] = [
      { symbol: "VIC", name: "Vingroup", type: "stock" },
      { symbol: "TCB", name: "Techcombank", type: "stock" },
      { symbol: "MBB", name: "MB Bank", type: "stock" },
      { symbol: "solana", name: "Solana", type: "crypto" },
    ];

    for (const item of watchItems) {
      const id = randomUUID();
      this.watchlist.set(id, { ...item, id, addedAt: new Date().toISOString() });
    }
  }

  async getPortfolio(): Promise<PortfolioItem[]> {
    return Array.from(this.portfolio.values());
  }

  async getPortfolioItem(id: string): Promise<PortfolioItem | undefined> {
    return this.portfolio.get(id);
  }

  async addPortfolioItem(item: InsertPortfolioItem): Promise<PortfolioItem> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const fullItem: PortfolioItem = {
      ...item,
      currency: item.currency || defaultPortfolioCurrency(item.type),
      id,
      addedAt: now,
      updatedAt: now,
    };
    this.portfolio.set(id, fullItem);
    return fullItem;
  }

  async updatePortfolioItem(id: string, updates: Partial<InsertPortfolioItem>): Promise<PortfolioItem | undefined> {
    const existing = this.portfolio.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.portfolio.set(id, updated);
    return updated;
  }

  async deletePortfolioItem(id: string): Promise<boolean> {
    return this.portfolio.delete(id);
  }

  async getWatchlist(): Promise<WatchlistItem[]> {
    return Array.from(this.watchlist.values());
  }

  async addWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem> {
    const id = randomUUID();
    const fullItem: WatchlistItem = { ...item, id, addedAt: new Date().toISOString() };
    this.watchlist.set(id, fullItem);
    return fullItem;
  }

  async removeWatchlistItem(id: string): Promise<boolean> {
    return this.watchlist.delete(id);
  }
}

export const storage = new MemStorage();
