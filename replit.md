# VN Finance Dashboard

## Overview
A modern portfolio tracking dashboard for Vietnamese stocks (HOSE, HNX, UpCOM), gold, oil, and cryptocurrency with real-time price updates and Vietstock RSS news feeds. Inspired by Perplexity.ai Finance interface.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Storage**: In-memory (MemStorage) with seed data
- **Font**: New York (system serif font) with Georgia fallback

## Key Features
- Real-time Vietnamese stock prices (HOSE, HNX, UpCOM) — 70+ stocks with exchange filter
- Shows ceiling (trần), floor (sàn), reference price (tham chiếu) for each VN stock
- Market indices: VNINDEX, HNXINDEX, UPCOMINDEX, VN30, HNX30, VN100
- **Gold page**: Tab toggle for SJC vs Vàng nhẫn 9999 chart views; real USD/VND from Vietcombank; formula-computed VN prices; Vietstock gold news
- **Oil page**: WTI + Brent with 1N/7N/30N chart switchers; Vietstock oil news
- **Crypto**: localStorage-based coin list (default BTC+ETH), add via CoinGecko search; Vietstock crypto news
- **Dashboard**: Mini sparkline charts embedded inside each index/commodity card; only selected crypto coins (BTC+ETH default, configurable); Vietstock intl finance + industry news; full settings panel with crypto toggles
- **Stocks page**: Market indices at top, "Cổ phiếu quan tâm" watchlist ABOVE detail panel, Vietstock stock news at bottom
- **Watchlist page**: Click any card to expand a detail drawer with price chart, high/low/volume stats, and 1N/7N/30N period selector
- Portfolio management: add/edit/delete with asset detail panel, P&L, and price chart
- Sidebar: reorderable navigation stored in localStorage

## Data Sources (All Free, Real-Time)
- **VN Stocks**: VPS Securities API (bgapidatafeed.vps.com.vn) — real-time HOSE/HNX/UpCOM prices
- **Gold price**: gold-api.com for XAU/USD; **Vietcombank XML API** for real USD/VND sell rate; VN gold prices computed via configurable formula
- **Oil prices**: Yahoo Finance (CL=F for WTI, BZ=F for Brent)
- **Crypto**: CoinGecko API (no key needed)
- **VN Indices**: stooq.com for VNINDEX/HNXINDEX; derived for VN30, HNX30, VN100, UPCOM
- **All news**: **Vietstock RSS** feeds (Vietnamese)
  - Gold: vietstock.vn/759/hang-hoa/vang-va-kim-loai-quy.rss
  - Oil: vietstock.vn/34/hang-hoa/nhien-lieu.rss
  - Crypto: vietstock.vn/4309/the-gioi/tien-ky-thuat-so.rss
  - Stocks: vietstock.vn/830/chung-khoan/co-phieu.rss
  - Intl Finance: vietstock.vn/772/the-gioi/tai-chinh-quoc-te.rss
  - Industry: vietstock.vn/1329/dong-duong/kinh-te-nganh.rss

## Project Structure
```
client/src/
  pages/
    Dashboard.tsx      - Market overview: mini charts inside cards, BTC+ETH crypto, Vietstock news
    StocksPage.tsx     - VN stocks: indices, then "Cổ phiếu quan tâm", then detail, then news
    GoldPage.tsx       - Gold: SJC/Nhẫn tab toggle, VCB exchange rate, Vietstock news
    OilPage.tsx        - Crude oil: WTI + Brent charts, Vietstock oil news
    CryptoPage.tsx     - Crypto: add/remove coins, period switcher, Vietstock crypto news
    PortfolioPage.tsx  - Portfolio: add/edit/delete assets with P&L detail panel
    WatchlistPage.tsx  - Watchlist: clickable cards, expandable detail drawer with chart
  components/
    Layout.tsx          - Sidebar with reordering/hide settings (localStorage)
    PriceChart.tsx      - Recharts area chart (supports mini prop for sparklines)
    NewsSection.tsx     - News feed component (shows image, title, source, time)
    PortfolioDialog.tsx - Add/edit portfolio dialog with live stock search
server/
  routes.ts            - All API endpoints; Vietstock RSS parser; Vietcombank rate fetcher
  storage.ts           - In-memory storage with portfolio + watchlist data
shared/
  schema.ts            - Shared types and Drizzle schemas
```

## API Endpoints
- `GET /api/prices/gold` — XAU/USD + VND prices with real VCB exchange rate
- `GET /api/prices/oil` — WTI + Brent from Yahoo Finance
- `GET /api/prices/crypto?ids=...` — CoinGecko prices
- `GET /api/prices/indices` — All 6 VN market indices
- `GET /api/prices/vn/:symbol` — Single VN stock price via VPS
- `GET /api/prices/vn-batch?symbols=...` — Batch VN stock prices
- `GET /api/stocks/search?q=...` — Full-text VN stock search
- `GET /api/stocks/lookup/:symbol` — Live VN stock lookup
- `GET /api/news/gold|oil|crypto|stocks|intl-finance|industry` — Vietstock RSS feeds
- `GET /api/news/vietstock?rss=URL` — Generic Vietstock RSS proxy
- `GET /api/historical/:type/:symbol?days=N` — Simulated historical OHLCV data
- `GET /api/market-overview` — Dashboard overview (indices + gold + oil + BTC+ETH)

## Cache Strategy
- Price data: 60s TTL
- News data: 5min TTL (300s)
- All cached in-memory Map (priceCache, newsCache)

## Key User Preferences
- Vietnamese language throughout all UI
- Real exchange rate from Vietcombank (not estimated)
- Vietstock RSS for all news (Vietnamese news source)
- Mini charts embedded inside market cards on Dashboard
- Click-to-expand detail in Watchlist and Stocks page
