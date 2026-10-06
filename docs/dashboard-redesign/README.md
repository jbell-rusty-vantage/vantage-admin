# Dashboard redesign — delivery notes (admin, 2026-10-06)

Spec: the workspace-root packet `dashboard-redesign-proposal/` (docs 01, 02, 03, 06, 15 and 16 built here; the rest
not yet). Built on `main` in this repository only, in two sessions on 2026-10-06. Server work the pages need is listed
in [SERVER-WORK.md](SERVER-WORK.md).

## What shipped

| Doc | Surface | Where |
|---|---|---|
| 15 | One CRM look: `--crm-*` tokens on `:root`, the dashboard theme under `[data-ui="crm"]`, the Desk aliased to the tokens, Plus Jakarta Sans app-wide, `components/ui/crm/` primitives, the shared `Button` restyled under the theme | `app/globals.css`, `app/crm.css`, `components/ui/crm/`, `components/outreach-desk/styles/outreach-desk.css`, `app/layout.tsx` |
| 01 | Six-item sidebar (Today · Leads · Bookings · Outreach Desk · Insights · Setup), live badges, ⌘K record search, environment chip, identity at the foot, topbar freshness chips, phone bottom bar, permanent redirects for every old route | `components/layout/`, `next.config.ts`, `server/auth/` |
| 01 | Insights (`/insights` Analytics, `/insights/sheets` Sheets), Setup hub (`/setup`), Bookings tabs (To finish · All bookings · Cancellations · Reconciliation · Precise Booking Form), `/leads/timeline` | `app/(dashboard)/insights`, `app/(dashboard)/setup`, `components/setup/`, `components/bookings/bookings-subnav.tsx`, `app/(dashboard)/bookings/cancellations` |
| 02 | Today (`/`): Pulse · Operations · Team · Money | `app/(dashboard)/page.tsx`, `components/today/`, `lib/api/money.ts` |
| 03 | Leads workspace (`/leads`): one list over both lead kinds, filter chips, cards, right panel, Verify in Master Sheet, New lead sheet | `app/(dashboard)/leads`, `components/leads/`, `lib/api/leads.ts` |
| 03 | The shared record frame: URL state, infinite load on the dashboard scroll root, search + sort row, filter chips, the select bar and verdicts of Verify in Master Sheet, the card stack states, the 480 px drawer; the shared Lead picker | `components/records/` |
| 03 | All bookings (`/bookings`): booking cards per the doc 03 table, Status · Source · Agent + More filters, three sorts, summary strip, `DetailPanel` with a new Cancellation tab, New booking header button | `components/bookings/`, `lib/api/bookings.ts`, `components/operational/operational-detail-panel.tsx` (`CancellationTab`) |
| 03 | Cancellations (`/bookings/cancellations`): cancellation cards, Reason · Source · Agent + More, the Aug 2026 empty state, a card opens its booking's Cancellation tab; Record a cancellation as the one-screen sheet (`/cancellations/new`) with the booking picker | `components/cancellations/`, `app/(dashboard)/cancellations/new` |
| 06 | Bookings to finish (`/intakes`): open booking cases as compact cards with one Finish, "Finished today" collapsed, the finish sheet (Customer · Official booking with Use buttons · File it with No action) on the existing lifecycle commands and rules | `components/intakes/` (`to-finish-page.tsx`, `to-finish-card.tsx`, `finish-booking-sheet.tsx`, `to-finish-copy.ts`), `lib/api/bookingsToFinish.ts` |
| 16 | Today → Operations: Board (lane tiles, one live feed with Needs you / Everything / lane chips, spotlight cards, rows, burst folding, the "N new ↑" buffer, fact drawer) and Lanes (`?view=lanes`, rows that expand in place, `?lane=` solo); presentation tiers with per-viewer overrides in Colours & visibility; milestone cards, the 30-minute pin, Pulse Highlights (tier A + milestones), Reps today / Team marks, the bottom-right toast in the shell | `components/daily/`, `components/today/`, `lib/api/dailyOperationsBoard.ts`, `components/layout/dashboard-shell.tsx` (`MilestoneToastHost`) |

## Redirects (permanent, query string translated)

