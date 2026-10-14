# Priority Pool in Admin

The production contract is the server's [approved Pool policy](../../vantage-main-server/docs/rep-desk-and-pool/POOL-APPROVAL-2026-10-14.md). Runtime policy, admission, eligibility, daily duties and call verification stay on the server.

My outreach shows adjacent New / Quoted / Other / Pool filters. Team outreach includes the same Pool and Other choices. Pool sends `GET /sales-outreach/queue?queue_scope=pool`; the existing production database `scope` is unchanged. The server returns every currently eligible shared Pool Lead regardless of receiver. Coordinator Rep filters select assigned-workload counts without narrowing the shared rows. Other sends `workflow=other`, excluding New, Quoted and Pool. Ordinary private assignment scope stays unchanged.

Queue rows and detail mirror the strict optional `pool` DTO: New York business date, server state, due time, completion time, actual caller and canonical completion event ID. Assignment stays visible, including Unassigned. The optional `pool_summary` reports shared team due/completed, assigned due/fulfilled and actual Pool outbound separately. No client command completes a duty. Pool detail hides callback and Quoted controls; Owner/Manager assignment keeps its original authority. Shared read entitlement grants no general Lead editing or financial allocation.

`outreach_pool` live hints invalidate every Desk read. Reconnect and 30-second foreground resnapshots recover missed hints; detail 403/404 clears cached rows and selection, and a revoked queue never displays retained rows. Queue filter changes do not display the previous filter's rows while the new scope loads.

Automations mirrors optional `pool_lanes.refresh` and `.discovery` freshness beneath the unchanged ALL status. Each displays last complete scope, collection/processing counts, failures and warnings, with oldest uncovered range, held rows and lag when supplied. Missing or incomplete collections never appear as fresh complete inventory.

Validation: `tests/outreach-desk/pool.test.ts`, `tests/pool-automations-freshness.test.ts`, the existing BFF role allowlist tests, server DTO fixture drift guards, typecheck and production build. Production activation and selected Lead enrollment are separate server rollout operations; rendering a Pool tab admits no Leads.

Executed checks and browser proof: [priority-pool-validation.md](priority-pool-validation.md).
