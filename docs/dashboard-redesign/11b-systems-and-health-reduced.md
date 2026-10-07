# 11b · Systems & health, reduced (locations + capacity runway)

Written 2026-10-07. **This is the build spec. It replaces doc 11 for the first build.** Docs 11, 12 and 13 live in the workspace-root packet `dashboard-redesign-proposal/`; this copy is the one in the repository. It takes a subset of 11, doc 12 and doc 13. The numbers come from the read-only gather of 2026-10-06 (workspace-root `systems-health-gather/PLAN.md`), adjusted for the disk trim of 2026-10-07 (workspace-root `DISK-TRIM.md`, server `c4382ce9`).

## What the Owner asked for

1. **Where everything lives:** the browser extension install link, the main site, the partner landing pages, and the other properties. Each has one place to find it.
2. **Master Sheet health**, with a projection of how long until a sheet is over capacity.
3. **Database storage**, with a projection of how long until the disk is over capacity.

Each projection answers one question in words: **"How long until this is full?"**

## The page

One new Owner-only Setup section: **Setup › Systems** at `/setup/systems`. It sits next to Connections. The page has two parts, Locations on top and Capacity below. There are no tabs.

```
Setup › Systems                                                                  checked 9:14 AM  [ Refresh ]

WHERE THINGS LIVE
  Granot Sync extension   chromewebstore.google.com/detail/granot-sync/mnfi…   [Install ↗] [Copy]  Code ↗ (personal account)
  Main site               www.vantagehomemovers.com                             [Open ↗]    [Copy]  Code ↗  Vercel ↗
  Partner landing pages   vantagemoves.com  /top10 · /tbm · /tbm-primes · /getmovers   [Open ↗] [Copy]  Code ↗  Vercel ↗
  Old partner site        vantagequotes.com (WordPress; partner paths retired)  [Open ↗]    [Copy]
  Dashboard               vantage-admin-rho.vercel.app                          [Open ↗]    [Copy]  Code ↗  Vercel ↗
  Server (API)            vantage-movers-main-server.vercel.app                 [Open ↗]    [Copy]  Code ↗  Vercel ↗  Logs ↗
  MCP server              vantage-movers-mcp.vercel.app/api/mcp                 [Copy]              Code ↗  Vercel ↗
  Master Leads            Google Sheets                                         [Open ↗]
  Master Booked           Google Sheets                                         [Open ↗]
                                                                                              [ Edit locations ]

CAPACITY
┌ Database (MongoDB Atlas) ──────────────────────────────────────────────────────────── ● Healthy ┐
│ Disk  9.0 of 13.9 GB used   █████████████░░░░░░░  65%                                          │
│       Business data 0.55 GB · Replication log 6.0 GB (≈ 5 GB reclaimable) · System ≈ 2.5 GB     │
│ Time until 90% full:  about 2 years 7 months  (≈ May 2029)       growing ≈ 4 MB/day            │
│ Time until full:      about 3 years 7 months  (≈ May 2030)       estimate · 3 of 7 days measured│
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
┌ Master Leads ──────────────────────────────────────────────────────────── ● Needs attention (red) ┐
│ Biggest tab  Forms 6,724 of 40,000 rows   ███░░░░░░░░░░░░░░░░░  17%      +1,300 rows / month   │
│ Workbook     363,022 of 10,000,000 cells  █░░░░░░░░░░░░░░░░░░░  3.6%     +45,000 cells / month │
│ Time until a new workbook is needed:  about 2 years 1 month (Forms hits 40,000 ≈ Nov 2028)      │
│ Time until Google's cell cap:         more than 15 years                                        │
│ Sync  last write 2 min ago ✓ · 1 pending · 0 failed · ⚠ 3 stuck since Jul 29                    │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
┌ Master Booked ──────────────────────────────────────────────────────────────────────── ● Healthy ┐
│ Biggest tab  Booked Deals 883 of 40,000 rows · +185 rows / month                                │
│ Time until a new workbook is needed:  more than 15 years                                        │
│ Last cancellation row: Aug 20, 2026                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Build the page in the CRM look (doc 15), using the existing Setup shell and `setup.css`.

## Part 1 · Locations

### The list (seed values, verified 2026-10-06)

| Key | Label | Main link | Code | Host / logs |
|---|---|---|---|---|
| `extension` | Granot Sync extension | https://chromewebstore.google.com/detail/granot-sync/mnfinkiglgagkfokimdnpkhlgemjnhfd (**Install**) | https://github.com/Overton77/vantage-movers-browser-extensions, marked **personal account** | Chrome Web Store listing (same as the main link) |
| `main_site` | Main site | https://www.vantagehomemovers.com | `jbell-rusty-vantage/vantage-movers-clients` → `apps/main-site` | Vercel `vantage-movers-clients-main-site` |
| `partner_pages` | Partner landing pages | https://vantagemoves.com, with paths `/top10`, `/tbm`, `/tbm-primes`, `/getmovers` shown as chips that each open | `jbell-rusty-vantage/vantage-movers-clients` → `apps/clients` | Vercel `vantage-movers-clients` |
| `wordpress` | Old partner site | https://vantagequotes.com (note: "WordPress. Partner paths moved to vantagemoves.com") | none | none known |
| `dashboard` | Dashboard | https://vantage-admin-rho.vercel.app | `jbell-rusty-vantage/vantage-admin` | Vercel `vantage-admin` |
| `server` | Server (API) | https://vantage-movers-main-server.vercel.app | `jbell-rusty-vantage/vantage-movers-server` | Vercel `vantage-movers-main-server`, plus Logs |
| `mcp` | MCP server | https://vantage-movers-mcp.vercel.app/api/mcp (Copy only; it returns 401 in a browser) | `jbell-rusty-vantage/vantage-movers-mcp` | Vercel `vantage-movers-mcp` |
| `master_leads` | Master Leads | `https://docs.google.com/spreadsheets/d/<MASTER_LEADS_SHEET_ID>` | — | — |
| `master_booked` | Master Booked | `https://docs.google.com/spreadsheets/d/<MASTER_BOOKED_SHEET_ID>` | — | — |

