# Agents List Metrics — Implementation Document

**Route:** `/agents`  
**Status:** Bug — list columns render empty (`-`) for all booking/cancellation metrics  
**Primary owner:** `vantage-main-server` (`api/services/admin/`)  
**Consumer:** `vantage-admin` (no UI changes required if backend contract is fixed)

---

## Problem

On the Agents page (`https://vantage-admin-rho.vercel.app/agents`), with **Production** scope selected and **no filters** active, every agent row shows:

| Name | Active | Role | Bookings | Binder | Deposit | Cancellations | Cancel Rate |
|------|--------|------|----------|--------|---------|---------------|-------------|
| ✓    | ✓      | ✓    | `-`      | `-`    | `-`     | `-`           | `-`         |

Name, Active, and Role render correctly. All performance columns are empty.

The **Analytics** dashboard (`/analytics`, report `agent-performance`) computes the same class of metrics correctly for production data. The Agents browse list and Analytics are therefore out of sync — not because filters or database scope are wrong, but because the **list API never returns those fields**.

---

## Current Request Flow

```text
vantage-admin/app/(dashboard)/agents/page.tsx
  └─ OperationalResourcePage (resource="agents")
       └─ components/operational/operational-resource-page.tsx
            └─ fetchAdminList("agents", filters)
                 └─ lib/api/admin.ts
                      └─ GET /api/proxy/api/v1/admin/agents?database_scope=production&...
                           └─ app/api/proxy/[...path]/route.ts
                                └─ vantage-main-server GET /api/v1/admin/agents
                                     └─ api/routes/v1.routes.ts → handleAdminBrowse("agents")
                                          └─ api/services/admin/adminBrowse.service.ts
                                               └─ browseAdminResource → browseConcrete
                                                    └─ queries Agent collection only (no aggregates)
```

Detail view (row click) follows a **different** path:

```text
fetchAdminDetail("agents", id, scope)
  └─ GET /api/v1/admin/agents/:id
       └─ getAdminResourceDetail → appendDetailRelations (agents branch)
            └─ queries booked-leads and attaches metrics to a single record
```

The table list never calls the detail endpoint until a row is selected.

---

## Root Cause

### Frontend expects metrics on list items

`components/operational/operational-resource-page.tsx` defines the Agents column config:

| UI column       | JSON path on list item   |
|-----------------|--------------------------|
| Bookings        | `booking_count`          |
| Binder          | `total_binder_amount`    |
| Deposit         | `total_deposit_amount`   |
| Cancellations   | `cancellation_count`     |
| Cancel Rate     | `cancellation_rate`      |

Missing or null values are formatted as `"-"` via `formatPlain` / `formatMoney` in the same file.

### Backend list endpoint returns raw Agent documents

`api/services/admin/adminBrowse.service.ts` → `browseConcrete` maps Mongo `Agent` documents through `normalizeDoc` only. The `Agent` schema (`api/models/Agent.ts`) stores:

- `name`, `normalized_name`, `active`, `role`, `created_from`, timestamps

It does **not** store booking aggregates. No enrichment step runs for the list response.

### Metrics exist only on detail (and are incomplete)

`appendDetailRelations` in `adminBrowse.service.ts` (agents branch) computes metrics when `GET /api/v1/admin/agents/:id` is called. Limitations of the current detail implementation:

1. **Not used by the table** — only the side panel detail query benefits.
2. **Capped at 25 bookings** — `.limit(25)` on the booked-leads query.
3. **Different logic than Analytics** — sums full `deposit_amount` per booking (not per allocation), uses `booking.cancelled` instead of `is_cancelled`, and matches via `agent_allocations.agent_name_snapshot` regex rather than the analytics unwind/group pipeline.

### Analytics works because it uses a separate service

`components/analytics/analytics-dashboard.tsx` calls:

```text
fetchAnalyticsReport("agent-performance", filters)
  └─ GET /api/v1/admin/analytics/agent-performance
       └─ api/services/analytics/agentPerformance.service.ts
            └─ MongoDB aggregation on booked-leads ($unwind agent_allocations, $group by agent)
```

That pipeline respects date/source filters via `api/services/analytics/analyticsFilters.ts` (`bookedLeadPrefix`). Field names differ slightly from the Agents table contract (e.g. `bookings` vs `booking_count`).

