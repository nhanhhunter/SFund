# SFund Project Notes

## Overview
SFund is a Vietnamese personal finance dashboard for tracking stocks, portfolio holdings, watchlists, gold, oil, and crypto. The project started as a Replit-built app and has since been reworked so it can run locally and deploy cleanly on Firebase App Hosting, Netlify plus separate API hosting, or other platforms without being tied to Replit services.

## Current Stack
- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Recharts
- Backend: Express, TypeScript
- Auth: Firebase Authentication
- Database: Firebase Firestore
- Build: Vite for client, `tsx` build script for server bundle
- Hosting target: Firebase App Hosting first-class, but portable to other platforms

## Deployment Model
- Frontend and backend can run together in one deployment, or split by origin.
- The client reads Firebase config from `VITE_FIREBASE_*`.
- The server uses `CORS_ORIGIN` when frontend and backend are deployed on different domains.
- `VITE_API_BASE_URL` can be left empty when frontend and backend share the same origin.
- `apphosting.yaml` is included for Firebase App Hosting.

## Local Development
1. Create `.env` from `.env.example`.
2. Fill in Firebase web app config values.
3. Make sure Firebase Authentication enables Google and Email/Password.
4. Make sure Firestore exists and rules from `firebase/firestore.rules` are published.
5. Run:
   - `npm install`
   - `npm run dev`

Notes:
- Local dev was adjusted to work on Windows by removing `reusePort` from the Express listener.
- The app is expected to be tested locally before production rollout.

## Authentication
- Google sign-in is supported.
- Email/password sign-in and sign-up are also supported.
- Google auth uses popup first and falls back to redirect if the popup is blocked or closes unexpectedly.
- Auth state is managed on the client through an `AuthProvider`.

Relevant files:
- `client/src/lib/firebase.ts`
- `client/src/components/AuthProvider.tsx`
- `client/src/components/AuthGate.tsx`
- `client/src/components/Layout.tsx`

## Data Storage
- Portfolio data is stored per authenticated user in Firestore.
- Watchlist data is stored per authenticated user in Firestore.
- Stocks page watchlist and Watchlist page are synced to the same Firestore-backed data.

Relevant files:
- `client/src/lib/user-data.ts`
- `client/src/pages/PortfolioPage.tsx`
- `client/src/pages/WatchlistPage.tsx`
- `client/src/pages/StocksPage.tsx`

## Market Data Sources
- Vietnamese stocks: VPS Securities API
- Vietnamese stock lookup/search: VPS plus local symbol metadata
- Market indices:
  - Primary source: VPS index symbols where available
  - Fallback: stooq plus derived values
- Gold world price: `vang.today` API (`XAUUSD`)
- Vietnam gold prices: `vang.today` API
  - `SJL1L10` mapped to `SJC 9999`
  - `SJ9999` mapped to `Nhẫn SJC`
- USD/VND: Vietcombank XML feed
- Oil: Yahoo Finance
- Crypto: CoinGecko
- News: Vietstock RSS feeds

## Gold Page Behavior
- World gold and Vietnam gold are shown separately.
- World and Vietnam gold charts use `vang.today` history/detail data for 1, 7, and 30 day ranges.
- Vietnam gold prices are fetched directly from external sources, not derived from user-entered premium.
- The spread/premium shown on the page is calculated as:
  - fetched Vietnam gold price minus converted world gold price
- The conversion formula is configurable from the Gold page settings modal.
- The Gold page now shows:
  - world gold summary card
  - Vietnam gold summary card
  - world gold chart
  - Vietnam gold chart
  - Vietstock gold news

## Portfolio Page Updates
- Portfolio summary layout was compressed to fit allocation in the top row.
- Related news was moved under the asset list.
- Best performer remains visible until a specific asset is selected.
- Added:
  - total portfolio daily P/L
  - per-asset daily P/L
- Asset detail panel fields were reordered and clarified, including P/L amount plus percentage.

## Watchlist and Stocks Updates
- Watchlist stock entry now supports symbol search like the Portfolio page instead of only a fixed list.
- Stocks page watchlist is synchronized with the Firestore watchlist used by the Watchlist page.
- Stocks and Dashboard section title styles were normalized for consistency.

## Crypto Page Updates
- Coin list now displays horizontally in a responsive grid.
- The dedicated selected-coin detail card was removed.
- Market cap and 24h volume were moved into each coin card.
- Chart and news now use the wider content area below the grid.

## Hosting and Config Files
- `apphosting.yaml`: Firebase App Hosting config
- `.env.example`: local environment template
- `firebase/firestore.rules`: Firestore security rules

## Important Endpoints
- `GET /api/prices/vn/:symbol`
- `GET /api/prices/vn-batch`
- `GET /api/stocks/search`
- `GET /api/stocks/lookup/:symbol`
- `GET /api/prices/indices`
- `GET /api/prices/gold`
- `GET /api/prices/oil`
- `GET /api/prices/crypto`
- `GET /api/market-overview`
- `GET /api/news/stocks`
- `GET /api/news/crypto`
- `GET /api/news/gold`
- `GET /api/news/oil`
- `GET /api/news/intl-finance`
- `GET /api/news/industry`
- `GET /api/historical/:type/:symbol`

## Project Structure
```text
client/src/
  components/
    AuthGate.tsx
    AuthProvider.tsx
    Layout.tsx
    NewsSection.tsx
    PortfolioDialog.tsx
    PriceChart.tsx
  lib/
    firebase.ts
    user-data.ts
  pages/
    Dashboard.tsx
    StocksPage.tsx
    PortfolioPage.tsx
    WatchlistPage.tsx
    GoldPage.tsx
    OilPage.tsx
    CryptoPage.tsx
server/
  index.ts
  routes.ts
firebase/
  firestore.rules
apphosting.yaml
```

## Verification Status
- `npm run check`: passing
- `npm run build`: passing
- `npm run dev`: starts successfully in local development after listener fix

## Operational Notes
- Avoid reintroducing in-memory portfolio/watchlist as the primary source of truth.
- Keep Firebase config client-safe only; do not add Admin credentials to the client env.
- If Google sign-in fails in production, first check:
  - Firebase Authorized Domains
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - App Hosting deployed domain
