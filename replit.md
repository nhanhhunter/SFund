# VN Finance Dashboard

## Overview
A modern portfolio tracking dashboard for Vietnamese stocks, gold, oil, and cryptocurrency with real-time price updates and news feeds. Inspired by Perplexity.ai Finance interface.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Storage**: In-memory (MemStorage) with seed data
- **Font**: New York (system serif font) with Georgia fallback

## Key Features
- Real-time Vietnamese stock prices (HOSE, HNX, UpCOM) - 47 stocks with exchange filter tabs
- Shows ceiling (trần), floor (sàn), reference price (tham chiếu) for each VN stock
- Gold prices (VND/Lượng + USD/Oz) from real-time gold-api.com
- Crude oil prices (WTI + Brent) from Yahoo Finance real-time data
- Cryptocurrency prices via CoinGecko API (8 coins) - real-time
- Portfolio management with add/edit/delete - uses real VN stock prices
- Watchlist for tracking assets
- News feeds via Alpha Vantage (stocks/commodities) and CryptoCompare (crypto)
- Interactive charts (30/90 day historical via Recharts)
- Dark/light mode toggle

## Data Sources (All Free, Real-Time)
- **VN Stocks**: VPS Securities API (bgapidatafeed.vps.com.vn) - real-time HOSE/HNX/UpCOM prices
- **Gold price**: gold-api.com for XAU/USD, ExchangeRate-API for USD/VND conversion
- **Oil prices**: Yahoo Finance (CL=F for WTI, BZ=F for Brent)
- **Crypto**: CoinGecko API (no key needed)
- **VN Indices**: Stooq.com for VNINDEX and HNXINDEX
- **Stock news**: Alpha Vantage demo key (limited)
- **Crypto news**: CryptoCompare API (no key needed)

## Project Structure
```
client/src/
  pages/
    Dashboard.tsx      - Market overview
    StocksPage.tsx     - Vietnamese stocks
    GoldPage.tsx       - Gold prices
    OilPage.tsx        - Crude oil prices
    CryptoPage.tsx     - Cryptocurrency
    PortfolioPage.tsx  - Portfolio management
    WatchlistPage.tsx  - Watchlist
  components/
    Layout.tsx         - Sidebar navigation
    PriceChart.tsx     - Recharts area chart
    NewsSection.tsx    - News feed component
    PortfolioDialog.tsx - Add/edit portfolio dialog
server/
  routes.ts            - All API endpoints with price fetching logic
  storage.ts           - In-memory storage with seed data
shared/
  schema.ts            - Zod schemas and TypeScript types
```

## API Endpoints
- GET /api/portfolio - Get portfolio items
- POST /api/portfolio - Add portfolio item
- PUT /api/portfolio/:id - Update portfolio item
- DELETE /api/portfolio/:id - Delete portfolio item
- GET /api/watchlist - Get watchlist
- POST /api/watchlist - Add to watchlist
- DELETE /api/watchlist/:id - Remove from watchlist
- GET /api/prices/vn/:symbol - VN stock price
- GET /api/prices/vn-batch - Multiple VN stock prices
- GET /api/prices/crypto - Crypto prices
- GET /api/prices/gold - Gold prices
- GET /api/prices/oil - Oil prices
- GET /api/market-overview - All market data
- GET /api/news/stocks - Stock news
- GET /api/news/crypto - Crypto news
- GET /api/news/gold - Gold news
- GET /api/news/oil - Oil news
- GET /api/historical/:type/:symbol - Historical price data

## Notes
- Price caching: 60 seconds for prices, 5 minutes for news
- VN stock prices from VPS API batch endpoint - single request for all symbols
- Gold: XAU/USD from gold-api.com × USD/VND from exchangerate-api.com → VND/lượng
- Oil: Yahoo Finance futures contracts (CL=F WTI, BZ=F Brent)
- VN Stocks: 47 stocks across HOSE (29), HNX (10), UpCOM (8) exchanges
- Exchange filter tabs in StocksPage allow browsing by exchange
- Stock data includes: price, change, ceiling (trần), floor (sàn), ref price (tham chiếu)
- Seed data pre-populated with realistic Vietnamese stock portfolio