---

## Files in This Unit of Work

### vantage-admin (consumer — likely no changes)

| Path | Role |
|------|------|
| `app/(dashboard)/agents/page.tsx` | Route entry; renders `OperationalResourcePage` with `resource="agents"` |
| `components/operational/operational-resource-page.tsx` | Agents column definitions, table rendering, `fetchAdminList` / `fetchAdminDetail` wiring |
| `lib/api/admin.ts` | `fetchAdminList`, `fetchAdminDetail`, `AdminResource` / `UiResource` mapping, proxy URL builder |
| `lib/api/filters.ts` | Serializable filter/query params (`database_scope`, `from`, `to`, `date_field`, pagination, sort) |
| `lib/query/keys.ts` | TanStack Query keys for list/detail caches |
| `app/api/proxy/[...path]/route.ts` | Authenticated proxy to `vantage-main-server` |

Reference (working comparison, not part of Agents list fix):

| Path | Role |
|------|------|
| `components/analytics/analytics-dashboard.tsx` | Agent Performance chart; uses analytics endpoint |
| `components/reports/agent-sales-report.tsx` | Separate agent sales report (`/api/v1/admin/reports/agent-sales`) |

### vantage-main-server (implementation target)

| Path | Role |
|------|------|
| `api/routes/v1.routes.ts` | Registers `GET /api/v1/admin/agents` and `GET /api/v1/admin/agents/:id` |
| `api/services/admin/adminBrowse.service.ts` | **Primary fix location** — `browseConcrete` list path + `appendDetailRelations` detail path |
| `api/services/admin/adminScope.service.ts` | Production vs historical model selection |
| `api/services/admin/adminExport.service.ts` | Agents CSV columns (currently exclude metrics) |
| `api/services/admin/admin.service.test.ts` | Admin browse/detail/export tests |
| `api/models/Agent.ts` | Agent document shape |
| `api/models/BookedLead.ts` | Source data for aggregates (`agent_allocations`, amounts, cancellation flags) |
| `api/validation/v1/admin.validation.ts` | `adminBrowseQuerySchema` (date range, scope, pagination) |

Reference (reuse for correct aggregation logic):

| Path | Role |
|------|------|
| `api/services/analytics/agentPerformance.service.ts` | Canonical agent metrics aggregation |
| `api/services/analytics/analyticsFilters.ts` | Date/source prefix stages for booked-lead pipelines |

---

## Target API Contract

`GET /api/v1/admin/agents` list items should include these **optional computed fields** (in addition to existing Agent fields):

```ts
{
  _id: string;
  database_scope: "production" | "historical";
  name: string;
  active: boolean;
  role: string;
  // ... existing Agent fields ...

  booking_count: number;
  total_binder_amount: number;      // sum of allocation binder amounts
  total_deposit_amount: number;     // align with analytics semantics (see below)
  cancellation_count: number;
  cancellation_rate: number;        // 0–1 fraction; UI does not append %
}
```

### Semantics (align with Analytics)

Match `agentPerformance.service.ts` behavior so `/agents` and `/analytics` tell the same story:

- Unwind `agent_allocations` on `booked-leads`
- Group by `agent_allocations.agent_name_snapshot` (case-insensitive match to `Agent.name`)
- `booking_count` ← count of allocation rows (same as analytics `bookings`)
- `total_binder_amount` ← sum of `agent_allocations.binder_amount`
- `total_deposit_amount` ← define explicitly: analytics currently sums full `deposit_amount` per unwound row (may double-count split bookings); document chosen rule and keep list/detail/analytics consistent
- `cancellation_count` ← sum where `is_cancelled` is true (not legacy `cancelled` field alone)
- `cancellation_rate` ← `cancellation_count / booking_count`, or `0` when `booking_count === 0`

### Date range filters

