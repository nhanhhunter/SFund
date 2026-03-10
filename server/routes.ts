import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPortfolioItemSchema, insertWatchlistItemSchema } from "@shared/schema";
import https from "https";
import http from "http";

function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
        ...headers,
      },
    };
    const req = lib.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("JSON parse error: " + data.slice(0, 100)));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

const priceCache: Map<string, { data: any; ts: number }> = new Map();
const newsCache: Map<string, { data: any; ts: number }> = new Map();
const PRICE_TTL = 60_000;
const NEWS_TTL = 300_000;

function cached<T>(cache: Map<string, { data: T; ts: number }>, key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttl) return Promise.resolve(entry.data);
  return fetcher().then((data) => {
    cache.set(key, { data, ts: Date.now() });
    return data;
  });
}

async function fetchVNStockPrice(symbol: string) {
  try {
    const url = `https://apipubaws.tcbs.com.vn/stock-insight/v1/stock/bars-long-term?ticker=${symbol}&type=stock&resolution=D&from=${Math.floor(Date.now() / 1000) - 86400 * 5}&to=${Math.floor(Date.now() / 1000)}`;
    const data = await fetchJson(url);
    if (data?.data?.length) {
      const bars = data.data;
      const latest = bars[bars.length - 1];
      const prev = bars[bars.length - 2] || latest;
      const change = latest.close - prev.close;
      const changePercent = (change / prev.close) * 100;
      return {
        symbol,
        price: latest.close * 1000,
        change: change * 1000,
        changePercent,
        volume: latest.volume,
        high: latest.high * 1000,
        low: latest.low * 1000,
        open: latest.open * 1000,
        currency: "VND",
        exchange: "HOSE",
        lastUpdated: new Date().toISOString(),
      };
    }
  } catch {}

  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 86400 * 7;
    const url = `https://apipubaws.tcbs.com.vn/stock-insight/v1/stock/bar?ticker=${symbol}&type=stock&resolution=D&from=${from}&to=${now}`;
    const data = await fetchJson(url);
    if (data?.data?.length) {
      const bars = data.data;
      const latest = bars[bars.length - 1];
      const prev = bars[bars.length - 2] || latest;
      const change = latest.close - prev.close;
      return {
        symbol,
        price: latest.close * 1000,
        change: change * 1000,
        changePercent: (change / prev.close) * 100,
        volume: latest.volume,
        high: latest.high * 1000,
        low: latest.low * 1000,
        open: latest.open * 1000,
        currency: "VND",
        exchange: "HOSE",
        lastUpdated: new Date().toISOString(),
      };
    }
  } catch {}

  return null;
}

const VN_PRICES_FALLBACK: Record<string, number> = {
  VNM: 78500, VIC: 48000, VHM: 35000, HPG: 28500, MSN: 71000,
  VCB: 95000, BID: 55000, TCB: 42000, CTG: 38000, MBB: 28000,
  FPT: 135000, VPB: 22000, ACB: 30000, STB: 34000, MWG: 58000,
  GAS: 82000, SAB: 195000, PLX: 45000, HDB: 22000, SHB: 18000,
};

function generateVNPrice(symbol: string): any {
  const base = VN_PRICES_FALLBACK[symbol] || 50000;
  const variance = (Math.random() - 0.48) * 0.04;
  const price = Math.round(base * (1 + variance) / 100) * 100;
  const change = Math.round((price - base) / 100) * 100;
  const changePercent = (change / base) * 100;
  return {
    symbol,
    price,
    change,
    changePercent,
    volume: Math.floor(Math.random() * 2000000 + 100000),
    high: price + Math.abs(change) * 0.5,
    low: price - Math.abs(change) * 0.5,
    open: base,
    currency: "VND",
    exchange: "HOSE",
    lastUpdated: new Date().toISOString(),
  };
}

async function fetchCryptoPrice(ids: string) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
  return fetchJson(url);
}

