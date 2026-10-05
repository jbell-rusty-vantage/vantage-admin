# Morning summary — Sales Outreach Desk admin build (local run, 2026-10-05)

**Bottom line:** both admin lanes are built, merged into `feat/outreach-desk` and pushed to origin. The desk at `/outreach-desk` reproduces the two reference screenshots (side-by-side comparisons in `screenshots/compare-*.png`), runs against the real server API on the replica with zero contract drift, and every gate is green except the pre-existing lint debt in files this sprint never touched. Nothing was pushed to `main`, deployed or run against production.

## 1. What merged (vantage-admin `feat/outreach-desk`)

| Order | Lane | Work packages | Lane head → merge |
| --- | --- | --- | --- |
| 1 | A1 | ADM-1 manager role end to end, ADM-2 `/outreach-desk` route + "Lead outreach" shell + desk token set + `/sales-intelligence*` redirects + Numbers/Accounts moved, ADM-7 BFF allowlists + Manager Daily Operations + desk live route | `ea73de6` → `7e005c7` |
| 2 | A2 | ADM-3 DTOs/fixtures/mock, ADM-5 Team (M1 goal parts first), ADM-4 My (M1 goal card first), ADM-6 Activity + Settings, ADM-8 Playwright; P2 integration fixes | see `git log feat/outreach-desk` (merge commit "admin lane A2") |

Details: [A1.md](A1.md), [A2.md](A2.md), [INTEGRATION.md](INTEGRATION.md).

**M1 (goal cards + Daily call goals) is ready on the admin side:** manager role, the shell, Team cards and Daily call goals, the My goal card, freshness chips, all reading only `GET capabilities`, `GET team`, `GET rep-days`, with the "Outbound calls" label and "Other outbound" separate.

## 2. Test results (exact commands, final state)

```text
pnpm typecheck                                                   → green
node --import tsx --test --test-concurrency=2 "{lib,server,tests}/**/*.test.ts"
                                                                 → 752 tests, 737 pass, 0 fail, 15 skipped (pre-existing)
pnpm lint                                                        → 11 errors / 7 warnings, all pre-existing in untouched files
pnpm test:e2e                                                    → 10 passed, 6 skipped (P2 walk; needs E2E_INTEGRATION=1)
pnpm build                                                       → green
P2 walk (INTEGRATION.md)                                         → 6 passed, 0 contract drift
```

Lint debt (not this sprint): `components/reporting/{reporting-dashboard,report-sheet-examples,destination-selector}.tsx`, `components/layout/global-search.tsx`, `components/manual/{create-lead-form,connect-booking-section}.tsx`, `components/operational/operational-resource-page.tsx`, `components/job-number-timeline/job-timeline-dashboard.tsx`, `components/dashboard/needs-you.tsx`, `components/operations-registry/lead-sources/lead-sources-manager.tsx`, `lib/api/granotLifecycle.test.ts` — mostly `react-hooks/set-state-in-effect`. `git diff --name-only e6e3bb1 -- <those files>` is empty.

## 3. Blocked or owed, and why

| Item | Why | What unblocks it |
| --- | --- | --- |
| P3 VERIFY (END-TO-END-RUN §3–§5) | Not a lane task; needs a fresh agent | Reuse INTEGRATION.md's setup (pilot DB and e2e admin users are still on the replica) |
| Admin merge to `main` / deploy (M1, M2) | RELEASE only (FAST-01). Note: server `main` already carries the desk (`6d1600fe`), so the admin can follow once VERIFY signs off | RELEASE agent |
| Rep goal card "overdue / calls due / SMS due" | Not served to a Rep (request 1); the card shows "—" | Server change |
| Live hints against the server | The P2 walk used refetch triggers; the change-stream hints themselves were not observed end to end | VERIFY §5 SSE row |

## 4. Server-side contract changes requested (none were made; server repo untouched)

1. **Rep-scoped cadence counts for the My goal card** (SPECIFICATION §6.1: distinct overdue leads, call attempts due today, SMS sends due today). Today only coordinators get `overdue_leads` per rep (via `GET team`); "calls due" and "SMS due" are not served to anyone. Suggest adding them to each `GET /rep-days` row (cadence-metric shape, `unknown_reason` when off).
2. **`schedule_day` on queue rows.** The reference "Lead age: Day 3" column needs it; the admin shows New York calendar age from `received_at` meanwhile, which can differ from the cadence day across closures.
3. **Capabilities `permitted_views`** never lists `activity`, and gives a Manager no `settings` although the Manager holds `day_override` (P09b attendance). The admin composes Activity from queue + detail reads and shows Manager Settings as attendance only; please add both views so capabilities stay the single authority.
4. **A read-only cadence summary for every desk role** (the reference's "New lead schedule" box). Reps cannot read configuration; the admin shows the lead's own explanation codes instead.
5. **Names in `history.assignment_changes`** (only Agent ids today; non-current reps render as "Unknown rep").
6. **Operational:** `install-approved-policy.ts` cannot clear `migration.paused`; RELEASE must PATCH it (P2 did it through the Owner BFF). Settings deliberately has no migration control.

## 5. What the Integrator / VERIFY step needs next

- Start from INTEGRATION.md (commands are exact). The server worktree `../vantage-main-server-p2` (detached at `b1056cf6`) has a real install and untracked `.p2-tmp/` helpers; the pilot database `testvantagemovers_sodpilot` and admin auth DBs `vantage_admin_outreach_e2e{,_p2}` remain on csi01.
- Run END-TO-END-RUN §3–§5 with an advancing synthetic clock; the admin side already has the visual (1186×742), keyboard/focus, reassignment and 403 checks as `pnpm test:e2e` + `tests/e2e/integration.spec.ts`.
- Observe live SSE change hints end to end (the replica supports change streams) and the 30 s clock frames.
- Confirm requests 1–5 with the server team; the admin will adopt new fields additively (schemas are non-strict).

## 6. Machine and checkout state

- Worktrees: `../vantage-admin-a1` (A1 branch), `../vantage-admin-a2` (A2 branch), both real installs, kept; `../vantage-admin-int` (detached, no `node_modules`) removed after merging. Server `../vantage-main-server-p2` kept for VERIFY.
- The main admin checkout was left as found (another session had `feat/outreach-desk` checked out there); merges were made on a detached worktree and pushed (fast-forward, no force). Pull before working there.
- Heavy commands ran one at a time under a lock; one dev server at a time; processes were stopped by task or exact PID only.
- Local mock mode for UI work: `OUTREACH_DESK_MOCK=desk pnpm dev` (or `m1` for the goal-parts-only desk). Never set it in Vercel; it is ignored when `VERCEL_ENV=production`.
