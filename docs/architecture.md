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
│  ProjectDetailView │ home/* │ credits/* │ projects/* │ ui/*     │
│  ConnectWalletDialog │ referral API / helpers                     │
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
│  │  - referral.js Referral settings and rewards             │   │
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
│   ├── project-private.js     # Project private LLM/Raw Task client (JWT)
│   └── v1/
│       ├── v1.js              # Axios client with auth interceptor
│       ├── auth.js            # Wallet login API
│       ├── account.js         # Balance, purchases, charges
│       ├── referral.js        # Referral settings and rewards
│       ├── purchase.js        # Purchase network and token config
│       ├── projects.js        # Project CRUD + API key reset
│       └── llm.js             # LLM billing_config and pricing_examples
├── components/
│   ├── layout/
│   │   └── DashboardLayout.vue  # Fixed left sidebar + scrollable main
│   ├── home/                  # Public marketing homepage sections + ConnectWalletDialog
│   ├── theme/
│   │   └── ThemeToggle.vue    # Light/dark mode toggle
│   ├── credits/               # Purchase dialog
│   ├── projects/              # Project dialogs and Playground
│   └── ui/                    # shadcn-vue generated components
├── composables/
│   └── use-wallet-connect.js  # AppKit connect → auth → optional redirect
├── content/
│   └── home.js                # Public homepage copy, links, and code samples
├── lib/
│   ├── appkit.js              # Reown AppKit + WagmiAdapter init
│   ├── theme.js               # Light/dark theme resolve, persist, and apply
│   ├── credits-ui.js          # Credits page formatting and purchase helpers
│   ├── referral.js            # Invite code storage and referral display helpers
│   ├── llm-billing.js         # Cost Level Gwei helpers and Credits/time examples
│   ├── project-url.js         # Private LLM base URL builder
│   ├── project-ui.js          # Project display and error helpers
│   ├── token-ratio.js         # Legacy homepage-only helper; not used by project Cost Level
│   └── utils.js               # shadcn cn() helper
├── router/
│   └── index.js               # Routes and auth guard
├── stores/
│   ├── auth.js                # JWT session
│   └── wallet.js              # Wallet address synced from wagmi
├── views/
│   ├── HomeView.vue           # Public marketing home + Connect
│   ├── CreditsView.vue        # Balance, referral link, purchases, usage, referrals
│   ├── ProjectListView.vue    # Dashboard project list + create
│   └── ProjectDetailView.vue  # Project detail, usage charts, recent requests
├── assets/
│   ├── index.css              # Tailwind + theme CSS variables
│   └── home.css               # Homepage reveal, logo assemble, fancy text
├── config.example.json        # committed template for local config.json
├── config.json                # local as_url / networks (gitignored)
├── App.vue
└── main.js
```

Public homepage static assets live under `public/home/` (brand SVG and integration logos).

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

- `/` is a full-screen public marketing page with no dashboard sidebar. `HomeView` owns a dedicated `h-full overflow-y-auto` scroll container so the homepage can scroll while `html`/`body`/`#app` remain `overflow-hidden` for the dashboard shell.
- The public homepage is assembled from `components/home/*` sections and static copy in `content/home.js`. Header, Hero, and CTA actions call `useWalletConnect()` when the user is not authenticated, and navigate to Projects when authenticated.
- Light and dark mode are shared across the homepage and dashboard. `lib/theme.js` resolves the theme from `localStorage` key `crynux-as-theme` or the system preference, applies the root `.dark` class, and is initialized before Vue mount in `index.html` and `main.js`. `ThemeToggle` appears in the homepage header and the dashboard sidebar.
- `/dashboard/*` uses `DashboardLayout.vue`: fixed-width left sidebar (no vertical scroll) and a right main area that scrolls independently (`h-full` flex on a viewport-sized `html`/`body`/`#app` with `overflow-hidden`; main uses `flex-1 min-h-0 overflow-y-auto`). The document root MUST NOT scroll; only the main content area scrolls.
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

- `CreditsView` shows the account Credits balance from `GET /v1/account`, a Purchase action, a Referral link block, and three history tabs.
- The balance card MUST show the active referral link built as `{origin}/?ref=<invite_code>` from `GET /v1/account/referral`, with Copy and Reset invite code actions. Below the link it MUST show one short sentence for the current referral reward rules from that same response (`invitee_bonus`, `deposit_reward_ratio`). When `purchase_bonus_tiers` are configured, that sentence MUST include a View details / Hide details control that toggles a compact collapsed-by-default table of after-purchases and extra-reward columns. Reset MUST open a confirmation dialog that does not close on outside click and has no Cancel button; confirming MUST call `POST /v1/account/referral/code/reset`.
- The Purchase dialog loads supported networks and tokens from `GET /v1/purchase/networks`. The user selects network, token, and amount. Estimated Credits MUST use integer arithmetic matching Crynux AS: `credits = floor(raw * credits_per_token / 10^decimals)` where `raw` is the token amount in base units.
- Purchase submission MUST require the connected wagmi address to equal `auth.sessionAddress`. The dialog MUST switch the wallet to the selected network `chain_id` when needed, then call wagmi `writeContract` for ERC20 `transfer(receiving_address, raw_amount)` on the selected token contract. `raw_amount` MUST be `amount * 10^decimals` using integer arithmetic. While the wallet confirmation is open, the dialog MUST replace the purchase form with a confirm-transfer view that shows only the pay amount, received Credits, the Crynux AS deposit address from the selected network `receiving_address`, and a cross-check link from `config.json` → `discord_url`. The dialog MUST wait for the transaction receipt before treating the payment as submitted.
- The WebUI MUST NOT treat a successful transfer as Credits credited. Credits crediting remains owned by the Crynux AS ledger scanner. After the purchase dialog receives the transaction receipt, it MUST close and the Credits page MUST reload `GET /v1/account` and `GET /v1/account/purchases` once. The Credits page MUST NOT poll for balance or purchase list updates.
- The Purchases tab lists `GET /v1/account/purchases`. The response field MUST be `purchases`. Each row MUST include `type` of `purchase`, `signup_bonus`, or `invitee_bonus`. Bonus rows MUST show `—` for Paid, Token, Network, and Tx. The Usage tab lists `GET /v1/account/charges`. Charges columns MUST include Model (with quantization and component repos when present), VRAM, and one Usage column: Chat rows show input/output tokens; Image rows show `W×H` and steps. The Referrals tab lists `GET /v1/account/referral/rewards` with columns in this order: Credits earned, Purchases, Extra %, Extra Credits, Invitee, Time. Extra % MUST show the stored summed `extra_ratio` as a percent, or `—` when zero. Extra Credits MUST show `extra_amount`, or `—` when zero. Purchases MUST show `prior_purchase_count/next_tier_min_purchases` using configured `purchase_bonus_tiers`, or only `prior_purchase_count` when there is no higher tier. All three tabs MUST use offset/limit pagination and MUST show empty and loading states; load failures MUST use toast notifications.
- User-facing copy MUST use Purchase terminology. The WebUI MUST NOT present this flow as a deposit.

### Project management views

Project list, project detail, Cost Level, Playground, usage, and recent-requests behavior MUST follow [project-management.md](./project-management.md).

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
| `authenticate({ inviteCode })` | Sign login message → call AS login with optional `invite_code` → `setSession` |
| `setSession` / `clearSession` | Session mutations |

Session is persisted (`persist: true`).

### Connected vs Authenticated

- **Connected**: wagmi/AppKit has a wallet address.
- **Authenticated**: wallet ownership proven by signature and exchanged for a JWT.

The Connect entry point on the homepage MUST open `ConnectWalletDialog` before AppKit. That dialog MUST NOT close on outside click. It has two steps:

1. `connect`: short connect hint, prominent safety line that Crynux AS will not ask for a transfer, token approval, or other on-chain permission, and a de-emphasized optional invite code field that MUST NOT take initial focus. Primary action: Connect. Then `ensureWalletConnected()` opens AppKit if needed.
2. `sign`: after the wallet is connected, the same dialog reopens with sign-step copy only (no Sign button) and immediately starts `signIn()` / `auth.authenticate({ inviteCode })`. Closing the dialog on the sign step without completing login MUST disconnect the wallet.

The WebUI MUST NOT use a toast for the connect or sign safety notices. Components that gate dashboard access MUST use `auth.isAuthenticated`.

Deep links of the form `/?ref=<code>` MUST store the code in `sessionStorage` and MUST open `ConnectWalletDialog` with the invite code prefilled when the visitor is not authenticated.

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
User clicks Connect, or opens /?ref=<code>
        │
        ▼
ConnectWalletDialog step=connect (optional invite code)
        │
        ▼
ensureWalletConnected()
        │
        ├── require VITE_REOWN_PROJECT_ID
        ├── if not connected: AppKit open({ view: 'Connect' })
        ├── wait until wagmi account is connected
        ├── wallet.syncFromWagmi()
        ▼
ConnectWalletDialog step=sign (notice only; no Sign button)
        │
        ▼
signIn(redirect?, { inviteCode }) starts immediately
        │
        ├── signMessage(login message) via wagmi
        ├── on auth_failed (incl. signature cancel):
        │     wallet.disconnectWallet() → stop
        ├── authAPI.login({ address, timestamp, signature, invite_code? })
        │     POST /v1/auth/login
        ├── setSession(token, expires_at, address)
        ├── clear stored invite code
        ▼
optional router.push(redirect)   e.g. { name: 'projects' }
```

### Sign out

`DashboardLayout` MUST open a confirmation dialog before signing out. That dialog MUST NOT close on outside click and MUST NOT include a Cancel button. Confirming MUST call `wallet.disconnectWallet()`, which disconnects wagmi and clears the auth session, then navigate to `home`.

---

## API Layer

### Client (`api/v1/v1.js`)

- Base URL: `config.json` → `as_url` + `/v1`
- Request interceptor injects `Authorization: Bearer <sessionToken>` when authenticated
- Successful responses resolve to `response.data.data`
- HTTP 401 clears session/wallet state and navigates to `/` via `apiUnauthorizedErrorHandler` set in `main.js`

### Project private client (`api/project-private.js`)

- Base URL: `config.json` → `as_url` + `/api/<endpoint_token>/v1`
- Uses the same JWT session token as `V1Client`
- Calls OpenAI-compatible and Raw Task private endpoints for the project Playground
- OpenAI-shaped responses MUST be returned as the HTTP JSON body; Raw Task create/status responses MUST use the management `data` field; image downloads MUST return PNG blobs

### Endpoints used

| API module | Method | Path | Auth |
|------------|--------|------|------|
| `auth.js` | `login` | `POST /auth/login` | No |
| `account.js` | `getBalance` | `GET /account` | Yes |
| `account.js` | `getStats` | `GET /account/stats` | Yes |
| `account.js` | `listPurchases` | `GET /account/purchases` | Yes |
| `account.js` | `listCharges` | `GET /account/charges` | Yes |
| `referral.js` | `getReferral` | `GET /account/referral` | Yes |
| `referral.js` | `resetInviteCode` | `POST /account/referral/code/reset` | Yes |
| `referral.js` | `listRewards` | `GET /account/referral/rewards` | Yes |
| `purchase.js` | `listNetworks` | `GET /purchase/networks` | Yes |
| `projects.js` | `list` | `GET /projects` | Yes |
| `projects.js` | `create` | `POST /projects` | Yes |
| `projects.js` | `get` | `GET /projects/:id` | Yes |
| `projects.js` | `update` | `PUT /projects/:id` | Yes |
| `projects.js` | `remove` | `DELETE /projects/:id` | Yes |
| `projects.js` | `resetApiKey` | `POST /projects/:id/api_key/reset` | Yes |
| `llm.js` | `getBillingConfig` | `GET /llm/billing_config` | Yes |
| `llm.js` | `getPricingExamples` | `GET /llm/pricing_examples` | Yes |
| `project-private.js` | `listModels` | `GET /api/<endpoint_token>/v1/models` | JWT |
| `project-private.js` | `listImageModels` | `GET /api/<endpoint_token>/v1/models/image` | JWT |
| `project-private.js` | `chatCompletions` | `POST /api/<endpoint_token>/v1/chat/completions` | JWT |
| `project-private.js` | `createInferenceTask` | `POST /api/<endpoint_token>/v1/inference_tasks` | JWT |
| `project-private.js` | `getInferenceTask` | `GET /api/<endpoint_token>/v1/inference_tasks/:id` | JWT |
| `project-private.js` | `getImageBlob` | `GET /api/<endpoint_token>/v1/inference_tasks/:id/images/:index` | JWT |

Further account APIs MUST follow the same `V1Client` + module class pattern.

### Configuration

| Source | Purpose |
|--------|---------|
| `src/config.example.json` | Committed template. Local setups MUST copy it to `src/config.json` before running the app. |
| `src/config.json` → `as_url` | Crynux AS HTTP base URL (bundled with the app). `src/config.json` MUST NOT be committed. |
| `src/config.json` → `discord_url` | Public Crynux Discord invite URL. The Purchase dialog MUST use this value for deposit-address cross-check links. |
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
| `lib/theme.js` | Light/dark theme resolve, persist, and apply |
| `lib/credits-ui.js` | Credits formatting, purchase estimate, transfer helpers |
| `lib/project-url.js` | Build private LLM base URL from `endpoint_token` |
| `lib/token-ratio.js` | Legacy homepage-only helper; not used by project Cost Level |
| `lib/llm-billing.js` | Cost Level Gwei helpers and Credits/execution-time example math |
| `api/v1/llm.js` | `billing_config` and `pricing_examples` clients |
| `stores/wallet.js` | Wallet address sync and disconnect |
| `stores/auth.js` | JWT session and `authenticate()` |
| `composables/use-wallet-connect.js` | Connect + login + redirect |
| `api/v1/v1.js` | Axios client and auth header |
| `api/project-private.js` | Project private LLM/Raw Task client for Playground |
| `api/v1/auth.js` | Login API |
| `api/v1/account.js` | Balance, account usage stats, purchases, charges |
| `api/v1/purchase.js` | Purchase networks config |
| `api/v1/projects.js` | Project management, stats, and recent requests API |
| `router/index.js` | Routes and `requiresAuth` guard |
| `components/layout/DashboardLayout.vue` | Dashboard shell |
| `components/credits/*` | Purchase dialog |
| `components/projects/*` | Create, API key reveal, reset, rename, delete dialogs, and Playground |
| `components/ui/sonner` | Global toast notifications via `vue-sonner` |
| `views/HomeView.vue` | Public marketing homepage and wallet connect entry |
| `components/home/*` | Homepage header, hero, services, interactive Cost Level pricing example, integrations, highlights, use cases, CTA, footer |
| `content/home.js` | Homepage copy, links, and code samples |
| `components/theme/ThemeToggle.vue` | Light/dark mode toggle |
| `views/CreditsView.vue` | Balance, referral link, purchases, usage, and referrals history |
| `components/home/ConnectWalletDialog.vue` | Pre-AppKit invite code dialog |
| `api/v1/referral.js` | Referral settings and rewards API |
| `lib/referral.js` | Invite code storage and referral display helpers |
| `views/ProjectListView.vue` | Project list and create flow |
| `components/projects/ProjectListItem.vue` | Project list card; Failed day count uses red when `elevated_recent_failure_rate` is true, otherwise muted gray |
| `components/stats/AccountUsageStats.vue` | Account usage summary cards (Requests, Input tokens, Output tokens, Images, Credits used, Success rate) and Requests/Credits charts from `GET /v1/account/stats` |
| `views/ProjectDetailView.vue` | Project detail, Cost Level, Playground, Usage charts, Recent Requests, reset key, delete |
| `components/projects/ProjectPlaygroundSection.vue` | Collapsible Playground shell with Chat and Image tabs |
| `components/projects/playground/*` | Chat and Image generation Playground panels |
| `components/stats/ProjectUsageSection.vue` | Project usage charts and Top Models table; Tokens & Images chart uses dual Y-axes |
| `components/stats/UsageLineChart.vue` | SVG line chart; optional per-series `yAxis` of `left` or `right` for dual-axis plots, with optional outer `leftAxisLabel` / `rightAxisLabel` titles |
| `components/stats/ProjectRecentRequestsSection.vue` | Project recent in-progress and finished request list |
| `components/stats/UsageWorkloadCell.vue` | Compact Chat token or Image workload / image-count cell |
| `components/stats/UsageModelCell.vue` | Model id with quantization label and component repos |
| `config.example.json` | Committed template for `config.json` |
| `config.json` | Local `as_url`, `discord_url`, `networks` (gitignored) |
| `main.js` | App bootstrap, plugins, unauthorized handler |
| `App.vue` | Root router outlet and toast `Toaster` |