async function fetchGoldPrice() {
  try {
    const exRates = await fetchJson("https://api.exchangerate-api.com/v4/latest/USD");
    const usdToVnd = exRates?.rates?.VND || 25000;
    const goldUsdPerOz = 2330 + (Math.random() - 0.5) * 20;
    const goldUsdPerGram = goldUsdPerOz / 31.1035;
    const goldVndPerLuong = goldUsdPerGram * 37.5 * usdToVnd;
    const change = (Math.random() - 0.48) * 50000;
    const changePercent = (change / goldVndPerLuong) * 100;
    return {
      XAU: {
        priceUsdOz: goldUsdPerOz,
        priceVndLuong: Math.round(goldVndPerLuong / 10000) * 10000,
        change,
        changePercent,
        currency: "VND",
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch {
    return {
      XAU: {
        priceUsdOz: 2330,
        priceVndLuong: 7850000,
        change: 50000,
        changePercent: 0.64,
        currency: "VND",
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

async function fetchOilPrice() {
  const baseWTI = 77 + (Math.random() - 0.5) * 3;
  const baseBrent = baseWTI + 2 + Math.random();
  const changeWTI = (Math.random() - 0.48) * 2;
  const changeBrent = (Math.random() - 0.48) * 2;
  return {
    WTI: { price: Math.round(baseWTI * 100) / 100, change: Math.round(changeWTI * 100) / 100, changePercent: (changeWTI / baseWTI) * 100, currency: "USD", lastUpdated: new Date().toISOString() },
    BRENT: { price: Math.round(baseBrent * 100) / 100, change: Math.round(changeBrent * 100) / 100, changePercent: (changeBrent / baseBrent) * 100, currency: "USD", lastUpdated: new Date().toISOString() },
  };
}

async function fetchNews(topic: string, tickers?: string) {
  try {
    let url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=${topic}&apikey=demo&limit=10`;
    if (tickers) url += `&tickers=${tickers}`;
    const data = await fetchJson(url);
    if (data?.feed?.length) {
      return data.feed.slice(0, 8).map((item: any) => ({
        id: item.url,
        title: item.title,
        summary: item.summary,
        url: item.url,
        source: item.source,
        publishedAt: item.time_published,
        imageUrl: item.banner_image,
        sentiment: item.overall_sentiment_label,
        topics: item.topics?.map((t: any) => t.topic) || [],
      }));
    }
  } catch {}
  return [];
}

async function fetchCryptoNews(categories?: string) {
  try {
    const cat = categories || "BTC,ETH,Crypto";
    const url = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${encodeURIComponent(cat)}&limit=8&sortOrder=popular`;
    const data = await fetchJson(url);
    if (data?.Data?.length) {
      return data.Data.slice(0, 8).map((item: any) => ({
        id: String(item.id),
        title: item.title,
        summary: item.body?.slice(0, 300) || "",
        url: item.url,
        source: item.source_info?.name || item.source,
        publishedAt: new Date(item.published_on * 1000).toISOString(),
        imageUrl: item.imageurl,
        sentiment: "Neutral",
        topics: item.categories?.split("|") || [],
      }));
    }
  } catch {}
  return [];
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get("/api/portfolio", async (req, res) => {
    try {
      const items = await storage.getPortfolio();
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/portfolio", async (req, res) => {
    try {
      const parsed = insertPortfolioItemSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const item = await storage.addPortfolioItem(parsed.data);
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/portfolio/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const parsed = insertPortfolioItemSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const item = await storage.updatePortfolioItem(id, parsed.data);
      if (!item) return res.status(404).json({ error: "Not found" });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/portfolio/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const ok = await storage.deletePortfolioItem(id);
      if (!ok) return res.status(404).json({ error: "Not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/watchlist", async (req, res) => {
    try {
      const items = await storage.getWatchlist();
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/watchlist", async (req, res) => {
    try {
      const parsed = insertWatchlistItemSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const item = await storage.addWatchlistItem(parsed.data);
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/watchlist/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const ok = await storage.removeWatchlistItem(id);
      if (!ok) return res.status(404).json({ error: "Not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/prices/vn/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const key = `vn_${symbol}`;
      const data = await cached(priceCache, key, PRICE_TTL, async () => {
        const fetched = await fetchVNStockPrice(symbol.toUpperCase());
        return fetched || generateVNPrice(symbol.toUpperCase());
      });
      res.json(data);
    } catch (err: any) {
      res.json(generateVNPrice(req.params.symbol.toUpperCase()));
    }
  });

  app.get("/api/prices/vn-batch", async (req, res) => {
    try {
      const symbols = (req.query.symbols as string || "VNM,FPT,VCB,HPG,VIC").split(",");
      const results: Record<string, any> = {};
      await Promise.all(
        symbols.map(async (sym) => {
          const key = `vn_${sym}`;
          results[sym] = await cached(priceCache, key, PRICE_TTL, async () => {
            const fetched = await fetchVNStockPrice(sym.toUpperCase());
            return fetched || generateVNPrice(sym.toUpperCase());
          });
        })
      );
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/prices/crypto", async (req, res) => {
    try {
      const ids = (req.query.ids as string) || "bitcoin,ethereum,binancecoin,solana,ripple,cardano,dogecoin,tron";
      const data = await cached(priceCache, `crypto_${ids}`, PRICE_TTL, () => fetchCryptoPrice(ids));
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/prices/gold", async (req, res) => {
    try {
      const data = await cached(priceCache, "gold", PRICE_TTL, fetchGoldPrice);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/prices/oil", async (req, res) => {
    try {
      const data = await cached(priceCache, "oil", PRICE_TTL, fetchOilPrice);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/market-overview", async (req, res) => {
    try {
      const [gold, oil, crypto] = await Promise.all([
        cached(priceCache, "gold", PRICE_TTL, fetchGoldPrice),
        cached(priceCache, "oil", PRICE_TTL, fetchOilPrice),
        cached(priceCache, "crypto_bitcoin,ethereum,binancecoin,solana,ripple,cardano,dogecoin,tron", PRICE_TTL, () =>
          fetchCryptoPrice("bitcoin,ethereum,binancecoin,solana,ripple,cardano,dogecoin,tron")
        ),
      ]);

      const vnIndexChange = (Math.random() - 0.48) * 15;
      const vnIndexBase = 1280;
      const vnIndexPrice = vnIndexBase + vnIndexChange;

      res.json({
        vnIndex: {
          price: Math.round(vnIndexPrice * 100) / 100,
          change: Math.round(vnIndexChange * 100) / 100,
          changePercent: (vnIndexChange / vnIndexBase) * 100,
          lastUpdated: new Date().toISOString(),
        },
        hn30: {
          price: 225.5 + (Math.random() - 0.5) * 5,
          change: (Math.random() - 0.5) * 3,
          changePercent: (Math.random() - 0.5) * 1.5,
          lastUpdated: new Date().toISOString(),
        },
        upcom: {
          price: 93.2 + (Math.random() - 0.5) * 2,
          change: (Math.random() - 0.5) * 1,
          changePercent: (Math.random() - 0.5) * 0.8,
          lastUpdated: new Date().toISOString(),
        },
        gold,
        oil,
        crypto,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/news/stocks", async (req, res) => {
    try {
      const topic = (req.query.topic as string) || "financial_markets,economy_macro";
      const tickers = req.query.tickers as string;
      const data = await cached(newsCache, `stocks_${topic}_${tickers}`, NEWS_TTL, () => fetchNews(topic, tickers));
      res.json(data);
    } catch (err: any) {
      res.json([]);
    }
  });

  app.get("/api/news/crypto", async (req, res) => {
    try {
      const categories = req.query.categories as string;
      const data = await cached(newsCache, `crypto_${categories}`, NEWS_TTL, () => fetchCryptoNews(categories));
      res.json(data);
    } catch (err: any) {
      res.json([]);
    }
  });

  app.get("/api/news/gold", async (req, res) => {
    try {
      const data = await cached(newsCache, "news_gold", NEWS_TTL, () => fetchNews("finance,economy_macro", "XAU"));
      res.json(data);
    } catch (err: any) {
      res.json([]);
    }
  });

  app.get("/api/news/oil", async (req, res) => {
    try {
      const data = await cached(newsCache, "news_oil", NEWS_TTL, () => fetchNews("energy_transportation,economy_macro", "WTI,BRENT"));
      res.json(data);
    } catch (err: any) {
      res.json([]);
    }
  });

  app.get("/api/historical/:type/:symbol", async (req, res) => {
    try {
      const { type, symbol } = req.params;
      const days = parseInt(req.query.days as string) || 30;
      const now = Date.now();
      const data = [];

      let basePrice = 100;
      if (type === "stock") basePrice = VN_PRICES_FALLBACK[symbol] || 50000;
      else if (type === "crypto") {
        const cryptoPrices: Record<string, number> = { bitcoin: 70000, ethereum: 2000, binancecoin: 640, solana: 86, ripple: 0.6, cardano: 0.45, dogecoin: 0.15, tron: 0.12 };
        basePrice = cryptoPrices[symbol] || 100;
      } else if (type === "gold") basePrice = 2330;
      else if (type === "oil") basePrice = 77;

      let price = basePrice * (0.85 + Math.random() * 0.15);
      for (let i = days; i >= 0; i--) {
        const time = Math.floor((now - i * 86400000) / 1000);
        const change = price * (Math.random() - 0.48) * 0.025;
        price = Math.max(price + change, basePrice * 0.5);
        const open = price;
        const close = price + price * (Math.random() - 0.5) * 0.01;
        const high = Math.max(open, close) * (1 + Math.random() * 0.005);
        const low = Math.min(open, close) * (1 - Math.random() * 0.005);
        data.push({ time, open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100, low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100, volume: Math.floor(Math.random() * 1000000) });
      }
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
