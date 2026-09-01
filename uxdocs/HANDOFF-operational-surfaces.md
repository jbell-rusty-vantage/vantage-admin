# Handoff — Operational surfaces (Admin)

Orientation for an agent picking up OSE-01–05 in `vantage-admin`.

**Contract (wins on conflict):**
[`vantage-main-server/docs/operational-surfaces/operational-surfaces-specification.md`](../../vantage-main-server/docs/operational-surfaces/operational-surfaces-specification.md)

**Pack:**
[`vantage-main-server/docs/operational-surfaces/README.md`](../../vantage-main-server/docs/operational-surfaces/README.md)

Start at the pack README → `AGENT-PROTOCOL.md` → the `ready` issue in
`PROGRESS.md`. Do not start OSE-02 before OSE-01 is complete.

## What this is

Admin presentation on the shared `OperationalResourcePage` shell
(Form Leads, Call Leads, Bookings, Cancellations, plus the duplicate /
Customers / Agents routes that already use it).

- Tabbed detail panel
- Row identity + status chips + sticky Actions cluster
- Grouped filters
- Remove raw JSON dumps

## What this is not

- Owner Daily View (`/daily`) or Details / Provenance / Conversation
- Embedding `ConversationPanel` on Call Leads
- Search, Intakes, Observational rewrites
- Main-server API or invariant changes
- Bad Call, a Sync button, or new filter keys

## 21st.dev

Allowed on OSE-02 (tabbed sheet), OSE-03 (chips + sticky actions), and
OSE-04 (grouped filter sidebar). Search first. Do not replace the page
module with a generated layout.

## Local

Admin: http://localhost:3000  
API: http://localhost:3001  

Sign in with `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` from
`vantage-admin/.env`. Do not paste those values.
