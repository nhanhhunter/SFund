import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPortfolioItemSchema, insertWatchlistItemSchema } from "@shared/schema";
import https from "https";
import http from "http";
import { fetchVnstockHistory, fetchVnstockListing, fetchVnstockPriceBoard } from "./vnstock";

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

function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/xml,application/xml,text/plain,*/*",
        ...headers,
      },
    };
    const req = lib.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
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
const PRICE_TTL = 180_000;
const FX_TTL = 86_400_000;
const LISTING_TTL = 6 * 60 * 60 * 1000;
const GOLD_HISTORY_TTL = 300_000;
const NEWS_TTL = 300_000;
const US_INDEX_SYMBOLS = ["^GSPC", "^DJI", "^IXIC"] as const;

function formatVnstockDate(date: Date, withTime = false) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (!withTime) {
    return `${year}-${month}-${day}`;
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function parseVnstockTime(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed);
  const normalizedLocalTime = trimmed.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/)
    ? `${trimmed.replace(" ", "T")}${hasExplicitTimezone ? "" : "+07:00"}`
    : trimmed;
  const parsed = Date.parse(normalizedLocalTime);
  if (!Number.isNaN(parsed)) {
    return Math.floor(parsed / 1000);
  }

  return null;
}

function normalizeStockHistoryPrice(value: number) {
  if (!Number.isFinite(value)) return 0;
  return value < 1000 ? value * 1000 : value;
}

function sortHistoricalRows<T extends { time: number }>(rows: T[]) {
  return [...rows].sort((a, b) => a.time - b.time);
}

function normalizeStockExchange(exchange?: string) {
  const value = (exchange || "").trim().toUpperCase();
  if (value === "UPCOM") return "UpCOM";
  return value || "";
}

function cached<T>(cache: Map<string, { data: T; ts: number }>, key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttl) return Promise.resolve(entry.data);
  return fetcher().then((data) => {
    cache.set(key, { data, ts: Date.now() });
    return data;
  });
}

async function fetchVNStockPriceBatch(symbols: string[]): Promise<Record<string, any>> {
  const result: Record<string, any> = {};

  if (!symbols.length) return result;

  const data = await fetchVnstockPriceBoard(symbols);

  for (const item of data) {
    const sym = item.symbol?.toUpperCase();
    if (!sym) continue;
    const price = Number(item.close_price ?? 0);
    const refPrice = Number(item.reference_price ?? 0);
    const change = Number(item.price_change ?? price - refPrice);
    const changePercent =
      item.percent_change !== undefined
        ? Number(item.percent_change)
        : refPrice > 0
          ? (change / refPrice) * 100
          : 0;

    result[sym] = {
      symbol: sym,
      price,
      change,
      changePercent,
      volume: Number(item.total_trades ?? 0),
      high: Number(item.high_price ?? 0),
      low: Number(item.low_price ?? 0),
      open: Number(item.open_price ?? 0),
      refPrice,
      ceiling: Number(item.ceiling_price ?? 0),
      floor: Number(item.floor_price ?? 0),
      currency: "VND",
      exchange: item.exchange || "HOSE",
      lastUpdated: item.time || new Date().toISOString(),
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

type VNStockListingItem = {
  symbol: string;
  name: string;
  exchange: string;
  enName?: string;
};

async function fetchVNStockListing(): Promise<VNStockListingItem[]> {
  try {
    const rows = (await cached(priceCache, "vnstock_listing", LISTING_TTL, async () => fetchVnstockListing())) as Awaited<
      ReturnType<typeof fetchVnstockListing>
    >;

    return rows
      .filter((row) => row.symbol && (!row.type || row.type.toLowerCase() === "stock"))
      .map((row) => ({
        symbol: row.symbol.toUpperCase(),
        name: row.organ_name?.trim() || row.symbol.toUpperCase(),
        exchange: normalizeStockExchange(row.exchange),
        enName: row.en_organ_name?.trim() || undefined,
      }));
  } catch {
    return VN_STOCK_LIST;
  }
}

// Full VN stock list across all exchanges
const VN_STOCK_LIST = [
  // HOSE
  { symbol: "VNM", name: "VNM - CTCP Sữa Việt Nam (Vinamilk)", exchange: "HOSE" },
  { symbol: "VIC", name: "VIC - Tập đoàn Vingroup - CTCP", exchange: "HOSE" },
  { symbol: "VHM", name: "VHM - CTCP Vinhomes", exchange: "HOSE" },
  { symbol: "HPG", name: "HPG - CTCP Tập đoàn Hòa Phát", exchange: "HOSE" },
  { symbol: "MSN", name: "MSN - CTCP Tập đoàn Masan", exchange: "HOSE" },
  { symbol: "VCB", name: "VCB - Ngân hàng TMCP Ngoại thương Việt Nam", exchange: "HOSE" },
  { symbol: "BID", name: "BID - Ngân hàng TMCP Đầu tư và Phát triển VN", exchange: "HOSE" },
  { symbol: "TCB", name: "TCB - Ngân hàng TMCP Kỹ thương Việt Nam", exchange: "HOSE" },
  { symbol: "CTG", name: "CTG - Ngân hàng TMCP Công Thương Việt Nam", exchange: "HOSE" },
  { symbol: "MBB", name: "MBB - Ngân hàng TMCP Quân đội", exchange: "HOSE" },
  { symbol: "FPT", name: "FPT - CTCP FPT", exchange: "HOSE" },
  { symbol: "VPB", name: "VPB - Ngân hàng TMCP Việt Nam Thịnh Vượng", exchange: "HOSE" },
  { symbol: "ACB", name: "ACB - Ngân hàng TMCP Á Châu", exchange: "HOSE" },
  { symbol: "STB", name: "STB - Ngân hàng TMCP Sài Gòn Thương Tín", exchange: "HOSE" },
  { symbol: "MWG", name: "MWG - CTCP Đầu tư Thế Giới Di Động", exchange: "HOSE" },
  { symbol: "GAS", name: "GAS - Tổng Công ty Khí Việt Nam - CTCP", exchange: "HOSE" },
  { symbol: "SAB", name: "SAB - CTCP Bia - Rượu - Nước giải khát Sài Gòn", exchange: "HOSE" },
  { symbol: "PLX", name: "PLX - Tập đoàn Xăng dầu Việt Nam", exchange: "HOSE" },
  { symbol: "HDB", name: "HDB - Ngân hàng TMCP Phát triển TP.HCM", exchange: "HOSE" },
  { symbol: "SHB", name: "SHB - Ngân hàng TMCP Sài Gòn-Hà Nội", exchange: "HOSE" },
  { symbol: "VRE", name: "VRE - CTCP Vincom Retail", exchange: "HOSE" },
  { symbol: "SSI", name: "SSI - CTCP Chứng khoán SSI", exchange: "HOSE" },
  { symbol: "PDR", name: "PDR - CTCP Phát triển Bất động sản Phát Đạt", exchange: "HOSE" },
  { symbol: "REE", name: "REE - CTCP Cơ điện lạnh", exchange: "HOSE" },
  { symbol: "PNJ", name: "PNJ - CTCP Vàng bạc Đá quý Phú Nhuận", exchange: "HOSE" },
  { symbol: "KDH", name: "KDH - CTCP Đầu tư và Kinh doanh Nhà Khang Điền", exchange: "HOSE" },
  { symbol: "NVL", name: "NVL - CTCP Tập đoàn No Va", exchange: "HOSE" },
  { symbol: "DGW", name: "DGW - CTCP Thế Giới Số", exchange: "HOSE" },
  { symbol: "DHC", name: "DHC - CTCP Đông Hải Bến Tre", exchange: "HOSE" },
  { symbol: "VCI", name: "VCI - CTCP Chứng khoán Vietcap", exchange: "HOSE" },
  { symbol: "EIB", name: "EIB - Ngân hàng TMCP Xuất Nhập khẩu Việt Nam", exchange: "HOSE" },
  { symbol: "GEX", name: "GEX - CTCP Tập đoàn GELEX", exchange: "HOSE" },
  { symbol: "DGC", name: "DGC - CTCP Tập đoàn Hóa chất Đức Giang", exchange: "HOSE" },
  // HNX
  { symbol: "SHS", name: "SHS - CTCP Chứng khoán Sài Gòn - Hà Nội", exchange: "HNX" },
  { symbol: "PVS", name: "PVS - Tổng Công ty CP Dịch vụ Kỹ thuật Dầu khí VN", exchange: "HNX" },
  { symbol: "NVB", name: "NVB - Ngân hàng TMCP Quốc Dân", exchange: "HNX" },
  { symbol: "VCS", name: "VCS - CTCP VICOSTONE", exchange: "HNX" },
  { symbol: "CEO", name: "CEO - CTCP Tập đoàn C.E.O", exchange: "HNX" },
  { symbol: "PVB", name: "PVB - CTCP Bọc ống dầu khí Việt Nam", exchange: "HNX" },
  { symbol: "IDC", name: "IDC - Tổng Công ty IDICO", exchange: "HNX" },
  { symbol: "HUT", name: "HUT - CTCP Tasco", exchange: "HNX" },
  { symbol: "L14", name: "L14 - CTCP Licogi 14", exchange: "HNX" },
  { symbol: "HHC", name: "HHC - CTCP Bánh kẹo Hải Hà", exchange: "HNX" },
  { symbol: "BVS", name: "BVS - CTCP Chứng khoán Bảo Việt", exchange: "HNX" },
  { symbol: "SD5", name: "SD5 - CTCP Sông Đà 5", exchange: "HNX" },
  // UpCOM
  { symbol: "ACV", name: "ACV - Tổng công ty Cảng hàng không Việt Nam", exchange: "UpCOM" },
  { symbol: "QNS", name: "QNS - CTCP Đường Quảng Ngãi", exchange: "UpCOM" },
  { symbol: "BSR", name: "BSR - CTCP Lọc hóa dầu Bình Sơn", exchange: "UpCOM" },
  { symbol: "OIL", name: "OIL - Tổng Công ty Dầu Việt Nam", exchange: "UpCOM" },
  { symbol: "MCH", name: "MCH - CTCP Hàng tiêu dùng Masan", exchange: "UpCOM" },
  { symbol: "LPB", name: "LPB - Ngân hàng TMCP Lộc Phát Việt Nam", exchange: "UpCOM" },
  { symbol: "VEA", name: "VEA - CTCP Ô tô Trường Hải", exchange: "UpCOM" },
  { symbol: "GVR", name: "GVR - Tập đoàn Công nghiệp Cao su Việt Nam", exchange: "UpCOM" },
  { symbol: "VCR", name: "VCR - CTCP Đầu tư và Phát triển Du lịch Vinaconex", exchange: "UpCOM" },
  { symbol: "ABI", name: "ABI - CTCP Bảo hiểm Ngân hàng Nông nghiệp", exchange: "UpCOM" },
  { symbol: "HPT", name: "HPT - CTCP Dịch vụ Công nghệ Tin học HPT", exchange: "UpCOM" },
  { symbol: "TV2", name: "Tư vấn Xây dựng Điện 2 - CTCP Tư vấn Xây dựng Điện 2", exchange: "UpCOM" },
  { symbol: "PGD", name: "Gas Petrolimex - CTCP Kinh doanh Khí hóa lỏng Miền Nam", exchange: "UpCOM" },
  { symbol: "FOX", name: "Bao bì Dầu thực vật - CTCP Bao bì Dầu thực vật", exchange: "UpCOM" },
  { symbol: "VPC", name: "VPC - CTCP Xây dựng và Kinh doanh Địa ốc Việt Phú", exchange: "UpCOM" },
  { symbol: "PPY", name: "Dầu khí Phan Vũ - CTCP Phan Vũ", exchange: "UpCOM" },
  { symbol: "MST", name: "Masan Nutri-Science - CTCP Masan Nutri-Science", exchange: "UpCOM" },
  { symbol: "VCG", name: "Vinaconex - Tổng Công ty CP Xuất nhập khẩu và Xây dựng VN", exchange: "UpCOM" },
  { symbol: "TDG", name: "TDG - CTCP Đầu tư và Phát triển TDG Global", exchange: "UpCOM" },
  { symbol: "AAS", name: "Chứng khoán SmartInvest - CTCP CK SmartInvest", exchange: "UpCOM" },
  { symbol: "UIC", name: "UIC - CTCP Đầu tư Phát triển Nhà và ĐT Idico", exchange: "UpCOM" },
  { symbol: "CST", name: "CST - CTCP Than Cao Sơn - Vinacomin", exchange: "UpCOM" },
  { symbol: "HNI", name: "HNI - CTCP Dệt may Hà Nội", exchange: "UpCOM" },
  { symbol: "BGW", name: "BGW - Nước sạch Bắc Giang", exchange: "UpCOM" },
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

// Fetch real USD/VND rate from Vietcombank XML API
async function fetchVietcombankRate(): Promise<number> {
  try {
    const xml = await fetchText("https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx?b=10");
    const match = xml.match(/CurrencyCode="USD"[^>]*Sell="([0-9,]+)"/);
    if (match) {
      const rate = parseFloat(match[1].replace(/,/g, ""));
      if (rate > 20000 && rate < 50000) return rate;
    }
  } catch {}
  return 26315;
}

async function fetchBaomoiVietcombankRate(): Promise<number | null> {
  try {
    const html = await fetchText("https://baomoi.com/tien-ich-ty-gia-ngoai-te-vietcombank.epi");
    const normalized = html.replace(/\s+/g, " ");
    const usdBlockMatch = normalized.match(/USD[\s\S]{0,800}?([0-9]{2},[0-9]{3})[\s\S]{0,200}?([0-9]{2},[0-9]{3})[\s\S]{0,200}?([0-9]{2},[0-9]{3})/i);
    const candidates = usdBlockMatch ? usdBlockMatch.slice(1) : normalized.match(/USD[\s\S]{0,800}?([0-9]{2},[0-9]{3})/i)?.slice(1);
    const parsed = candidates
      ?.map((value) => Number(value.replace(/,/g, "")))
      .filter((value) => Number.isFinite(value) && value > 20000 && value < 50000);

    if (parsed?.length) {
      return parsed[parsed.length - 1];
    }
  } catch {}

  return null;
}

async function fetchUsdToVndRate() {
  const baomoiRate = await fetchBaomoiVietcombankRate();
  const rate = baomoiRate || await fetchVietcombankRate();
  return {
    rate: Math.round(rate),
    source: baomoiRate ? "Baomoi • Vietcombank" : "Vietcombank XML",
    lastUpdated: new Date().toISOString(),
  };
}

async function fetchVietnamGoldPrices() {
  const response = await fetchJson("https://www.vang.today/api/prices?action=current");
  const rows = Array.isArray(response?.data) ? response.data : [];

  const getItem = (typeCode: string) =>
    rows.find((item: any) => item?.type_code === typeCode);

  const sjc = getItem("SJL1L10");
  const nhan = getItem("SJ9999");

  if (!sjc || !nhan) {
    throw new Error("Unable to parse Vietnam gold prices from vang.today");
  }

  const toIsoTime = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return new Date(value * 1000).toISOString();
    }
    return new Date().toISOString();
  };

  return {
    SJC: {
      buy: Number(sjc.buy) || 0,
      sell: Number(sjc.sell) || 0,
      source: "vang.today",
      lastUpdated: toIsoTime(sjc.update_time ?? response?.current_time),
    },
    NHAN9999: {
      buy: Number(nhan.buy) || 0,
      sell: Number(nhan.sell) || 0,
      source: "vang.today",
      lastUpdated: toIsoTime(nhan.update_time ?? response?.current_time),
    },
  };
}

const GOLD_SYMBOL_TO_TYPE_CODE: Record<string, string> = {
  XAU: "XAUUSD",
  XAU_USD: "XAUUSD",
  SJC_VND: "SJL1L10",
  NHAN_VND: "SJ9999",
};

function toIsoTime(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function getGoldTypeCode(symbol: string) {
  return GOLD_SYMBOL_TO_TYPE_CODE[symbol.toUpperCase()];
}

function getGoldEntryPrice(typeCode: string, item: any) {
  return typeCode === "XAUUSD" ? Number(item?.buy) || 0 : Number(item?.sell) || 0;
}

function mapGoldEntriesToHistorical(typeCode: string, entries: any[]) {
  const sorted = [...entries]
    .filter((entry) => typeof entry?.unix === "number")
    .sort((a, b) => a.unix - b.unix);

  return sorted.map((entry) => {
    const close = getGoldEntryPrice(typeCode, entry);
    const delta = typeCode === "XAUUSD" ? Number(entry?.change_buy) || 0 : Number(entry?.change_sell) || 0;
    const open = close - delta;
    const high = Math.max(open, close);
    const low = Math.min(open, close);
    return {
      time: entry.unix,
      open,
      high,
      low,
      close,
      volume: 0,
    };
  });
}

async function fetchVangTodayCurrentPrices() {
  return fetchJson("https://www.vang.today/api/prices?action=current");
}

async function fetchVangTodayDailyHistory(typeCode: string, days: number) {
  return fetchJson(`https://www.vang.today/api/prices?type=${encodeURIComponent(typeCode)}&days=${days}`);
}

async function fetchVangTodayDateEntries(typeCode: string, date: string) {
  return fetchJson(`https://www.vang.today/api/prices?type=${encodeURIComponent(typeCode)}&date=${encodeURIComponent(date)}`);
}

async function fetchVangTodayLatestEntries(typeCode: string) {
  return fetchJson(`https://www.vang.today/api/prices?type=${encodeURIComponent(typeCode)}&history=1`);
}

async function fetchGoldHistoricalSeries(symbol: string, days: number) {
  const typeCode = getGoldTypeCode(symbol);
  if (!typeCode) {
    throw new Error(`Unsupported gold symbol: ${symbol}`);
  }

  const safeDays = Math.max(1, Math.min(30, days));

  if (safeDays === 1) {
    const detail = await fetchVangTodayLatestEntries(typeCode);
    const entries = Array.isArray(detail?.data?.entries) ? detail.data.entries : [];
    return mapGoldEntriesToHistorical(typeCode, entries);
  }

  const summary = await fetchVangTodayDailyHistory(typeCode, safeDays);
  const history = Array.isArray(summary?.history) ? [...summary.history].reverse() : [];

  const daySeries = await Promise.all(
    history.map(async (item: any) => {
      const date = item?.date as string | undefined;
      if (!date) return [];

      try {
        const detail = await fetchVangTodayDateEntries(typeCode, date);
        const entries = Array.isArray(detail?.data?.entries) ? detail.data.entries : [];
        if (entries.length > 0) {
          return mapGoldEntriesToHistorical(typeCode, entries);
        }
      } catch {}

      const daily = item?.prices?.[typeCode];
      const close = getGoldEntryPrice(typeCode, daily);
      const change = typeCode === "XAUUSD" ? Number(daily?.day_change_buy) || 0 : Number(daily?.day_change_sell) || 0;
      const open = close - change;
      const timestamp = Math.floor(new Date(`${date}T00:00:00+07:00`).getTime() / 1000);
      return [{
        time: timestamp,
        open,
        high: Math.max(open, close),
        low: Math.min(open, close),
        close,
        volume: 0,
      }];
    }),
  );

  return daySeries.flat().sort((a, b) => a.time - b.time);
}

async function fetchGoldPrice() {
  try {
    const [currentGold, usdToVndData, vnGold] = await Promise.all([
      fetchVangTodayCurrentPrices(),
      cached(priceCache, "fx_usd_vnd", FX_TTL, fetchUsdToVndRate),
      fetchVietnamGoldPrices(),
    ]);
    const rows = Array.isArray(currentGold?.data) ? currentGold.data : [];
    const xau = rows.find((item: any) => item?.type_code === "XAUUSD");
    const goldUsdPerOz = Number(xau?.buy) || 0;
    if (!goldUsdPerOz) throw new Error("No gold price");
    const usdToVnd = usdToVndData.rate;
    // 1 lượng = 37.5g, 1 troy oz = 31.1035g → 1 lượng = 1.2057 troy oz
    const goldVndPerLuong = goldUsdPerOz * (37.5 / 31.1035) * usdToVnd;
    const worldChangeUsd = Number(xau?.change_buy) || 0;
    const prevUsd = goldUsdPerOz - worldChangeUsd;
    const change24h = worldChangeUsd * (37.5 / 31.1035) * usdToVnd;
    const prev = prevUsd > 0 ? prevUsd * (37.5 / 31.1035) * usdToVnd : goldVndPerLuong - change24h;
    const changePercent = prev > 0 ? (change24h / prev) * 100 : 0;
    return {
      XAU: {
        priceUsdOz: Math.round(goldUsdPerOz * 100) / 100,
        priceVndLuong: Math.round(goldVndPerLuong),
        changeUsdOz: Math.round(worldChangeUsd * 100) / 100,
        change: Math.round(change24h),
        changePercent: Math.round(changePercent * 100) / 100,
        usdToVnd: Math.round(usdToVnd),
        usdToVndSource: usdToVndData.source,
        usdToVndUpdatedAt: usdToVndData.lastUpdated,
        currency: "VND",
        source: "vang.today",
        lastUpdated: toIsoTime(xau?.update_time ?? currentGold?.current_time),
      },
      ...vnGold,
    };
  } catch {
    return {
      XAU: {
        priceUsdOz: 2900,
        priceVndLuong: 86000000,
        changeUsdOz: 18.5,
        change: 500000,
        changePercent: 0.58,
        usdToVnd: 26315,
        usdToVndSource: "Vietcombank",
        usdToVndUpdatedAt: new Date().toISOString(),
        currency: "VND",
        lastUpdated: new Date().toISOString(),
      },
      SJC: {
        buy: 181100000,
        sell: 184100000,
        source: "fallback",
        lastUpdated: new Date().toISOString(),
      },
      NHAN9999: {
        buy: 180800000,
        sell: 183800000,
        source: "fallback",
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

async function fetchOilPrice() {
  try {
    const [wtiData, brentData, domesticRetail] = await Promise.all([
      fetchJson("https://query1.finance.yahoo.com/v8/finance/chart/CL=F?range=2d&interval=1d"),
      fetchJson("https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?range=2d&interval=1d"),
      fetchVietnamFuelRetailPrices(),
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
      domesticRetail,
    };
  } catch {
    return {
      WTI: { price: 77.5, change: -0.3, changePercent: -0.39, currency: "USD", lastUpdated: new Date().toISOString() },
      BRENT: { price: 81.2, change: -0.25, changePercent: -0.31, currency: "USD", lastUpdated: new Date().toISOString() },
      domesticRetail: {
        ron95vV1: null,
        ron95vV2: null,
        source: "Baomoi/webgia.com",
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

async function fetchVietnamFuelRetailPrices() {
  try {
    const html = await fetchText("https://baomoi.com/tien-ich-gia-xang-dau.epi", {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    });
    const normalized = html.replace(/\s+/g, " ");
    const updatedAt = normalized.match(/Giá Xăng dầu Ngày ([0-9-]+ [0-9:]+)/i)?.[1] || null;
    const ron95Row = normalized.match(/Xăng RON 95-V\s+([0-9,]+)\s+([0-9,]+)/i);

    return {
      ron95vV1: ron95Row ? Number(ron95Row[1].replace(/,/g, "")) : null,
      ron95vV2: ron95Row ? Number(ron95Row[2].replace(/,/g, "")) : null,
      source: "Baomoi/webgia.com",
      lastUpdated: updatedAt ? new Date(updatedAt.replace(" ", "T") + "+07:00").toISOString() : new Date().toISOString(),
    };
  } catch {
    return {
      ron95vV1: null,
      ron95vV2: null,
      source: "Baomoi/webgia.com",
      lastUpdated: new Date().toISOString(),
    };
  }
}

function buildSyntheticHistory(endPrice: number, days: number, decimals = 2) {
  const safeEndPrice = endPrice > 0 ? endPrice : 100;
  const safeDays = Math.max(1, days);
  const prices: number[] = [safeEndPrice];

  for (let i = 1; i <= safeDays; i++) {
    const prev = prices[prices.length - 1];
    const change = prev * (Math.random() - 0.48) * 0.01;
    prices.push(Math.max(prev - change, safeEndPrice * 0.8));
  }

  prices.reverse();
  const now = Date.now();

  return prices.map((price, i) => {
    const time = Math.floor((now - (safeDays - i) * 86400000) / 1000);
    const spread = price * 0.004;
    const open = price + (Math.random() - 0.5) * spread;
    const close = price;
    const high = Math.max(open, close) * (1 + Math.random() * 0.002);
    const low = Math.min(open, close) * (1 - Math.random() * 0.002);

    return {
      time,
      open: Number(open.toFixed(decimals)),
      high: Number(high.toFixed(decimals)),
      low: Number(low.toFixed(decimals)),
      close: Number(close.toFixed(decimals)),
      volume: 0,
    };
  });
}

async function fetchYahooChart(symbol: string, range: string, interval: string) {
  const encodedSymbol = encodeURIComponent(symbol);
  return fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?range=${range}&interval=${interval}`);
}

function mapYahooChartToHistorical(data: any) {
  const result = data?.chart?.result?.[0];
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const quote = result?.indicators?.quote?.[0] || {};
  const opens = Array.isArray(quote?.open) ? quote.open : [];
  const highs = Array.isArray(quote?.high) ? quote.high : [];
  const lows = Array.isArray(quote?.low) ? quote.low : [];
  const closes = Array.isArray(quote?.close) ? quote.close : [];
  const volumes = Array.isArray(quote?.volume) ? quote.volume : [];

  return timestamps
    .map((time: number, index: number) => {
      const open = Number(opens[index]);
      const high = Number(highs[index]);
      const low = Number(lows[index]);
      const close = Number(closes[index]);

      if (![open, high, low, close].every(Number.isFinite)) return null;

      return {
        time,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: Number(volumes[index] || 0),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

async function fetchUSIndices() {
  try {
    const [sp500Data, dowData, nasdaqData] = await Promise.all([
      fetchYahooChart("^GSPC", "5d", "1d"),
      fetchYahooChart("^DJI", "5d", "1d"),
      fetchYahooChart("^IXIC", "5d", "1d"),
    ]);

    const toQuote = (data: any, fallbackPrice: number) => {
      const meta = data?.chart?.result?.[0]?.meta || {};
      const marketPrice = Number(meta.regularMarketPrice);
      const prevClose = Number(meta.chartPreviousClose);
      const price = Number.isFinite(marketPrice) ? marketPrice : fallbackPrice;
      const reference = Number.isFinite(prevClose) && prevClose > 0 ? prevClose : price;
      const change = price - reference;
      const changePercent = reference > 0 ? (change / reference) * 100 : 0;

      return {
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        source: "Yahoo Finance",
        lastUpdated: new Date().toISOString(),
      };
    };

    return {
      "^GSPC": toQuote(sp500Data, 5100),
      "^DJI": toQuote(dowData, 39000),
      "^IXIC": toQuote(nasdaqData, 16000),
    };
  } catch {
    return {
      "^GSPC": { price: 5100, change: 24.8, changePercent: 0.49, source: "fallback", lastUpdated: new Date().toISOString() },
      "^DJI": { price: 39000, change: 115.4, changePercent: 0.30, source: "fallback", lastUpdated: new Date().toISOString() },
      "^IXIC": { price: 16000, change: -42.5, changePercent: -0.26, source: "fallback", lastUpdated: new Date().toISOString() },
    };
  }
}

async function fetchUSIndexHistorical(symbol: string, days: number) {
  const safeSymbol = symbol.toUpperCase();
  const safeDays = Math.max(1, Math.min(30, days));
  const range = safeDays <= 1 ? "1d" : safeDays <= 7 ? "7d" : "1mo";
  const interval = safeDays <= 1 ? "5m" : "1d";

  try {
    const data = await fetchYahooChart(safeSymbol, range, interval);
    const mapped = mapYahooChartToHistorical(data);
    if (mapped.length) return mapped;
  } catch {}

  const fallbacks: Record<string, number> = {
    "^GSPC": 5100,
    "^DJI": 39000,
    "^IXIC": 16000,
  };
  return buildSyntheticHistory(fallbacks[safeSymbol] || 1000, safeDays);
}

async function fetchVNIndices() {
  try {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 10);
    start.setHours(0, 0, 0, 0);

    const symbols = ["VNINDEX", "HNXINDEX", "UPCOMINDEX", "VN30", "HNX30", "VN100"] as const;
    const histories = await Promise.all(
      symbols.map(async (symbol) => {
        const rows = await fetchVnstockHistory(
          symbol,
          formatVnstockDate(start),
          formatVnstockDate(now),
          "1D",
        );

        const mapped = rows
          .map((item) => {
            const time = parseVnstockTime(item.time);
            if (!time) return null;
            return {
              time,
              open: Number(item.open ?? 0),
              high: Number(item.high ?? 0),
              low: Number(item.low ?? 0),
              close: Number(item.close ?? 0),
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item));

        const sorted = sortHistoricalRows(mapped);
        const latest = sorted[sorted.length - 1];
        const previous = sorted[sorted.length - 2];
        if (!latest) {
          throw new Error(`No index data for ${symbol}`);
        }

        const reference = previous?.close || latest.open || latest.close || 1;
        const change = latest.close - reference;
        const changePercent = reference > 0 ? (change / reference) * 100 : 0;

        return [
          symbol,
          {
            price: Number(latest.close.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2)),
            high: Number((latest.high || latest.close).toFixed(2)),
            low: Number((latest.low || latest.close).toFixed(2)),
            source: "KBS",
            lastUpdated: new Date(latest.time * 1000).toISOString(),
          },
        ] as const;
      }),
    );

    return Object.fromEntries(histories);
  } catch {
    return {
      VNINDEX: { price: 1280, change: 8.5, changePercent: 0.67, high: 1285, low: 1272, source: "KBS", lastUpdated: new Date().toISOString() },
      HNXINDEX: { price: 225.5, change: 1.2, changePercent: 0.53, high: 227, low: 224, source: "KBS", lastUpdated: new Date().toISOString() },
      UPCOMINDEX: { price: 93.5, change: 0.3, changePercent: 0.32, high: 94, low: 93, source: "KBS", lastUpdated: new Date().toISOString() },
      VN30: { price: 1435, change: 9.2, changePercent: 0.64, high: 1441, low: 1428, source: "KBS", lastUpdated: new Date().toISOString() },
      HNX30: { price: 347, change: 1.8, changePercent: 0.52, high: 349, low: 345, source: "KBS", lastUpdated: new Date().toISOString() },
      VN100: { price: 1498, change: 9.8, changePercent: 0.66, high: 1504, low: 1490, source: "KBS", lastUpdated: new Date().toISOString() },
    };
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// Parse Vietstock RSS XML into news items
function parseVietstockRSS(xml: string): any[] {
  const items: any[] = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemPattern.exec(xml)) !== null) {
    const block = itemMatch[1];
    const getTag = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? (m[1] || m[2] || "").trim() : "";
    };
    const title = decodeHtmlEntities(getTag("title"));
    const link = getTag("link") || getTag("guid");
    const rawDescription = getTag("description");
    const pubDate = getTag("pubDate");

    const description = decodeHtmlEntities(rawDescription);

    const imgMatch = description.match(/src=['"]([^'"]+)['"]/i);
    const imageUrl = imgMatch ? imgMatch[1] : undefined;

    const summary = description
      .replace(/<img[^>]*\/?>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (title && link) {
      items.push({
        id: link,
        title,
        summary: summary.slice(0, 280),
        url: link,
        source: "Vietstock",
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        imageUrl,
        sentiment: "Neutral",
        topics: [],
      });
    }
  }
  return items.slice(0, 10);
}

async function fetchVietstockRSS(rssUrl: string): Promise<any[]> {
  try {
    const xml = await fetchText(rssUrl);
    return parseVietstockRSS(xml);
  } catch {
    return [];
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
      let results = await fetchVNStockListing();
      if (q) {
        results = results.filter(
          (s) =>
            s.symbol.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            (s.enName || "").toLowerCase().includes(q)
        );
      }
      if (exchange) {
        results = results.filter((s) => s.exchange.toLowerCase() === exchange.toLowerCase());
      }
      const sliced = results.slice(0, 20);

      if (q && q.length >= 2 && sliced.length === 0) {
        try {
          const batch = await fetchVNStockPriceBatch([q.toUpperCase()]);
          const found = batch[q.toUpperCase()];
          if (found) {
            return res.json([
              {
                symbol: found.symbol,
                name: found.symbol,
                exchange: normalizeStockExchange(found.exchange),
              },
            ]);
          }
        } catch {}
      }

      res.json(sliced);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/stocks/lookup/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const key = `lookup_${symbol}`;
      const data = await cached(priceCache, key, PRICE_TTL, async () => {
        const batch = await fetchVNStockPriceBatch([symbol]);
        return batch[symbol] || null;
      });
      if (!data) return res.status(404).json({ error: "Không tìm thấy mã cổ phiếu" });
      const listing = await fetchVNStockListing();
      const meta = listing.find((item) => item.symbol === symbol);
      res.json({
        ...data,
        exchange: normalizeStockExchange(data.exchange || meta?.exchange),
        name: meta?.name || symbol,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/stocks/list", async (req, res) => {
    try {
      const exchange = (req.query.exchange as string) || "HOSE";
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const listing = await fetchVNStockListing();
      const filtered = listing.filter(
        (s) => !exchange || s.exchange.toLowerCase() === exchange.toLowerCase()
      );
      const paged = filtered.slice((page - 1) * limit, page * limit);
      const symbols = paged.map((s) => s.symbol);
      let prices: Record<string, any> = {};
      try {
        prices = await fetchVNStockPriceBatch(symbols);
      } catch {}
      const result = paged.map((s) => ({
        ...s,
        ...(prices[s.symbol] || {}),
        exchange: normalizeStockExchange(prices[s.symbol]?.exchange || s.exchange),
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
        return fetchVNStockPrice(symbol.toUpperCase());
      });
      if (!data) return res.status(404).json({ error: "Kh?ng t?m th?y d? li?u c? phi?u" });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/prices/vn-batch", async (req, res) => {
    try {
      const symbols = ((req.query.symbols as string) || "VNM,FPT,VCB,HPG,VIC").split(",").map(s => s.trim().toUpperCase());
      const key = `vn_batch_${symbols.sort().join(",")}`;
      const results = await cached(priceCache, key, PRICE_TTL, async () => fetchVNStockPriceBatch(symbols));
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // CoinGecko coin search
  app.get("/api/crypto/search", async (req, res) => {
    try {
      const q = ((req.query.q as string) || "").trim();
      if (!q) return res.json([]);
      const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`;
      const data = await fetchJson(url);
      const coins = (data?.coins || []).slice(0, 12).map((c: any) => ({
        id: c.id,
        symbol: c.symbol?.toUpperCase(),
        name: c.name,
        thumb: c.thumb,
        marketCapRank: c.market_cap_rank,
      }));
      res.json(coins);
    } catch (err: any) {
      res.json([]);
    }
  });

  app.get("/api/prices/crypto", async (req, res) => {
    try {
      const ids = (req.query.ids as string) || "bitcoin,ethereum,binancecoin,solana,ripple,cardano,dogecoin,tron";
      const data = await cached(priceCache, `crypto_${ids}`, PRICE_TTL, () => fetchCryptoPrice(ids));
      if (!data) return res.status(404).json({ error: "Kh?ng t?m th?y d? li?u c? phi?u" });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/prices/gold", async (req, res) => {
    try {
      const data = await cached(priceCache, "gold", PRICE_TTL, fetchGoldPrice);
      if (!data) return res.status(404).json({ error: "Kh?ng t?m th?y d? li?u c? phi?u" });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/exchange-rates/usd-vnd", async (_req, res) => {
    try {
      const data = await cached(priceCache, "fx_usd_vnd", FX_TTL, fetchUsdToVndRate);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/prices/oil", async (req, res) => {
    try {
      const data = await cached(priceCache, "oil", PRICE_TTL, fetchOilPrice);
      if (!data) return res.status(404).json({ error: "Kh?ng t?m th?y d? li?u c? phi?u" });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/prices/indices", async (req, res) => {
    try {
      const [vnIndices, usIndices] = await Promise.all([
        cached(priceCache, "vn_indices", PRICE_TTL, fetchVNIndices),
        cached(priceCache, "us_indices", PRICE_TTL, fetchUSIndices),
      ]);
      const data = {
        ...vnIndices,
        ...usIndices,
      };
      if (!data) return res.status(404).json({ error: "Kh?ng t?m th?y d? li?u c? phi?u" });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/market-overview", async (req, res) => {
    try {
      const [gold, oil, crypto, indices, usIndices] = await Promise.all([
        cached(priceCache, "gold", PRICE_TTL, fetchGoldPrice),
        cached(priceCache, "oil", PRICE_TTL, fetchOilPrice),
        cached(priceCache, "crypto_bitcoin,ethereum", PRICE_TTL, () =>
          fetchCryptoPrice("bitcoin,ethereum")
        ),
        cached(priceCache, "vn_indices", PRICE_TTL, fetchVNIndices),
        cached(priceCache, "us_indices", PRICE_TTL, fetchUSIndices),
      ]);

      res.json({
        vnIndex: indices.VNINDEX,
        hnxIndex: indices.HNXINDEX,
        upcom: indices.UPCOMINDEX,
        vn30: indices.VN30,
        hnx30: indices.HNX30,
        vn100: indices.VN100,
        sp500: usIndices["^GSPC"],
        dowJones: usIndices["^DJI"],
        nasdaqComposite: usIndices["^IXIC"],
        gold,
        oil,
        crypto,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // News endpoints - all use Vietstock RSS

  app.get("/api/news/stocks", async (req, res) => {
    try {
      const data = await cached(newsCache, "news_stocks_vietstock", NEWS_TTL, () =>
        fetchVietstockRSS("https://vietstock.vn/830/chung-khoan/co-phieu.rss")
      );
      if (!data) return res.status(404).json({ error: "Kh?ng t?m th?y d? li?u c? phi?u" });
      res.json(data);
    } catch {
      res.json([]);
    }
  });

  app.get("/api/news/crypto", async (req, res) => {
    try {
      const data = await cached(newsCache, "news_crypto_vietstock", NEWS_TTL, () =>
        fetchVietstockRSS("https://vietstock.vn/4309/the-gioi/tien-ky-thuat-so.rss")
      );
      if (!data) return res.status(404).json({ error: "Kh?ng t?m th?y d? li?u c? phi?u" });
      res.json(data);
    } catch {
      res.json([]);
    }
  });

  app.get("/api/news/gold", async (req, res) => {
    try {
      const data = await cached(newsCache, "news_gold_vietstock", NEWS_TTL, () =>
        fetchVietstockRSS("https://vietstock.vn/759/hang-hoa/vang-va-kim-loai-quy.rss")
      );
      if (!data) return res.status(404).json({ error: "Kh?ng t?m th?y d? li?u c? phi?u" });
      res.json(data);
    } catch {
      res.json([]);
    }
  });

  app.get("/api/news/oil", async (req, res) => {
    try {
      const data = await cached(newsCache, "news_oil_vietstock", NEWS_TTL, () =>
        fetchVietstockRSS("https://vietstock.vn/34/hang-hoa/nhien-lieu.rss")
      );
      if (!data) return res.status(404).json({ error: "Kh?ng t?m th?y d? li?u c? phi?u" });
      res.json(data);
    } catch {
      res.json([]);
    }
  });

  app.get("/api/news/intl-finance", async (req, res) => {
    try {
      const data = await cached(newsCache, "news_intl_finance", NEWS_TTL, () =>
        fetchVietstockRSS("https://vietstock.vn/772/the-gioi/tai-chinh-quoc-te.rss")
      );
      if (!data) return res.status(404).json({ error: "Kh?ng t?m th?y d? li?u c? phi?u" });
      res.json(data);
    } catch {
      res.json([]);
    }
  });

  app.get("/api/news/industry", async (req, res) => {
    try {
      const data = await cached(newsCache, "news_industry", NEWS_TTL, () =>
        fetchVietstockRSS("https://vietstock.vn/1329/dong-duong/kinh-te-nganh.rss")
      );
      if (!data) return res.status(404).json({ error: "Kh?ng t?m th?y d? li?u c? phi?u" });
      res.json(data);
    } catch {
      res.json([]);
    }
  });

  // Generic Vietstock RSS proxy
  app.get("/api/news/vietstock", async (req, res) => {
    try {
      const rss = req.query.rss as string;
      if (!rss || !rss.startsWith("https://vietstock.vn/")) {
        return res.status(400).json({ error: "Invalid RSS URL" });
      }
      const data = await cached(newsCache, `vietstock_${rss}`, NEWS_TTL, () => fetchVietstockRSS(rss));
      if (!data) return res.status(404).json({ error: "Kh?ng t?m th?y d? li?u c? phi?u" });
      res.json(data);
    } catch {
      res.json([]);
    }
  });

  app.get("/api/historical/:type/:symbol", async (req, res) => {
    try {
      const { type, symbol } = req.params;
      const days = parseInt(req.query.days as string) || 30;
      const currentPriceParam = parseFloat(req.query.currentPrice as string) || 0;

      if (type === "stock") {
        const now = new Date();
        const start = new Date(now);
        let interval = "1D";

        if (days <= 1) {
          start.setHours(9, 0, 0, 0);
          interval = "5m";
        } else {
          start.setDate(start.getDate() - Math.max(days, 2));
          start.setHours(0, 0, 0, 0);
        }

        const history = await fetchVnstockHistory(
          symbol.toUpperCase(),
          formatVnstockDate(start, days <= 1),
          formatVnstockDate(now, days <= 1),
          interval,
        );

        const mapped = history
          .map((item) => {
            const time = parseVnstockTime(item.time);
            if (!time) return null;

            return {
              time,
              open: normalizeStockHistoryPrice(Number(item.open ?? 0)),
              high: normalizeStockHistoryPrice(Number(item.high ?? 0)),
              low: normalizeStockHistoryPrice(Number(item.low ?? 0)),
              close: normalizeStockHistoryPrice(Number(item.close ?? 0)),
              volume: Number(item.volume ?? 0),
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item));

        return res.json(sortHistoricalRows(mapped));
      }

      if (type === "index") {
        if (US_INDEX_SYMBOLS.includes(symbol.toUpperCase() as (typeof US_INDEX_SYMBOLS)[number])) {
          const data = await fetchUSIndexHistorical(symbol, days);
          return res.json(data);
        }

        const now = new Date();
        const start = new Date(now);
        let interval = "1D";

        if (days <= 1) {
          start.setHours(9, 0, 0, 0);
          interval = "5m";
        } else {
          start.setDate(start.getDate() - Math.max(days, 2));
          start.setHours(0, 0, 0, 0);
        }

        const history = await fetchVnstockHistory(
          symbol.toUpperCase(),
          formatVnstockDate(start, days <= 1),
          formatVnstockDate(now, days <= 1),
          interval,
        );

        const mapped = history
          .map((item) => {
            const time = parseVnstockTime(item.time);
            if (!time) return null;

            return {
              time,
              open: Number(item.open ?? 0),
              high: Number(item.high ?? 0),
              low: Number(item.low ?? 0),
              close: Number(item.close ?? 0),
              volume: Number(item.volume ?? 0),
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item));

        return res.json(sortHistoricalRows(mapped));
      }

      if (type === "gold") {
        const key = `gold_hist_${symbol.toUpperCase()}_${Math.max(1, Math.min(30, days))}`;
        const data = await cached(priceCache, key, GOLD_HISTORY_TTL, () =>
          fetchGoldHistoricalSeries(symbol, days)
        );
        return res.json(data);
      }

      let endPrice = currentPriceParam;

      if (!endPrice) {
        if (type === "stock") {
          try {
            const batch = await fetchVNStockPriceBatch([symbol.toUpperCase()]);
            endPrice = batch[symbol.toUpperCase()]?.price || VN_PRICES_FALLBACK[symbol.toUpperCase()] || 50000;
          } catch {
            endPrice = VN_PRICES_FALLBACK[symbol.toUpperCase()] || 50000;
          }
        } else if (type === "index") {
          const indexFallback: Record<string, number> = {
            VNINDEX: 1280, HNXINDEX: 225.5, UPCOMINDEX: 93.5,
            VN30: 1435, HNX30: 347, VN100: 1498,
          };
          endPrice = indexFallback[symbol.toUpperCase()] || 1000;
        } else if (type === "crypto") {
          const cryptoPrices: Record<string, number> = {
            bitcoin: 70000, ethereum: 2000, binancecoin: 640, solana: 86,
            ripple: 0.6, cardano: 0.45, dogecoin: 0.15, tron: 0.12,
          };
          endPrice = cryptoPrices[symbol.toLowerCase()] || 100;
        } else if (type === "oil") {
          endPrice = 88;
        }
      }

      const volatility = type === "stock" ? 0.018 : type === "index" ? 0.008 : type === "crypto" ? 0.04 : 0.015;

      const prices: number[] = [endPrice];
      for (let i = 1; i <= days; i++) {
        const prev = prices[prices.length - 1];
        const change = prev * (Math.random() - 0.48) * volatility;
        prices.push(Math.max(prev - change, endPrice * 0.5));
      }
      prices.reverse();

      const now = Date.now();
      const data = prices.map((price, i) => {
        const time = Math.floor((now - (days - i) * 86400000) / 1000);
        const spread = price * 0.005;
        const open = price + (Math.random() - 0.5) * spread;
        const close = price;
        const high = Math.max(open, close) * (1 + Math.random() * 0.003);
        const low = Math.min(open, close) * (1 - Math.random() * 0.003);
        const dec = type === "stock" ? 0 : type === "index" ? 2 : 4;
        return {
          time,
          open: parseFloat(open.toFixed(dec)),
          high: parseFloat(high.toFixed(dec)),
          low: parseFloat(low.toFixed(dec)),
          close: parseFloat(close.toFixed(dec)),
          volume: Math.floor(Math.random() * 1000000),
        };
      });

      if (!data) return res.status(404).json({ error: "Kh?ng t?m th?y d? li?u c? phi?u" });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
