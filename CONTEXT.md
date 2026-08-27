# Vantage Admin Dashboard

Internal web application for lead search, bookings, cancellations, Granot intakes, analytics, and Workflow Observational.

**Platform domain language:** [`../CONTEXT.md`](../CONTEXT.md)

**ADRs:** [`../docs/adr/`](../docs/adr/)

**Agent consumer rules:** [`../docs/agents/domain.md`](../docs/agents/domain.md)

**Planned (admin-local pointer, not a glossary term):** Owner Daily View / owner-home UX change is intended on branch `granot-lead-lifecycle`. It is not architected and is not current `/` Overview (`HomeOverview`) behavior. See [`.cursor/rules/project-organization.mdc`](.cursor/rules/project-organization.mdc) and [`uxdocs/owner-daily-view-planned.txt`](uxdocs/owner-daily-view-planned.txt).

**Lead Conversations tab (admin-local pointer):** shipped Owner-only `/conversations` example surface. One seeded Lead Conversation. Vercel AI Gateway automation is not authorized and is not live. Contract: [`uxdocs/lead-conversations-tab-specification.md`](uxdocs/lead-conversations-tab-specification.md). Domain words stay in the root glossary.

**Job Timeline Enhancement (admin-local pointer):** live `/job-timeline` is still the v1 coverage-chip page. Enhanced UI is JTE-04 after the server pack reaches JTE-03. Orientation: [`uxdocs/HANDOFF-job-timeline-enhancement.md`](uxdocs/HANDOFF-job-timeline-enhancement.md). Contract: [`../vantage-main-server/docs/job-number-timeline/README.md`](../vantage-main-server/docs/job-number-timeline/README.md).

Shared vocabulary always defers to the root glossary.
