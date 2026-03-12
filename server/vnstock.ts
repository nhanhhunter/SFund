const VNSTOCK_SOURCE = (process.env.VNSTOCK_SOURCE || "KBS").toUpperCase();

const KBS_BASE_URL = "https://kbbuddywts.kbsec.com.vn/iis-server/investment";
const KBS_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,vi-VN;q=0.8,vi;q=0.7",
  Connection: "keep-alive",
  "Content-Type": "application/json",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
  DNT: "1",
  Pragma: "no-cache",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
};

const KBS_INTERVAL_MAP: Record<string, string> = {
  "1m": "1P",
  "5m": "5P",
  "15m": "15P",
  "30m": "30P",
  "1h": "60P",
  "1H": "60P",
  "60m": "60P",
  "1d": "day",
  "1D": "day",
  d: "day",
  D: "day",
  daily: "day",
  "1w": "week",
  "1W": "week",
  w: "week",
  W: "week",
  weekly: "week",
  "1M": "month",
  m: "month",
  M: "month",
  monthly: "month",
};

export type VnstockBoardRow = {
  symbol: string;
  time?: string;
  exchange?: string;
  ceiling_price?: number;
  floor_price?: number;
  reference_price?: number;
  open_price?: number;
  high_price?: number;
  low_price?: number;
  close_price?: number;
  average_price?: number;
  total_trades?: number;
  total_value?: number;
  price_change?: number;
  percent_change?: number;
};

export type VnstockHistoryRow = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type VnstockListingRow = {
  symbol: string;
  organ_name?: string;
  en_organ_name?: string;
  exchange?: string;
  type?: string;
  id?: number;
};

type KbsListingApiRow = {
  symbol: string;
  name?: string;
  nameEn?: string;
  exchange?: string;
  type?: string;
  index?: number;
};

type KbsBoardApiRow = Record<string, string | number | null | undefined>;
type KbsHistoryApiRow = {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
};

function assertSupportedSource() {
  if (VNSTOCK_SOURCE !== "KBS") {
    throw new Error(`Unsupported VNSTOCK_SOURCE: ${VNSTOCK_SOURCE}. Only KBS is supported in App Hosting mode.`);
  }
}

async function fetchKbsJson<T>(path: string, init?: RequestInit): Promise<T> {
  assertSupportedSource();

  const response = await fetch(`${KBS_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...KBS_HEADERS,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`KBS request failed (${response.status}) ${path}: ${body.slice(0, 200)}`);
  }

  return (await response.json()) as T;
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatHistoryDate(date: string) {
  const [datePart] = date.trim().split(" ");
  const [year, month, day] = datePart.split("-");
  if (!year || !month || !day) return date;
  return `${day}-${month}-${year}`;
}

export async function fetchVnstockPriceBoard(symbols: string[]) {
  if (!symbols.length) return [];

  const rows = await fetchKbsJson<KbsBoardApiRow[]>("/stock/iss", {
    method: "POST",
    headers: {
      "x-lang": "vi",
      "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
    },
    body: JSON.stringify({
      code: symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean).join(","),
    }),
  });

  return rows.map((row) => ({
    symbol: String(row.SB || "").toUpperCase(),
    time: typeof row.t === "number" ? new Date(row.t).toISOString() : undefined,
    exchange: typeof row.EX === "string" ? row.EX : undefined,
    ceiling_price: toNumber(row.CL),
    floor_price: toNumber(row.FL),
    reference_price: toNumber(row.RE),
    open_price: toNumber(row.OP),
    high_price: toNumber(row.HI),
    low_price: toNumber(row.LO),
    close_price: toNumber(row.CP),
    average_price: toNumber(row.AP),
    total_trades: toNumber(row.TT),
    total_value: toNumber(row.TV),
    price_change: toNumber(row.CH),
    percent_change: toNumber(row.CHP),
  }));
}

export async function fetchVnstockHistory(
  symbol: string,
  start: string,
  end: string,
  interval: string,
) {
  const suffix = KBS_INTERVAL_MAP[interval];
  if (!suffix) {
    throw new Error(`Unsupported KBS interval: ${interval}`);
  }

  const params = new URLSearchParams({
    sdate: formatHistoryDate(start),
    edate: formatHistoryDate(end),
  });

  const payload = await fetchKbsJson<{ data_day?: KbsHistoryApiRow[]; [key: string]: KbsHistoryApiRow[] | string | undefined }>(
    `/stocks/${symbol.toUpperCase()}/data_${suffix}?${params.toString()}`,
  );

  const dataKey = `data_${suffix}`;
  const rows = Array.isArray(payload[dataKey]) ? (payload[dataKey] as KbsHistoryApiRow[]) : [];

  return rows.map((row) => ({
    time: row.t,
    open: toNumber(row.o),
    high: toNumber(row.h),
    low: toNumber(row.l),
    close: toNumber(row.c),
    volume: toNumber(row.v),
  }));
}

export async function fetchVnstockListing() {
  const rows = await fetchKbsJson<KbsListingApiRow[]>("/stock/search/data");

  return rows.map((row) => ({
    symbol: row.symbol?.toUpperCase() || "",
    organ_name: row.name || row.symbol,
    en_organ_name: row.nameEn,
    exchange: row.exchange,
    type: row.type,
    id: row.index,
  }));
}
