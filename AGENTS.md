## Coding Requirements

### Full Picture

Before making any changes, consult `./docs/AGENTS.md` for the project overview. All modifications must be consistent with the existing architecture and design.

### Clean Code

Before adding new code, first check whether existing logic can be reused. Prefer extracting reusable code into a dedicated function, class, or file, and place it in the most appropriate location. Remove duplicated code and avoid adding redundant implementations of the same functionality.

Comments must describe final behavior only. Do not add comments that explain change history, such as what was added, removed, or why code was deleted. Keep comments concise and use them only for complex or non-obvious logic.

Do not add defensive fallback logic unless its purpose is explicit, requirement-backed, and tied to a concrete failure mode.

### Error Handling

Never silently swallow errors. Log structured context to the console for unexpected failures.

User-facing API and load failures MUST be shown with `vue-sonner` toast notifications. The toast message MUST tell the user to try again later. These failures MUST NOT be rendered as inline page or dialog error text, and MUST NOT include a Retry button.

Client-side input validation errors in forms and dialogs MAY remain inline next to the relevant fields.

When implementing page components in Vue, use shadcn-vue components and Tailwind utilities by default. Prefer existing `components/ui` pieces before adding new UI primitives.

### API Layer

Authenticated Crynux AS calls MUST go through `src/api/v1/v1.js` so the Bearer token interceptor and 401 handling apply. New endpoint modules MUST follow the existing `BaseApi` + domain module pattern under `src/api/v1/`.

### Wallet and Auth

Wallet connection and login MUST go through `composables/use-wallet-connect.js` and `stores/auth.js` / `stores/wallet.js`. Do not bypass AppKit/wagmi with ad-hoc `window.ethereum` access unless a documented exception requires it.

Dashboard routes that require a logged-in user MUST set `meta.requiresAuth: true` and rely on the router guard plus `auth.isAuthenticated`.

## Debug Requirements

Follow a root-cause-first bug fix protocol. Before changing code, analyze the relevant code path, form a clear hypothesis, and validate the actual failure cause with concrete evidence.

Apply a precise and minimal fix tied directly to the confirmed cause. Do not make speculative changes, broad defensive changes, or fallback-style fixes that mask the underlying problem.
