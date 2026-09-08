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
│  │  - account.js  Balance, purchases, charges               │   │
│  │  - purchase.js Purchase networks and tokens              │   │
│  │  - projects.js Project CRUD + API key reset              │   │
│  │  - llm.js      LLM billing_config and pricing_examples   │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                      External Services                           │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │   Crynux AS API      │  │  Reown AppKit        │             │
│  │   (REST Backend)     │  │  + wagmi / viem      │             │
│  │                      │  │                      │             │
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
│       ├── account.js         # Balance, purchases, charges
│       ├── purchase.js        # Purchase network and token config
│       ├── projects.js        # Project CRUD + API key reset
│       └── llm.js             # LLM billing_config and pricing_examples
├── components/
│   ├── layout/
│   │   └── DashboardLayout.vue  # Fixed left sidebar + scrollable main
│   ├── credits/               # Purchase dialog
│   ├── projects/              # Project dialogs (create, reveal key, reset, delete, rename)
│   └── ui/                    # shadcn-vue generated components
├── composables/
│   └── use-wallet-connect.js  # Connect modal → auth → optional redirect
├── lib/
│   ├── appkit.js              # Reown AppKit + WagmiAdapter init
│   ├── credits-ui.js          # Credits page formatting and purchase helpers
│   ├── llm-billing.js         # Credits and execution-time example helpers
│   ├── project-url.js         # Private LLM base URL builder
│   ├── project-ui.js          # Project display and error helpers
│   ├── token-ratio.js         # Cost-level options builder from max_token_ratio
│   └── utils.js               # shadcn cn() helper
├── router/
│   └── index.js               # Routes and auth guard
├── stores/
│   ├── auth.js                # JWT session
│   └── wallet.js              # Wallet address synced from wagmi
├── views/
│   ├── HomeView.vue           # Public home + Connect
│   ├── CreditsView.vue        # Balance, purchase, purchases/usage history
│   ├── ProjectListView.vue    # Dashboard project list + create
│   └── ProjectDetailView.vue  # Project detail, edit, reset key, delete
├── assets/
│   └── index.css              # Tailwind + theme CSS variables
├── config.example.json        # committed template for local config.json
├── config.json                # local as_url / networks (gitignored)
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
| Credits purchase | Direct ERC20 `transfer` via wagmi `writeContract` |

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

- `CreditsView` shows the account Credits balance from `GET /v1/account`, a Purchase action, and two history tabs.
- The Purchase dialog loads supported networks and tokens from `GET /v1/purchase/networks`. The user selects network, token, and amount. Estimated Credits MUST use integer arithmetic matching Crynux AS: `credits = floor(raw * credits_per_token / 10^decimals)` where `raw` is the token amount in base units.
- Purchase submission MUST require the connected wagmi address to equal `auth.sessionAddress`. The dialog MUST switch the wallet to the selected network `chain_id` when needed, then call wagmi `writeContract` for ERC20 `transfer(receiving_address, raw_amount)` on the selected token contract. `raw_amount` MUST be `amount * 10^decimals` using integer arithmetic. The dialog MUST wait for the transaction receipt before treating the payment as submitted.
- The WebUI MUST NOT treat a successful transfer as Credits credited. Credits crediting remains owned by the Crynux AS ledger scanner. After transfer success the page MUST poll `GET /v1/account` and `GET /v1/account/purchases` for a short interval and surface toast feedback when the balance updates or when the poll window ends.
- The Purchases tab lists `GET /v1/account/purchases`. The response field MUST be `purchases`. The Usage tab lists `GET /v1/account/charges`. Both tabs MUST use offset/limit pagination and MUST show empty, loading, and retryable error states.
- User-facing copy MUST use Purchase terminology. The WebUI MUST NOT present this flow as a deposit.

### Project management views

- `ProjectListView` loads `GET /v1/projects`, creates projects via `POST /v1/projects`, and opens `ApiKeyRevealDialog` when the create response includes a one-time plaintext `api_key`.
- `ProjectDetailView` presents two primary sections: a muted LLM API panel (base URL, API key prefix, reset key; rename/delete via overflow menu) and a Cost Level panel. The cost panel uses a cost-level slider (API field `token_ratio`) that saves after 3 seconds without further changes via `PUT /v1/projects/:id`. The slider options MUST be `0.1` through `1.0` step `0.1`, then `2` through `max_token_ratio` step `1`, using `max_token_ratio` from `GET /v1/llm/billing_config`. When `GET /v1/llm/billing_config` provides live queue bounds, a separate range bar under the cost level slider MUST show Min and Max markers for `lowest_priority_gwei / reference_priority_gwei` and `highest_priority_gwei / reference_priority_gwei`, snapped to allowed cost levels and clamped to the bar ends. The blue segment MUST stay strictly between the Min and Max markers; segments outside that interval MUST be red when at least one bound falls inside the allowed cost level range. When both bounds fall outside on the same side, the entire bar MUST be red. The panel MUST show two example tables built from `GET /v1/llm/pricing_examples` plus `billing_config`: a `Credits per 1M tokens` table with `Model`, `1M Input`, and `1M Output` columns for separate 1M-token unit prices without `constant_seconds`, scaled by cost level; and an execution-time table with `Model`, `Input`, `Output`, and `Seconds` for a typical call of `time_prompt_tokens=512` input and `time_completion_tokens=2048` output, including `constant_seconds`, not scaled by cost level. Cost-level save feedback uses a single replaceable toast. The page leaves space below for future usage stats charts.
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
| `account.js` | `listPurchases` | `GET /account/purchases` | Yes |
| `account.js` | `listCharges` | `GET /account/charges` | Yes |
| `purchase.js` | `listNetworks` | `GET /purchase/networks` | Yes |
| `projects.js` | `list` | `GET /projects` | Yes |
| `projects.js` | `create` | `POST /projects` | Yes |
| `projects.js` | `get` | `GET /projects/:id` | Yes |
| `projects.js` | `update` | `PUT /projects/:id` | Yes |
| `projects.js` | `remove` | `DELETE /projects/:id` | Yes |
| `projects.js` | `resetApiKey` | `POST /projects/:id/api_key/reset` | Yes |
| `llm.js` | `getBillingConfig` | `GET /llm/billing_config` | Yes |
| `llm.js` | `getPricingExamples` | `GET /llm/pricing_examples` | Yes |

