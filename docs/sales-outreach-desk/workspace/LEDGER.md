# Local task ledger

Preparation state as of 2026-10-04: ready for cloud implementation, with no task claimed or accepted. Record repository, branch, HEAD and initial dirty files when you claim. Work packages are defined in [IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) §7.

| ID | Lane | Depends on | Status | Claimed files / checkout | Evidence / next handoff |
| --- | --- | --- | --- | --- | --- |
| SRV-0/1/2/3/7/8/9/T | Server S1 foundation & API | none | ready | unclaimed | models early → S3; DTOs → ADMIN |
| SRV-4 | Server S2 engine | none | ready | unclaimed | engine types → S1/S3 |
| SRV-5 | Server S3 capture | none | ready | unclaimed | E01 proof script → operator |
| SRV-6 | Server S3 goals/evidence | SRV-3 models | ready | unclaimed | → S1 reads |
| ADM-1/2/7 | Admin A1 roles/route/BFF | none | review | vantage-admin `feat/outreach-desk-a1` (`ea73de6`), worktree `../vantage-admin-a1`; merged into `feat/outreach-desk` as `7e005c7`, pushed | [A1.md](evidence/A1.md); typecheck/tests/build green; lint debt pre-existing only → VERIFY |
| ADM-3/4/5/6/8 | Admin A2 desks | A1 merged | review | vantage-admin `feat/outreach-desk-a2`, worktree `../vantage-admin-a2`; merged into `feat/outreach-desk`, pushed | [A2.md](evidence/A2.md), [INTEGRATION.md](evidence/INTEGRATION.md) (P2 6/6 on the replica, 0 drift), [ADMIN-SUMMARY.md](evidence/ADMIN-SUMMARY.md) → VERIFY; server requests 1–6 in ADMIN-SUMMARY §4 |
| RELEASE M1 | Deploy + operate call progress (FAST-01) | M1 pieces merged + verified on replica | blocked | — | evidence/RELEASE.md |
| RELEASE M2 | Deploy full desk + backfill + controls on | M2 verified on replica | blocked | — | evidence/RELEASE.md |
| VERIFY | Integrated replica + browser | server + admin merged into feat/outreach-desk | ready | — | Admin side merged; reuse INTEGRATION.md setup (pilot DB + e2e users on csi01). END-TO-END-RUN §3–§5 evidence |

Allowed states: ready, claimed, in_progress, review, blocked, accepted. Only VERIFY or the coordinator marks a cross-service item accepted, and only with evidence. A blocking issue names the decision or proof ID, the concrete failing scenario, the owning lane and what it depends on. A skipped test is not accepted.

## Admin run log — 2026-10-05 (local Windows, coordinator)

- A1 claimed at `e6e3bb1`; built in `../vantage-admin-a1`; merged `7e005c7` on a detached integration worktree (the main checkout had `feat/outreach-desk` checked out by another session and was not touched) on top of the concurrent packet commit `42a8ce9`; pushed (fast-forward).
- ADM-3 built by a helper agent in `../vantage-admin-a2` in parallel with A1 (`3a32395`); A1 merged into A2 before UI work.
- P2 ran: csi01 was up. Server worktree `../vantage-main-server-p2` at `b1056cf6` (read-only), synthetic pilot `testvantagemovers_sodpilot`, API on 127.0.0.1:3107 with local secrets. 6/6, zero drift. See evidence/INTEGRATION.md.
- Decisions taken without stopping (no business rule changed):
  - the desk renders outside the Admin shell for every role; the Owner gets "Admin dashboard" and Daily Operations links in the desk sidebar;
  - Plus Jakarta Sans self-hosted (OFL) as the desk font, scoped to `/outreach-desk`;
  - My view defaults to New leads (reference) with All leads as a third tab; Team defaults to All leads;
  - move date defaults to Any move date (the spec's Upcoming default is marked proposed);
  - Lead age = NY calendar days since received until the server serves `schedule_day` on queue rows;
  - first load auto-selects the first queue row; nothing is auto-selected after a revocation or close;
  - callback form collapsed behind "Schedule a callback";
  - three freshness chips (Moving software, RingCentral calls, RingCentral SMS);
  - Manager Settings = attendance only; Activity composed from queue + detail reads (capabilities do not list either view yet);
  - new dev-only env `OUTREACH_DESK_MOCK` (desk | m1), ignored when `VERCEL_ENV=production`; declared in `lib/env/server.ts`;
  - the generic proxy now also returns the server's refusal `code` for desk paths.
- Server contract requests (not made; server untouched): see evidence/ADMIN-SUMMARY.md §4.
