# Dynamic Agents and Merchants

## Problem

Customer Sales Agent and Merchant dropdowns are duplicated as hardcoded frontend constants in `lib/constants/domain.ts`. The same production lists are mirrored again in `vantage-main-server` (`adminFacets.service.ts`). Agents and merchants change often, so every roster or processor change requires a code deploy in two repos.

Booking creation, operational filters (production scope), and analytics filters all depend on these static lists. The backend does not validate against them: `agent` and `merchant` are accepted as any non-empty string. Agent names are upserted into the `agents` collection only after a booking is submitted; merchants have no catalog collection at all.

## Goal

Make agents and merchants **admin-managed, database-backed catalog records** that drive all production dropdowns and write-time validation, while preserving historical read-only behavior and existing booked-lead snapshots.

## Recommended approach

Treat agents and merchants as **configuration catalogs** owned by `vantage-main-server`, managed through `vantage-admin`, and consumed everywhere production dropdowns appear.

```
┌─────────────────────┐     proxy      ┌──────────────────────────┐
│  vantage-admin      │ ─────────────► │  vantage-main-server     │
│                     │                │                          │
│  Settings UI        │   POST/PATCH   │  agents collection       │
│  Booking form       │   GET catalog  │  merchants collection    │
│  Filters / facets   │ ◄───────────── │  validation on writes    │
└─────────────────────┘                └──────────────────────────┘
```

`vantage-admin` must not read or write operational Mongo collections directly. All catalog CRUD and dropdown reads go through authenticated `/api/proxy/...` routes to new or extended `vantage-main-server` endpoints.

---

## Data model

### Agents (already exists)

The production `agents` collection already has the right shape:

| Field | Purpose |
|-------|---------|
| `name` | Display name shown in dropdowns and stored as `agent_name_snapshot` on bookings |
| `normalized_name` | Unique lookup key (`trim`, collapse whitespace, lowercase) |
| `active` | `true` = selectable in new bookings; `false` = hidden from dropdowns, retained for history |
| `role` | Keep default `"agent"`; room for future roles |
| `created_from` | `"admin"` for catalog-created rows; keep `"booked_lead"` for rows created by booking upsert |

**Do not delete agent documents.** Align with the existing no-delete policy: deactivate instead. Existing bookings keep their `agent_allocations[].agent_name_snapshot` regardless of later deactivation or rename.

**Rename policy:** Prefer deactivating the old name and adding the new name. If rename is supported, update `name` only and leave `normalized_name` stable, or treat rename as deactivate + create to avoid breaking normalized uniqueness.

### Merchants (new collection)

Add a `merchants` collection mirroring the agent catalog pattern:

```ts
{
  name: string;              // required, trimmed, e.g. "Paper Check"
  normalized_name: string;   // required, unique, lowercase trimmed key
  active: boolean;           // default true
  created_from: string;      // default "admin"
  timestamps: true
}
```

`BookedLead.merchant` and `CancelledLead.merchant` stay as plain strings (snapshots). No ObjectId ref migration is required for v1. On booking create/update, validate that the submitted merchant matches an **active** catalog entry (by `normalized_name`), then store the canonical `name` string on the booking.

Historical merchant strings that are not in the catalog remain valid on read; they simply will not appear in production dropdowns unless re-added to the catalog.

---

## Backend API (`vantage-main-server`)

### Catalog read endpoints (dropdowns)

Lightweight, cache-friendly endpoints used by forms and filters:

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `/api/v1/admin/catalog/agents` | `{ ok, data: { items: [{ id, name }] } }` — `active: true` only, sorted by `name` |
| `GET` | `/api/v1/admin/catalog/merchants` | Same shape for active merchants |

These replace hardcoded `AGENT_OPTIONS` / `MERCHANT_OPTIONS` in production UI. Scope is always production; no `database_scope` needed.

Optional: support `?include_inactive=true` for the management UI only (admin browse can also use the fuller list endpoints below).

### Management endpoints

