# Crynux AS WebUI Architecture

This document describes the technical architecture of the Crynux AS WebUI frontend application. **Read this document before making any code changes.**

## Overview

Crynux AS WebUI is a Vue 3 application that interacts with:

1. **Crynux AS API** — backend REST API for wallet login, accounts, projects, Credits, and LLM configuration
2. **User wallets** — browser extensions and WalletConnect wallets via Reown AppKit and wagmi

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vue Components                            │
│  HomeView │ DashboardLayout │ CreditsView │ ProjectListView │   │
│  ProjectDetailView │ credits/* │ projects/* │ ui/*              │
├─────────────────────────────────────────────────────────────────┤
│     Stores (Pinia)      │         Composables                   │
│  ┌─────────┐ ┌────────┐ │  ┌──────────────────────────────┐     │
│  │ wallet  │ │  auth  │ │  │   use-wallet-connect.js      │     │
│  │  .js    │ │  .js   │ │  └──────────────────────────────┘     │
│  └─────────┘ └────────┘ │                                       │
├─────────────────────────┴───────────────────────────────────────┤
│                         API Layer                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  v1 (Crynux AS API)                                      │   │
│  │  - v1.js       Axios client + Bearer interceptor         │   │
│  │  - auth.js     POST /auth/login                          │   │
│  │  - account.js  Balance, deposits, charges                │   │
│  │  - deposit.js  Deposit networks and tokens               │   │
│  │  - projects.js Project CRUD + API key reset              │   │
│  │  - llm.js      LLM billing config                        │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                      External Services                           │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │   Crynux AS API      │  │  Reown AppKit        │             │
│  │   (REST Backend)     │  │  + wagmi / viem      │             │
│  │                      │  │  + AppKit Pay        │             │
│  └──────────────────────┘  └──────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
src/
├── api/                       # REST API clients
│   ├── api-error.js           # Typed API error classes
│   ├── base-api.js            # Shared API base
│   └── v1/
│       ├── v1.js              # Axios client with auth interceptor
│       ├── auth.js            # Wallet login API
│       ├── account.js         # Balance, deposits, charges
│       ├── deposit.js         # Deposit network and token config
│       ├── projects.js        # Project CRUD + API key reset
│       └── llm.js             # LLM billing config (VRAM tiers)
├── components/
│   ├── layout/
│   │   └── DashboardLayout.vue  # Fixed left sidebar + scrollable main
│   ├── credits/               # Deposit dialog
│   ├── projects/              # Project dialogs (create, reveal key, reset, delete, rename)
│   └── ui/                    # shadcn-vue generated components
├── composables/
│   └── use-wallet-connect.js  # Connect modal → auth → optional redirect
├── lib/
│   ├── appkit.js              # Reown AppKit + WagmiAdapter init
│   ├── credits-ui.js          # Credits page formatting and deposit helpers
│   ├── llm-billing.js         # Credits estimate helpers for UI examples
│   ├── project-url.js         # Private LLM base URL builder
│   ├── project-ui.js          # Project display and error helpers
│   ├── token-ratio.js         # Allowed cost-level (token_ratio) options
│   └── utils.js               # shadcn cn() helper
├── router/
│   └── index.js               # Routes and auth guard
├── stores/
│   ├── auth.js                # JWT session
│   └── wallet.js              # Wallet address synced from wagmi
├── views/
│   ├── HomeView.vue           # Public home + Connect
│   ├── CreditsView.vue        # Balance, deposit, deposits/charges history
│   ├── ProjectListView.vue    # Dashboard project list + create
│   └── ProjectDetailView.vue  # Project detail, edit, reset key, delete
├── assets/
│   └── index.css              # Tailwind + theme CSS variables
├── config.json                # as_url and other app config
├── App.vue
└── main.js
```

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Vue 3.5 |
| Build | Vite 7 |
| Routing | vue-router 5 |
| State | Pinia 4 + pinia-plugin-persistedstate |
| HTTP | axios |
| UI | shadcn-vue + Tailwind CSS v4 + Lucide |
| Wallet | Reown AppKit + `@reown/appkit-adapter-wagmi` + `@wagmi/vue` + viem |
| Deposit payment | Reown AppKit Pay (`@reown/appkit-pay`) |

---

## Layout and Routing

### Layout

- `/` is a full-screen public page with no dashboard sidebar.
- `/dashboard/*` uses `DashboardLayout.vue`: fixed-width left sidebar (no vertical scroll) and a right main area that scrolls independently (`h-screen` flex; main uses `flex-1 min-h-0 overflow-y-auto`).
- Dashboard page content MUST fill the full width of the right main area. `DashboardLayout` wraps `RouterView` in a full-width container with shared horizontal and vertical padding (`px-6 py-8`). Dashboard views MUST NOT center themselves with `mx-auto` or constrain the page to a max-width column.

### Routes

| Path | Name | Auth | Component |
|------|------|------|-----------|
| `/` | `home` | No | `HomeView` |
| `/dashboard` | — | Yes | redirects to `projects` |
| `/dashboard/credits` | `credits` | Yes | `CreditsView` |
| `/dashboard/projects` | `projects` | Yes | `ProjectListView` |
| `/dashboard/projects/:id` | `project-detail` | Yes | `ProjectDetailView` |

`router.beforeEach` checks `meta.requiresAuth`. If the route requires auth and `auth.isAuthenticated` is false, the guard clears session/wallet display state and redirects to `/`.

### Credits view

- `CreditsView` shows the account Credits balance from `GET /v1/account`, a Deposit action, and two history tabs.
- The Deposit dialog loads supported networks and tokens from `GET /v1/deposit/networks`. The user selects network, token, and amount. Estimated Credits MUST use integer arithmetic matching Crynux AS: `credits = floor(raw * credits_per_token / 10^decimals)` where `raw` is the token amount in base units.
- Deposit submission MUST require the connected wagmi address to equal `auth.sessionAddress`. The dialog MUST call AppKit Pay `pay({ recipient, amount, paymentAsset })` with `recipient` equal to the selected network `receiving_address` and `paymentAsset` built from the selected token (`eip155:<chain_id>`, contract address, decimals, symbol).
- AppKit Pay waits for the wallet payment result. The WebUI MUST NOT treat Pay success as Credits credited. Credits crediting remains owned by the Crynux AS deposit scanner. After Pay success the page MUST poll `GET /v1/account` and `GET /v1/account/deposits` for a short interval and surface toast feedback when the balance updates or when the poll window ends.
- The Deposits tab lists `GET /v1/account/deposits`. The Charges tab lists `GET /v1/account/charges`. Both tabs MUST use offset/limit pagination and MUST show empty, loading, and retryable error states.

### Project management views

- `ProjectListView` loads `GET /v1/projects`, creates projects via `POST /v1/projects`, and opens `ApiKeyRevealDialog` when the create response includes a one-time plaintext `api_key`.
- `ProjectDetailView` presents two primary sections: a muted LLM API panel (base URL, API key prefix, reset key; rename/delete via overflow menu) and a Cost and speed panel. The cost panel uses a cost-level slider (API field `token_ratio`) that saves after 3 seconds without further changes via `PUT /v1/projects/:id`, explains Credits charging from input/output tokens and VRAM tier, and shows a Credits-per-1M-tokens pricing table by VRAM tier using `GET /v1/llm/billing_config` (unit prices and VRAM tiers). Cost-level save feedback uses a single replaceable toast. The page leaves space below for future usage stats charts.
- Project data is page state loaded through `projectsAPI`. There is no Pinia project store.
- Plaintext API keys MUST NOT be persisted in local storage or route state after the reveal dialog closes.

---

## Stores

### `wallet.js` — Wallet Store

Manages the connected wallet address synced from wagmi / AppKit.

| State | Description |
|-------|-------------|
| `address` | Checksummed wallet address |
| `isConnected` | Whether an address is present |

| Action | Description |
|--------|-------------|
| `syncFromWagmi()` | Read account from wagmi; clear auth if address missing or mismatched with session |
| `startWatching()` | Subscribe to wagmi account changes |
| `disconnectWallet()` | Disconnect via wagmi, clear auth and wallet state |
| `shortAddress()` | Short display form of the address |

Persisted fields: `address`, `isConnected`.

### `auth.js` — Auth Store

Manages Crynux AS JWT session.

| State | Description |
|-------|-------------|
| `sessionToken` | JWT from `POST /v1/auth/login` |
| `sessionExpiresAt` | Unix expiry |
| `sessionAddress` | Authenticated wallet address |

| Getter | Description |
|--------|-------------|
| `isAuthenticated` | Valid token exists and is not expired |
| `isAuthenticating` | Login flow in progress |

| Action | Description |
|--------|-------------|
| `authenticate()` | Sign login message → call AS login → `setSession` |
| `setSession` / `clearSession` | Session mutations |

Session is persisted (`persist: true`).

### Connected vs Authenticated

- **Connected**: wagmi/AppKit has a wallet address.
- **Authenticated**: wallet ownership proven by signature and exchanged for a JWT.

The Connect entry point (`useWalletConnect().connect`) always runs the full flow: open AppKit if needed, then `auth.authenticate()`. Components that gate dashboard access MUST use `auth.isAuthenticated`.

If `authenticate()` returns `auth_failed` (including when the user cancels the signature prompt), `connect` MUST call `wallet.disconnectWallet()` so the next Connect opens AppKit from the wallet selection step instead of reusing the previous connection.

If the wallet address changes and no longer matches `sessionAddress`, `wallet.syncFromWagmi()` clears the session.

---

## Authentication

### Login message

The wallet signs this exact personal-sign message (must match Crynux AS backend):

```text
Crynux AS
Action: Login
Address: <checksummed address>
Timestamp: <unix seconds>
```

### Connect flow

```
User clicks Connect
        │
        ▼
useWalletConnect().connect(redirect?)
        │
        ├── require VITE_REOWN_PROJECT_ID
        ├── if not connected: AppKit open({ view: 'Connect' })
        ├── wait until wagmi account is connected
        ├── wallet.syncFromWagmi()
        ▼
auth.authenticate()
        │
        ├── signMessage(login message) via wagmi
        ├── on auth_failed (incl. signature cancel):
        │     wallet.disconnectWallet() → stop
        ├── authAPI.login({ address, timestamp, signature })
        │     POST /v1/auth/login
        ├── setSession(token, expires_at, address)
        ▼
optional router.push(redirect)   e.g. { name: 'projects' }
```

### Sign out

`DashboardLayout` calls `wallet.disconnectWallet()`, which disconnects wagmi and clears the auth session, then navigates to `home`.

---

## API Layer

### Client (`api/v1/v1.js`)

- Base URL: `config.json` → `as_url` + `/v1`
- Request interceptor injects `Authorization: Bearer <sessionToken>` when authenticated
- Successful responses resolve to `response.data.data`
- HTTP 401 clears session/wallet state and navigates to `/` via `apiUnauthorizedErrorHandler` set in `main.js`

### Endpoints used

| API module | Method | Path | Auth |
|------------|--------|------|------|
| `auth.js` | `login` | `POST /auth/login` | No |
| `account.js` | `getBalance` | `GET /account` | Yes |
| `account.js` | `listDeposits` | `GET /account/deposits` | Yes |
| `account.js` | `listCharges` | `GET /account/charges` | Yes |
| `deposit.js` | `listNetworks` | `GET /deposit/networks` | Yes |
| `projects.js` | `list` | `GET /projects` | Yes |
| `projects.js` | `create` | `POST /projects` | Yes |
| `projects.js` | `get` | `GET /projects/:id` | Yes |
| `projects.js` | `update` | `PUT /projects/:id` | Yes |
| `projects.js` | `remove` | `DELETE /projects/:id` | Yes |
| `projects.js` | `resetApiKey` | `POST /projects/:id/api_key/reset` | Yes |
| `llm.js` | `getBillingConfig` | `GET /llm/billing_config` | Yes |

Further account APIs MUST follow the same `V1Client` + module class pattern.

### Configuration

| Source | Purpose |
|--------|---------|
| `src/config.json` → `as_url` | Crynux AS HTTP base URL (bundled with the app) |
| `VITE_REOWN_PROJECT_ID` | Reown Cloud project ID; embedded at build time from `.env` / CI |

`.env` is not copied into `dist/`. Vite replaces `import.meta.env.VITE_*` at build time.

---

## Wallet integration (`lib/appkit.js`)

- `WagmiAdapter` + `createAppKit` are initialized once in `main.js` via `initAppKit()`.
- AppKit networks currently include Ethereum mainnet and Base (for wallet UX / WalletConnect). Login itself is chain-agnostic personal sign against Crynux AS.
- `wagmiConfig` is shared with `WagmiPlugin` and store/composable actions (`getAccount`, `signMessage`, `disconnect`, `watchAccount`).
- Credits deposits MUST use AppKit Pay from `@reown/appkit-pay`. The Reown Dashboard Payments feature MUST be enabled for `VITE_REOWN_PROJECT_ID`. Local AppKit Pay testing MUST use `http://localhost:3000` (`npm run dev` binds Vite to port 3000).
- AppKit Pay success confirms the on-chain payment flow result only. The WebUI MUST NOT credit the local balance from the Pay result; Crynux AS deposit scanning remains the authority for Credits.
- AppKit swaps and onramp remain available in the AppKit modal for funding the user wallet. They MUST NOT be used as the deposit-to-platform path.

---

## Error Handling

- API failures map to `ApiError` types in `api/api-error.js`.
- Connect/auth failures return `{ success: false, reason }` from `useWalletConnect` / `authenticate`; `HomeView` shows user-facing messages for known reasons.
- Project list/detail and project dialogs map `ApiError` to user-facing messages via `lib/project-ui.js` (`projectErrorMessage`) and offer retry where loading failed.
- Credits balance, deposit, deposits, and charges map `ApiError` to user-facing messages via `lib/credits-ui.js` (`creditsErrorMessage`) and offer retry where loading failed.
- Transient success and failure feedback (for example saving cost level) MUST use toast notifications via `vue-sonner` (`Toaster` in `App.vue`) instead of inline page text.
- Unexpected API 500/unknown errors are logged via handlers registered in `main.js`.
- Do not silently swallow errors. User-impacting failures MUST surface clear feedback; otherwise log structured context and propagate.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `lib/appkit.js` | Reown AppKit + wagmi config |
| `lib/credits-ui.js` | Credits formatting, deposit estimate, paymentAsset builder |
| `lib/project-url.js` | Build private LLM base URL from `endpoint_token` |
| `lib/token-ratio.js` | Allowed `token_ratio` display values |
| `stores/wallet.js` | Wallet address sync and disconnect |
| `stores/auth.js` | JWT session and `authenticate()` |
| `composables/use-wallet-connect.js` | Connect + login + redirect |
| `api/v1/v1.js` | Axios client and auth header |
| `api/v1/auth.js` | Login API |
| `api/v1/account.js` | Balance, deposits, charges |
| `api/v1/deposit.js` | Deposit networks config |
| `api/v1/projects.js` | Project management API |
| `router/index.js` | Routes and `requiresAuth` guard |
| `components/layout/DashboardLayout.vue` | Dashboard shell |
| `components/credits/*` | Deposit dialog |
| `components/projects/*` | Create, API key reveal, reset, rename, and delete dialogs |
| `components/ui/sonner` | Global toast notifications via `vue-sonner` |
| `views/CreditsView.vue` | Balance, deposit, deposits and charges history |
| `views/ProjectListView.vue` | Project list and create flow |
| `views/ProjectDetailView.vue` | Project detail, edit, reset key, delete |
| `config.json` | `as_url` |
| `main.js` | App bootstrap, plugins, unauthorized handler |
| `App.vue` | Root router outlet and toast `Toaster` |
