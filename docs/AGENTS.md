## Full Picture

Before making any changes, consult [`./architecture.md`](./architecture.md) for the frontend architecture. All modifications must be consistent with the existing design.

## Documentation Index

| Document | Description |
|----------|-------------|
| [architecture.md](./architecture.md) | Technical architecture: Vue app layers, directory layout, Pinia stores, wallet login via Reown AppKit and Crynux AS JWT, API client, dashboard routing and layout |

## Coding Requirements

### Clean Code

Before adding new code, first check whether existing logic can be reused. Prefer extracting reusable code into a dedicated function, class, or file, and place it in the most appropriate location. Remove duplicated code and avoid adding redundant implementations of the same functionality.

Comments must describe final behavior only. Do not add comments that explain change history, such as what was added, removed, or why code was deleted. Keep comments concise and use them only for complex or non-obvious logic.

Do not add defensive fallback logic unless its purpose is explicit, requirement-backed, and tied to a concrete failure mode.

### Error Handling

Never silently swallow errors. For user-impacting or recoverable cases, show clear UI feedback with a safe fallback or retry path; otherwise log structured context to the console and rethrow or propagate as appropriate.

When implementing page components in Vue, use shadcn-vue components and Tailwind utilities by default. Prefer existing `components/ui` pieces before adding new UI primitives.

### API Layer

Authenticated Crynux AS calls MUST go through `src/api/v1/v1.js` so the Bearer token interceptor and 401 handling apply. New endpoint modules MUST follow the existing `BaseApi` + domain module pattern under `src/api/v1/`.

### Wallet and Auth

Wallet connection and login MUST go through `composables/use-wallet-connect.js` and `stores/auth.js` / `stores/wallet.js`. Do not bypass AppKit/wagmi with ad-hoc `window.ethereum` access unless a documented exception requires it.

Dashboard routes that require a logged-in user MUST set `meta.requiresAuth: true` and rely on the router guard plus `auth.isAuthenticated`.

## Debug Requirements

Follow a root-cause-first bug fix protocol. Before changing code, analyze the relevant code path, form a clear hypothesis, and validate the actual failure cause with concrete evidence.

Apply a precise and minimal fix tied directly to the confirmed cause. Do not make speculative changes, broad defensive changes, or fallback-style fixes that mask the underlying problem.

## Doc Update Requirements

When updating documentation files:

1. Read the entire document first to understand its structure, sections, and flow
2. Find the most appropriate location to integrate new content based on:
   - Logical relationship with existing sections
   - Document flow and narrative
   - Where readers would naturally expect to find the information
3. Integrate new content naturally into existing sections when possible:
   - Add as a paragraph within a relevant section
   - Extend an existing list or table
   - Add as a subsection under an appropriate parent section
   - Distribute across multiple sections if a feature affects different parts of the document
4. Do NOT simply create a new top-level section and place all new content there
5. Only create a new section if the topic is truly distinct from all existing content

Write documentation as a specification.

Documentation MUST state clear, final decisions and requirements.

Documentation MUST NOT include:
- Recommendations or advice.
- Options or alternatives.
- Speculation or uncertainty.
- Future-facing placeholders.

Documentation MUST use definitive language that can be implemented and tested:
- Requirement keywords: MUST, MUST NOT, SHALL, SHOULD. Use SHOULD only when a requirement level is intended.
- Exact behavior, constraints, and interfaces.

## Chat Content Isolation

Documentation MUST be generated from task requirements and authoritative project sources only.
User chat instructions about removing content are editing actions, not document content.
The final document MUST NOT restate removal instructions.
If a content type is removed, it must be absent from the final document.

Example chat cycle:
- AI draft includes setup commands.
- User says remove setup commands and keep only flow.
- Wrong final doc line: This document does not include setup commands.
- Right final doc line: Run the flow in order: prepare environment, start services, execute deposit and withdraw, then verify results.