Extend agent management from read-only to catalog CRUD. Add parallel merchant management.

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/api/v1/admin/agents` | Already exists (browse) |
| `GET` | `/api/v1/admin/agents/:id` | Already exists (detail) |
| `POST` | `/api/v1/admin/agents` | Create agent (`name`, optional `active`, default `active: true`, `created_from: "admin"`) |
| `PATCH` | `/api/v1/admin/agents/:id` | Update `name` (careful), `active`, `role` |
| `GET` | `/api/v1/admin/merchants` | Browse merchants (same pagination/filter conventions as agents) |
| `GET` | `/api/v1/admin/merchants/:id` | Detail |
| `POST` | `/api/v1/admin/merchants` | Create merchant |
| `PATCH` | `/api/v1/admin/merchants/:id` | Update `active`, optionally `name` |

Validation rules:

- `name` must be non-empty after trim.
- Reject duplicates by `normalized_name` with a clear 409-style error.
- Writes are **production only**; reject `database_scope=historical` or `combined`.
- Audit every mutating request (same pattern as other admin proxy mutations).

### Write-path validation (bookings)

Tighten booking schemas so production writes reference the catalog:

| Field | Current | Proposed |
|-------|---------|----------|
| `agent` / `agent_name` | `nonEmptyString` | Must resolve to an **active** agent by `normalized_name` (booking upsert can stop auto-creating unknown agents, or only auto-create when explicitly flagged — prefer **reject unknown** once catalog is live) |
| `merchant` | `nonEmptyString` | Must match an **active** merchant by `normalized_name` |

`resolveAgentAllocations` / `upsertAgentByName` should be updated so admin-managed agents are the source of truth. Unknown agent names on booking create should return `400` with a message like `"Unknown or inactive agent: …"`.

### Facets endpoint

Update `GET /api/v1/admin/facets` for `database_scope=production`:

- **Before:** returns hardcoded `PRODUCTION_AGENTS` / `PRODUCTION_MERCHANTS`.
- **After:** query active catalog entries (same data as catalog endpoints), or delegate to shared catalog service.

Historical and combined scopes stay as they are today: distinct values from `booked-leads` (and related collections), because historical data is open-ended and read-only.

---

## Frontend (`vantage-admin`)

### Settings management UI

Add catalog management under **Settings** (or sub-routes):

- `/settings/agents` — list active/inactive agents, add new, deactivate/reactivate
- `/settings/merchants` — same for merchants

Suggested UX:

- Table with name, active status, created date, created-from source
- **Add** opens a simple form (name + active toggle)
- **Deactivate** instead of delete; confirm when deactivating an agent/merchant that was used recently
- No edits in historical scope

The existing `/agents` operational browse page can remain for inspecting agent records linked to bookings, or it can link to Settings for management. Avoid duplicating two management surfaces long term.

### Dropdown consumption

Replace static imports in:

| Consumer | Today | After |
|----------|-------|-------|
| `components/forms/booking-form.tsx` | `AGENT_OPTIONS`, `MERCHANT_OPTIONS` | `useCatalogOptions()` hook fetching catalog endpoints |
| `components/operational/operational-resource-page.tsx` | hardcoded filter options | catalog hook for production scope |
| `lib/api/facets.ts` | hardcoded for production | catalog hook, or facets backed by DB |

Add:

- `lib/api/catalog.ts` — `fetchCatalogAgents()`, `fetchCatalogMerchants()`
- `lib/query/keys.ts` — `catalog.agents`, `catalog.merchants`
- `useCatalogOptions()` — TanStack Query wrapper with ~5 min `staleTime` (same as facets)

Mutations from Settings must invalidate catalog queries, agent/merchant browse queries, facets, and any open booking form caches.

### Constants cleanup

After rollout, remove or demote `AGENTS` / `MERCHANTS` from `lib/constants/domain.ts`. Keep them only in a one-time seed script reference, not in runtime UI code.

Update `app/(dashboard)/settings/page.tsx` copy — it currently says operational dropdowns use frontend constants.

---

## Migration and seeding

### One-time seed script (`vantage-main-server`)

Run a script (or admin-only bootstrap endpoint) to insert current hardcoded values if missing:

**Agents:** Austin, Brian, Dylan, Jacob, Josh, Jason, Mike, Patrick, Sil, Roys, House

**Merchants:** Elavon, Maverick, Cardpointe, EMS, Paper Check, Seamless, Wire Transfer ACH

Use upsert on `normalized_name` so existing `agents` rows created by `upsertAgentByName` are not duplicated. Mark seeded rows `created_from: "seed"` or `"admin"`.

### Reconcile booking-created agents

The `agents` collection may already contain rows from past bookings (`created_from: "booked_lead"`). After seeding, review for:

- Duplicate normalized names with different display casing
- Agents in bookings but missing from the seed list (add via Settings or seed)
- Inactive agents that should no longer appear in dropdowns

No migration is required on `booked-leads`; snapshots remain as stored.

### Merchants backfill

Optionally scan `booked-leads.distinct("merchant")` in production and seed any recurring values not in the initial list so dropdowns match operational reality on day one.

---

## Rollout plan

### Phase 1 — Backend catalog (no UI break)

1. Add `Merchant` model.
2. Add catalog + management endpoints.
3. Seed agents and merchants from current constants.
4. Ship seed script; run in production.

### Phase 2 — Admin management UI

1. Settings pages for agents and merchants.
2. Proxy routes + audit for mutations.
3. Owners can add/deactivate without deploys.

### Phase 3 — Dynamic dropdowns

1. Switch booking form and production filters to catalog hooks.
2. Update `adminFacets` production branch to read DB.
3. Remove hardcoded constants from runtime frontend code.

### Phase 4 — Strict validation

1. Enforce active-catalog validation on booking create/update.
2. Stop auto-creating unknown agents in `upsertAgentByName` (or gate behind feature flag until team confirms catalog is complete).

Feature flag suggestion: `CATALOG_STRICT_VALIDATION=true` in `vantage-main-server` so dropdowns can go dynamic before writes are hardened.

---

## Edge cases and decisions

| Scenario | Recommendation |
|----------|----------------|
| Agent leaves the company | Set `active: false`. Hidden from new bookings; past bookings unchanged. |
| New payment processor | Add via Settings → Merchants. Available immediately in booking form after query invalidation. |
| Typo in catalog name | Deactivate typo, add correct name. Do not rewrite historical booking strings. |
| Booking references inactive agent | Allowed on existing records. Edits that change agent must pick an active one. |
| Historical analytics filters | Keep live distinct queries from `booked-leads`; do not force historical filters to match production catalog. |
| Combined scope analytics | Continue merging production catalog + historical distincts. |
| Google Sheet sync | No change required if booking still stores display `name` strings; sheet projections already use snapshots. |
| Concurrent duplicate add | Rely on unique `normalized_name` index; return friendly error in UI. |

---

## Ownership summary

| Layer | Owns |
|-------|------|
| `vantage-main-server` | `Agent` and `Merchant` models, catalog CRUD, booking validation, seed script, facets production source |
| `vantage-admin` | Settings management UI, catalog fetch hooks, proxy mutations, query invalidation |
| Neither | Direct Mongo access to `vantagemovers` from the admin app |

---

## Success criteria

- Adding or deactivating an agent or merchant requires **no code change** and **no deploy**.
- Booking creation and production-scope filters always reflect the current active catalog.
- Historical records and exports remain accurate with original snapshot strings.
- All catalog mutations are auditable and production-scoped.
- Hardcoded `AGENTS` / `MERCHANTS` arrays are removed from runtime admin code after migration.

---

## Related files (current state)

**vantage-admin**

- `lib/constants/domain.ts` — hardcoded `AGENTS`, `MERCHANTS`
- `components/forms/booking-form.tsx` — booking dropdowns
- `lib/api/facets.ts` — production uses constants; historical uses API
- `components/operational/operational-resource-page.tsx` — filter select options
- `app/(dashboard)/settings/page.tsx` — placeholder settings page

**vantage-main-server**

- `api/models/Agent.ts` — existing agent catalog collection
- `api/services/agents/agentAllocation.service.ts` — `upsertAgentByName` on booking create
- `api/services/admin/adminFacets.service.ts` — hardcoded production facets
- `api/validation/v1/bookings.validation.ts` — `nonEmptyString` only today
- `api/models/BookedLead.ts` — `merchant` stored as plain string
