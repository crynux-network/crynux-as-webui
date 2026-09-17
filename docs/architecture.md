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
│   ├── home/                  # Public marketing homepage sections
│   ├── theme/
│   │   └── ThemeToggle.vue    # Light/dark mode toggle
│   ├── credits/               # Purchase dialog
│   ├── projects/              # Project dialogs (create, reveal key, reset, delete, rename)
│   └── ui/                    # shadcn-vue generated components
├── composables/
│   └── use-wallet-connect.js  # Connect modal → auth → optional redirect
├── content/
│   └── home.js                # Public homepage copy, links, and code samples
├── lib/
│   ├── appkit.js              # Reown AppKit + WagmiAdapter init
│   ├── theme.js               # Light/dark theme resolve, persist, and apply
│   ├── credits-ui.js          # Credits page formatting and purchase helpers
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
│   ├── CreditsView.vue        # Balance, purchase, purchases/usage history
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

- `CreditsView` shows the account Credits balance from `GET /v1/account`, a Purchase action, and two history tabs.
- The Purchase dialog loads supported networks and tokens from `GET /v1/purchase/networks`. The user selects network, token, and amount. Estimated Credits MUST use integer arithmetic matching Crynux AS: `credits = floor(raw * credits_per_token / 10^decimals)` where `raw` is the token amount in base units.
- Purchase submission MUST require the connected wagmi address to equal `auth.sessionAddress`. The dialog MUST switch the wallet to the selected network `chain_id` when needed, then call wagmi `writeContract` for ERC20 `transfer(receiving_address, raw_amount)` on the selected token contract. `raw_amount` MUST be `amount * 10^decimals` using integer arithmetic. The dialog MUST wait for the transaction receipt before treating the payment as submitted.
- The WebUI MUST NOT treat a successful transfer as Credits credited. Credits crediting remains owned by the Crynux AS ledger scanner. After transfer success the page MUST poll `GET /v1/account` and `GET /v1/account/purchases` for a short interval and surface toast feedback when the balance updates or when the poll window ends.
- The Purchases tab lists `GET /v1/account/purchases`. The response field MUST be `purchases`. The Usage tab lists `GET /v1/account/charges`. Both tabs MUST use offset/limit pagination and MUST show empty, loading, and retryable error states.
- User-facing copy MUST use Purchase terminology. The WebUI MUST NOT present this flow as a deposit.

### Project management views

