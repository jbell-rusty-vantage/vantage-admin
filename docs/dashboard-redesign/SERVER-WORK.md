# Server work the redesigned dashboard is waiting on

Written 2026-10-06 after the admin-only pass over docs 01, 02, 03 and 15. Each item names the admin call site that
switches over when the server ships it, so nothing here needs a second design round. Server behaviour stays in
`vantage-main-server`; none of this is forked into the admin.

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

## Bookings and Cancellations (doc 03, Phase 5)

| # | Item | Notes |
|---|---|---|
| B1 | `GET /api/v1/admin/bookings` (`BookingCard` DTO with `cancellation` summary, source snapshot labels, `case_file_summary`) and `GET /api/v1/admin/cancellations` (`CancellationCard` with the booking's deposit and binder) | the Bookings and Cancellations tabs keep `OperationalResourcePage` until then |
| B2 | Phone and email search on bookings and cancellations through the linked Customer and lead; `q` stops matching source, merchant, agent, reason | today's `customer_phone` filter has no server field |

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
- Record a cancellation as the one-screen sheet (doc 03); today `/cancellations/new` is the existing form.
