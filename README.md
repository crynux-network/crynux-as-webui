# Crynux AS WebUI

Frontend for Crynux AI Services. Vue 3 dashboard with wallet login against the Crynux AS backend.

## Stack

- Vue 3.5 + Vite 7
- Vue Router 5 + Pinia 4
- Axios API client
- shadcn-vue + Tailwind CSS v4
- Reown AppKit (WalletConnect + browser wallets) via `@wagmi/vue`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and set your Reown Cloud project ID:

```bash
cp .env.example .env
```

Create a project ID at https://dashboard.reown.com and set:

```env
VITE_REOWN_PROJECT_ID=your_project_id
```

3. Point the API client at your Crynux AS server in `src/config.json`:

```json
{
  "as_url": "http://127.0.0.1:8090"
}
```

4. Start the dev server:

```bash
npm run dev
```

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run preview` — preview production build

## Auth flow

1. Home page Connect opens the Reown AppKit modal.
2. After the wallet connects, the app signs:

```text
Crynux AS
Action: Login
Address: <address>
Timestamp: <unix>
```

3. `POST /v1/auth/login` exchanges the signature for a JWT.
4. The app navigates to `/dashboard/projects`.

## Routes

| Path | Description |
|------|-------------|
| `/` | Static home placeholder + Connect |
| `/dashboard/projects` | Empty project list (auth required) |
