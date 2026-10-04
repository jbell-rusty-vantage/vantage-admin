# Server and Admin slimming

The canonical specification, plan, ledger and evidence live in the server repository. This file is only a pointer; do not copy their content here.

- [Start here](../../../vantage-main-server/docs/server-admin-slimming/README.md)
- [Specification](../../../vantage-main-server/docs/server-admin-slimming/SPECIFICATION.md)
- [Implementation plan](../../../vantage-main-server/docs/server-admin-slimming/IMPLEMENTATION-PLAN.md)
- [Execution ledger](../../../vantage-main-server/docs/server-admin-slimming/LEDGER.md): wave status, commits, open issues
- [Code map](../../../vantage-main-server/docs/server-admin-slimming/CODE-MAP.md)
- [Data deletion and storage runbook](../../../vantage-main-server/docs/server-admin-slimming/DATA-AND-STORAGE.md) and [deletion manifest](../../../vantage-main-server/docs/server-admin-slimming/DELETION-MANIFEST.md)
- Admin evidence: [A-DEST](../../../vantage-main-server/docs/server-admin-slimming/evidence/A-DEST.md), [A-OPS](../../../vantage-main-server/docs/server-admin-slimming/evidence/A-OPS.md), [A-SI](../../../vantage-main-server/docs/server-admin-slimming/evidence/A-SI.md), [INTEGRATION-ADMIN](../../../vantage-main-server/docs/server-admin-slimming/evidence/INTEGRATION-ADMIN.md)
- Server contract the interim Sales Intelligence builds against: [S-NUM-CONTRACT](../../../vantage-main-server/docs/server-admin-slimming/evidence/S-NUM-CONTRACT.md)

## What changed in this repository

Implemented on branch `slim/server-admin` (base `adda9e1`), waves 1 and 2:

- Retired destinations and their direct routes show the normal not-found page: `/customers`, `/agents`, `/observational/**`, `/exports`, `/audit-log`, `/reports/agent-sales`, `/conversations`, `/live-events`. `/granot-lifecycle` and `/granot-lifecycle/receipts` redirect to `/granot-lifecycle/health`.
- The Admin Audit Log model (`admin_audit_logs`) and its writers are deleted (SLIM-08). Authentication, sessions, invites, proxy signing and role checks are unchanged.
- The database scope selector is gone (SLIM-03); old `database_scope` values are cleaned from storage and URLs.
- `/sales-intelligence` is Numbers + RingCentral Accounts only; see [CONTEXT.md](../../CONTEXT.md) and [`.cursor/rules/project-organization.mdc`](../../.cursor/rules/project-organization.mdc).
- Daily Operations is protected and unchanged.

The new deterministic Sales Outreach Desk stays governed by its own hashed packet (`docs/sales-outreach-desk/`, `SALES-OUTREACH-DESK.md`). Slimming work never edits that packet.

This pointer requires the sibling server checkout.
