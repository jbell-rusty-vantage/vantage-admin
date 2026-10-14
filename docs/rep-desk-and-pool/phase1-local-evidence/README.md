# Phase 1 real local browser evidence

October 14, 2026 UTC / October 13 New York. Final indexed `tests/e2e/phase1.integration.spec.ts`: **3/3 passed in 51 seconds**, real login + BFF + Express + Mongo replica + SSE, no response mocks. All four declared EntityChange indexes were installed, including unique `{ entity.model, entity.id, revision_after }`. Run with `tests/e2e/phase1-local.config.ts` and the `E2E_PHASE1`/local auth configuration documented in the server's `docs/rep-desk-and-pool/phase1-local-integration.md`.

| Screenshot | Evidence |
| --- | --- |
| [Rep money](rep-metrics-and-queue.png) | Four own gross allocation windows; attached total `$1,000.01`; partial linked amount coverage |
| [Rep queue](rep-queue-relative-labels.png) | Server Move date order, unknown last; date-only Today / past / future; latest interaction age / No interaction |
| [Past filter](rep-past-filter.png) | Yesterday-only result, preserving selected lead |
| [Unknown filter](rep-unknown-filter.png) | Unknown move date stays separate from Past and Future; filter survives refresh |
| [Owner viewing Rep](owner-selected-rep.png) | Owner reads same selected Rep amount |
| [Manager viewing Rep](manager-selected-rep.png) | Manager reads same selected Rep amount |
| [Stream recovery](rep-live-reconnected.png) | Real stream reopened after hidden-page close; `$1,010.01` after a committed change while closed |

Rep foreign-Agent metric requests and generic Admin requests returned 403. Owner/Manager Team filters and search/priority/workflow/date composition passed. The complete queue was traversed with two-row cursor pages, with seven unique rows and null move dates last. Committed money mutations refreshed the card without navigation; cleanup restored the synthetic attached Booking to `$100.01` with consistent allocations.

The corrected helpers transactionally read/CAS/advance each actual aggregate revision and insert schema-validated immutable receipts with matching adjacent revisions, complete provenance and matching changed fields. The indexed replica proof rejected a duplicate receipt with Mongo `11000`, preserved both aggregate and receipt state on rollback, passed two consecutive bump/restore cycles (`3 → 4 → 5 → 6 → 7`) and an extra no-op restore. Final audit retained 15 corrected receipts; Booking revision 11 and allocations `$50.01/$50.00` matched the restored state. Explicit legacy cleanup removed 16 old local proof receipts lacking actor/initiator; repeating the refined cleanup removed 0 and preserved corrected history. The server tracks `docs/rep-desk-and-pool/phase1-indexed-proof.json` with the exact index, revision and audit evidence.

The replica holds only synthetic test records (`testvantagemovers_phase1`); auth uses `testvantage_admin_phase1_e2e`. Provider credentials are stripped and no checkout `.env` file is loaded. Queue interaction timestamps are explicitly synthetic projection fixtures, not a claim of RingCentral capture. Provider freshness correctly remains Unknown / Not connected and goals Pending.

The stream recovery check controls document visibility to exercise the app's real close/reopen lifecycle; it does not mock SSE or reads. Playwright's offline flag retained an already-open SSE in this Chromium, so transport-offline caption behavior is not asserted by this proof. Dependency files were local hardlinks of the same installed package versions to avoid linked-worktree Next development hydration errors.
