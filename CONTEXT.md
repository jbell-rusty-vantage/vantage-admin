# Vantage Admin Dashboard

Internal web application for lead search, bookings, cancellations, Granot intakes, analytics, and Workflow Observational.

**Platform domain language:** [`../CONTEXT.md`](../CONTEXT.md)

**ADRs:** [`../docs/adr/`](../docs/adr/)

**Agent consumer rules:** [`../docs/agents/domain.md`](../docs/agents/domain.md)

**Overview desk (admin-local pointer):** live `/` is `HomeOverview` — Owner Waiting for you Booking intakes from the existing open-case list, this-week pulse, compact all-time, create Booking/Cancellation. Cancellation intakes are not on Overview. Not Daily View, not a sitemap, not a second Analytics. Map: [`.cursor/rules/project-organization.mdc`](.cursor/rules/project-organization.mdc).

**Planned (admin-local pointer, not a glossary term):** Owner Daily View is intended as its own `/daily` page. It is not implemented and is not current `/` Overview behavior. See [`uxdocs/owner-daily-view-planned.txt`](uxdocs/owner-daily-view-planned.txt).

**Lead Conversations tab (admin-local pointer):** shipped Owner-only `/conversations` example surface. One seeded Lead Conversation. Vercel AI Gateway automation is not authorized and is not live. Contract: [`uxdocs/lead-conversations-tab-specification.md`](uxdocs/lead-conversations-tab-specification.md). Domain words stay in the root glossary.

**Dashboard chrome (admin-local pointer):** Sidebar destinations are grouped Today / Records / People / Insight / System in `components/layout/dashboard-nav.tsx`. Links stay compact under those headers. `visibleDashboardNav(role)` stays a flattened destination list; Owner order still starts Overview, Live Events, Lead Conversations. No Settings tab. No New badges. Grouping labels are not Owner Daily View. Map: [`.cursor/rules/project-organization.mdc`](.cursor/rules/project-organization.mdc).

**Operations Registry (admin-local pointer):** `/operations-registry` owns agents, merchants, sources, Granot sources, RingCentral, Moving Carriers, CPL schedules, Legacy CPL, and Changes. Owner can edit Moving Carriers; Admin is read-only. Legacy CPL stays a read-only compatibility view. `/settings` permanently redirects to `?tab=moving-carriers` and is not owner-only — Admin can follow it onto Operations Registry. Map: [`.cursor/rules/project-organization.mdc`](.cursor/rules/project-organization.mdc).

**Live Events tab (admin-local pointer):** shipped Owner-only `/live-events`. Granot live webhook SSE moved out of Ingestion to a top-level Owner sidebar tab (first item under Overview). Contract: [`uxdocs/live-events-tab-specification.md`](uxdocs/live-events-tab-specification.md). Domain words stay in the root glossary.

**Form Lead contact snapshots (admin-local pointer):** shipped. `/form-leads` and `/duplicate-form-leads` show Form submitted vs Granot contact (chip + Contacts detail). Browse and typeahead search live fields plus both snapshots. Contract: [`../vantage-main-server/docs/form-lead-contact-snapshots-display-and-search-specification.md`](../vantage-main-server/docs/form-lead-contact-snapshots-display-and-search-specification.md). Domain words stay in the root glossary.

**Booking intake robustness (admin-local pointer):** BILA-01–BILA-03 shipped — `/intakes` Find the right customer searches any-known-contact and shows Form submitted vs Granot (shared helper in `form-lead-contacts.tsx`). Confirm may omit a Lead; unique high auto-attaches; otherwise Master Booked only. `/bookings` detail owns Connect Booking to Lead for a Leadless Booking (Stored lead column + in-place search). Not `/bookings/reconciliation`. Pack: [`../vantage-main-server/docs/booking-intake-lead-attachment/README.md`](../vantage-main-server/docs/booking-intake-lead-attachment/README.md). Domain words stay in the root glossary.

**Job Timeline Enhancement (admin-local pointer):** JTE-04 shipped. Live `/job-timeline?job=` renders the server-evaluated v2 page. Coverage chips remain the v1 fallback only. Live proof and deep links are JTE-05. Orientation: [`uxdocs/HANDOFF-job-timeline-enhancement.md`](uxdocs/HANDOFF-job-timeline-enhancement.md). Contract: [`../vantage-main-server/docs/job-number-timeline/README.md`](../vantage-main-server/docs/job-number-timeline/README.md).

**Operational surfaces (admin-local pointer, not a glossary term):** planned pack OSE-01–05. Keep `OperationalResourcePage`. Tab the detail panel (Summary / Contact / Lead Message / Actions / Production record / Source Company). Cluster row actions. Group filters. Remove raw JSON. Not Daily View. Agents may use 21st.dev for the four named shells. Contract: [`../vantage-main-server/docs/operational-surfaces/README.md`](../vantage-main-server/docs/operational-surfaces/README.md). Domain words stay in the root glossary.

**Granot Lifecycle surfaces (admin-local pointer, not a glossary term):** planned pack GLS-01–03. Ingestion keeps Granot workflow (HTTP Automation) first, then Best Relocation. Strip the Granot nest (Lifecycle / Intakes / Job Timeline / Health). New Owner-only System tab **Granot Lifecycle** holds Health and searchable webhook-channel Granot Observation Receipts. Job Timeline stays `/job-timeline`. Live Events SSE stays `/live-events`. Not Operations Registry, not an Observational tab. Contract: [`../vantage-main-server/docs/granot-lifecycle-surfaces/README.md`](../vantage-main-server/docs/granot-lifecycle-surfaces/README.md). Domain words stay in the root glossary.

Shared vocabulary always defers to the root glossary.