- `ProjectListView` loads `GET /v1/projects`, creates projects via `POST /v1/projects`, and opens `ApiKeyRevealDialog` when the create response includes a one-time plaintext `api_key`. Each list row MUST distinguish Cost Level modes: static rows show a `Static` mode tag, the stored `priority_gwei`, and queue-range status; auto rows show an `Auto` mode tag, `auto_queue_position` as a percent, and `auto_max_priority_gwei` as Max.
- `ProjectDetailView` presents two primary sections: a muted LLM API panel (base URL, API key prefix, reset key; rename/delete via overflow menu) and a Cost Level panel. The Cost Level panel MUST support modes `static` and `auto` with a short explanation for each. Mode and both setting sets MUST persist independently through partial `PUT /v1/projects/:id` after 3 seconds without further changes. Static mode MUST use a logarithmic Gwei slider and numeric input bound to `priority_gwei`, with hard bounds from `GET /v1/llm/billing_config`, plus the existing queue range bar under the slider when live bounds are present. Auto mode MUST use two dual-bar control groups: Queue position (`auto_queue_position` clamped to `[1, 99]` in the WebUI) and Max Cost Level (`auto_max_priority_gwei` with the live Current queue range bar). When a project first enters Auto without a stored cap, the WebUI MUST initialize the cap from current queue max or `min_priority_gwei` and save it with the mode. The panel MUST show two example tables built from `GET /v1/llm/pricing_examples` plus `billing_config`: a Credits table with `Model`, `1M Input`, and `1M Output` columns for separate 1M-token unit prices without `constant_seconds`; and an execution-time table with `Model`, `Input`, `Output`, and `Seconds` for a typical call of `time_prompt_tokens=512` input and `time_completion_tokens=2048` output, including `constant_seconds`, not scaled by Cost Level. Static Credits examples MUST use `priority_gwei` and title `Credits per 1M tokens`. Auto Credits examples MUST use `auto_max_priority_gwei` and title `Maximum Credits per 1M tokens`. Cost-level save feedback uses a single replaceable toast. Rename MUST send only `name`. Below Cost Level, `ProjectUsageSection` MUST show project usage charts from `GET /v1/projects/:id/stats`, `GET /v1/projects/:id/stats/completion-duration`, and `GET /v1/projects/:id/stats/models`. Below Usage, `ProjectRecentRequestsSection` MUST list recent in-progress and finished requests from `GET /v1/projects/:id/requests` with columns Status, Model, VRAM, Input, Output, Duration, Cost Level, Credits, and Time. Status MUST be shown as an icon only: `Clock` for `queued`, `CircleDot` for `in_progress`, `CheckCircle2` for `success`, and `XCircle` for `failed`, with the corresponding status label available to assistive technology. Status icons MUST NOT use animation. In-progress rows MUST show `—` for Input, Output, Duration, and Credits. Duration for finished rows MUST display `Math.round(duration_ms / 1000)` as an integer second count with an `s` suffix. Row keys MUST use `source` and `id`. While any listed row has status `queued` or `in_progress`, the section MUST refresh every 5 seconds; the timer MUST stop when no such rows remain or the component unmounts. The requests list MUST NOT send `limit` or `offset`. Load failures for Usage and Recent Requests MUST use `vue-sonner` toast messages that tell the user to try again later.
- Project data is page state loaded through `projectsAPI`. There is no Pinia project store.
- Plaintext API keys MUST NOT be persisted in local storage or route state after the reveal dialog closes.

#### Static Cost Level control layout

When mode is `static`, the Cost Level controls MUST use this layout:

1. The numeric `priority_gwei` input MUST sit on the left of the control group.
2. The logarithmic slider MUST sit to the right of the numeric input, with `Cheaper` to the left of the slider track and `Faster` to the right of the slider track.
3. The queue range bar MUST sit directly under the slider track when live queue bounds are present.
4. The queue range bar's horizontal track MUST share the same width and the same left/right edges as the slider track (`SliderTrack`). The range bar MUST NOT extend under `Cheaper`, `Faster`, or the numeric input. The range bar MUST sit in the same column as the Slider root and MUST NOT add horizontal padding or inset relative to that column. Thumb overhang MUST NOT change the range bar width.
5. The numeric `priority_gwei` control MUST use a larger type size than the slider side labels and MUST use the primary highlight text color. Its outer bordered box MUST use a tall fixed control height (`h-20`) with flexbox-centered digits around a natural-height input.
6. The digits MUST be vertically centered inside that outer box. The implementation MUST NOT rely on a tall native `<input>` height plus line-height to center the text.
7. The numeric box MUST stay left-aligned in the panel row. The slider-plus-range-bar block MUST occupy about 80% of the remaining row width to the right of the numeric box and MUST be horizontally centered in that remaining space. The slider block MUST be cross-axis centered with the numeric box. The queue range bar MUST size to its visible track and Current queue min / Current queue max labels without extra empty height below the labels.
8. Spacing above the mode cards MUST use `mb-10` after the intro text. Spacing from the mode cards to the control row MUST use `mb-20`. Spacing from the control row to the example tables MUST use `mb-20`.
9. Queue range bar colors and markers MUST follow the Cost Level WebUI rules in Crynux AS `credits-billing.md`: Current queue min and Current queue max labels under the track, blue segment between the mapped queue bounds, red outside that segment.
10. The Cost Level panel intro above the mode cards MUST state that Cost Level controls how many Credits each request spends and how long tasks wait in the queue. That sentence is panel-level intro copy and MUST NOT be placed inside a mode card. Mode cards MUST place Auto on the left and Static on the right. Auto card copy MUST state that the system adjusts Cost Level to the chosen queue position, that Credits for the same task can change, and that Credits never exceed the set maximum. Static card copy MUST state that the same task always spends the same Credits and that tasks may wait too long in the queue. User-facing intro and mode card copy MUST NOT mention Gwei or task fee.
11. When the Cost Level panel is collapsed, the header preview MUST show a mode tag (`Auto` or `Static`) plus the setting values: Auto as `position% · max`, Static as the single `priority_gwei` value.