`OperationalResourcePage` passes `from`, `to`, and `date_field` (default `createdAt` for agents config, but users can change date range in the filter bar). Aggregates on the list should respect the same date window applied to booked leads — use `book_date` (or the browse query's effective date field mapped to booked-lead dates) consistently with how operators interpret the filter bar.

---

## Implementation Plan

### 1. Add list enrichment in `adminBrowse.service.ts` (required)

After `browseConcrete` fetches the paginated agent docs for `resource === "agents"`:

1. Collect agent names (and/or `normalized_name`) from the page of results.
2. Run **one** aggregation query against `booked-leads` for the current scope (production or historical), filtered by:
   - browse query date range (`from` / `to` / `date_field` mapped appropriately)
   - agent names present on the current page
3. Build a lookup map: `normalized agent name → metrics`
4. Merge metrics into each list item before returning `{ items, page, limit, total, has_next_page }`

**Suggested approach:** Extract shared logic from `agentPerformance.service.ts` into a small helper (e.g. `api/services/admin/agentBrowseMetrics.service.ts` or `api/services/analytics/agentMetrics.shared.ts`) that accepts `(models, query, agentNames?: string[])` so list, detail, and analytics do not drift.

### 2. Fix detail endpoint consistency (recommended)

Update `appendDetailRelations` agents branch to:

- Remove the `.limit(25)` cap (or replace with the same aggregation used for list enrichment)
- Use `is_cancelled` and per-allocation binder sums
- Return the same field names and formulas as the list endpoint

### 3. Historical + combined scope

- **Production / historical:** enrichment must use `getAdminModels(scope)` so historical agents match historical booked leads.
- **Combined browse:** `browseCombined` merges production and historical agent lists. Enrich each scope's items with that scope's booked-lead aggregates before merge, or run two aggregations and tag rows with `database_scope` (already present on each item).

### 4. CSV export (optional follow-up)

`adminExport.service.ts` agents columns are currently:

```text
_id, database_scope, createdAt, name, normalized_name, active, role, created_from
```

If operators expect export parity with the table, append metric columns after list enrichment is shared with `exportAdminResourceRows`.

### 5. Tests in `admin.service.test.ts` (required)

Add coverage for:

- `browseAdminResource("agents", …)` returns items with `booking_count`, `total_binder_amount`, etc.
- Date range on browse query restricts aggregated bookings
- Agent with zero bookings returns `0` / `0` rate, not omitted fields
- Detail endpoint returns metrics consistent with list enrichment

### 6. vantage-admin changes

**None required** if the backend populates the existing JSON paths the UI already reads.

Optional UX improvements (out of scope unless requested):

- Format `cancellation_rate` as a percentage in `formatCell`
- Show a footnote when date filters scope metrics to booked-lead dates vs agent `createdAt`

---

## Verification Checklist

### Manual

1. Open `/agents` with Production scope, no filters → metrics populated for agents with bookings.
2. Set a date range → metrics change to reflect only bookings in range.
3. Switch to Historical scope → metrics use historical booked leads; still read-only.
4. Open Analytics → Agent Performance with same scope/dates → totals per agent align with list rows.
5. Click an agent row → detail panel metrics match the table row.

### Automated

```bash
# vantage-main-server
npm test -- api/services/admin/admin.service.test.ts
```

---

## Out of Scope (related but separate)

- **Customers list** (`/customers`) has the same pattern: columns reference `booking_count`, `cancellation_count`, `deposit_total` but `browseConcrete` only returns raw `Customer` documents; aggregates exist only in `appendDetailRelations` on detail. Fix separately if needed.
- **Agent catalog CRUD** (`POST/PATCH /api/v1/admin/agents`) — unchanged; agents remain catalog-managed, not inline-edited on this page.
- **Sorting by metric columns** — Agents table columns do not expose sort on metrics today; adding sort would require backend `allowedSorts` and aggregation-aware sort (future enhancement).

---

## Summary

| Layer | Today | Needed |
|-------|-------|--------|
| Agents UI | Reads `booking_count`, `total_binder_amount`, … from list items | No change |
| `GET /api/v1/admin/agents` | Returns raw `Agent` docs | Enrich each item with booked-lead aggregates |
| `GET /api/v1/admin/agents/:id` | Partial metrics, max 25 bookings | Reuse same aggregation as list |
| `GET /api/v1/admin/analytics/agent-performance` | Full aggregation | Reference implementation to reuse |

The bug is a **missing server-side enrichment step on the agents browse list**, not a frontend rendering or database-scope issue.
