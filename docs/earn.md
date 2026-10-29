# Shared Keys

This document specifies the authenticated Shared Keys page for Shared API Key management, CNX earnings, and withdrawals.

## Route and Navigation

The dashboard sidebar MUST include `Shared Keys` as a top-level item. It MUST route to `/dashboard/earn`, use `EarnView.vue`, and require authentication through `meta.requiresAuth`.

The page title MUST be `Shared Keys`. The page intro MUST state that users share unused quota from their OpenAI, Anthropic, or Google API subscriptions to earn CNX.

The page MUST load `GET /v1/earn`, `GET /v1/earn/providers`, and `GET /v1/earn/keys` independently. A failure in one section MUST NOT hide successfully loaded sections.

## Balance Summary

The first content on the page MUST be a balance card matching the Credits page summary layout (`rounded-lg border bg-muted/30`). The card MUST show:

* Available CNX;
* a Withdraw action.

The card MUST NOT show Pending CNX or Withdrawal Locked CNX.

Backend amounts are CNX wei decimal strings. The WebUI MUST parse, compare, add, and format them with `BigInt`; it MUST NOT convert a monetary value through JavaScript `Number`. Every CNX amount shown on this page MUST use `formatCnx` from `src/lib/cnx.js`: thousand commas on the integer part and exactly four decimal places.

The Withdraw action MUST open the withdrawal dialog. It MUST be disabled only while the balance summary has not loaded.

## Shared API Keys

The keys section MUST list the authenticated Key Owner's Shared API Keys. The section header MUST include an Add action. The page MUST NOT show an inline upload form.

Each list item MUST show:

* Provider display name;
* masked suffix;
* owner enabled or disabled state;
* Enable or Disable, and Delete actions.

Owner state and system health MUST be displayed separately when both are present. `owner_enabled=false` means the Key Owner disabled the key. A health status other than `usable` means AS has restricted the key. The UI MUST NOT imply that Enable clears an authentication failure, quota block, or cooldown.

The WebUI MUST NOT expose a per-key model selector or concurrency control. Every key can execute every configured model of its Provider, and concurrency is global backend configuration.

### Add

The Add key dialog MUST contain:

* Provider, selected from `GET /v1/earn/providers`;
* API Key secret.

The dialog MUST state that the key is encrypted before storage so others cannot steal or misuse it. The dialog MUST NOT describe encryption algorithms or key-management internals.

Submission MUST call `POST /v1/earn/keys`. The secret field MUST use password-style display, MUST NOT be persisted in Pinia or browser storage, and MUST be cleared when the dialog closes or the request finishes.

### Enable and Disable

Enable and Disable MUST each open a confirmation dialog before calling the API. Enable MUST call `POST /v1/earn/keys/:key_id/enable`. Disable MUST call `POST /v1/earn/keys/:key_id/disable`.

The Disable confirmation MUST state that no new tasks will be assigned to the key until it is enabled again, and that the key will not be deleted.

### Delete

Delete MUST require confirmation and call `DELETE /v1/earn/keys/:key_id`. The dialog MUST state that the key secret will be removed and that usage history will be kept. A deleted key MUST be omitted from the list.

Add, Enable, Disable, and Delete dialogs MUST NOT close on outside click while submission is pending.

## History

The page MUST show Recent Calls and Withdrawals as two tabs under one `Tabs` control.

### Recent Calls

Calls MUST use `GET /v1/earn/calls?before_id=<id>&limit=<limit>` and show Provider, model, key masked suffix, status, normalized token usage, CNX earning, start time, and duration. It MUST NOT display API Consumer identity, project, prompt, response, or upstream error body.

### Withdrawals

Withdrawals MUST use `GET /v1/earn/withdrawals?before_id=<id>&limit=<limit>` and show columns in this order: Created At, Amount, Fee, Network as a `NetworkTag`, To Address, Status, and Tx Hash. To Address MUST show `Beneficial` when `benefit_address` differs from the withdrawal `address`, otherwise `Operational`. The transaction link MUST match response `chain_id` to `config.json` network configuration.

Every network returned by `GET /v1/earn/withdrawal_networks` MUST have one `config.json` network with the same chain ID and a resolvable transaction explorer. A missing match is a deployment configuration error: the page MUST log redacted context, show the standard try-again-later toast, and omit transaction links for that network without hiding balances or withdrawal history.

Both histories MUST use backend keyset pagination. They MUST NOT emulate offset pagination or sort complete histories in the browser.

## Withdrawal Flow

The withdrawal dialog UI MUST follow the Credits Purchase dialog patterns: tall network select with network icons, large amount input, muted summary card, and Cancel plus Submit footer actions.

Withdrawal fee and limit behavior MUST match Crynux Portal's Relay withdraw dialog:

1. load `GET /v1/earn/withdrawal_networks`, including `fixed_withdrawal_fee_cnx` and `withdrawal_min_cnx`;
2. accept a whole-CNX integer amount and one returned network;
3. use the network fixed fee as the only withdrawal fee;
4. compute Max as the largest whole-CNX amount where `amount + fixed_fee <= Available`;
5. show `Min` and `Max` under the amount field;
6. disable the amount input and show `Insufficient balance to meet the minimum after fee.` when Max is below Min;
7. reject amounts below Min or above Max with inline validation;
8. show live Actual Deduction, fee, network, and receiving address in the summary card; when the destination is a Beneficial Address, the receiving address MUST show a `Beneficial` tag; when the destination is the operational address, the dialog MUST NOT show an `Operational` tag;
9. on Submit, send CNX wei to `POST /v1/earn/withdrawals/prepare`;
10. ask the authenticated wallet to personal-sign the exact `message` returned by prepare;
11. submit `amount`, `network`, `benefit_address`, `timestamp`, and `signature` to `POST /v1/earn/withdrawals`;
12. close after successful creation and reload the summary and withdrawal history once.

The connected wagmi address MUST equal `auth.sessionAddress` before signing. The WebUI MUST sign the returned message unchanged and MUST NOT construct or alter the canonical withdrawal message locally. A prepare response is not a withdrawal and MUST NOT change displayed balances.

Client validation does not replace backend validation. Prepare and create MUST still reject amounts below `withdrawal_min_cnx`.

The WebUI MUST show a pending withdrawal until AS receives a Wallet callback. It MUST NOT infer success from elapsed time and MUST NOT offer timeout refund or cancellation.

## API Layer

Authenticated Shared Keys calls MUST use `src/api/v1/v1.js` through a domain module at `src/api/v1/earn.js`. Secret-bearing requests MUST use the same module and MUST never be logged.

The module MUST expose summary, provider list, key lifecycle, call history, withdrawal network list, withdrawal prepare, withdrawal create, and withdrawal history methods matching the backend paths in this document.

## Error Handling

Client-side field validation MAY appear inline beside its field.

Every API or load failure MUST:

* log structured context to the console without secrets, signatures, or complete backend payloads;
* show a `vue-sonner` toast that tells the user to try again later;
* avoid inline page or dialog error text;
* avoid a Retry button.

An action failure MUST preserve non-secret form fields for correction. A secret field MUST be cleared even when submission fails.
