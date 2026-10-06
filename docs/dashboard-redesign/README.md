# Dashboard redesign — delivery notes (admin, 2026-10-06)

Spec: the workspace-root packet `dashboard-redesign-proposal/` (docs 01, 02, 03, 06, 15, 16, 17 and 19 built here; the rest
not yet). Built on `main` in this repository only, in three sessions on 2026-10-06. Server work the pages need is listed
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
| 06 | Bookings to finish (`/intakes`): open booking cases as compact cards with one Finish, "Finished today" collapsed, the finish sheet (Customer · Official booking · File it with No action; **2026-10-06, the Owner's ask:** the Use buttons and the Granot hints beside Book date, Binder, Deposit and the suggested Agent are gone, so nothing is recommended to the Owner's manager; Granot's figures stay as facts in "What Granot sent"), **No action straight from the card** (opens in place, same reasons and lock as the sheet, `components/intakes/no-action-panel.tsx`); a review card offers No action and Review only on the existing lifecycle commands and rules | `components/intakes/` (`to-finish-page.tsx`, `to-finish-card.tsx`, `finish-booking-sheet.tsx`, `to-finish-copy.ts`), `lib/api/bookingsToFinish.ts` |
| 16 | Today → Operations: Board (lane tiles, one live feed with Needs you / Everything / lane chips, spotlight cards, rows, burst folding, the "N new ↑" buffer, fact drawer) and Lanes (`?view=lanes`, rows that expand in place, `?lane=` solo); presentation tiers with per-viewer overrides in Colours & visibility; milestone cards, the 30-minute pin, Pulse Highlights (tier A + milestones), Reps today / Team marks, the bottom-right toast in the shell | `components/daily/`, `components/today/`, `lib/api/dailyOperationsBoard.ts`, `components/layout/dashboard-shell.tsx` (`MilestoneToastHost`) |
| 19 | Setup (`/setup/*`): one route with a left sub-navigation, eight sections, Owner words, the CRM look | `app/(dashboard)/setup/`, `components/setup/` (`setup-shell.tsx`, `setup-sections.ts`, `setup-copy.ts`, `setup.css`), `lib/setup/setup-links.ts`, `lib/setup/setup-redirects.ts` |
| 19 | Lead sources (`/setup/lead-sources`): Things that need you, the source tree (feeds → Granot names · inbound numbers · lead cost), the Granot names and Inbound numbers views, the Feed / Granot name / Inbound number / Lead cost sheets, Add a lead source in six screens, Turn it on with the default feed chosen explicitly | `components/setup/lead-sources/`, `lib/setup/readiness.ts` |
| 19 | Lead costs (`/setup/lead-costs`): the grid by company with one effective date and one Save, Fix past leads, the read-only Old rate book; the per-feed Lead cost sheet with Periods | `components/setup/lead-costs/` |
| 19 | People & access (`/setup/people`): one person, one card (Agent · Dashboard login · Extension · RingCentral · Pay), the four Edit sheets on the existing commands, Add person, Not matched to a person | `components/setup/people/` (`people-model.ts` is the client-side join) |
| 19 | Merchants (`/setup/merchants`; doc 19 called it Money, renamed because only Merchants live there): Merchants as cards with rename / deactivate / reactivate | `components/setup/merchants/` |
| 19 | Carriers (`/setup/carriers`): the table, create / edit, CSV import with Patch as the default and a browser preview | `components/setup/carriers/`, `lib/setup/carriers-preview.ts` |
| 19 | Connections & health (`/setup/connections`, Owner): Granot · RingCentral · Google Sheets cards, the Registry signing status, compatibility statement and health findings | `components/setup/connections/` |
| 19 | External Sheet Ingestion (`/setup/sheet-ingestion`): the Best Relocation sheet pull, embedded; split out of Connections on the Owner's ask | `components/setup/sheet-ingestion/` |
| 19 | Website (`/setup/website`, Owner): Testimonials re-homed | `components/setup/website/` |
| 19 | Change history (`/setup/changes`): Entity · Who · When and the diff | `components/setup/changes/` |
| 17 | **Automations** (`/automations`, Owner only; a new seventh sidebar tab, 2026-10-06, for operations the Owner starts and approves; more Granot reads and extractions land here later): the hub with one card per automation, its health line ("Last check ‹when› · applied N") and the Waiting notice; the Automations badge counts the checks waiting for approval | `components/automations/` (`automations-hub.tsx`, `automations-copy.ts`, `automations.css`), `components/layout/dashboard-nav.tsx`, `components/layout/use-sidebar-badges.ts` |
| 17 | **Granot updates** (`/automations/granot-updates`, Owner only; supersedes doc 05's placement under Connections & health and the brief's placement under Leads, on the Owner's instruction): ① Choose as one card (Form leads · Call leads toggles saying what each fills, Granot names as chips grouped by Source Company with not-ready names greyed and Fix in Setup ›, presets Since last check · Today · Yesterday · Last 7 days · Custom with a two-month range picker, Opened / Booked, the sentence, **Check Granot**, always `workflow: "apply"`), the Waiting for you notice, History grouped per check with All · Waiting · Done · Failed and Load more | `components/automations/granot-updates/start-page.tsx`, `start-new-check.tsx`, `start-range-picker.tsx`, `start-history.tsx` |
| 17 | **The check page** (`/automations/granot-updates/[checkId]`, `checkId` = `run_group_id`): ② the honest progress strip (signed in · reading N / M · matching) with "You can leave this page", failures as sentences + Try again; ③ four summary cards, tabs Ready · Needs a look · Not found · No change · Sources (active tab only), Lead type chip, Hide fallback matches, the table Job # (copy) · Lead (opens the Leads `DetailPanel` on `?lead=&lk=`) · Granot name · What changes (before → after per field) · Matched by (warnings on hover), the sticky bar and **one** confirmation dialog that sends one approve per plan with its own checksum; a 409 shows "This plan changed or expired · Check again"; ④ Applied · Already current · Failed · Pending cards, tabs, rows joined to their planned action, per-row Audit details drawer (the only place ids and the checksum appear), Export CSV built in the browser | `check-page.tsx`, `check-progress.tsx`, `check-review.tsx`, `check-approve-dialog.tsx`, `check-results.tsx`, `check-cells.tsx` |
| 17 | The pure model (what changes, job number, matched by, four buckets, one check per group, Since last check, outcome words, approval summary, results CSV, failure sentences, history rows) and the data layer (`normalizeAction` keeps `patch`, `expected`, `preview`, `lead_id`, `table_section`, `job_no`, `display`; `fetchGranotRuns({ limit })`; the run's `failure` block) | `lib/automations/granot-updates-model.ts`, `lib/api/granotAutomation.ts`, `components/automations/granot-updates/use-granot-updates.ts` |
| 17 | Today → Pulse → Waiting for you gets the fourth slot "N Granot updates ready · window · expires in Nh → Review" (only while a check waits); Setup → Connections & health → Granot keeps a health line and **Open Granot updates** | `components/today/pulse-view.tsx`, `components/today/today-copy.ts`, `components/setup/connections/partner-cards.tsx` (`GranotUpdatesLine`) |
| 17 | Retired: `components/ingestion/granot-automation-dashboard.tsx`, the ingestion subnav and `INGESTION_COPY`, `/ingestion/granot` (now a redirect); `/ingestion` keeps Best Relocation only | `components/ingestion/`, `app/(dashboard)/ingestion/` |

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
| `/operations-registry` (bare or an unknown `tab`) | `/setup/lead-sources` |
| `?tab=lead-sources\|sources[&entity=X][&feed=Y]` | `/setup/lead-sources[?source=X][?feed=Y]` |
| `?tab=granot-names\|granot-sources[&entity=X]` | `/setup/lead-sources?view=granot[&granot=X]` |
| `?tab=inbound-numbers\|ringcentral[&entity=X]` | `/setup/lead-sources?view=numbers[&number=X]` |
| `?tab=lead-costs\|cpl` · `…&cpl_mode=corrections` | `/setup/lead-costs` · `/setup/lead-costs?view=fix` |
| `?tab=legacy-cpl` | `/setup/lead-costs?view=old` |
| `?tab=agents[&entity=X]` · `?tab=users` | `/setup/people[?person=X]` |
| `?tab=merchants` | `/setup/merchants` |
| `?tab=moving-carriers` · `/settings` | `/setup/carriers` |
| `?tab=changes` | `/setup/changes` |
| `?tab=overview` | `/setup/connections` |
| `/extension` · `/testimonials` | `/setup/people` · `/setup/website` |
| `/setup` | `/setup/lead-sources` (a page redirect; the hub kept for one release) |
| `/ingestion/granot` · `/ingestion/granot?run=X` | `/automations/granot-updates` · `/automations/granot-updates/X` (doc 17; the table in `lib/automations/granot-updates-redirects.ts`, pinned by its test) |

`/cancellations/new`, `/bookings/new`, `/bookings/reconciliation`, `/intakes`, `/reporting/*`, `/granot-lifecycle/*`, `/ingestion/*`
keep their routes; the sidebar highlights the item that owns them. The table in `lib/setup/setup-redirects.ts` is the one `next.config.ts`
installs; `tests/setup-shell.test.ts` keeps it equal to `rewriteRegistryHref` in `lib/setup/setup-links.ts`, which the sections use for
server-produced deep links.

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
- **Setup → Lead sources:** `view=sources|granot|numbers` (default sources), `source=<company id>`, `feed=<feed id>`,
  `edit=feed|granot|number|cost|source` (`source` is the company sheet: rename, Master Sheet, On / Off), `granot=<Granot name id>`,
  `number=<inbound number id>`, `new=1` (Add a lead source); `feed=new`, `granot=new`, `number=new` open a blank sheet.
- **Setup → Lead costs:** `view=grid|fix|old` (default grid), `focus=<feed id>` (the Set lead cost deep link).
- **Setup → People & access:** `person=<agent id>`, `edit=roster|login|extension|ringcentral`, `new=1` (Add person).
- **Setup → Carriers:** `import=1` (the CSV import sheet), `q`, `inactive=1`.
- **Setup → Website:** the Testimonials keys unchanged (`q`, `reviewer_name`, `rating`, `from`, `to`, `direction`, `page`, `limit`).
- **Setup → Change history:** `entity`, `who`, `from`, `to`, `page`, `limit`, `change=<id>` (the open diff).
- **Automations → Granot updates:** the start page holds its choices in component state (nothing in the URL); the check page
  is `/automations/granot-updates/<checkId>` (`checkId` = `run_group_id`; a run id from an old `?run=` link also resolves) and
  takes `lead=<id>&lk=form|call[&panel=…]` for the lead panel, the same keys as Leads.

## Roles

| Role | Sidebar | Home |
|---|---|---|
| Owner | all seven (Automations is Owner-only: route guard, shell prefix and the route layout agree) | `/` (Today) |
| Admin | Leads, Bookings, Insights, Setup (read-only; People shows the roster only; no Connections or Website) | `/leads` (Today redirects there) |
| Manager | Today → Operations only, Outreach Desk | `/` (Today, Operations tab) |
| Rep | Outreach Desk | `/outreach-desk` |

## Desk packet amendment still owed

Doc 15 asks for Desk SPECIFICATION §5 ("Desk look versus the rest of Admin", the paragraph that confines the look to
`/outreach-desk`) to read: *"The Desk's token set is the platform token set. The Desk owns its shell and layouts; the
tokens and primitives are shared."* The packet is a byte-identical mirror of the server copy (PACKET-MANIFEST.json), so
the amendment is made in the server copy first and re-mirrored here. Not done in this admin-only pass; see SERVER-WORK.md.

## Not built (later docs)

04 Granot case file, 07 Sheets, 09–14, 18 Job Timeline chronicle (the full page moved to `/leads/timeline`;
the panel tab is not built). Doc 17 shipped on 2026-10-06 under the Automations tab (the Leads badge stays empty; the
badge is on Automations). The booking panel keeps the `DetailPanel` tabs (Summary · Contact · Cancellation · Actions ·
Production · Source) until docs 04 and 18 land; the cancellation's own Edit stays in the cancellations panel reached
from the Cancellation tab.

## Not verified in a browser

Both sessions were admin-only with no dev server walk. The Owner's first look is the acceptance check for: the booking
and cancellation cards against production payloads (populated `cancelled`, `booked_lead`, `agent_allocations`,
`sheet_sync`), the finish sheet against a real open case (File booking, No action from the card), the Record a
cancellation submit, the Operations Board feed under live facts (buffer, folding, pairing), the Lanes expand-in-place,
and the toast (which needs the server milestones).

The doc 17 session (2026-10-06) was also admin-only with no browser walk. The Owner's first look is the acceptance check
for: the Granot-name chips against the production catalog (the Registry join and the not-ready reasons), a real check
from Check Granot through the progress strip to the review (the counts, the What changes column from `patch` /
`expected`, the lead panel from a row), one approval through the dialog (one approve per plan; the 409 path), the
results page and the CSV, the Today slot and the Automations badge while a check waits, and the `/ingestion/granot`
redirect. Deviations from doc 17 and the brief: the pages live under **Automations** (a new Owner-only sidebar tab, by
the Owner's instruction) instead of Leads, so there is no Granot updates button in the Leads header and the badge sits
on Automations; "Which Granot sources" reads "Which Granot names" because the language deck bans the phrase "granot
sources"; Try again / Check again re-create the check with Opened dates unless the choice was made in this browser tab
(G6); failures show the generic sentence until the server projects `failure` (G5).
