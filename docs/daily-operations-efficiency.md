# Daily Operations read view

The Operations tab and shell milestone toast share one `DailyOperationsReadProvider` per authorized tab. It reads `/api/daily-operations-board` at most once per minute while visible and online, aborts hidden/unmounted requests, and backs off 60/120/300 seconds after failure. No Daily Operations EventSource remains in new bundles. Core Outreach transport and its working cadence stay unchanged.

The BFF checks the active session and token version on every request, permits Owner/Manager only, signs the exact server path, propagates cancellation, and uses private no-store responses. The legacy live BFF forwards authenticated HTTP 204 without fabricating a missing-body error, allowing native old EventSources to stop. Already-loaded old toast code can still retry until that tab reloads.

The board consumes schema version 2 from `GET /api/v1/admin/daily-operations/board`: day, timezone, revision, generated_at, freshness, poll_after_ms, snapshot, events and milestones. Counters are replaced from the authoritative snapshot; event touches never increment them again. Last-good data and its generation time survive transient failures, but session refusals clear the visible board and supplementary cards. Bounded history remains available through explicit Load earlier actions; there is no automatic per-lane fetch fan-out.

Milestones establish a baseline on first load, toast unique new facts once per browser session, and ignore notifications older than fifteen minutes. The core provider feeds both board and toast without another timer or transport. Spend uses the Owner-only `/lead-spend-summary` cache at five minutes, while the Pulse keeps `/lead-spend`. Goals use the narrow `/goal-summary` response at five minutes, avoiding the full Outreach team payload and live subscription. Manager routes allow board and goal reads, without granting spend or writes.

The server implementation and rollout contract are canonical in `../vantage-main-server/docs/daily-operations-efficiency/PROPOSAL.md`. Normal core freshness is roughly 60–120 seconds and auxiliary freshness roughly 5–6 minutes. A failed dependency is unavailable/stale, never an empty count.

Offline tests cover the actual visibility adapter and request coordinator (two consumers, single-flight, no hidden work, cancellation, backoff and revocation), snapshot replacement, signed BFF access, legacy 204, and separate Pulse/spend-summary endpoints. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` from this repository.
