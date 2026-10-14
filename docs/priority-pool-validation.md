# Priority Pool Admin validation — October 14, 2026

All evidence below uses local code and synthetic records. Browser authentication used the existing isolated local E2E database. No production Lead admission, call, assignment, or customer mutation was performed.

| Check | Result |
| --- | --- |
| `pnpm test` | 1,203 tests: 1,188 passed, 15 existing optional replica/historical-fixture checks skipped, zero failed |
| `pnpm typecheck` | Passed |
| Changed-file ESLint | Passed |
| `pnpm exec next build --webpack` (`RAYON_NUM_THREADS=2`) | Passed, including TypeScript and all 52 static pages |
| `pnpm exec playwright test tests/e2e/pool.spec.ts` (`E2E_PORT=3114`, `RAYON_NUM_THREADS=2`) | Chromium: one passed, 33.5 seconds total |

The browser scenario authenticates as a Rep and supplies synthetic server DTOs through intercepted Desk API responses. It verifies adjacent New / Quoted / Other / Pool tabs; a foreign-assigned Pool Lead with its assigned Rep retained; the shared due state in detail; absence of a callback command; teammate completion appearing in both row and detail on the 30-second foreground resnapshot; team counts updating while this viewer's actual outbound remains zero; and a later 404 plus queue exit removing the row, detail information, and selected Lead from the URL. This proves browser behavior under server responses, not provider qualification or database concurrency.

Focused contract/component coverage in `tests/outreach-desk/pool.test.ts` and `tests/pool-automations-freshness.test.ts` additionally verifies strict Pool state/caller fields, separate queue scope serialization, all role URL handling, explicit Unassigned and coverage-pending states, assigned fulfillment versus actual outbound counts, complete Desk invalidation for `outreach_pool`, cached shared-row eviction, and independent incomplete/failing historical and refresh collection lanes. Existing BFF allowlist tests include Pool reads and reject invented completion/mutation endpoints for Reps and Managers.

Server `src/validation/v1/salesOutreachReads.ts` strict queue/detail schemas parsed synthetic Pool samples, and the Admin mirrors round-tripped both without losing fields. Saved samples are `tests/outreach-desk/fixtures/server/queue.rep.pool.json` and `outreach.rep.pool.json`; the existing drift guard reads them on every run. Source comparison also confirms matching `queue_scope`, `other` filter and `outreach_pool` fields. Older server responses remain parseable. Existing `all_outbound` and `eligible_new_quoted` enums, progress, remaining and goal-reached calculations are unchanged; the Pool workload card reads only the separate queue summary.

The default Turbopack build encountered a Windows OS 1450 resource error. The documented Webpack fallback completed successfully without repository build-configuration changes. Production merge/deployment and activation are handled by the main rollout; no release is claimed by this local validation.
