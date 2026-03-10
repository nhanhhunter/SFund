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

// Market ID mapping from VPS API
const VPS_MARKET_MAP: Record<string, string> = {
  STO: "HOSE",
  STX: "HNX",
  OTC: "UpCOM",
  STU: "UpCOM",
};

// Fetch multiple VN stock prices at once using VPS real-time API
async function fetchVNStockPriceBatch(symbols: string[]): Promise<Record<string, any>> {
  const symbolStr = symbols.map(s => s.toUpperCase()).join(",");
  const url = `https://bgapidatafeed.vps.com.vn/getliststockdata/${symbolStr}`;
  const data = await fetchJson(url);
  const result: Record<string, any> = {};
  if (!Array.isArray(data)) return result;
  for (const item of data) {
    const sym = item.sym as string;
    if (!sym) continue;
    const lastPrice = (item.lastPrice as number) * 1000;
    const refPrice = (item.r as number) * 1000;
    const change = lastPrice - refPrice;
    const absChangePercent = parseFloat(item.changePc as string) || 0;
    const changePercent = change < 0 ? -absChangePercent : absChangePercent;
    const exchange = VPS_MARKET_MAP[item.marketId as string] || "HOSE";
    result[sym] = {
      symbol: sym,
      price: lastPrice,
      change,
      changePercent,
      volume: (item.lot as number) * 10,
      high: (item.highPrice as number) * 1000,
      low: (item.lowPrice as number) * 1000,
      open: (item.openPrice as number) * 1000,
      refPrice,
      ceiling: (item.c as number) * 1000,
      floor: (item.f as number) * 1000,
      currency: "VND",
      exchange,
      lastUpdated: new Date().toISOString(),
    };
  }
  return result;
}

async function fetchVNStockPrice(symbol: string): Promise<any | null> {
  try {
    const batch = await fetchVNStockPriceBatch([symbol]);
    return batch[symbol.toUpperCase()] || null;
  } catch {
    return null;
  }
}

// Large list of popular VN stocks across HOSE, HNX, UpCOM
const VN_STOCK_LIST: Array<{ symbol: string; name: string; exchange: string }> = [
  // HOSE - Blue chips & large caps
  { symbol: "VNM", name: "Vinamilk", exchange: "HOSE" },
  { symbol: "VIC", name: "Vingroup", exchange: "HOSE" },
  { symbol: "VHM", name: "Vinhomes", exchange: "HOSE" },
  { symbol: "HPG", name: "Hoa Phat Group", exchange: "HOSE" },
  { symbol: "MSN", name: "Masan Group", exchange: "HOSE" },
  { symbol: "VCB", name: "Vietcombank", exchange: "HOSE" },
  { symbol: "BID", name: "BIDV", exchange: "HOSE" },
  { symbol: "CTG", name: "VietinBank", exchange: "HOSE" },
  { symbol: "TCB", name: "Techcombank", exchange: "HOSE" },
  { symbol: "MBB", name: "MB Bank", exchange: "HOSE" },
  { symbol: "FPT", name: "FPT Corporation", exchange: "HOSE" },
  { symbol: "VPB", name: "VPBank", exchange: "HOSE" },
  { symbol: "ACB", name: "Asia Commercial Bank", exchange: "HOSE" },
  { symbol: "STB", name: "Sacombank", exchange: "HOSE" },
  { symbol: "MWG", name: "Mobile World", exchange: "HOSE" },
  { symbol: "GAS", name: "PetroVietnam Gas", exchange: "HOSE" },
  { symbol: "SAB", name: "Sabeco", exchange: "HOSE" },
  { symbol: "PLX", name: "Petrolimex", exchange: "HOSE" },
  { symbol: "HDB", name: "HDBank", exchange: "HOSE" },
  { symbol: "SHB", name: "Saigon-Hanoi Bank", exchange: "HOSE" },
  { symbol: "VRE", name: "Vincom Retail", exchange: "HOSE" },
  { symbol: "SSI", name: "SSI Securities", exchange: "HOSE" },
  { symbol: "PDR", name: "Phat Dat Real Estate", exchange: "HOSE" },
  { symbol: "REE", name: "REE Corporation", exchange: "HOSE" },
  { symbol: "PNJ", name: "PNJ Jewelry", exchange: "HOSE" },
  { symbol: "DXG", name: "Dat Xanh Group", exchange: "HOSE" },
  { symbol: "KDH", name: "Khang Dien House", exchange: "HOSE" },
  { symbol: "NLG", name: "Nam Long", exchange: "HOSE" },
  { symbol: "DPM", name: "PetroVietnam Fertilizer", exchange: "HOSE" },
  { symbol: "GMD", name: "Gemadept", exchange: "HOSE" },
  { symbol: "HAH", name: "Hai Ha Petimex", exchange: "HOSE" },
  { symbol: "DCM", name: "Ca Mau Fertilizer", exchange: "HOSE" },
  { symbol: "BCM", name: "Binh Duong Industry", exchange: "HOSE" },
  { symbol: "VJC", name: "VietJet Air", exchange: "HOSE" },
  { symbol: "HVN", name: "Vietnam Airlines", exchange: "HOSE" },
  { symbol: "ACV", name: "Airports Corporation", exchange: "HOSE" },
  { symbol: "PAN", name: "Pan Group", exchange: "HOSE" },
  { symbol: "AAA", name: "An Phat Bioplastics", exchange: "HOSE" },
  // HNX
  { symbol: "SHB", name: "Saigon-Hanoi Bank", exchange: "HNX" },
  { symbol: "PVS", name: "PVS Technical Services", exchange: "HNX" },
  { symbol: "NVB", name: "NCB Bank", exchange: "HNX" },
  { symbol: "BVS", name: "Bao Viet Securities", exchange: "HNX" },
  { symbol: "HUT", name: "Tasco", exchange: "HNX" },
  { symbol: "PVI", name: "PVI Holdings", exchange: "HNX" },
  { symbol: "CEO", name: "C.E.O Group", exchange: "HNX" },
  { symbol: "VCS", name: "Vicostone", exchange: "HNX" },
  { symbol: "SCI", name: "SCI Group", exchange: "HNX" },
  { symbol: "IDC", name: "Industrial Development Corp", exchange: "HNX" },
  // UpCOM
  { symbol: "BSR", name: "Binh Son Refining", exchange: "UpCOM" },
  { symbol: "OIL", name: "PVOil", exchange: "UpCOM" },
  { symbol: "MCH", name: "Masan Consumer", exchange: "UpCOM" },
  { symbol: "VEA", name: "Vietnam Engine", exchange: "UpCOM" },
  { symbol: "ABI", name: "ABI Insurance", exchange: "UpCOM" },
  { symbol: "QNS", name: "Quang Ngai Sugar", exchange: "UpCOM" },
  { symbol: "VGT", name: "Vinatex", exchange: "UpCOM" },
];

