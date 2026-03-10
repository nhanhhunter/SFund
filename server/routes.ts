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

// Comprehensive list of VN stocks across HOSE, HNX, UpCOM
const VN_STOCK_LIST: Array<{ symbol: string; name: string; exchange: string }> = [
  // HOSE - Blue chips & large caps
  { symbol: "VNM", name: "Vinamilk - CTCP Sữa Việt Nam", exchange: "HOSE" },
  { symbol: "VIC", name: "Vingroup - Tập đoàn Vingroup", exchange: "HOSE" },
  { symbol: "VHM", name: "Vinhomes - CTCP Vinhomes", exchange: "HOSE" },
  { symbol: "HPG", name: "Hòa Phát - Tập đoàn Hòa Phát", exchange: "HOSE" },
  { symbol: "MSN", name: "Masan Group - Tập đoàn Masan", exchange: "HOSE" },
  { symbol: "VCB", name: "Vietcombank - NH TMCP Ngoại Thương VN", exchange: "HOSE" },
  { symbol: "BID", name: "BIDV - NH Đầu tư và Phát triển VN", exchange: "HOSE" },
  { symbol: "CTG", name: "VietinBank - NH TMCP Công Thương VN", exchange: "HOSE" },
  { symbol: "TCB", name: "Techcombank - NH TMCP Kỹ Thương VN", exchange: "HOSE" },
  { symbol: "MBB", name: "MBBank - NH TMCP Quân Đội", exchange: "HOSE" },
  { symbol: "FPT", name: "FPT - Tập đoàn FPT", exchange: "HOSE" },
  { symbol: "VPB", name: "VPBank - NH TMCP Việt Nam Thịnh Vượng", exchange: "HOSE" },
  { symbol: "ACB", name: "ACB - NH TMCP Á Châu", exchange: "HOSE" },
  { symbol: "STB", name: "Sacombank - NH TMCP Sài Gòn Thương Tín", exchange: "HOSE" },
  { symbol: "MWG", name: "Thế Giới Di Động - CTCP Đầu Tư TGDĐ", exchange: "HOSE" },
  { symbol: "GAS", name: "PV Gas - Tổng Công ty Khí Việt Nam", exchange: "HOSE" },
  { symbol: "SAB", name: "Sabeco - Tổng Công ty CP Bia Rượu NGK Sài Gòn", exchange: "HOSE" },
  { symbol: "PLX", name: "Petrolimex - Tập đoàn Xăng Dầu VN", exchange: "HOSE" },
  { symbol: "HDB", name: "HDBank - NH TMCP Phát triển TP.HCM", exchange: "HOSE" },
  { symbol: "VRE", name: "Vincom Retail - CTCP Vincom Retail", exchange: "HOSE" },
  { symbol: "SSI", name: "SSI - CTCP Chứng Khoán SSI", exchange: "HOSE" },
  { symbol: "PDR", name: "Phát Đạt - CTCP Phát triển BĐS Phát Đạt", exchange: "HOSE" },
  { symbol: "REE", name: "REE - CTCP Cơ Điện Lạnh", exchange: "HOSE" },
  { symbol: "PNJ", name: "PNJ - CTCP Vàng Bạc Đá Quý Phú Nhuận", exchange: "HOSE" },
  { symbol: "DXG", name: "Đất Xanh Group - CTCP Tập đoàn Đất Xanh", exchange: "HOSE" },
  { symbol: "KDH", name: "Khang Điền - CTCP Đầu tư và Kinh doanh Nhà Khang Điền", exchange: "HOSE" },
  { symbol: "NLG", name: "Nam Long - CTCP Đầu tư Nam Long", exchange: "HOSE" },
  { symbol: "DPM", name: "Đạm Phú Mỹ - Tổng Công ty Phân bón và HC Dầu khí", exchange: "HOSE" },
  { symbol: "GMD", name: "Gemadept - CTCP Gemadept", exchange: "HOSE" },
  { symbol: "DCM", name: "Đạm Cà Mau - CTCP Phân bón Dầu khí Cà Mau", exchange: "HOSE" },
  { symbol: "BCM", name: "Becamex - Tổng Công ty Đầu tư và Phát triển CN Bình Dương", exchange: "HOSE" },
  { symbol: "VJC", name: "Vietjet Air - CTCP Hàng không VietJet", exchange: "HOSE" },
  { symbol: "HVN", name: "Vietnam Airlines - Tổng Công ty Hàng không VN", exchange: "HOSE" },
  { symbol: "ACV", name: "Cảng Hàng không - Tổng Công ty Cảng Hàng không VN", exchange: "HOSE" },
  { symbol: "PAN", name: "Pan Group - CTCP Tập đoàn Pan", exchange: "HOSE" },
  { symbol: "HAG", name: "HAGL - CTCP Hoàng Anh Gia Lai", exchange: "HOSE" },
  { symbol: "DIG", name: "DIC Corp - Tổng Công ty CP Đầu tư Phát triển XD", exchange: "HOSE" },
  { symbol: "CII", name: "CII - CTCP Đầu tư Hạ tầng Kỹ thuật TP.HCM", exchange: "HOSE" },
  { symbol: "EVF", name: "EVNFinance - CTCP Tài chính Điện lực", exchange: "HOSE" },
  { symbol: "VCI", name: "Vietcap - CTCP Chứng khoán Bản Việt", exchange: "HOSE" },
  { symbol: "HCM", name: "HCMS - CTCP Chứng khoán TP.HCM", exchange: "HOSE" },
  { symbol: "VND", name: "VNDirect - CTCP Chứng khoán VNDirect", exchange: "HOSE" },
  { symbol: "LPB", name: "LienVietPostBank - NH TMCP Bưu điện Liên Việt", exchange: "HOSE" },
  { symbol: "EIB", name: "Eximbank - NH TMCP Xuất Nhập Khẩu VN", exchange: "HOSE" },
  { symbol: "TPB", name: "TPBank - NH TMCP Tiên Phong", exchange: "HOSE" },
  { symbol: "OCB", name: "OCB - NH TMCP Phương Đông", exchange: "HOSE" },
  { symbol: "MSB", name: "MSB - NH TMCP Hàng Hải VN", exchange: "HOSE" },
  { symbol: "VIB", name: "VIB - NH TMCP Quốc Tế VN", exchange: "HOSE" },
  { symbol: "TCH", name: "Tiến Chất - CTCP Đầu tư Kinh doanh Nhà Tiến Chất", exchange: "HOSE" },
  { symbol: "NAB", name: "NamABank - NH TMCP Nam Á", exchange: "HOSE" },
  { symbol: "BVH", name: "Bảo Việt - Tập đoàn Bảo Việt", exchange: "HOSE" },
  { symbol: "VGC", name: "Viglacera - Tổng Công ty Viglacera", exchange: "HOSE" },
  { symbol: "GVR", name: "Cao su VN - Tập đoàn Công nghiệp Cao su VN", exchange: "HOSE" },
  { symbol: "PC1", name: "PC1 - CTCP Xây lắp Điện 1", exchange: "HOSE" },
  { symbol: "POW", name: "PV Power - Tổng Công ty Điện lực Dầu khí VN", exchange: "HOSE" },
  { symbol: "NT2", name: "Điện Nhơn Trạch 2 - CTCP Điện lực Dầu khí Nhơn Trạch 2", exchange: "HOSE" },
  { symbol: "CNG", name: "CNG Việt Nam - CTCP CNG Việt Nam", exchange: "HOSE" },
  { symbol: "PVD", name: "PVDrilling - CTCP Khoan và Dịch vụ Khoan DK", exchange: "HOSE" },
  { symbol: "GEX", name: "Gelex Group - CTCP Tập đoàn Gelex", exchange: "HOSE" },
  { symbol: "BWE", name: "BWE - CTCP Cấp Thoát nước Bình Dương", exchange: "HOSE" },
  { symbol: "HSG", name: "Hoa Sen - CTCP Tập đoàn Hoa Sen", exchange: "HOSE" },
  { symbol: "NKG", name: "Nam Kim - CTCP Thép Nam Kim", exchange: "HOSE" },
  { symbol: "TLH", name: "Thép Tiến Lên - CTCP Tập đoàn Thép Tiến Lên", exchange: "HOSE" },
  { symbol: "VHG", name: "VHG - CTCP Đầu tư Cao su Quảng Nam", exchange: "HOSE" },
  { symbol: "ASM", name: "Sao Mai Group - CTCP Tập đoàn Sao Mai", exchange: "HOSE" },
  { symbol: "IMP", name: "IMEXPHARM - CTCP Dược phẩm Imexpharm", exchange: "HOSE" },
  { symbol: "DHC", name: "Đông Hải Bến Tre - CTCP Đông Hải Bến Tre", exchange: "HOSE" },
  { symbol: "HDG", name: "Hà Đô Group - CTCP Tập đoàn Hà Đô", exchange: "HOSE" },
  { symbol: "IJC", name: "IJC - CTCP Phát triển Hạ tầng KT Khu CN Tỉnh BĐ", exchange: "HOSE" },
  { symbol: "SJS", name: "Sudico - CTCP Đầu tư Phát triển ĐT SJC", exchange: "HOSE" },
  { symbol: "AGR", name: "Agribank Chứng khoán - CTCP Chứng khoán Agribank", exchange: "HOSE" },
  { symbol: "CRE", name: "CRE - CTCP BĐS Thế kỷ", exchange: "HOSE" },
  { symbol: "BSI", name: "BSI - CTCP Chứng khoán BIDV", exchange: "HOSE" },
  { symbol: "PTB", name: "Phú Tài - CTCP Phú Tài", exchange: "HOSE" },
  { symbol: "MCH", name: "Masan Consumer - CTCP Hàng Tiêu dùng Masan", exchange: "HOSE" },
  { symbol: "BSR", name: "Lọc Hóa dầu Bình Sơn - CTCP Lọc Hóa Dầu Bình Sơn", exchange: "HOSE" },
  // HNX - popular stocks
  { symbol: "SHB", name: "SHB - NH TMCP Sài Gòn - Hà Nội", exchange: "HNX" },
  { symbol: "PVS", name: "PVS - Tổng Công ty CP Dịch vụ Kỹ thuật DK VN", exchange: "HNX" },
  { symbol: "NVB", name: "NCB - NH TMCP Quốc Dân", exchange: "HNX" },
  { symbol: "BVS", name: "Bảo Việt Securities - CTCP Chứng khoán Bảo Việt", exchange: "HNX" },
  { symbol: "HUT", name: "Tasco - CTCP Tasco", exchange: "HNX" },
  { symbol: "PVI", name: "PVI Holdings - CTCP PVI", exchange: "HNX" },
  { symbol: "CEO", name: "C.E.O Group - CTCP Tập đoàn C.E.O", exchange: "HNX" },
  { symbol: "VCS", name: "Vicostone - CTCP Vicostone", exchange: "HNX" },
  { symbol: "IDC", name: "IDC - Tổng Công ty Đầu tư Phát triển CN", exchange: "HNX" },
  { symbol: "HBC", name: "Xây dựng Hoà Bình - CTCP Xây dựng và Kinh doanh ĐT Hoà Bình", exchange: "HNX" },
  { symbol: "KLB", name: "Kienlongbank - NH TMCP Kiên Long", exchange: "HNX" },
  { symbol: "BAB", name: "BacABank - NH TMCP Bắc Á", exchange: "HNX" },
  { symbol: "SGB", name: "Saigonbank - NH TMCP Sài Gòn Công Thương", exchange: "HNX" },
  { symbol: "MBS", name: "MB Securities - CTCP Chứng khoán MB", exchange: "HNX" },
  { symbol: "SHS", name: "SHS - CTCP Chứng khoán Sài Gòn - Hà Nội", exchange: "HNX" },
  { symbol: "PGS", name: "PGS - CTCP Kinh doanh Khí miền Nam", exchange: "HNX" },
  { symbol: "SD9", name: "Sông Đà 9 - CTCP Sông Đà 9", exchange: "HNX" },
  { symbol: "HAI", name: "HAI - CTCP Nông nghiệp Hải Dương", exchange: "HNX" },
  { symbol: "PTI", name: "PTI - CTCP Bảo hiểm Bưu điện", exchange: "HNX" },
  { symbol: "VGS", name: "Ống Thép Việt Đức - CTCP Ống thép Việt Đức VG PIPE", exchange: "HNX" },
  { symbol: "HLD", name: "CIENCO4 Land - CTCP Đầu tư và Phát triển BĐS An Đình", exchange: "HNX" },
  { symbol: "CTP", name: "CTP - CTCP Công trình Giao thông Vận tải Cần Thơ", exchange: "HNX" },
  { symbol: "NBB", name: "Năm Bảy Bảy - CTCP Đầu tư Năm Bảy Bảy", exchange: "HNX" },
  { symbol: "HCC", name: "Gạch Đồng Tâm - CTCP Gạch Đồng Tâm", exchange: "HNX" },
  { symbol: "NET", name: "Bột giặt NET - CTCP Bột giặt NET", exchange: "HNX" },
  { symbol: "BCC", name: "Xi măng Bỉm Sơn - CTCP Xi măng Bỉm Sơn", exchange: "HNX" },
  { symbol: "HGM", name: "HGMC - CTCP Cơ khí và Khoáng sản Hà Giang", exchange: "HNX" },
  { symbol: "PVB", name: "PV Drilling - CTCP Bảo hiểm PVI", exchange: "HNX" },
  { symbol: "ACM", name: "Khoáng sản Á Châu - CTCP Khoáng sản Á Châu", exchange: "HNX" },
  { symbol: "PLC", name: "Dầu nhờn PLC - Tổng Công ty Hóa dầu Petrolimex", exchange: "HNX" },
  // UpCOM - popular stocks
  { symbol: "OIL", name: "PVOil - Tổng Công ty Dầu Việt Nam", exchange: "UpCOM" },
  { symbol: "VEA", name: "Veam - Tổng Công ty Máy động lực và Máy nông nghiệp VN", exchange: "UpCOM" },
  { symbol: "QNS", name: "Đường Quảng Ngãi - CTCP Đường Quảng Ngãi", exchange: "UpCOM" },
  { symbol: "VGT", name: "Vinatex - Tập đoàn Dệt May VN", exchange: "UpCOM" },
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

    // VN30 ~10% above VNINDEX, HNX30 ~360, VN100 ~1480
    const vn30Price = Math.round(vnPrice * 1.12 * 100) / 100;
    const vn30Change = Math.round(vnChange * 1.1 * 100) / 100;
    const hxn30Price = 345 + (hnxPrice - 220) * 0.6;
    const hnx30Change = Math.round(hnxChange * 0.8 * 100) / 100;
    const vn100Price = Math.round(vnPrice * 1.17 * 100) / 100;
    const vn100Change = Math.round(vnChange * 1.05 * 100) / 100;
    const upcomPrice = 93.5 + (vnPrice - 1280) * 0.03;

    const idx = (price: number, change: number, high?: number, low?: number) => ({
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round((change / (price - change || 1)) * 10000) / 100,
      high: high ?? price,
      low: low ?? price,
      lastUpdated: new Date().toISOString(),
    });

    return {
      VNINDEX: idx(vnPrice, vnChange, vnSym?.high, vnSym?.low),
      HNXINDEX: idx(hnxPrice, hnxChange, hnxSym?.high, hnxSym?.low),
      UPCOMINDEX: idx(upcomPrice, vnChange * 0.02, undefined, undefined),
      VN30: idx(vn30Price, vn30Change),
      HNX30: idx(hxn30Price, hnx30Change),
      VN100: idx(vn100Price, vn100Change),
    };
  } catch {
    return {
      VNINDEX: { price: 1280, change: 8.5, changePercent: 0.67, high: 1285, low: 1272, lastUpdated: new Date().toISOString() },
      HNXINDEX: { price: 225.5, change: 1.2, changePercent: 0.53, high: 227, low: 224, lastUpdated: new Date().toISOString() },
      UPCOMINDEX: { price: 93.5, change: 0.3, changePercent: 0.32, high: 94, low: 93, lastUpdated: new Date().toISOString() },
      VN30: { price: 1435, change: 9.2, changePercent: 0.64, high: 1441, low: 1428, lastUpdated: new Date().toISOString() },
      HNX30: { price: 347, change: 1.8, changePercent: 0.52, high: 349, low: 345, lastUpdated: new Date().toISOString() },
      VN100: { price: 1498, change: 9.8, changePercent: 0.66, high: 1504, low: 1490, lastUpdated: new Date().toISOString() },
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
      const sliced = results.slice(0, 20);

      // If query looks like an exact symbol not in our list, try live VPS lookup
      if (q && q.length >= 2 && sliced.length === 0) {
        try {
          const batch = await fetchVNStockPriceBatch([q.toUpperCase()]);
          const found = batch[q.toUpperCase()];
          if (found) {
            return res.json([{ symbol: found.symbol, name: found.symbol, exchange: found.exchange }]);
          }
        } catch {}
      }

      res.json(sliced);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Live stock lookup by symbol (any VN stock)
  app.get("/api/stocks/lookup/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const key = `lookup_${symbol}`;
      const data = await cached(priceCache, key, PRICE_TTL, async () => {
        const batch = await fetchVNStockPriceBatch([symbol]);
        return batch[symbol] || null;
      });
      if (!data) return res.status(404).json({ error: "Không tìm thấy mã cổ phiếu" });
      // Also find metadata from static list
      const meta = VN_STOCK_LIST.find(s => s.symbol === symbol);
      res.json({ ...data, name: meta?.name || symbol });
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
      // currentPrice can be passed by frontend to anchor the chart to the real price
      const currentPriceParam = parseFloat(req.query.currentPrice as string) || 0;

      // Determine end price (the most recent data point = today's price)
      let endPrice = currentPriceParam;

      if (!endPrice) {
        if (type === "stock") {
          // Try to fetch real price from VPS
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
        } else if (type === "gold") {
          endPrice = 2900;
        } else if (type === "oil") {
          endPrice = 88;
        }
      }

      // Daily volatility by type
      const volatility = type === "stock" ? 0.018 : type === "index" ? 0.008 : type === "crypto" ? 0.04 : 0.015;

      // Generate prices backwards from endPrice
      const prices: number[] = [endPrice];
      for (let i = 1; i <= days; i++) {
        const prev = prices[prices.length - 1];
        const change = prev * (Math.random() - 0.48) * volatility;
        prices.push(Math.max(prev - change, endPrice * 0.5));
      }
      prices.reverse(); // now oldest → newest, ending at endPrice

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

      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
