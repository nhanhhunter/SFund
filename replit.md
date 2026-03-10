# VN Finance Dashboard

## Overview
A modern portfolio tracking dashboard for Vietnamese stocks (HOSE, HNX, UpCOM), gold, oil, and cryptocurrency with real-time price updates and news feeds. Inspired by Perplexity.ai Finance interface.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Storage**: In-memory (MemStorage) with seed data
- **Font**: New York (system serif font) with Georgia fallback

## Key Features
- Real-time Vietnamese stock prices (HOSE, HNX, UpCOM) — 115+ stocks with exchange filter tabs
- Shows ceiling (trần), floor (sàn), reference price (tham chiếu) for each VN stock
- Market indices: VNINDEX, HNXINDEX, UPCOMINDEX, VN30, HNX30, VN100 (all 6 on Dashboard)
- Gold page: World price in USD/oz with thousand separator; formula-computed VN prices (Vàng nhẫn 9999 + SJC); configurable settings panel; 1N/7N/30N chart switcher
- Crude oil prices (WTI + Brent) — each chart has 1N/7N/30N period switcher
- Cryptocurrency — localStorage-based coin list (default BTC+ETH), add via CoinGecko search, remove button, 1N/7N/30N period switcher
- Portfolio management: add/edit/delete; clicking a row opens asset detail panel with P&L breakdown, price chart (1N/7N/30N), and related news
- Dashboard: toggleable metric cards (show/hide VN indices, gold, oil) stored in localStorage
- Sidebar: reorderable navigation (up/down arrows), hideable items — stored in localStorage; default order: Portfolio → Watchlist → Dashboard → Stocks → Gold → Oil → Crypto
- News feeds via Alpha Vantage and CryptoCompare

## Data Sources (All Free, Real-Time)
- **VN Stocks**: VPS Securities API (bgapidatafeed.vps.com.vn) — real-time HOSE/HNX/UpCOM prices
- **Gold price**: gold-api.com for XAU/USD, ExchangeRate-API for USD/VND conversion; VN gold prices computed via configurable formula
- **Oil prices**: Yahoo Finance (CL=F for WTI, BZ=F for Brent)
- **Crypto**: CoinGecko API (no key needed); search via /api/crypto/search
- **VN Indices**: VPS API for all 6 indices (VNINDEX, HNXINDEX, UPCOMINDEX, VN30, HNX30, VN100)
- **Stock news**: Alpha Vantage demo key
- **Crypto news**: CryptoCompare API

## Project Structure
```
client/src/
  pages/
    Dashboard.tsx      - Market overview with 6 indices + toggleable cards
    StocksPage.tsx     - Vietnamese stocks with watchlist management
    GoldPage.tsx       - Gold prices with formula/settings + period switcher
    OilPage.tsx        - Crude oil with 1N/7N/30N chart switchers
    CryptoPage.tsx     - Crypto with add/remove coins + period switcher
    PortfolioPage.tsx  - Portfolio with asset detail panel + chart
    WatchlistPage.tsx  - Watchlist
  components/
    Layout.tsx          - Sidebar with reordering/hide settings (localStorage)
    PriceChart.tsx      - Recharts area chart
    NewsSection.tsx     - News feed component
    PortfolioDialog.tsx - Add/edit portfolio dialog with live stock search
server/
  routes.ts            - All API endpoints; /api/crypto/search endpoint added
  storage.ts           - In-memory storage with seed data
shared/
  schema.ts            - Zod schemas and TypeScript types
```

## API Endpoints
- GET /api/portfolio — Get portfolio items
- POST /api/portfolio — Add portfolio item
- PUT /api/portfolio/:id — Update portfolio item
- DELETE /api/portfolio/:id — Delete portfolio item
- GET /api/watchlist — Get watchlist
- POST /api/watchlist — Add to watchlist
- DELETE /api/watchlist/:id — Remove from watchlist
- GET /api/prices/vn/:symbol — VN stock price
- GET /api/prices/vn-batch — Multiple VN stock prices
- GET /api/prices/crypto?ids=... — Crypto prices
- GET /api/prices/gold — Gold prices (USD/oz + VND/lượng + usdToVnd)
- GET /api/prices/oil — Oil prices (WTI + Brent)
- GET /api/prices/indices — All 6 VN indices
- GET /api/market-overview — All market data (all 6 indices + gold + oil + crypto)
- GET /api/crypto/search?q=... — CoinGecko coin search
- GET /api/stocks/search?q=... — VN stock search
- GET /api/stocks/lookup/:symbol — VN stock lookup
- GET /api/news/stocks — Stock news
- GET /api/news/crypto — Crypto news
- GET /api/news/gold — Gold news
- GET /api/news/oil — Oil news
- GET /api/historical/:type/:symbol — Historical price data

## localStorage Keys
- `nav_items_order` — sidebar navigation order
- `nav_items_hidden` — hidden sidebar items
- `dashboard_visible_cards` — dashboard index card visibility
- `gold_settings` — gold formula parameters (shipping, insurance, tax, processing fee, SJC premium)
- `crypto_coins` — user's crypto watchlist (default: bitcoin, ethereum)
- `stocks_watchlist` — VN stock watchlist
- `indices_watchlist` — VN index watchlist

## Notes
- Price caching: 60 seconds for prices, 5 minutes for news
- Gold VN formula: Giá VN = (Giá TG + phí VC + phí BH) × (1 + thuế NK) × 1.205653 × tỷ giá + phí gia công
- SJC price = Vàng nhẫn price + configurable SJC premium (default: 5,000,000 VND/lượng)
- VN stock list: 115+ stocks across HOSE, HNX, UpCOM exchanges
- SCI (HNX) is included in the stock list