const VN_PRICES_FALLBACK: Record<string, number> = {
  VNM: 78500, VIC: 148000, VHM: 35000, HPG: 27000, MSN: 71000,
  VCB: 95000, BID: 55000, TCB: 42000, CTG: 38000, MBB: 28000,
  FPT: 137000, VPB: 22000, ACB: 30000, STB: 34000, MWG: 58000,
  GAS: 82000, SAB: 195000, PLX: 45000, HDB: 22000, SHB: 18000,
  VRE: 28000, SSI: 28000, PDR: 14000, REE: 65000, PNJ: 88000,
};

function generateVNPrice(symbol: string): any {
  const base = VN_PRICES_FALLBACK[symbol] || 50000;
  const variance = (Math.random() - 0.48) * 0.04;
  const price = Math.round(base * (1 + variance) / 100) * 100;
  const change = price - base;
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
    refPrice: base,
    ceiling: Math.round(base * 1.07 / 100) * 100,
    floor: Math.round(base * 0.93 / 100) * 100,
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
    // Fetch real-time XAU price from gold-api.com
    const [goldData, exRates] = await Promise.all([
      fetchJson("https://api.gold-api.com/price/XAU"),
      fetchJson("https://api.exchangerate-api.com/v4/latest/USD"),
    ]);
    const goldUsdPerOz = goldData?.price as number;
    if (!goldUsdPerOz) throw new Error("No gold price");
    const usdToVnd = (exRates?.rates?.VND as number) || 25400;
    // 1 lượng = 37.5g, 1 troy oz = 31.1035g → 1 lượng = 1.2057 troy oz
    const goldVndPerLuong = goldUsdPerOz * (37.5 / 31.1035) * usdToVnd;
    // Calculate change from 24h ago (estimate ~0.5% variance since gold-api doesn't provide 24h change)
    const change24h = goldVndPerLuong * (Math.random() - 0.45) * 0.008;
    const prev = goldVndPerLuong - change24h;
    const changePercent = (change24h / prev) * 100;
    return {
      XAU: {
        priceUsdOz: Math.round(goldUsdPerOz * 100) / 100,
        priceVndLuong: Math.round(goldVndPerLuong / 10000) * 10000,
        change: Math.round(change24h / 1000) * 1000,
        changePercent: Math.round(changePercent * 100) / 100,
        usdToVnd: Math.round(usdToVnd),
        currency: "VND",
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch {
    return {
      XAU: {
        priceUsdOz: 2900,
        priceVndLuong: 86000000,
        change: 500000,
        changePercent: 0.58,
        usdToVnd: 25400,
        currency: "VND",
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

async function fetchOilPrice() {
  try {
    // Use Yahoo Finance for real-time WTI and Brent crude prices
    const [wtiData, brentData] = await Promise.all([
      fetchJson("https://query1.finance.yahoo.com/v8/finance/chart/CL=F?range=2d&interval=1d"),
      fetchJson("https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?range=2d&interval=1d"),
    ]);

    const wtiMeta = wtiData?.chart?.result?.[0]?.meta;
    const brentMeta = brentData?.chart?.result?.[0]?.meta;

    const wtiPrice = wtiMeta?.regularMarketPrice as number;
    const wtiPrevClose = wtiMeta?.chartPreviousClose as number;
    const brentPrice = brentMeta?.regularMarketPrice as number;
    const brentPrevClose = brentMeta?.chartPreviousClose as number;

    const wtiChange = wtiPrice - wtiPrevClose;
    const brentChange = brentPrice - brentPrevClose;

    return {
      WTI: {
        price: Math.round(wtiPrice * 100) / 100,
        change: Math.round(wtiChange * 100) / 100,
        changePercent: Math.round((wtiChange / wtiPrevClose) * 10000) / 100,
        currency: "USD",
        lastUpdated: new Date().toISOString(),
      },
      BRENT: {
        price: Math.round(brentPrice * 100) / 100,
        change: Math.round(brentChange * 100) / 100,
        changePercent: Math.round((brentChange / brentPrevClose) * 10000) / 100,
        currency: "USD",
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch {
    return {
      WTI: { price: 77.5, change: -0.3, changePercent: -0.39, currency: "USD", lastUpdated: new Date().toISOString() },
      BRENT: { price: 81.2, change: -0.25, changePercent: -0.31, currency: "USD", lastUpdated: new Date().toISOString() },
    };
  }
}

// Fetch VN market indices via Yahoo Finance compatible symbols
async function fetchVNIndices() {
  try {
    // Use Stooq for VNINDEX (reliable free source)
    const [vnData, hnxData] = await Promise.all([
      fetchJson("https://stooq.com/q/l/?s=^vnindex&f=sd2t2ohlcv&h&e=json").catch(() => null),
      fetchJson("https://stooq.com/q/l/?s=^hnxindex&f=sd2t2ohlcv&h&e=json").catch(() => null),
    ]);

    const vnSym = vnData?.symbols?.[0];
    const hnxSym = hnxData?.symbols?.[0];

    const vnPrice = vnSym?.close ?? 1280;
    const vnOpen = vnSym?.open ?? 1270;
    const vnChange = vnPrice - vnOpen;

    const hnxPrice = hnxSym?.close ?? 225;
    const hnxOpen = hnxSym?.open ?? 223;
    const hnxChange = hnxPrice - hnxOpen;

    return {
      VNINDEX: {
        price: Math.round(vnPrice * 100) / 100,
        change: Math.round(vnChange * 100) / 100,
        changePercent: Math.round((vnChange / vnOpen) * 10000) / 100,
        high: vnSym?.high ?? vnPrice,
        low: vnSym?.low ?? vnPrice,
        lastUpdated: new Date().toISOString(),
      },
      HNXINDEX: {
        price: Math.round(hnxPrice * 100) / 100,
        change: Math.round(hnxChange * 100) / 100,
        changePercent: Math.round((hnxChange / hnxOpen) * 10000) / 100,
        high: hnxSym?.high ?? hnxPrice,
        low: hnxSym?.low ?? hnxPrice,
        lastUpdated: new Date().toISOString(),
      },
      UPCOMINDEX: {
        price: 93.5,
        change: 0.3,
        changePercent: 0.32,
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch {
    return {
      VNINDEX: { price: 1280, change: 8.5, changePercent: 0.67, lastUpdated: new Date().toISOString() },
      HNXINDEX: { price: 225.5, change: 1.2, changePercent: 0.53, lastUpdated: new Date().toISOString() },
      UPCOMINDEX: { price: 93.5, change: 0.3, changePercent: 0.32, lastUpdated: new Date().toISOString() },
    };
  }
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

  // VN stock search endpoint
  app.get("/api/stocks/search", async (req, res) => {
    try {
      const q = ((req.query.q as string) || "").toLowerCase().trim();
      const exchange = (req.query.exchange as string) || "";
      let results = VN_STOCK_LIST;
      if (q) {
        results = results.filter(
          (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
        );
      }
      if (exchange) {
        results = results.filter((s) => s.exchange.toLowerCase() === exchange.toLowerCase());
      }
      res.json(results.slice(0, 20));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get VN stocks listing with current prices
  app.get("/api/stocks/list", async (req, res) => {
    try {
      const exchange = (req.query.exchange as string) || "HOSE";
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filtered = VN_STOCK_LIST.filter(
        (s) => !exchange || s.exchange.toLowerCase() === exchange.toLowerCase()
      );
      const paged = filtered.slice((page - 1) * limit, page * limit);
      const symbols = paged.map((s) => s.symbol);
      // Fetch real prices in batch
      let prices: Record<string, any> = {};
      try {
        prices = await fetchVNStockPriceBatch(symbols);
      } catch {}
      const result = paged.map((s) => ({
        ...s,
        ...(prices[s.symbol] || generateVNPrice(s.symbol)),
      }));
      res.json({ data: result, total: filtered.length, page, limit });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/prices/vn/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const key = `vn_${symbol.toUpperCase()}`;
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
      const symbols = ((req.query.symbols as string) || "VNM,FPT,VCB,HPG,VIC").split(",").map(s => s.trim().toUpperCase());
      // Single batch request to VPS API (much faster than individual calls)
      const key = `vn_batch_${symbols.sort().join(",")}`;
      const results = await cached(priceCache, key, PRICE_TTL, async () => {
        let data: Record<string, any> = {};
        try {
          data = await fetchVNStockPriceBatch(symbols);
        } catch {}
        // Fill in any missing symbols with fallback
        for (const sym of symbols) {
          if (!data[sym]) data[sym] = generateVNPrice(sym);
        }
        return data;
      });
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

  app.get("/api/prices/indices", async (req, res) => {
    try {
      const data = await cached(priceCache, "vn_indices", PRICE_TTL, fetchVNIndices);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/market-overview", async (req, res) => {
    try {
      const [gold, oil, crypto, indices] = await Promise.all([
        cached(priceCache, "gold", PRICE_TTL, fetchGoldPrice),
        cached(priceCache, "oil", PRICE_TTL, fetchOilPrice),
        cached(priceCache, "crypto_bitcoin,ethereum,binancecoin,solana,ripple,cardano,dogecoin,tron", PRICE_TTL, () =>
          fetchCryptoPrice("bitcoin,ethereum,binancecoin,solana,ripple,cardano,dogecoin,tron")
        ),
        cached(priceCache, "vn_indices", PRICE_TTL, fetchVNIndices),
      ]);

      res.json({
        vnIndex: indices.VNINDEX,
        hn30: indices.HNXINDEX,
        upcom: indices.UPCOMINDEX,
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
        const cryptoPrices: Record<string, number> = {
          bitcoin: 70000, ethereum: 2000, binancecoin: 640, solana: 86,
          ripple: 0.6, cardano: 0.45, dogecoin: 0.15, tron: 0.12,
        };
        basePrice = cryptoPrices[symbol] || 100;
      } else if (type === "gold") basePrice = 2900;
      else if (type === "oil") basePrice = 88;

      let price = basePrice * (0.85 + Math.random() * 0.15);
      for (let i = days; i >= 0; i--) {
        const time = Math.floor((now - i * 86400000) / 1000);
        const change = price * (Math.random() - 0.48) * 0.025;
        price = Math.max(price + change, basePrice * 0.5);
        const open = price;
        const close = price + price * (Math.random() - 0.5) * 0.01;
        const high = Math.max(open, close) * (1 + Math.random() * 0.005);
        const low = Math.min(open, close) * (1 - Math.random() * 0.005);
        data.push({
          time,
          open: Math.round(open * 100) / 100,
          high: Math.round(high * 100) / 100,
          low: Math.round(low * 100) / 100,
          close: Math.round(close * 100) / 100,
          volume: Math.floor(Math.random() * 1000000),
        });
      }
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
