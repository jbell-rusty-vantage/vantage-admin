# Transportation pricing

Owner-only Setup → Transportation pricing (`/setup/transportation-pricing`) edits the independent operations service. Operations owns pricing rules, Mongo collections, revisions and control; Admin owns session verification, the signed proxy and the editor. No main-server runtime change or Granot writeback is involved.

## Owner flow (2026-10-28: edit → Save → toast)

The page opens on the **live** rates, so the Owner always sees what agents use. Each part edits on its own and every Save goes live in one click, answered by a toast (`sonner`, mounted once in `app/layout.tsx` via `components/ui/toaster.tsx`). The Owner is never asked for a reason, a preview or a draft.

- **Agent pricing switch** (top card): on/off for agent calculations. Disabled until base rates exist. Automatic change note "Agent pricing turned on/off".
- **Base rates**: the 8 distance × 7 move-size table in dollars per cubic foot. Edit base rates → inputs → Save base rates. Empty boxes are yellow, non-numbers red. A save with either is refused by a toast that names the count, and nothing is sent. Use 0 for no charge. On first use (no published rates) the editor is already open.
- **State surcharges**: one card per group, showing its states and 7 rates. A card has an On/Off switch (saves immediately), Edit (name, On/Off, state picker, 7 rates → Save group) and Delete (browser confirm). **Add surcharge group** starts a new group **On**. A group is refused, with one sentence, when its name is empty or already used, when it has no states, when a rate is missing or invalid, or when an active state is already in another active group.
- **Earlier versions** (collapsed): published revisions newest first; **Use these rates** restores one after a confirm.
- A save whose rates make a slightly bigger move cheaper still goes through; a warning toast names the first spot (base-rate saves only).

`saveConfiguration` in `lib/transportation-pricing.ts` keeps the operations service's protocol and audit trail intact behind that one click. It creates a draft from the live revision, writes the whole configuration, previews it with no sample moves, and publishes it with an automatic change note (for example "Updated base rates" or "Added surcharge group “X”") and the preview's warning hash. A part's Save sends the live configuration with only that part replaced, so other open editors keep their unsaved text. A 409 conflict or an unknown outcome reloads the live rates and asks the Owner to redo the change. Publishing preserves the on/off state.

## Server boundary

`app/api/operations-pricing/[...path]/route.ts` resolves the current Mongo-backed Admin session on every request (refreshing existing session cookies when needed). Only a current Owner is accepted. Mutations require the exact same Origin and reject cross-site fetches. `server/operations-pricing/` owns a strict route/query/body allowlist, 256 KiB streamed request limit, bounded upstream response, no redirects and a deadline. Browser cookies, authorization, readiness secrets and supplied actor headers are not forwarded.

The proxy signs the validated, once-serialized outbound JSON bytes using the dedicated version/audience, Owner ID, role, canonical millisecond timestamp, UUID, method, exact canonical target and SHA-256 body digest from the operations specification. Pricing configuration is server-only; missing configuration fails closed. See [environment inventory](knowledge/environment.md).

## Local verification and launch

Run `pnpm test`, `pnpm typecheck`, `pnpm exec eslint server/operations-pricing app/api/operations-pricing components/setup/transportation-pricing-section.tsx lib/transportation-pricing.ts tests/transportation-pricing.test.ts`, and `pnpm build`. Tests use mocked sessions/transport and invented values; they do not load production configuration. Production build follows the existing Next environment loading behavior.

For a local integration, use the isolated operations stack, a deliberately configured Admin test session/database, `OPERATIONS_API_BASE_URL` pointing to that trusted local origin, and a dedicated matching operations signing key. Run `pnpm exec next dev --port 3002`; configure operations CORS deliberately. Do not point test mutation flows at production.

Reconciliation checks (2026-10-26): full Admin suite passed with 1,217 tests and 15 existing skips; the final focused pricing suite passed 9/9 after adding the role-denial coverage. Typecheck, production build and focused lint passed. Repository-wide lint still reports six existing errors and five warnings in unrelated job timeline, manual, reporting and Granot lifecycle files. Authenticated interactive browser/E2E verification remains a separate integration gate; server-rendered UI and mocked proxy checks are included.

Production Admin deployment was explicitly authorized and completed on 2026-10-26: `dpl_9SqULR8VgdtT6cwWcwEh7NC4jXkb`, Ready, at [Owner management](https://vantage-admin-rho.vercel.app/setup/transportation-pricing). The release was packaged from HEAD plus pricing-owned changes, excluding unrelated dirty files and all secret local environment files. Unauthenticated management redirects to login (307); configuration API denies missing sessions (401, no-store). A single standard login attempt using the documented local Owner seed credentials returned 401; no authenticated production management read was obtained. This remains a valid-Owner-session verification gate. No pricing publication, rate seeding or enablement was performed. Owner approval of actual rates, commercial scope, numeric/role defaults, discontinuities and pilot outcomes remains required under the [operations specification](../../vantage-operations-server/docs/pricing/SPECIFICATION.md).


## Verification

`node tests/transportation-pricing-visual.mjs [chrome-headless-shell.exe]` renders the real component and toaster against a stateful in-page fake of the operations API, on loopback only. On desktop and mobile it covers first-time fill (all 56 rates), the empty-rate and bad-rate refusals, editing one cell, adding a group (which starts On), switching a group off, turning agent pricing on and restoring an earlier version. It also asserts that no page-level horizontal overflow occurs. Unit tests (`tests/transportation-pricing.test.ts`) cover rate parsing, group problems, the default-active group and the four-call save pipeline.
