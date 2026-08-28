# Live Events tab — move out of Ingestion

**Repo:** `vantage-admin` only.
**Status:** shipped. Server SSE is already live; this is a navigation move.
**Written:** 2026-08-28.

## Goal

Give the Owner a top-level sidebar tab labeled **Live Events**, placed **immediately under Overview**. The Granot webhook stream leaves Ingestion. Do not rebuild the stream.

## Current (do not rebuild)

| Piece | Where it lives | Keep? |
| --- | --- | --- |
| SSE source | `vantage-main-server` `GET /api/v1/admin/granot-lifecycle/receipts/live` | Yes. No server change. |
| Admin BFF | `app/api/granot-live-receipts/route.ts` → `/api/granot-live-receipts` | Yes. Same path. |
| Stream UI | `components/granot-lifecycle/live-webhooks.tsx` | Yes. Reuse as-is. |
| Types / merge | `lib/api/granotLiveReceipts.ts` | Yes. Change the page href only. |
| Current page | `app/(dashboard)/ingestion/granot/live/page.tsx` | Delete after redirect. |
| Granot sub-tab | `granot-navigation.tsx` item `Live webhooks` → `/ingestion/granot/live` | Remove. |

The stream is Owner-only, one-way, Mongo-polled SSE of `lead_created`, `priority_updated`, and `booking_status_changed`. Accordion lead facts stay. The Admin client keeps a sliding 30-minute window of at most 80 newest cards so a tab left open does not grow without bound.

## Target

**Sidebar** (`components/layout/dashboard-nav.tsx`), Owner-only, `isNew: true`:

```
Overview
Live Events          ← new, href /live-events
Lead Conversations
Form Leads
…
```

`Live Events` is the second item. Do not put it under Ingestion, Observational, or Granot.

**Route:** `/live-events`

```
app/(dashboard)/live-events/page.tsx   → render <LiveWebhooks />
```

The page sits in the normal dashboard shell. It must **not** use `app/(dashboard)/ingestion/granot/layout.tsx` (that chrome is Automation / Lifecycle / Intakes / Health).

**Redirect:** `/ingestion/granot/live` → `/live-events` (308 or Next.js `redirect`). Old bookmarks must not 404.

**Href constant:** `GRANOT_LIVE_RECEIPTS_HREF` (or rename to `LIVE_EVENTS_HREF`) becomes `"/live-events"`. Stream path stays `"/api/granot-live-receipts"`.

## Auth (Admin only)

Owner-only, same pattern as `/conversations` and `/job-timeline`. Add `/live-events` in every place that lists owner page prefixes — do not rely on `/ingestion/granot` after the move:

- `server/auth/authorization.ts` — `OWNER_ONLY_PAGE_PREFIXES` + `canAccessDashboardPath`
- `components/layout/dashboard-shell.tsx` — `ownerOnlyPagePrefixes` (today this list is incomplete vs authorization; add `/live-events` here and do not “fix” the rest)
- `dashboard-nav.tsx` — `ownerOnly: true`

Non-owners: no sidebar item, page blocked, `/api/granot-live-receipts` still 403 (already).

`canProxyVantagePath` for `…/receipts/live` does not change.

## Tests the agent must update

- Nav order: `visibleDashboardNav("owner")` is Overview, then Live Events, then Lead Conversations.
- Admin role: Live Events absent from `visibleDashboardNav("admin")`; `canAccessDashboardPath("admin", "/live-events")` is false.
- Granot nav no longer contains `Live webhooks` or `/ingestion/granot/live`.
- Existing live accordion test still passes (move the import if the file moves; do not rewrite the UI).

## Out of scope

- Any `vantage-main-server` change
- New event types, WebSockets, writes on the stream
- ODR / Daily View
- Home Overview quick-link (sidebar is enough)
- Renaming the SSE BFF

## Done when

1. Owner sees **Live Events** as the first item under Overview and the same live accordion works there.
2. Ingestion / Granot has no Live webhooks tab.
3. `/ingestion/granot/live` redirects to `/live-events`.
4. Admin cannot open `/live-events`.