Vercel links follow two patterns:

- Project: `https://vercel.com/vantage-4d3db9ef/<project>`
- Logs: `https://vercel.com/vantage-4d3db9ef/<project>/logs`

### Where the list is stored

The standing rule is that configuration lives in Mongo and not in env vars. A domain cut-over must not need a redeploy, so the list is a runtime configuration document:

- The server seeds it with the table above the first time it is read.
- The Owner changes it with **Edit locations**, an inline form with one row per key. A URL must be `https://`. The key set is fixed; only labels, links and notes can change.
- Every save records who changed what, the same way other Setup edits are recorded, so it shows in Setup › Change history.

The two Master Sheet links are not stored in this document. The server builds them from `MASTER_LEADS_SHEET_ID` and `MASTER_BOOKED_SHEET_ID`, which is wiring. Sheet ids are not secrets (server `docs/knowledge/environment.md`).

Each row has Open (or **Install** for the extension) and Copy, which copies the URL. Code and Host appear only where they exist.

## Part 2 · Capacity

### How "time until full" is computed (shared by every card)

1. **Daily snapshot.** A new cron runs once a day at about 04:45 New York (`45 8 * * *` UTC). It writes one row to `capacity_snapshots`:
   ```
   { day (New York date, unique),
     database: { fs_used_bytes, fs_total_bytes, data_bytes, oplog_storage_bytes, oplog_max_bytes },
     sheets:   [{ workbook: master_leads | master_booked, grid_cells,
                  tabs: [{ name, filled_rows, grid_cells }] }] }
   ```
   There is no TTL. That is one small row a day, about 30 KB a year.
2. **Growth rate.** Take a least-squares slope over the last 30 snapshots (at least 7 are required) for each measure.
3. **Runway.** Divide what is left before the limit by the slope, and show the result as a duration and an approximate month:
   - "about 2 years 7 months (≈ May 2029)"
   - beyond 5 years: **"more than 5 years"**
   - beyond 15 years, for sheets: **"more than 15 years"**
   - a slope of zero or less: **"not growing"**
4. **Before 7 snapshots exist,** use the seed rate below and label the line **"estimate · N of 7 days measured"**. That label keeps a guess from reading like a measurement.

The projection logic is one pure function, `projectRunway(points, limit, now)` → `{ rate_per_day, days_left, date, label, basis: "measured" | "estimate" }`. It is unit-tested and shared by all three cards.

### Database card

**What it shows:**

- Disk used of total, with a bar.
- One breakdown line: business data, replication log (and how much of it is reclaimable), system.
- Growth per day.
- **Time until 90%** and **Time until full**.
- A muted caveat line: "Atlas tier and storage auto-scaling are not known yet. If auto-scaling is on, reaching 90% grows the disk and the bill instead of failing."

