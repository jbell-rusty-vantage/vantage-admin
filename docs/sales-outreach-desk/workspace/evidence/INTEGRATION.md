# P2 — admin against the real server API on the replica (2026-10-05)

The csi01 replica (127.0.0.1:27189) was running, so P2 ran locally. Docker was not started or restarted. No production URI, `.env` or secret was used anywhere; every secret below is a local placeholder.

## Setup (exact)

Server: a detached worktree `../vantage-main-server-p2` at `origin/feat/outreach-desk` = `b1056cf6` (read-only use; no server file was changed or committed; the only additions were untracked helpers under `.p2-tmp/`). Real `pnpm install`.

> **2026-10-05:** that worktree is removed. The helpers now live in the server repo at `ops/local-integration/` (see its README). They take `--database=`, refuse non-`test` names and ignore `.env`. Run the commands below from the main server checkout.

```text
# synthetic pilot (the server's own seed; refuses non-loopback / non-test databases)
node --import tsx ops/sales-outreach/seed-synthetic-pilot.ts --database=testvantagemovers_sodpilot [--reset]
# env for the next steps (no .env; provider/production env names unset)
TEST_MODE=true TEST_MONGO_DATABASE_NAME=testvantagemovers_sodpilot MONGO_URI="mongodb://127.0.0.1:27189/?replicaSet=csi01" SHEET_SYNC_MODE=disabled
node --import tsx ops/sales-outreach/build-indexes.ts --target=testvantagemovers_sodpilot --apply
node --import tsx ops/local-integration/csi-indexes.ts --database=testvantagemovers_sodpilot   # CSI ledger/audit + registry indexes
node --import tsx ops/sales-outreach/install-approved-policy.ts --target=testvantagemovers_sodpilot --apply \
  --enable=desk_enabled,goal_metrics_enabled,cadence_shadow_enabled,cadence_enforcement_enabled
# API on loopback only (127.0.0.1:3107), with local secrets
VANTAGE_API_SECRET=local-e2e-api-secret VANTAGE_ADMIN_PROXY_SIGNING_SECRET=local-e2e-proxy-signing-secret-32ch \
CRON_SECRET=local-p2-cron-secret node --import tsx ops/local-integration/serve.ts --database=testvantagemovers_sodpilot
```

Admin (`../vantage-admin-a2`): `next dev -p 3100` with `VANTAGE_API_BASE_URL=http://127.0.0.1:3107`, the same two secrets, mock mode **off**, admin auth DB `vantage_admin_outreach_e2e_p2` on the replica. Users seeded by `tests/e2e/seed-users.ts` with the two Reps bound to the pilot Agents (Avery `d9e98cc15237c848c5c8732b`, Blake `360f2f6456d420c391c73535`).

```text
E2E_INTEGRATION=1 E2E_BASE_URL=http://localhost:3100 E2E_ADMIN_AUTH_DB_NAME=vantage_admin_outreach_e2e_p2 \
E2E_REP_AGENT_ID=d9e98cc15237c848c5c8732b E2E_REP2_AGENT_ID=360f2f6456d420c391c73535 \
P2_API=http://127.0.0.1:3107 P2_CRON_SECRET=local-p2-cron-secret pnpm exec playwright test tests/e2e/integration.spec.ts
```

## Result: 6 / 6 passed on a freshly dropped and rebuilt pilot database, zero contract drift

| Check | Result |
| --- | --- |
| Owner through the BFF: capabilities (desk available), configuration GET, `PATCH /configuration` (`migration.paused` → false, with revision + Idempotency-Key), enrollment `report` (`backfill_scope`, 19 in scope, 1 review = unmapped priority, `writes: 0`) then `apply` of that manifest until `completed`; then the desk crons (`lead-changes`, `contact-events`, `evaluate` ×2) | pass |
| Owner and Manager Team desk on real data (pilot reps listed; counts Pending while no call capture ran; Manager `GET configuration` = 403) | pass |
| Rep (Avery) My desk on real data: own queue and lead panel; `GET team` = 403; `rep-days?agent_id=<Blake>` = 403 | pass |
| Reassignment: Owner `PATCH outreach/:id/assignment` (Avery → Blake) while Avery has the lead open → Avery's next refetch gets 404, the selection is dropped, the row leaves the queue, nothing auto-selected; `GET outreach/:id` as Avery = 404 | pass |
| Generic Admin: page redirect, BFF `capabilities` 403, `/api/outreach-desk-live` 403 | pass |
| Every desk GET the browser made (`/capabilities`, `/team`, `/rep-days`, `/queue`, `/outreach/:id`, `/configuration`) parsed with the admin Zod mirror | **0 drift** |

## Contract drift found and fixed (admin side)

1. **Server refusal codes were lost in the BFF.** The generic proxy returned the server's `code` only as `registry_code`, so the desk saw `READ_FAILED` instead of `CURSOR_EXPIRED`, `REVISION_CONFLICT`, `REP_NOT_LINKED`, `PROJECTION_PENDING`. Fixed: the proxy now also returns `code` for `/api/v1/admin/sales-outreach/**`, and the client parser falls back to `registry_code`.
2. **Auto-select after revocation.** After a reassignment 404 the My view selected the next row, hiding the revocation. Fixed: only the very first load auto-selects.
3. **A 403 on a capabilities refetch kept the desk on screen** (TanStack keeps prior data on error). Fixed: a refusal outranks cached data (found by the mock flow suite, then proven against the server).

No server change was needed for these. Server-side requests are listed in ADMIN-SUMMARY.md.

## Notes

- RingCentral is not connected on the replica, so freshness reads Unknown / Not connected and goal counts Pending with "Call capture incomplete" — the honest rendering, not an error.
- Teardown: both dev processes stopped (by their own task / PID only); the pilot database and the e2e admin-user databases remain on the replica for VERIFY to reuse.
