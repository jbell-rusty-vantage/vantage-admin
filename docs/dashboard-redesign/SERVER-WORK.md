# Server work the redesigned dashboard is waiting on

Written 2026-10-06 after the admin-only passes over docs 01, 02, 03, 15 (first session) and 03 bookings, 06, 16
(second session). Each item names the admin call site that switches over when the server ships it, so nothing here
needs a second design round. Server behaviour stays in `vantage-main-server`; none of this is forked into the admin.

## Today (doc 02)

| # | Item | Where (server) | Admin call site | Size |
|---|---|---|---|---|
| T1 | **`GET /api/v1/admin/money/spend?range=today\|yesterday\|this_week\|this_month`** returning `{ range, generated_at, totals: { lead_spend, cost_per_lead, cost_per_booked_lead, rep_cost_per_lead, unpriced }, by_source_company: [{ source_company, source_company_label, leads, duplicates, rate_label, spend, booked, cost_per_booked, unpriced }], by_rep: [{ agent_id, agent_name, leads_received, calls, booked, rep_cost, cost_per_lead, cost_per_booked, compensation_missing }] }` in the `{ ok, data }` envelope. Spend = Σ `cpl` over non-duplicate leads per New York day; `unpriced` = `unresolved_cpl_count`. | new `src/services/money/` reusing `leadCost.service.ts` and `receiverAgentPerformance.service.ts` | `lib/api/money.ts` `fetchMoneySpend` (already typed); the Money tab stops showing the "waiting on the server" notice and the Overview fallback by itself | small |
| T2 | Add `cpl` and `receiver_agent` to the Daily Operations lead facts so the Spend tile moves between resyncs | `recordFormLeadDailyOperationsFact` and the call equivalent (additive field) | `components/today/pulse-view.tsx` Spend tile (today a "—" that links to Money) | small |
| T3 | `rep_compensation` on Agent (pay basis hourly / daily / monthly, amount, effective date; audited like every Registry change) | Operations Registry service + Changes; Setup → Money UI follows | Money tab by-rep rows (`compensation_missing` → "no rate", never $0) | medium |
| T4 | Deposits-today on the snapshot (the Bookings tile caption) | Daily Operations snapshot `metrics.bookings` | `pulse-view.tsx` Bookings tile caption (omitted today) | trivial |
| T5 | Doc 17 Granot check waiting for approval (fourth Waiting-for-you slot, Leads badge) | doc 17 | `pulse-view.tsx`, `components/layout/use-sidebar-badges.ts` (`leads` badge is `null` today) | later |

Already in place: `intakes.still_open` on the snapshot and `unassigned.count` on the Desk team read drive the Today and
Bookings badges with no new polling.

## Leads workspace (doc 03)

