# SFund

## Overview
SFund is a Vietnamese personal finance dashboard for tracking stocks, portfolio holdings, watchlists, gold, oil, and crypto. The application uses a React frontend, an Express API, Firebase Authentication, and Firestore.

Stripe has been removed from the project. Support and donation guidance in the app now uses Momo only.

## Stack
- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Recharts
- Backend: Express, TypeScript
- Auth: Firebase Authentication
- Database: Firestore
- Hosting: Firebase App Hosting

## Local Development
1. Create `.env` from `.env.example`.
2. Fill in the Firebase web app variables.
3. Enable Google and Email/Password in Firebase Authentication.
4. Publish [firebase/firestore.rules](firebase/firestore.rules).
5. Run:

```bash
npm install
npm run dev
```

## Environment Variables
Client:
- `VITE_API_BASE_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Server:
- `CORS_ORIGIN`
- `VNSTOCK_SOURCE=KBS`

Optional:
- `VNSTOCK_API_KEY`

Note:
- `VNSTOCK_API_KEY` is currently not required for the production stock-price flow because the backend calls KBS endpoints directly over HTTP.

## Authentication and User Data
- Google sign-in and Email/Password sign-in are supported.
- Portfolio, watchlist, and per-user settings are stored in Firestore.
- Portfolio items support:
  - base currency per asset: `VND` or `USD`
  - multiple buy lots with quantity, price, and buy timestamp
  - dividend history for stocks with amount and received timestamp
- User settings include theme, font, menu preferences, display name, avatar icon, and password updates for email/password accounts.

## Portfolio Data Model

Portfolio documents are stored under:

```text
users/{uid}/portfolio/{itemId}
```

Normalized fields:

- `id`
- `symbol`
- `name`
- `type`
- `currency`
- `purchaseLots`
- `dividends`
- `quantity`
- `avgBuyPrice`
- `notes`
- `addedAt`
- `updatedAt`

Example:

```json
{
  "id": "abc123",
  "symbol": "VNM",
  "name": "Vinamilk",
  "type": "stock",
  "currency": "VND",
  "purchaseLots": [
    {
      "quantity": 100,
      "price": 82000,
      "boughtAt": "2026-03-12T02:15:00.000Z"
    },
    {
      "quantity": 50,
      "price": 79000,
      "boughtAt": "2026-03-15T03:30:00.000Z"
    }
  ],
  "dividends": [
    {
      "amount": 1500000,
      "receivedAt": "2026-04-10T00:00:00.000Z"
    }
  ],
  "quantity": 150,
  "avgBuyPrice": 81000,
  "notes": "Tich luy dai han",
  "addedAt": "2026-03-12T02:15:00.000Z",
  "updatedAt": "2026-03-16T08:45:00.000Z"
}
```

Notes:

- `quantity` and `avgBuyPrice` are derived from `purchaseLots` in the client data layer.
- Existing older documents without `currency`, `purchaseLots`, or `dividends` are normalized on read for backward compatibility.
- `updatedAt` is refreshed each time a portfolio item is edited.
- Stock ROI includes both price change and received dividends.

## Current UI Behavior

### Dashboard
- Market indices on the Overview page include:
  - `VN-Index`
  - `HNX-Index`
  - `UPCOM`
  - `S&P 500`
  - `Dow Jones`
  - `Nasdaq Composite`
- Commodity cards on the Overview page are ordered as:
  - `Vang (USD/Oz)`
  - `Vang SJC 9999`
  - `Dau Brent (USD/bbl)`
  - `Dau WTI (USD/bbl)`
- Overview cards are added via inline search inputs instead of a settings modal.
- Cards can be removed directly from the card itself using the `x` button in the top-right corner.
- Dashboard card visibility is persisted in local storage:
  - `dashboard_index_card_keys`
  - `dashboard_commodity_card_keys`
  - `dashboard_crypto_ids`

### Portfolio
- The asset-list hint `(chon ma de xem chi tiet)` is shown only when no asset is selected.
- The selected asset detail card can be closed normally after fixing the `onClose` runtime error.
- Asset detail and price chart are split into separate cards so the selected asset card does not stretch the first summary row.
- Dividend amounts displayed in `USD` are rounded to 2 decimal places in portfolio detail and history views.
- The summary cards use a more consistent title style and icon treatment.
- The old `Hieu suat tot nhat` card was replaced by a combined ROI performance card with:
  - `Hieu suat cao`: top 2 assets by ROI
  - `Hieu suat thap`: bottom 2 assets by ROI

### Watchlist
- Adding crypto uses live search from `/api/crypto/search`, similar to the dedicated Crypto page.
- Gold watchlist options are:
  - `Vang the gioi (XAU/USD)`
  - `Vang SJC 9999`
  - `Vang Nhan SJC`
- Oil watchlist options are ordered with `BRENT` before `WTI`.
- Watchlist cards use an `x` remove action for consistency with other card-based pages.

### Stocks Page
- The `Chi so thi truong` section uses the same index set as the Dashboard:
  - `VN-Index`
  - `HNX-Index`
  - `UPCOM`
  - `S&P 500`
  - `Dow Jones`
  - `Nasdaq Composite`
- The Stocks page source label reflects combined VN and US index feeds.

Portfolio calculations:

```text
Lai/Lo = (Current Value - Cost Basis) / Cost Basis
ROI = (Current Value - Cost Basis + Dividends Received) / Cost Basis
```

## Stock Price API

### Current Production Design
Vietnamese stock prices are fetched in Node from KBS endpoints in [server/vnstock.ts](server/vnstock.ts).

This replaced the old Python `vnstock` bridge because Firebase App Hosting deployed the Node app successfully, but production requests failed with `500` when Python runtime dependencies were not available.

### Upstream Endpoints
Listing:
- `GET https://kbbuddywts.kbsec.com.vn/iis-server/investment/stock/search/data`