Any change to the static Cost Level control markup in `ProjectDetailView.vue` MUST be checked against this layout subsection before finishing the change.

#### Auto Cost Level control layout

When mode is `auto`, the Cost Level controls MUST follow Crynux AS `credits-billing.md` Auto controls rules and MUST use this layout:

1. Two separate bordered groups MUST appear in order: `Queue position`, then `Max Cost Level`. Vertical spacing between groups MUST be larger than spacing inside one group. The Queue position group description MUST state that when each task is sent, the system reads the current queue min and max Cost Level and sets this request's Cost Level from the configured position.
2. Each group MUST use a left tall numeric input (`h-20`, primary digits, flex-centered) and a right dual-bar block at about 80% of the remaining row width, horizontally centered.
3. Queue position: linear slider with `min=1` and `max=99`; fixed symmetric red–blue–red bar under the slider with blue from 10% to 90% of the track; marker labels `Queue min` and `Queue max`. The slider track MUST be inset so value `1` aligns with `Queue min` and value `99` aligns with `Queue max`. The WebUI MUST clamp stored and edited values into `[1, 99]`.
4. Max Cost Level: logarithmic slider with `Cheaper` / `Faster` labels and the same live Current queue min / Current queue max range bar rules as Static mode.
5. Spacing from the mode cards to the Auto control block and from the Auto control block to the example tables MUST use `mb-20`.

Any change to the auto Cost Level control markup in `ProjectDetailView.vue` MUST be checked against this layout subsection before finishing the change.

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
| `api/v1/auth.js` | Login API |
| `api/v1/account.js` | Balance, purchases, charges |
| `api/v1/purchase.js` | Purchase networks config |
| `api/v1/projects.js` | Project management, stats, and recent requests API |
| `router/index.js` | Routes and `requiresAuth` guard |
| `components/layout/DashboardLayout.vue` | Dashboard shell |
| `components/credits/*` | Purchase dialog |
| `components/projects/*` | Create, API key reveal, reset, rename, and delete dialogs |
| `components/ui/sonner` | Global toast notifications via `vue-sonner` |
| `views/HomeView.vue` | Public marketing homepage and wallet connect entry |
| `components/home/*` | Homepage header, hero, services, interactive Cost Level pricing example, integrations, highlights, use cases, CTA, footer |
| `content/home.js` | Homepage copy, links, and code samples |
| `components/theme/ThemeToggle.vue` | Light/dark mode toggle |
| `views/CreditsView.vue` | Balance, purchase, purchases and usage history |
| `views/ProjectListView.vue` | Project list and create flow |
| `views/ProjectDetailView.vue` | Project detail, Cost Level, Usage charts, Recent Requests, reset key, delete |
| `components/stats/ProjectUsageSection.vue` | Project usage charts and model top table |
| `components/stats/ProjectRecentRequestsSection.vue` | Project recent in-progress and finished LLM request list |
| `config.example.json` | Committed template for `config.json` |
| `config.json` | Local `as_url`, `networks` (gitignored) |
| `main.js` | App bootstrap, plugins, unauthorized handler |
| `App.vue` | Root router outlet and toast `Toaster` |
