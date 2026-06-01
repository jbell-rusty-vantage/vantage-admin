# Vantage Admin Docs Metadata And Agent Prompting Guide

## Purpose

This document explains how to use the Vantage Admin specification documents to prompt coding agents through the implementation.

Use this as the control document when starting new agent sessions. It tells the agent what to read, what unit to execute, what boundaries to respect, and what handoff summary to produce.

## Document Map

### `admin-dashboard-product-spec.md`

Use for product intent.

Contains:

- Owner goals.
- V1 scope and non-goals.
- Page inventory.
- Search, filters, analytics, exports.
- Booking and cancellation workflows.
- Permissions and success criteria.

Agents should read this when they need to understand why the feature exists and what user outcome matters.

### `admin-dashboard-technical-architecture.md`

Use for system design.

Contains:

- Next.js architecture.
- Auth/session design.
- Admin audit logging.
- API proxy pattern.
- TanStack Query strategy.
- Charting strategy.
- Security and deployment requirements.
- Suggested project structure.

Agents should read this before scaffolding, auth work, proxy work, or deployment-sensitive changes.

### `admin-dashboard-backend-api-spec.md`

Use for `vantage-main-server` work.

Contains:

- Current backend route surface.
- Missing admin endpoints.
- Required browse/detail/search/export endpoints.
- Database scope rules.
- Analytics endpoint contract.
- CSV export contract.
- Backend acceptance criteria.

Agents should read this before modifying `vantage-main-server`.

### `admin-dashboard-data-ui-spec.md`

Use for frontend screens and workflows.

Contains:

- Table columns.
- Filters.
- Detail views.
- Edit forms.
- Dropdown constants.
- Booking UX.
- Cancellation UX.
- Analytics UI.
- Cache invalidation rules.

Agents should read this before building pages, components, forms, filters, or charts.

### `admin-dashboard-agent-work-units.md`

Use for execution planning.

Contains:

- Six implementation units.
- Dependencies.
- Key files and folders.
- Handoff rules.
- Acceptance criteria.
- Stop conditions.
- Integration milestones.

Agents should use this to determine exactly what they own and what they must hand off.

## Recommended Reading Order For Every Agent

Every agent should read:

1. `admin-dashboard-docs-metadata.md`
2. `admin-dashboard-agent-work-units.md`
3. `admin-dashboard-product-spec.md`
4. The unit-specific docs listed below.

Unit-specific docs:

- Unit 1: read `admin-dashboard-technical-architecture.md`
- Unit 2: read `admin-dashboard-technical-architecture.md` and `admin-dashboard-data-ui-spec.md`
- Unit 3: read `admin-dashboard-backend-api-spec.md`
- Unit 4: read `admin-dashboard-backend-api-spec.md` and `admin-dashboard-product-spec.md`
- Unit 5: read `admin-dashboard-data-ui-spec.md` and `admin-dashboard-backend-api-spec.md`
- Unit 6: read all specs

If the agent will edit `vantage-main-server`, it must also read:

- `vantage-main-server/.cursor/rules/project-organization.mdc`
- `vantage-main-server/api/routes/v1.routes.ts`
- `vantage-main-server/api/services/v1.service.ts`
- The relevant backend model, service, and validation files.

## Global Prompt Rules

Include these rules in every implementation prompt:

```text
You are implementing one unit of the Vantage Admin dashboard.

Before coding, read the relevant specs in `vantage-admin/.cursor/`.

Respect these hard boundaries:
- All operational reads/writes go through `vantage-main-server`.
- The browser must never receive `VANTAGE_API_SECRET`.
- No delete UI in v1.
- Historical records are read-only.
- Booking and cancellation writes must preserve existing Google Sheet sync side effects.
- Prefer admin-specific backend routes under `/api/v1/admin/...`.
- Use server-side pagination, filtering, and sorting.
- Use URL-synced filters in the frontend.
- End with a handoff summary: files changed, env vars, commands run, tests run, limitations, and next-unit notes.
```

## Unit Prompt Templates

### Unit 1 Prompt: Foundation And Auth

```text
Implement Unit 1 from `vantage-admin/.cursor/admin-dashboard-agent-work-units.md`: Next.js Admin Foundation And Auth.

Read first:
- `vantage-admin/.cursor/admin-dashboard-docs-metadata.md`
- `vantage-admin/.cursor/admin-dashboard-agent-work-units.md`
- `vantage-admin/.cursor/admin-dashboard-product-spec.md`
- `vantage-admin/.cursor/admin-dashboard-technical-architecture.md`

Goal:
Create the greenfield Next.js App Router app in `vantage-admin`, with TypeScript, Tailwind, shadcn/ui, Mongo-backed custom admin auth, session cookies, protected dashboard middleware, `AdminUser`, `AdminAuditLog`, and a seed script.

Do not implement operational tables or backend admin APIs in this unit.

Finish with the required handoff summary and verification results.
```