Realtime board:
- `POST https://kbbuddywts.kbsec.com.vn/iis-server/investment/stock/iss`
- Request body:

```json
{ "code": "FPT,VNM,HPG" }
```

Historical OHLC:
- `GET https://kbbuddywts.kbsec.com.vn/iis-server/investment/stocks/{SYMBOL}/data_{suffix}?sdate=DD-MM-YYYY&edate=DD-MM-YYYY`

Interval mapping:
- `1m -> data_1P`
- `5m -> data_5P`
- `15m -> data_15P`
- `30m -> data_30P`
- `1H -> data_60P`
- `1D -> data_day`
- `1W -> data_week`
- `1M -> data_month`

### Internal API Endpoints
- `GET /api/prices/vn/:symbol`
- `GET /api/prices/vn-batch?symbols=FPT,VNM`
- `GET /api/prices/indices`
- `GET /api/market-overview`
- `GET /api/stocks/search?q=fpt`
- `GET /api/stocks/lookup/:symbol`
- `GET /api/stocks/list?exchange=HOSE&page=1&limit=20`
- `GET /api/crypto/search?q=bitcoin`
- `GET /api/historical/stock/:symbol?days=1`
- `GET /api/historical/stock/:symbol?days=7`
- `GET /api/historical/stock/:symbol?days=30`
- `GET /api/historical/index/:symbol?days=7`

### Normalized Response Fields
Realtime:
- `symbol`
- `price`
- `change`
- `changePercent`
- `volume`
- `high`
- `low`
- `open`
- `refPrice`
- `ceiling`
- `floor`
- `exchange`
- `lastUpdated`

Historical:
- `time`
- `open`
- `high`
- `low`
- `close`
- `volume`

Listing/search:
- `symbol`
- `name`
- `exchange`
- `enName`

### Search and Listing Behavior
- `/api/stocks/search` and `/api/stocks/list` use KBS listing data as the primary source.
- `/api/crypto/search` proxies CoinGecko search results for crypto lookup flows.
- Listing results are cached server-side.
- If listing fetch fails, the backend falls back to the bundled local symbol list in [server/routes.ts](server/routes.ts).

### Constraints
- The current implementation supports `VNSTOCK_SOURCE=KBS`.
- If you want to switch provider later, extend [server/vnstock.ts](server/vnstock.ts).

## Other Data Sources
- Gold: `vang.today`
- USD/VND: Vietcombank XML
- Oil: Yahoo Finance
- Crypto: CoinGecko
- US indices: Yahoo Finance chart endpoints consumed directly in Node
- News: Vietstock RSS

Yahoo Finance note:

- The current code fetches US indices, Brent, and WTI directly from Yahoo Finance JSON endpoints in the Node server.
- The `yfinance` project is a Python wrapper around Yahoo Finance data and is a reasonable backup candidate for research or failover workflows.
- `yfinance` is not enabled in production by default because this project is deployed as a Node app on Firebase App Hosting, and the main production stock flow intentionally avoids Python runtime dependencies.

Notes:

- Gold, oil, crypto, and VN stock market data are refreshed every 3 minutes in the client.
- USD/VND is fetched from Vietcombank once and reused across the app session and server cache window because it is treated as fixed intraday for portfolio conversion.

## Deployment

### Firebase App Hosting
- [apphosting.yaml](apphosting.yaml) uses:
  - `buildCommand: npm run build`
  - `runCommand: npm run start`
- Local `.env` is not used in production.
- Production secrets and env vars must be configured in Firebase App Hosting.
- A new commit on the connected GitHub branch triggers a new rollout.

### Production Note
You do not need Python or `pip install vnstock` on Firebase App Hosting for the current stock-data flow.

### Firestore Rules

After any change to the portfolio document shape, publish [firebase/firestore.rules](firebase/firestore.rules) again.

This is required for fields such as:

- `currency`
- `purchaseLots`
- `dividends`
- `notes`

Deploy command:

```bash
firebase deploy --only firestore:rules
```

## Important Files
- [client/src/lib/firebase.ts](client/src/lib/firebase.ts)
- [client/src/lib/user-data.ts](client/src/lib/user-data.ts)
- [client/src/pages/Dashboard.tsx](client/src/pages/Dashboard.tsx)
- [client/src/pages/PortfolioPage.tsx](client/src/pages/PortfolioPage.tsx)
- [client/src/pages/StocksPage.tsx](client/src/pages/StocksPage.tsx)
- [client/src/pages/WatchlistPage.tsx](client/src/pages/WatchlistPage.tsx)
- [client/src/pages/SettingsPage.tsx](client/src/pages/SettingsPage.tsx)
- [server/index.ts](server/index.ts)
- [server/routes.ts](server/routes.ts)
- [server/vnstock.ts](server/vnstock.ts)
- [apphosting.yaml](apphosting.yaml)
- [firebase/firestore.rules](firebase/firestore.rules)

## Verification
- `npm run check`
- `npm run build`
