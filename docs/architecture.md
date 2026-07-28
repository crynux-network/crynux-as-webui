# Crynux AS WebUI Architecture

This document describes the technical architecture of the Crynux AS WebUI frontend application. **Read this document before making any code changes.**

## Overview

Crynux AS WebUI is a Vue 3 application that interacts with:

1. **Crynux AS API** — backend REST API for wallet login, accounts, projects, Credits, and LLM configuration
2. **User wallets** — browser extensions and WalletConnect wallets via Reown AppKit and wagmi

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vue Components                            │
│  HomeView │ DashboardLayout │ ProjectListView │ ui/*            │
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
│  │  - v1.js   Axios client + Bearer interceptor             │   │
│  │  - auth.js POST /auth/login                              │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                      External Services                           │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │   Crynux AS API      │  │  Reown AppKit        │             │
│  │   (REST Backend)     │  │  + wagmi / viem      │             │
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
│       └── auth.js            # Wallet login API
├── components/
│   ├── layout/
│   │   └── DashboardLayout.vue  # Fixed left sidebar + scrollable main
│   └── ui/                    # shadcn-vue generated components
├── composables/
│   └── use-wallet-connect.js  # Connect modal → auth → optional redirect
├── lib/
│   ├── appkit.js              # Reown AppKit + WagmiAdapter init
│   └── utils.js               # shadcn cn() helper
├── router/
│   └── index.js               # Routes and auth guard
├── stores/
│   ├── auth.js                # JWT session
│   └── wallet.js              # Wallet address synced from wagmi
├── views/
│   ├── HomeView.vue           # Public home + Connect
│   └── ProjectListView.vue    # Dashboard project list
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

---

## Layout and Routing

### Layout

- `/` is a full-screen public page with no dashboard sidebar.
- `/dashboard/*` uses `DashboardLayout.vue`: fixed-width left sidebar (no vertical scroll) and a right main area that scrolls independently (`h-screen` flex; main uses `flex-1 min-h-0 overflow-y-auto`).

### Routes

| Path | Name | Auth | Component |
|------|------|------|-----------|
| `/` | `home` | No | `HomeView` |
| `/dashboard` | — | Yes | redirects to `projects` |
| `/dashboard/projects` | `projects` | Yes | `ProjectListView` |

`router.beforeEach` checks `meta.requiresAuth`. If the route requires auth and `auth.isAuthenticated` is false, the guard clears session/wallet display state and redirects to `/`.

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

Further project and account APIs MUST follow the same `V1Client` + module class pattern.

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

---

## Error Handling

- API failures map to `ApiError` types in `api/api-error.js`.
- Connect/auth failures return `{ success: false, reason }` from `useWalletConnect` / `authenticate`; `HomeView` shows user-facing messages for known reasons.
- Unexpected API 500/unknown errors are logged via handlers registered in `main.js`.
- Do not silently swallow errors. User-impacting failures MUST surface clear feedback; otherwise log structured context and propagate.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `lib/appkit.js` | Reown AppKit + wagmi config |
| `stores/wallet.js` | Wallet address sync and disconnect |
| `stores/auth.js` | JWT session and `authenticate()` |
| `composables/use-wallet-connect.js` | Connect + login + redirect |
| `api/v1/v1.js` | Axios client and auth header |
| `api/v1/auth.js` | Login API |
| `router/index.js` | Routes and `requiresAuth` guard |
| `components/layout/DashboardLayout.vue` | Dashboard shell |
| `config.json` | `as_url` |
| `main.js` | App bootstrap, plugins, unauthorized handler |