### Unit 2 Prompt: Proxy, Constants, Query Infrastructure

```text
Implement Unit 2 from `vantage-admin/.cursor/admin-dashboard-agent-work-units.md`: Vantage API Proxy, Constants, Query Infrastructure.

Read first:
- `vantage-admin/.cursor/admin-dashboard-docs-metadata.md`
- `vantage-admin/.cursor/admin-dashboard-agent-work-units.md`
- `vantage-admin/.cursor/admin-dashboard-technical-architecture.md`
- `vantage-admin/.cursor/admin-dashboard-data-ui-spec.md`

Goal:
Build the server-only `vantage-main-server` API client, Next.js proxy route pattern, TanStack Query provider, query key factory, filter serialization, URL filter utilities, CSV helper, and frontend constants for agents, merchants, source labels, source companies, cancellation reasons, local types, and move sizes.

Hard requirement:
No browser request may include `x-api-secret` or `VANTAGE_API_SECRET`.

Finish with the required handoff summary and verification results.
```

### Unit 3 Prompt: Backend Admin Read APIs And Exports

```text
Implement Unit 3 from `vantage-admin/.cursor/admin-dashboard-agent-work-units.md`: Backend Admin Read APIs, Global Search, And CSV Exports.

Read first:
- `vantage-admin/.cursor/admin-dashboard-docs-metadata.md`
- `vantage-admin/.cursor/admin-dashboard-agent-work-units.md`
- `vantage-admin/.cursor/admin-dashboard-backend-api-spec.md`
- `vantage-admin/.cursor/admin-dashboard-product-spec.md`
- `vantage-main-server/.cursor/rules/project-organization.mdc`
- `vantage-main-server/api/routes/v1.routes.ts`
- `vantage-main-server/api/services/v1.service.ts`
- Relevant files under `vantage-main-server/api/models/`, `api/services/search/`, and `api/validation/v1/`
- Relevant historical models under `vantage-main-server/scripts/historical/models/`

Goal:
Add admin-specific backend routes/services for browse, detail, global search, historical read-only access, and CSV export for form leads, call leads, bookings, cancellations, customers, and agents.

Do not implement analytics in this unit except shared scope/export helpers that Unit 4 can reuse.

Hard requirements:
- Existing public `/api/v1` behavior must not break.
- Historical scope is read-only.
- No delete routes are added or promoted for admin v1.

Finish with the required handoff summary and verification results.
```

### Unit 4 Prompt: Backend Analytics APIs

```text
Implement Unit 4 from `vantage-admin/.cursor/admin-dashboard-agent-work-units.md`: Backend Analytics APIs.

Read first:
- `vantage-admin/.cursor/admin-dashboard-docs-metadata.md`
- `vantage-admin/.cursor/admin-dashboard-agent-work-units.md`
- `vantage-admin/.cursor/admin-dashboard-backend-api-spec.md`
- `vantage-admin/.cursor/admin-dashboard-product-spec.md`
- `vantage-main-server/scripts/historical/historical-analytics.ts`
- `vantage-main-server/scripts/historical/models/`
- `vantage-main-server/api/models/`
- `vantage-main-server/api/config/domain/`

Goal:
Extract the historical analytics concepts into reusable backend analytics services and expose typed `/api/v1/admin/analytics/...` endpoints for production, historical, and combined scopes.

Hard requirements:
- Combined analytics must merge by stable text dimensions, not ObjectIds.
- Date filters must work.
- Add leading `$match` stages where practical.
- Preserve existing historical script behavior unless intentionally extracting shared logic.

Finish with the required handoff summary and verification results.
```

### Unit 5 Prompt: Operational Tables And Details

```text
Implement Unit 5 from `vantage-admin/.cursor/admin-dashboard-agent-work-units.md`: Frontend Operational Tables And Record Details.

Read first:
- `vantage-admin/.cursor/admin-dashboard-docs-metadata.md`
- `vantage-admin/.cursor/admin-dashboard-agent-work-units.md`
- `vantage-admin/.cursor/admin-dashboard-data-ui-spec.md`
- `vantage-admin/.cursor/admin-dashboard-backend-api-spec.md`
- `vantage-admin/.cursor/admin-dashboard-technical-architecture.md`

Goal:
Build the dashboard pages for Form Leads, Call Leads, Bookings, Cancellations, Customers, Agents, Audit Log, global search results, detail drawers/pages, production edit forms, historical read-only behavior, and CSV export buttons.

Dependencies:
This unit expects Unit 1, Unit 2, and enough of Unit 3 to be complete. If backend routes are incomplete, create narrow placeholders only when necessary and clearly document what remains blocked.

Hard requirements:
- Filters sync to URL.
- Tables use server-side pagination/sorting/filtering.
- Historical mode hides mutation actions.
- Production mode never shows delete actions.
- Edits go through the Next.js proxy to `vantage-main-server`.

Finish with the required handoff summary and verification results.
```

