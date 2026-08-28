# Vantage Admin Dashboard

Internal web application for lead search, bookings, cancellations, Granot intakes, analytics, and Workflow Observational.

**Platform domain language:** [`../CONTEXT.md`](../CONTEXT.md)

**ADRs:** [`../docs/adr/`](../docs/adr/)

**Agent consumer rules:** [`../docs/agents/domain.md`](../docs/agents/domain.md)

**Planned (admin-local pointer, not a glossary term):** Owner Daily View / owner-home UX change is intended on branch `granot-lead-lifecycle`. It is not architected and is not current `/` Overview (`HomeOverview`) behavior. See [`.cursor/rules/project-organization.mdc`](.cursor/rules/project-organization.mdc) and [`uxdocs/owner-daily-view-planned.txt`](uxdocs/owner-daily-view-planned.txt).

**Lead Conversations tab (admin-local pointer):** shipped Owner-only `/conversations` example surface. One seeded Lead Conversation. Vercel AI Gateway automation is not authorized and is not live. Contract: [`uxdocs/lead-conversations-tab-specification.md`](uxdocs/lead-conversations-tab-specification.md). Domain words stay in the root glossary.

**Live Events tab (admin-local pointer):** shipped Owner-only `/live-events`. Granot live webhook SSE moved out of Ingestion to a top-level Owner sidebar tab. Contract: [`uxdocs/live-events-tab-specification.md`](uxdocs/live-events-tab-specification.md). Domain words stay in the root glossary.

**Job Timeline Enhancement (admin-local pointer):** JTE-04 shipped. Live `/job-timeline?job=` renders the server-evaluated v2 page. Coverage chips remain the v1 fallback only. Live proof and deep links are JTE-05. Orientation: [`uxdocs/HANDOFF-job-timeline-enhancement.md`](uxdocs/HANDOFF-job-timeline-enhancement.md). Contract: [`../vantage-main-server/docs/job-number-timeline/README.md`](../vantage-main-server/docs/job-number-timeline/README.md).

Shared vocabulary always defers to the root glossary.
