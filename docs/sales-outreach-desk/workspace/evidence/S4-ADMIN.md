# S4 admin follow-ups — consumers of the server's additive S4 fields, 2026-10-05

Input: server `feat/outreach-desk@5049b662` (`docs/sales-outreach-desk/workspace/evidence/S4.md`, "Admin DTO handoff — S4 additions"). Built by the RELEASE session on admin `feat/outreach-desk` (from `4927dc0`) against the server's regenerated `dto-examples/`. No server change; no new env name.

## What changed

| Area | Change |
| --- | --- |
| DTO mirror (`lib/api/salesOutreach.ts`) | rep-day rows gain `overdue_leads` (cadence metric), `calls_due_today` / `sms_due_today` (due-count metric with the extra reason `coverage_incomplete`, `SALES_OUTREACH_DUE_TODAY_UNKNOWN_REASONS`); `GET /team` `daily_call_goals[]` now reuse the rep-day row schema; queue rows gain `schedule_day`; capabilities gain `cadence_summary` (`salesOutreachCadenceSummarySchema`); `history.assignment_changes[]` gain `from_agent_name` / `to_agent_name`. |
| Fixtures | `tests/outreach-desk/fixtures/server/` re-copied byte for byte from the server's `dto-examples/` (three new: `capabilities.rep.cadence-enforcement.json`, `rep-days.rep.cadence-enforcement.json`, `rep-days.owner.cadence-enforcement.json`). The drift guard (`lib/api/salesOutreach.test.ts`) round-trips every example. Synthetic fixtures carry the new fields (due counts summed from the synthetic queue rows). |
| My goal card | The three metrics (overdue leads, calls due, SMS due) come from the rep's own `GET /rep-days` row for every role; an unknown value shows "—" with the reason (`coverage_incomplete` → "Waiting for RingCentral capture coverage"). The coordinator-only lookup in `GET /team` is gone. |
| Lead age | The queue's Lead age column shows the server's `schedule_day` when present; Quoted and other workflows (null) keep the New York calendar age. |
| Views | The sidebar lists the role's frames narrowed to `permitted_views` (`deskNavViews`); a frame the server does not permit renders "This page isn't part of your desk" (a Rep no longer sees Settings). Activity and a Manager's Settings follow the server. |
| Lead panel | A "New lead schedule" box for New leads, rendered 1:1 from `capabilities.cadence_summary` (nothing when unconfigured). |
| Activity | Assignment changes read "from → to" with the server's names; Unassigned / Unknown rep otherwise. |

## Tests

New/updated: `tests/outreach-desk/desk-render.test.ts` (Lead age from `schedule_day`; cadence summary lines from the enforcement example and empty when unconfigured; `coverage_incomplete` reads as unavailable), `tests/outreach-desk/desk-url.test.ts` (`deskNavViews` per role and desk-off). Gates: see the RELEASE section of the LEDGER.