| # | Item | Where (server) | Admin call site | Size |
|---|---|---|---|---|
| L1 | **`GET /api/v1/admin/leads`** returning a typed `LeadCard` DTO across both models (`$unionWith` over `form_leads` and `call_leads`, keyset on `(timestamp, _id)`), filters `kind`, `show=regular\|duplicates\|both`, `status`, `company`, `feed`, `agent`, `from`/`to`/`date_field`, `sort`, plus `granot_priority`, `granot_move_size`, `granot_service_type` exposed | `adminBrowse.service.ts` or a new leads service | `lib/api/leads.ts`: replace the two-list client merge (`mergeLeadPages`) with one infinite query; `components/leads/leads-workspace.tsx` list query | medium |
| L2 | `totals` on the list response (`$facet` over the same filter: count, unassigned, booked, bad) | same endpoint | `components/leads/` summary strip (today: Leads / Form / Call totals only) | small |
| L3 | Search classifier shared by the three list endpoints: job number on **form leads** (`normalized_job_no`, not searched today), phone normalisation (formatted phones miss today), email and name across live, ingested and Granot contact snapshots | `adminBrowse.service.ts` `qFields` / new classifier | `lib/api/leads.ts` `classifyLeadSearch` + `leadListFilters` (today: job → `job_no` on call leads and `q` on form leads; phone → `phone_number` with digits) | small |
| L4 | `POST /api/v1/admin/leads/:id/assign` (sets `receiver_agent`, assignment source `manual`, the same write the Desk uses) | reuse the Desk assignment command keyed by lead id | the card's Assign control (today: the production `PATCH /api/v1/form-leads/:id` / `call-leads/:id` with `receiver_agent`, which records no source) | small |
| L5 | Source-company-level filtering (a company without a feed): accept several `source_granularity_key` values or a `company` filter | `adminBrowse.service.ts` | `leadListFilters` (today a company without a feed is sent as `source_company`, an exact match on the slug or its label snapshots; unverified against production data) | small |
| L7 | `show=both`: the browse service pins `duplicate != true` unless `duplicate=true`, so regular and duplicate leads cannot be read in one list | `adminBrowse.service.ts` duplicate clause | the Showing control (today "Both" shows a note and the regular list) | trivial |
| L8 | `receiver_agent=none` (unassigned) and a `bad_lead` filter; the form `move_date` sort with nulls last and a `move_date` sort on call leads | `adminBrowse.service.ts` | Unassigned and Bad are client-side narrowings of loaded pages today (the summary totals blank while active); Move date sort floors form leads at 2000-01-01 and merges call leads last | small |
| L9 | `to` dates interpreted in Florida time (today the client sends end of day UTC) and a `phone_number` match on normalized digits (today a "contains" match misses formatted phones) | `adminBrowse.service.ts` | `leadListFilters` | small |
| L6 | Case file read + capture-now (doc 04) for the panel's first tab | doc 04 | `components/leads/` lead panel (today: the existing `DetailPanel` tabs) | new |

## Bookings, Cancellations and To finish (docs 03 and 06)

The admin builds the three Bookings tabs on today's browse lists (`booked-leads`, `cancelled-leads`) and case list.
Everything below is additive on those reads; the typed `BookingCard` / `CancellationCard` DTOs of doc 03 are optional
once B1–B6 land.