**Data source.** `db.stats` on each database gives `fsUsedSize`, `fsTotalSize`, `storageSize` and `indexSize`. The oplog figures come from `collStats` on `local.oplog.rs`. The app's database user can already read both.

**The rate to project.** Use the **larger** of two slopes:

- the slope of `fs_used_bytes`;
- the slope of `data_bytes` (storage plus indexes, summed over every database).

The reason is the trim. It freed about 380 MB inside the data files, and WiredTiger reuses that space before the file grows. While that happens, disk use stays flat even though the data is growing. Taking the data slope keeps the forecast honest during that period.

**Seed estimate (until 7 snapshots exist): ≈ 4 MB/day.** It comes from the 2026-10-06 gather:

- The permanent pace was 18 MB/day.
- The audit trail added about 9.9 MB/day. The trim stopped those writes.
- Raw RingCentral events added about 4.2 MB/day. They now expire after 7 days, so they plateau at about 30 MB.
- What remains is about 4 MB/day.

This figure has not been measured since the trim. Confirming it is the main job of the first week of snapshots.

| Scenario, from 9.02 of 13.85 GB used | 90% (12.47 GB) | Full |
|---|---|---|
| Before the trim (15.5 MB/day, doc 13's planning rate) | ≈ May 2027 | ≈ Aug 2027 |
| **After the trim (≈ 4 MB/day, seed)** | **≈ May 2029** | **≈ May 2030** |
| After the trim plus the oplog `compact` (+≈ 5 GB) | more than 5 years | more than 5 years |

The oplog compact is the largest lever still available. It is an Atlas operation, run one node at a time, and still owed (DISK-TRIM.md). This spec does not run it. The card shows the reclaimable figure so the Owner can see what it is worth.

**Colour rules** (from doc 13):

| Colour | Rule |
|---|---|
| Green | under 75% used, and 90% is more than 90 days away |
| Amber | 75–85% used, or 90% within 90 days |
| Red | over 85% used, or 90% within 30 days |

### Master Sheet cards (Master Leads, Master Booked)

**What each card shows:**

- The biggest tab against the 40,000-row limit.
- The workbook's grid cells against Google's 10,000,000-cell cap.
- Growth per month.
- **Time until a new workbook is needed:** the earlier of "biggest tab reaches 40,000 rows" and "workbook reaches 5,000,000 cells".
- **Time until Google's cell cap.**
- One sync line:
  - last successful write;
  - pending and failed job counts;
  - **stuck jobs**: `processing` for more than 15 minutes, with the oldest date shown.
- Master Booked only: the last cancellation row date. No cancellation has been recorded since August.

**Why 40,000 rows is the limit that matters.** Google's 10M-cell cap is 15 or more years away. Speed binds first: every Sheet Sync drain reads whole tabs, and reads slow as a tab grows (doc 12). The 40,000-row trigger and the 30,000-row warning are doc 12's figures.

**Data sources:**

- **Grid cells per tab:** `spreadsheets.get` metadata, cached for 1 hour.
- **Filled rows:** the last non-empty cell in column A, read **only on Master Leads and Master Booked**, where the server writes the Mongo id into column A. Column A is not a valid signal on the formula-fed source-company workbooks.
- **Sync line:** `sheet_sync_runs` (newest completed) and `sheet_sync_jobs` grouped by `status`.

**Seed estimates (until 7 snapshots exist),** from doc 12 and the 2026-10-06 gather:

| Workbook | Measure | Now | Rate | Hits limit |
|---|---|---|---|---|
| Master Leads | Forms rows → 30,000 (warning) | 6,724 | +1,300 / month | ≈ Apr 2028 |
| Master Leads | Forms rows → 40,000 (**new workbook needed**) | 6,724 | +1,300 / month | **≈ Nov 2028** |
| Master Leads | Cells → 10,000,000 (Google cap) | 363,022 | +45,000 / month | ≈ 2044 |
| Master Booked | Booked Deals rows → 40,000 | 883 | +185 / month | more than 15 years |

**Colour rules** (from doc 12):

| Colour | Rule |
|---|---|
| Green | biggest tab under 30,000 rows and under 3M cells; queue clean |
| Amber | 30,000 rows or 3M cells, or a new workbook needed within 6 months |
| Red | 40,000 rows or 5M cells, or any failed job, or any job stuck more than 15 minutes |

**Master Leads is red on day one.** Three `sheet_sync_jobs` rows have been stuck in `processing` since 2026-07-29 and 2026-08-31. That is correct and intended: the card should surface them. Clearing them is a separate one-off task. Do not hide them to make the card green.

## Server work

| # | Item | Size |
|---|---|---|
| R1 | Locations runtime configuration document: seed on first read, plus `GET` and `PATCH /api/v1/admin/systems/locations` (Owner). Validates `https://` and the fixed key set; records the change. Master Sheet links are built from the two env ids | small |
| R2 | `capacity_snapshots` collection (unique on `day`), plus cron `/api/cron/capacity-snapshot` at `45 8 * * *` in `vercel.json`. Idempotent per New York day | small |
| R3 | `projectRunway()` pure function with unit tests: fewer than 7 points gives the estimate basis; a zero or negative slope gives "not growing"; the 5-year and 15-year caps | small |
| R4 | `GET /api/v1/admin/systems/capacity` (Owner) returns `{ database, sheets: [master_leads, master_booked], generated_at }`. Includes live readings, the runway from R3, colour and reason. The database reading is cached for 10 minutes and the Sheets metadata for 1 hour. `?refresh=1` skips the cache, at most once a minute | small–medium |
| R5 | Service doc `docs/knowledge/services/systems-capacity.md` and an `environment.md` check (no new env names) | trivial |

**No new env vars, no new secrets.** The server already holds the Mongo user, the Sheets service account and the two sheet ids.

## Admin work

| # | Item |
|---|---|
| A1 | New Setup section `systems` (Owner only), with its route in `setup-sections.ts`, `setup-copy.ts` and `SETUP_ROUTES`. Icon: `Server` or `Gauge` |
| A2 | `components/setup/systems/locations-list.tsx`: rows, Open/Install, Copy, Code/Host chips, the "personal account" tag, and the inline Edit form |
| A3 | `components/setup/systems/capacity-card.tsx`: one component for all three cards, with bar, runway lines, the estimate label and colour with its reason sentence. Reuse the status-icon pattern from `capture-health.tsx` |
| A4 | Refresh button (calls `?refresh=1`) and a "checked HH:MM" stamp. Plus a mock fixture with the seed numbers above, so the page renders in mock mode and in e2e |

## Acceptance

- `/setup/systems` shows every location in the table above, and each Open, Install and Copy action works. The extension row opens the Chrome Web Store listing.
- Editing the partner pages domain in the form takes effect without a deploy, and the edit appears in Change history.
- The database card shows live disk use and both "time until" lines. Before 7 snapshots exist it carries the estimate label.
- The Master Leads card shows Forms against 40,000, cells against 10M, the time until a new workbook is needed, and the 3 stuck jobs (red).
- `projectRunway` tests pass. The snapshot cron writes exactly one row per New York day, even when run twice.
- Admin and Manager roles cannot open the section.

## Deliberately left out (from 11/12/13)

These are cut from this build. The cheapest to add next come first:

1. **"Last backup successful at …"** (doc 13). One small read of the newest GCS success manifest; the server's Google identity can already list it.
2. **Reachability dots** on locations: a live HTTPS check when the page loads, with nothing stored.
3. HTTP probe cron, `system_checks`, uptime and latency, TLS days, Up/Slow/Down statuses, and the down alert email.
4. Flow signals ("no leads since …", extension last write), the "How they connect" strip and the sidebar status pill.
5. `/version` and `/api/health` routes in every app, the `x-vantage-client` header (telling WordPress leads from Next leads) and `x-extension-version`.
6. Vercel API deploy state (needs `VERCEL_READ_TOKEN`), Atlas Admin API (tier, auto-scaling, snapshots), and the Partners and Backups tabs.
7. Doc 12's workbook generations (yearly rotation, prepare/verify/activate) and doc 13's backup job changes. The runway line tells the Owner when rotation becomes necessary, about two years out at today's pace.
8. ID-column-only Sheet Sync reads (doc 12). This is still worth doing on its own as a performance fix; it is not part of this page.

## Open items (not blocking)

- **Atlas tier and storage auto-scaling.** These decide whether "full" means an outage or a bigger bill. Check in the Atlas UI and add them to the caveat line by hand.
- **The extension's published store version.** The repo says 0.3.3, but the listing page was not parsed.
- **WordPress admin URL.** It is not in the workspace. The Owner can add it with Edit locations.
- **When to run the oplog compact.** This is an Owner and Atlas decision. It is the difference between a runway of about 2.5 years and a runway of more than 5 years.