| Old | New |
|---|---|
| `/form-leads[?record=X]` | `/leads?kind=form[&lead=X&lk=form]` |
| `/duplicate-form-leads[?record=X]` | `/leads?kind=form&show=duplicates[&lead=X&lk=form]` |
| `/call-leads[?record=X]` | `/leads?kind=call[&lead=X&lk=call]` |
| `/duplicate-call-leads[?record=X]` | `/leads?kind=call&show=duplicates[&lead=X&lk=call]` |
| `/search?q=` | `/leads?q=` |
| `/manual` · `/manual?tab=attach` | `/leads?new=1` · `/bookings/reconciliation?connect=1` |
| `/job-timeline?job=` | `/leads/timeline?job=` |
| `/cancellations` · `/bookings?tab=cancellations` | `/bookings/cancellations` |
| `/daily` | `/?tab=operations` (Board) |
| `/daily?lane=X` | `/?tab=operations&view=lanes&lane=X` |
| `/analytics` · `/reporting` | `/insights` · `/insights/sheets` |

`/cancellations/new`, `/bookings/new`, `/bookings/reconciliation`, `/intakes`, `/reporting/*`, `/operations-registry`, `/extension`,
`/granot-lifecycle/*`, `/ingestion/*`, `/testimonials` keep their routes; the sidebar highlights the item that owns them.

## URL contracts

- **Today:** `/?tab=pulse|operations|team|money`; Operations adds `view=board|lanes` (default board; a `lane` with no
  `view` means lanes) and keeps the Daily Operations keys (`lane` on the Lanes view, `company`, `quiet_priorities`).
- **Leads:** `q`, `kind=form|call`, `show=duplicates|both`, `status=open|booked|cancelled|bad`, `company`, `feed`, `agent`, `from`, `to`,
  `date_field=timestamp|move_date`, `sort=received_desc|received_asc|move_soonest`, `lead=<id>&lk=form|call[&panel=…]`, `new=1`,
  plus `no_sync`, `move_size`, `local` from More filters.
- **All bookings:** `q`, `status=active|cancelled|all` (default active), `source`, `agent`, `merchant`, `from`, `to`,
  `type=lead|leadless|referral`, `local`, `binder=2k|4k`, `sort=book_desc|book_asc|binder_desc`, `record=<id>[&panel=…]`
  (`panel=cancellation` is the cancellation tab), `connect=1`.
- **Cancellations:** `q`, `reason`, `source`, `agent`, `merchant`, `from`, `to`, `refund=yes|no`, `by`,
  `sort=cancel_desc|cancel_asc|refund_desc`, `record=<id>[&panel=…]` (fallback panel when the booking is not populated).
- **Record a cancellation:** `/cancellations/new[?booked_lead=<id>]`.
- **To finish:** `/intakes[?case=<id>]` (the finish sheet); the old `tab`, `state`, `job`, `cursor` keys are ignored.
- **Reconciliation:** `/bookings/reconciliation?connect=1`.

## Roles

| Role | Sidebar | Home |
|---|---|---|
| Owner | all six | `/` (Today) |
| Admin | Leads, Bookings, Insights, Setup (read-only Registry) | `/leads` (Today redirects there) |
| Manager | Today → Operations only, Outreach Desk | `/` (Today, Operations tab) |
| Rep | Outreach Desk | `/outreach-desk` |

## Desk packet amendment still owed

Doc 15 asks for Desk SPECIFICATION §5 ("Desk look versus the rest of Admin", the paragraph that confines the look to
`/outreach-desk`) to read: *"The Desk's token set is the platform token set. The Desk owns its shell and layouts; the
tokens and primitives are shared."* The packet is a byte-identical mirror of the server copy (PACKET-MANIFEST.json), so
the amendment is made in the server copy first and re-mirrored here. Not done in this admin-only pass; see SERVER-WORK.md.

## Not built (later docs)

04 Granot case file, 05 Setup rename and sections (the hub links to today's pages), 07 Sheets, 09–14, 17 Granot
updates (the Leads badge stays empty until then), 18 Job Timeline chronicle (the full page moved to `/leads/timeline`;
the panel tab is not built). The booking panel keeps the `DetailPanel` tabs (Summary · Contact · Cancellation · Actions ·
Production · Source) until docs 04 and 18 land; the cancellation's own Edit stays in the cancellations panel reached
from the Cancellation tab.

## Not verified in a browser

Both sessions were admin-only with no dev server walk. The Owner's first look is the acceptance check for: the booking
and cancellation cards against production payloads (populated `cancelled`, `booked_lead`, `agent_allocations`,
`sheet_sync`), the finish sheet against a real open case (Use buttons, suggested agent, File booking), the Record a
cancellation submit, the Operations Board feed under live facts (buffer, folding, pairing), the Lanes expand-in-place,
and the toast (which needs the server milestones).
