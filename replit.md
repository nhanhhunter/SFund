# VN Finance Dashboard

## Overview
A modern portfolio tracking dashboard for Vietnamese stocks, gold, oil, and cryptocurrency with real-time price updates and news feeds. Inspired by Perplexity.ai Finance interface.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Storage**: In-memory (MemStorage) with seed data
- **Font**: New York (system serif font) with Georgia fallback

## Key Features
- Real-time Vietnamese stock prices (HOSE market) - 20 stocks
- Gold prices (VND/Lượng + USD/Oz via exchange rate calculation)
- Crude oil prices (WTI + Brent)
- Cryptocurrency prices via CoinGecko API (8 coins)
- Portfolio management with add/edit/delete (stocks, crypto, gold, oil)
- Watchlist for tracking assets
- News feeds via Alpha Vantage (stocks/commodities) and CryptoCompare (crypto)
- Interactive charts (30/90 day historical via Recharts)
- Dark/light mode toggle

## Data Sources (All Free)
- **Crypto**: CoinGecko API (no key needed)
- **Exchange rate**: ExchangeRate-API (no key needed) 
- **Gold price**: Calculated from XAU/USD + USD/VND exchange rate
- **Stock news**: Alpha Vantage demo key (limited)
- **Crypto news**: CryptoCompare API (no key needed)
- **VN Stocks**: TCBS API (attempted), falls back to realistic generated prices

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
- Gold prices are calculated from XAU/USD × USD/VND exchange rate
- VN stock prices fall back to simulated data when TCBS API unavailable
- Seed data pre-populated with realistic Vietnamese stock portfolio