| # | Item | Where (server) | Admin call site | Size |
|---|---|---|---|---|
| B1 | **`totals` on the `booked-leads` and `cancelled-leads` list responses**: `{ count, total_binder_amount, total_deposit_amount, total_refund_amount, cancelled_count }` from one `$facet` over the same filter | `adminBrowse.service.ts` | `readListTotals()` in `lib/api/bookings.ts`, read by `components/bookings/bookings-workspace.tsx` (Binder total, Deposits total, Cancelled) and `components/cancellations/cancellations-workspace.tsx` (Refunded total). Today the money cards show "—" with the caption "needs server totals"; the list `total` feeds the count cards; nothing is summed from the loaded page | small |
| B2 | `case_file_summary` on bookings (`{ origin, destination, pickup }`, origin and destination as `{ city, state }` or strings) from the latest case file | doc 04 / 14 | `caseFileRouteText` in `components/bookings/booking-card-model.ts` (card line 2; "Route not captured yet" until then) | small, after doc 04 |
| B3 | **Search classifier on bookings and cancellations** (job / phone / email / name as doc 03's table): `q` stops matching source, merchant, agent, reason and cancelled-by; phone and email go through the linked Customer and lead (today `q` has no phone or email field, so those queries find nothing) | `adminBrowse.service.ts` `qFields` or the shared classifier (L3) | `applySearch()` in `lib/api/bookings.ts` (sends `job_no` for a job number, `q` otherwise); the search placeholder copy in `components/bookings/bookings-copy.ts` and `components/cancellations/cancellations-copy.ts` | small |
| B4 | `is_referral_booking` as a list filter (`leadless` exists; Referral does not) | `adminBrowse.service.ts` | `bookingListFilters` + `matchesBookingType` in `lib/api/bookings.ts`: Referral (and With lead, which drops referral rows) narrow the loaded cards today and the count card reads "N of loaded" | trivial |
| B5 | `refund_max` on `cancelled-leads` (`refund_max=0` for "No refund"; `refund_min=0.01` already serves "Refunded") | `adminBrowse.service.ts` | `matchesCancellationRefund` in `lib/api/bookings.ts` (client-side today) | trivial |
| B6 | Source snapshot labels on the `cancelled-leads` list (today the card shows the booking's `employee_source_snapshot` when `booked_lead` is populated, else the stored `source`); `lead_ref` populated consistently (`lead_ref_snapshot` is the fallback for the Lead link) | `adminBrowse.service.ts` populate list | `sourceText` / lead link in `components/cancellations/cancellation-card-model.ts` | trivial |
| B7 | **`case_file_summary` on the Granot lifecycle case list item** (`origin`, `destination`, `pickup`, `total_estimate`, `customer_payment`, `rep`) from the latest case file (doc 06) | lifecycle case list projection, after doc 04 | the optional type is on `GranotLifecycleCaseListItem` in `lib/api/granotLifecycle.ts`; `moveMoneyLine` and the rep tile in `components/intakes/to-finish-card.tsx` fill in with no admin change | small, after doc 04 |
| B8 | `granot_values_used: ["binder", "deposit", …]` on the confirm and update bodies, recorded in the case timeline (doc 06) | Granot lifecycle booking commands | `submit()` in `components/intakes/finish-booking-sheet.tsx`: the Use buttons only fill the fields client-side and nothing unknown is sent today | small, additive |
| B9 | `suggested_agent_id` on the case detail (the case file's rep resolved to an Agent through the Granot CRM username) | lifecycle case detail | `suggestedAgentId()` in `components/intakes/finish-booking-sheet.tsx` matches `case_file_summary.rep`, then `observed_context.granot_username`, against `CatalogItem.granot_crm_username` in the admin today, and says "suggested" only on a match | trivial |
| B10 | `possible_customer_count` on the case list item (the "two possible customers · pick one" line) | lifecycle case list projection | `components/intakes/to-finish-card.tsx` reads `possible_customer_count >= 2` when present; the fallback splits `customer_label` on " / " | trivial |
| B11 | `resolved_from` (or `resolved_on=today`) filter on the case list for "Finished today" | lifecycle case list | `components/intakes/to-finish-page.tsx` reads the first 50 resolved cases and filters to today's New York day in the browser | trivial |
| B12 | Typed `GET /api/v1/admin/bookings` (`BookingCard`, keyset on `(book_date, _id)`, embedded `cancellation`) and `GET /api/v1/admin/cancellations` (`CancellationCard`, `$lookup` of the booking) | new services | `lib/api/bookings.ts` list helpers and the two workspaces' `useInfiniteQuery` calls (one swap each) | later, optional |

## Today → Operations (doc 16)

The admin board renders the two milestone kinds, the `outreach` lane chip and the toast already; until the server
emits the facts nothing appears. Items as doc 16 states them.

| # | Item | Where (server) | Admin call site | Size |
|---|---|---|---|---|
| O1 | New lane `outreach` in `DAILY_OPERATIONS_LANES`, kinds `outreach.rep_goal_met` and `outreach.team_goal_met` in `DAILY_OPERATIONS_KIND_CATALOG` (metric touches `outreach.reps_at_goal`, `outreach.team_goal_met`) | Daily Operations catalog | `lib/api/dailyOperationsBoard.ts` `DAILY_OPERATIONS_MILESTONE_KINDS` (tier A, gold); `usePulseEvents` in `components/today/pulse-view.tsx` may switch to `fetchDailyOperationsEvents({ lane: "outreach" })`; add `outreach` to the lane type in `lib/api/dailyOperations.ts` | medium (with O2–O10) |
| O2 | Crossing detection inside `recountRepDay`: `crossed_goal = previous.actual_confirmed < goal ≤ next.actual_confirmed`, only when `goal_state = "goal"` and `goal > 0` | Desk `recountRepDay` | none (server rule) | — |
| O3 | Fire only when `business_day` is today's New York day; recounts of older days never celebrate | same | none | — |
| O4 | Count `actual_confirmed` only, never `actual_awaiting_confirmation` | same | none | — |
| O5 | Rep fact through `recordDailyOperationsFact`, `dedupe_key = outreach.rep_goal_met:{agent_id}:{business_day}`; payload `agent_id`, name snapshot, `actual`, `goal`, `reached_at`, `count_scope`, rank ("2nd rep at goal today") | same | `readMilestone` in `components/daily/milestone.ts` reads `agent_id`, `agent_name` / `name_snapshot`, `actual`, `goal`, `reached_at`, `rank` (number or words), from the event's `card` first, then its top level. Confirm the field placement when the fact is written | — |
| O6 | Team fact after the rep-day write: when Σ actual ≥ Σ goal crosses, `dedupe_key = outreach.team_goal_met:{business_day}`; payload team actual, team goal, reps at goal, reps on roster, `reached_at` | same | the same reader: `team_actual`, `team_goal`, `reps_at_goal`, `reps_on_roster` | — |
| O7 | `reached_at` = the start of the call that crossed the goal when known, else `computed_as_of` | same | `reachedAt` falls back to the fact's `occurred_at` | — |
| O8 | Never retracted: a later recount that drops the rep keeps the fact; the Team tab shows current truth | same | none | — |
| O9 | Additive snapshot block `outreach: { reps_at_goal, reps_on_roster, team_actual, team_goal }` | Daily Operations snapshot | no consumer yet; a Pulse tile / Team summary number on first paint would read it (add it to `DailyOperationsSnapshot` in `lib/api/dailyOperations.ts` then) | trivial |
| O10 | Record the fact after the rep-day transaction commits and swallow failures, like `publishGoalChangesSafely` | same | none | — |
| O11 | Runtime configuration keys (Mongo, not env): `daily_operations.milestones.rep_goal`, `daily_operations.milestones.team_goal`, `daily_operations.milestones.toast`, default on | runtime configuration | none: the server stops emitting and the toast host receives nothing | trivial |

## Packet amendment (doc 15)

Desk SPECIFICATION §5, the paragraph beginning "Desk look versus the rest of Admin (Owner instruction, 2026-10-04)",
must be amended in the **server copy** of `docs/sales-outreach-desk/` to read *"The Desk's token set is the platform
token set. The Desk owns its shell and layouts; the tokens and primitives are shared."*, then PACKET-MANIFEST.json
regenerated and the packet re-mirrored to the admin. The admin mirror was not edited in this pass so the manifest check
still holds. Without the amendment a future agent following the packet would correctly refuse to apply the look outside
`/outreach-desk`.

## Follow-ups inside the admin (no server dependency)

- Have the Desk import the `components/ui/crm/` primitives back (doc 15 step 3). The Desk keeps its `od-*` primitives
  today because its Playwright suite selects them; the tokens are already shared, so this is a refactor, not a restyle.
- Lead panel tabs per doc 03 (Case file · Contact · Timeline · Booking · Message · Edit · Sheets) once doc 04 and
  doc 18 land; today the panel is the existing `DetailPanel` (Summary · Contact · Message · Actions · Production · Source).
- The Lead picker's booking mode is `components/cancellations/booking-picker.tsx` (same search box and classifier,
  active bookings only); Reconciliation's attach (`booking-lead-browser.tsx`, keyed by a reconciliation case) and the
  Manual Connect section were not migrated to `components/records/lead-picker.tsx` because neither is a drop-in.
- The milestone toast (`components/daily/milestone-toast.tsx`, mounted in the dashboard shell for Owner and Manager)
  opens its own `EventSource`; on Today → Operations it stays quiet because the feed pins the card, but two
  connections are open there. Folding it into one shared stream provider is a refactor once the server emits milestones.
- The board's CSS lives in `components/daily/daily-board-css.ts` (classes `dboard-*`, rendered as a React `<style>`
  with `precedence`); the To finish page's in `components/intakes/to-finish.css`. Both can move into `app/crm.css`.
