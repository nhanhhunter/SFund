import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const PYTHON_BIN = process.env.PYTHON_BIN || "python";
const VNSTOCK_SOURCE = (process.env.VNSTOCK_SOURCE || "KBS").toUpperCase();
const runtimeDir = path.join(process.cwd(), ".vnstock-runtime");
const bridgePath = path.join(process.cwd(), "server", "vnstock_bridge.py");

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

function ensureRuntimeDirs() {
  fs.mkdirSync(runtimeDir, { recursive: true });
}

async function runBridge<T>(args: string[]): Promise<T> {
  ensureRuntimeDirs();

  const { stdout, stderr } = await execFileAsync(PYTHON_BIN, [bridgePath, ...args], {
    cwd: process.cwd(),
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      VNSTOCK_RUNTIME_DIR: runtimeDir,
    },
  });

  const output = stdout.trim();

  if (!output) {
    throw new Error(stderr.trim() || "vnstock bridge returned no output");
  }

  return JSON.parse(output) as T;
}

export async function fetchVnstockPriceBoard(symbols: string[]) {
  if (!symbols.length) return [];

  return runBridge<VnstockBoardRow[]>([
    "price-board",
    "--symbols",
    symbols.join(","),
    "--source",
    VNSTOCK_SOURCE,
  ]);
}

export async function fetchVnstockHistory(
  symbol: string,
  start: string,
  end: string,
  interval: string,
) {
  return runBridge<VnstockHistoryRow[]>([
    "history",
    "--symbol",
    symbol,
    "--source",
    VNSTOCK_SOURCE,
    "--start",
    start,
    "--end",
    end,
    "--interval",
    interval,
  ]);
}

export async function fetchVnstockListing() {
  return runBridge<VnstockListingRow[]>(["listing", "--source", VNSTOCK_SOURCE]);
}
