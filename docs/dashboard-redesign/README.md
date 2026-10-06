# Dashboard redesign — delivery notes (admin, 2026-10-06)

Spec: the workspace-root packet `dashboard-redesign-proposal/` (docs 01, 02, 03 and 15 built here; 04–18 not yet).
Built on `main` in this repository only. Server work the pages need is listed in [SERVER-WORK.md](SERVER-WORK.md).

## What shipped

| Doc | Surface | Where |
|---|---|---|
| 15 | One CRM look: `--crm-*` tokens on `:root`, the dashboard theme under `[data-ui="crm"]`, the Desk aliased to the tokens, Plus Jakarta Sans app-wide, `components/ui/crm/` primitives, the shared `Button` restyled under the theme | `app/globals.css`, `app/crm.css`, `components/ui/crm/`, `components/outreach-desk/styles/outreach-desk.css`, `app/layout.tsx` |
| 01 | Six-item sidebar (Today · Leads · Bookings · Outreach Desk · Insights · Setup), live badges, ⌘K record search, environment chip, identity at the foot, topbar freshness chips, phone bottom bar, permanent redirects for every old route | `components/layout/`, `next.config.ts`, `server/auth/` |
| 01 | Insights (`/insights` Analytics, `/insights/sheets` Sheets), Setup hub (`/setup`), Bookings tabs (To finish · All bookings · Cancellations · Reconciliation · Precise Booking Form), `/leads/timeline` | `app/(dashboard)/insights`, `app/(dashboard)/setup`, `components/setup/`, `components/bookings/bookings-subnav.tsx`, `app/(dashboard)/bookings/cancellations` |
| 02 | Today (`/`): Pulse · Operations · Team · Money | `app/(dashboard)/page.tsx`, `components/today/`, `lib/api/money.ts` |
| 03 | Leads workspace (`/leads`): one list over both lead kinds, filter chips, cards, right panel, Verify in Master Sheet, New lead sheet | `app/(dashboard)/leads`, `components/leads/`, `lib/api/leads.ts` |

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
| `/daily[?lane=…]` | `/?tab=operations[&lane=…]` |
| `/analytics` · `/reporting` | `/insights` · `/insights/sheets` |

`/cancellations/new`, `/bookings/new`, `/bookings/reconciliation`, `/intakes`, `/reporting/*`, `/operations-registry`, `/extension`,
`/granot-lifecycle/*`, `/ingestion/*`, `/testimonials` keep their routes; the sidebar highlights the item that owns them.

## URL contracts

- **Today:** `/?tab=pulse|operations|team|money`; Operations keeps the Daily Operations keys (`lane`, `company`, `quiet_priorities`).
- **Leads:** `q`, `kind=form|call`, `show=duplicates|both`, `status=open|booked|cancelled|bad`, `company`, `feed`, `agent`, `from`, `to`,
  `date_field=timestamp|move_date`, `sort=received_desc|received_asc|move_soonest`, `lead=<id>&lk=form|call[&panel=…]`, `new=1`,
  plus `no_sync`, `move_size`, `local` from More filters.
- **Bookings:** `/bookings?record=<id>`, `/bookings/cancellations?record=<id>`, `/bookings/reconciliation?connect=1`.

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

04 Granot case file, 05 Setup rename and sections (the hub links to today's pages), 06 Bookings to finish, 07 Sheets,
09–14, 16 live-feed tiers and milestones, 17 Granot updates (the Leads badge stays empty until then), 18 Job Timeline
chronicle (the full page moved to `/leads/timeline`; the panel tab is not built).