### Unit 6 Prompt: Workflows, Analytics, Hardening

```text
Implement Unit 6 from `vantage-admin/.cursor/admin-dashboard-agent-work-units.md`: Booking, Cancellation, Analytics, And Final Hardening.

Read first:
- All files in `vantage-admin/.cursor/admin-dashboard-*.md`
- `vantage-main-server/api/services/bookings/bookedLead.service.ts`
- `vantage-main-server/api/services/bookings/bookedLeadFromSource.service.ts`
- `vantage-main-server/api/services/cancellations/cancelledLead.service.ts`
- `vantage-main-server/api/validation/v1/bookings.validation.ts`
- `vantage-main-server/api/validation/v1/cancellations.validation.ts`

Goal:
Implement booking from selected form/call leads, cancellation from selected booking/lead, analytics pages and charts, overview cards, analytics CSV exports, cache invalidation, and final production hardening.

Hard requirements:
- Booking and cancellation submit through `vantage-main-server`.
- Existing Google Sheet sync side effects must remain intact.
- Split agent binder behavior mirrors the current Google Form.
- Historical records cannot be booked, cancelled, or edited.
- Analytics support production, historical, and combined scopes.

Finish with the required handoff summary and verification results.
```

## Prompting Strategy

### Best Approach

Start agents one unit at a time until Unit 2 is complete. After that, Units 3 and 4 can run in parallel if they coordinate backend route/scope helper names.

Recommended sequence:

1. Run Unit 1.
2. Run Unit 2.
3. Run Unit 3 and Unit 4, optionally in parallel.
4. Run Unit 5.
5. Run Unit 6.

### When To Use Parallel Agents

Good parallel split:

- Agent A: Unit 3 backend admin read/export APIs.
- Agent B: Unit 4 backend analytics APIs.

Only do this after agreeing on:

- Admin route prefix: `/api/v1/admin`.
- Shared database scope utility location.
- Shared CSV helper location.

Avoid running Units 5 and 6 in parallel unless Unit 5 has stable page/component contracts.

## Integration Prompts

Use these after units complete.

### Integration Review Prompt

```text
Review the completed Vantage Admin work against the docs in `vantage-admin/.cursor/`.

Focus on:
- Spec deviations.
- Security issues.
- Browser exposure of secrets.
- Historical write risks.
- Missing audit logging.
- Delete UI accidentally exposed.
- Booking/cancellation sync regressions.
- Missing tests.

Return findings first, ordered by severity, with file references and recommended fixes.
```

### Backend Contract Check Prompt

```text
Compare the implemented `vantage-main-server` admin endpoints against `vantage-admin/.cursor/admin-dashboard-backend-api-spec.md`.

Return:
- Implemented endpoints.
- Missing endpoints.
- Filter gaps.
- Response shape mismatches.
- Historical scope gaps.
- CSV export gaps.
- Analytics gaps.
- Test gaps.
```

### Frontend Contract Check Prompt

```text
Compare the implemented `vantage-admin` UI against `vantage-admin/.cursor/admin-dashboard-data-ui-spec.md`.

Return:
- Implemented pages.
- Missing pages.
- Missing filters.
- Missing columns/detail fields.
- Workflow gaps.
- Historical read-only gaps.
- Delete UI risks.
- Cache invalidation gaps.
- Test gaps.
```

## Final Acceptance Prompt

Use this when all units are believed complete:

```text
Perform final acceptance for the Vantage Admin dashboard using all docs in `vantage-admin/.cursor/`.

Verify:
- Owner can sign in.
- Owner can browse and filter every model.
- Owner can view production and historical records.
- Owner can update safe production fields.
- Owner can book selected form and call leads.
- Owner can cancel selected production bookings or booked leads.
- Owner can view analytics across production, historical, and combined scopes.
- Owner can export filtered CSVs.
- Every mutation is audit logged.
- Deletes are not exposed.
- Historical records are read-only.
- `VANTAGE_API_SECRET` never reaches browser code.
- Critical tests pass.

Return:
- Pass/fail by requirement.
- Blocking issues.
- Non-blocking issues.
- Recommended launch checklist.
```

## What Not To Ask Agents To Do

Do not ask any unit agent to:

- Build all units at once.
- Bypass `vantage-main-server` for operational writes.
- Add delete controls in the admin UI.
- Make historical records editable.
- Put `VANTAGE_API_SECRET` in client code.
- Replace the existing booking or cancellation service logic without a focused reason.
- Refactor unrelated backend systems while implementing the admin dashboard.

## If A Unit Gets Stuck

Ask the stuck agent for:

- Exact blocker.
- File and symbol involved.
- What has already been tried.
- Whether the blocker is product, backend contract, data-model, auth, deployment, or test related.
- The smallest decision needed to continue.

Then resume the same unit with a narrower prompt rather than starting the whole implementation over.