Further account APIs MUST follow the same `V1Client` + module class pattern.

### Configuration

| Source | Purpose |
|--------|---------|
| `src/config.example.json` | Committed template. Local setups MUST copy it to `src/config.json` before running the app. |
| `src/config.json` → `as_url` | Crynux AS HTTP base URL (bundled with the app). `src/config.json` MUST NOT be committed. |
| `src/config.json` → `networks` | AppKit/wagmi EVM networks. Each entry MUST include `id`. Optional `rpc_urls` overrides the AppKit preset RPC list. Optional `tx_explorer` (`…/tx`) overrides the AppKit preset block explorer for purchase Tx links; when omitted, the WebUI uses `{blockExplorers.default.url}/tx` from the AppKit preset. If the chain id is not an AppKit preset, the entry MUST also include `name`, `native_currency`, and `rpc_urls`. |
| `VITE_REOWN_PROJECT_ID` | Reown Cloud project ID; embedded at build time from `.env` / CI |

`.env` is not copied into `dist/`. Vite replaces `import.meta.env.VITE_*` at build time.

---

## Wallet integration (`lib/appkit.js`)

- `WagmiAdapter` + `createAppKit` are initialized once in `main.js` via `initAppKit()`.
- AppKit and wagmi networks MUST be selected from `config.json` → `networks` by chain `id`. For AppKit-known chain ids, the WebUI MUST use the matching `@reown/appkit/networks` preset, including that preset’s default RPC URLs and block explorer, unless `rpc_urls` or `tx_explorer` is set in config. The WebUI MUST NOT hardcode a fixed chain list such as `mainnet`, `base`, or `baseSepolia` in application code. Login itself is chain-agnostic personal sign against Crynux AS.
- `wagmiConfig` is shared with `WagmiPlugin` and store/composable actions (`getAccount`, `signMessage`, `disconnect`, `watchAccount`).
- Credits purchases MUST use a direct ERC20 `transfer` through wagmi (`switchChain` when needed, then `writeContract`, then `waitForTransactionReceipt`). The WebUI MUST NOT open AppKit Pay or any multi-asset payment chooser for purchases.
- A successful transfer confirms only that the on-chain ERC20 payment was submitted. The WebUI MUST NOT credit the local balance from the transfer result; Crynux AS ledger scanning remains the authority for Credits.
- AppKit swaps and onramp remain available in the AppKit modal for funding the user wallet. They MUST NOT be used as the Credits purchase path.

---

## Error Handling

- API failures map to `ApiError` types in `api/api-error.js`.
- Connect/auth failures return `{ success: false, reason }` from `useWalletConnect` / `authenticate`; `HomeView` shows user-facing messages for known reasons.
- Project list/detail and project dialogs map `ApiError` to user-facing messages via `lib/project-ui.js` (`projectErrorMessage`) and offer retry where loading failed.
- Credits balance, purchases, and usage map `ApiError` to user-facing messages via `lib/credits-ui.js` (`creditsErrorMessage`) and offer retry where loading failed.
- Transient success and failure feedback (for example saving cost level) MUST use toast notifications via `vue-sonner` (`Toaster` in `App.vue`) instead of inline page text.
- Unexpected API 500/unknown errors are logged via handlers registered in `main.js`.
- Do not silently swallow errors. User-impacting failures MUST surface clear feedback; otherwise log structured context and propagate.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `lib/appkit.js` | Reown AppKit + wagmi config |
| `lib/credits-ui.js` | Credits formatting, purchase estimate, transfer helpers |
| `lib/project-url.js` | Build private LLM base URL from `endpoint_token` |
| `lib/token-ratio.js` | Builds allowed `token_ratio` display values from `max_token_ratio` |
| `lib/llm-billing.js` | Credits and execution-time example math for Cost Level UI |
| `api/v1/llm.js` | `billing_config` and `pricing_examples` clients |
| `stores/wallet.js` | Wallet address sync and disconnect |
| `stores/auth.js` | JWT session and `authenticate()` |
| `composables/use-wallet-connect.js` | Connect + login + redirect |
| `api/v1/v1.js` | Axios client and auth header |
| `api/v1/auth.js` | Login API |
| `api/v1/account.js` | Balance, purchases, charges |
| `api/v1/purchase.js` | Purchase networks config |
| `api/v1/projects.js` | Project management API |
| `router/index.js` | Routes and `requiresAuth` guard |
| `components/layout/DashboardLayout.vue` | Dashboard shell |
| `components/credits/*` | Purchase dialog |
| `components/projects/*` | Create, API key reveal, reset, rename, and delete dialogs |
| `components/ui/sonner` | Global toast notifications via `vue-sonner` |
| `views/CreditsView.vue` | Balance, purchase, purchases and usage history |
| `views/ProjectListView.vue` | Project list and create flow |
| `views/ProjectDetailView.vue` | Project detail, Cost Level examples, queue position, reset key, delete |
| `config.example.json` | Committed template for `config.json` |
| `config.json` | Local `as_url`, `networks` (gitignored) |
| `main.js` | App bootstrap, plugins, unauthorized handler |
| `App.vue` | Root router outlet and toast `Toaster` |
