# Vantage Admin Agent Work Units

## Purpose

This document partitions the Vantage Admin implementation into six large but bounded work units suitable for frontier coding agents with subagent and planning ability.

Each unit includes:

- Goal.
- Scope.
- Key files and folders.
- Dependencies.
- Handoff inputs.
- Handoff outputs.
- Acceptance criteria.
- Stop conditions.

## Global Handoff Rules

### Before Starting Any Unit

The assigned agent must read:

- `vantage-admin/.cursor/admin-dashboard-product-spec.md`
- `vantage-admin/.cursor/admin-dashboard-technical-architecture.md`
- `vantage-admin/.cursor/admin-dashboard-backend-api-spec.md`
- `vantage-admin/.cursor/admin-dashboard-data-ui-spec.md`
- `vantage-admin/.cursor/admin-dashboard-agent-work-units.md`

If working in `vantage-main-server`, also read:

- `vantage-main-server/.cursor/rules/project-organization.mdc`
- `vantage-main-server/api/routes/v1.routes.ts`
- `vantage-main-server/api/services/v1.service.ts`
- Relevant model/service/validation files for the unit.

### During Implementation

- Keep all operational writes routed through `vantage-main-server`.
- Do not expose `VANTAGE_API_SECRET` to browser code.
- Do not add delete UI in v1.
- Preserve existing Google Sheet sync behavior.
- Preserve existing public/extension API behavior.
- Prefer adding admin-specific routes under `/api/v1/admin/...` instead of breaking existing route contracts.
- Use server-side pagination/filtering for tables.
- Use URL-synced filters in the frontend.
- Add tests proportional to risk.

### Handoff Output Required From Every Unit

Each agent must finish with:

- Summary of changes.
- Files changed.
- Env vars added or changed.
- Commands run.
- Tests run and results.
- Known limitations.
- Follow-up tasks for the next unit.

### Stop Conditions

Stop and ask for direction if:

- A needed backend invariant conflicts with the current booking or cancellation workflow.
- A production write would require bypassing `vantage-main-server`.
- A delete action seems necessary for v1.
- Historical writes become necessary.
- Secrets would need to be exposed to the browser.
- Existing Google Sheet sync behavior would be changed.

## Unit 1: Next.js Admin Foundation And Auth

### Goal

Create the greenfield `vantage-admin` Next.js app foundation, protected dashboard shell, custom Mongo-backed owner login, and audit log base.

### Scope

Implement:

- Next.js App Router app.
- TypeScript.
- Tailwind CSS.
- shadcn/ui setup.
- Environment validation.
- Mongo connection for admin auth collections.
- `AdminUser` model.
- `AdminAuditLog` model.
- Login page.
- Logout.
- Refresh/session route.
- Protected dashboard middleware.
- Seed script for first admin user.
- Basic dashboard layout shell.

### Key Folders And Files

Create or modify:

- `vantage-admin/package.json`
- `vantage-admin/next.config.ts`
- `vantage-admin/tsconfig.json`
- `vantage-admin/app/layout.tsx`
- `vantage-admin/app/(auth)/login/page.tsx`
- `vantage-admin/app/(dashboard)/layout.tsx`
- `vantage-admin/app/(dashboard)/page.tsx`
- `vantage-admin/app/api/auth/login/route.ts`
- `vantage-admin/app/api/auth/refresh/route.ts`
- `vantage-admin/app/api/auth/logout/route.ts`
- `vantage-admin/app/api/auth/me/route.ts`
- `vantage-admin/middleware.ts`
- `vantage-admin/lib/env/server.ts`
- `vantage-admin/lib/db/adminMongo.ts`
- `vantage-admin/server/auth/`
- `vantage-admin/server/audit/`
- `vantage-admin/scripts/seed-admin-user.ts`
- `vantage-admin/components/layout/`
- `vantage-admin/components/ui/`

### Dependencies

No implementation dependency on other units.

### Handoff Inputs

- Env variable names from technical architecture spec.
- Desired initial owner email and password supplied out-of-band through env or seed command.

### Handoff Outputs

- Working protected dashboard shell.
- Seedable admin user.
- Audit log helper usable by later units.
- Documented auth env vars.

### Acceptance Criteria

- Unauthenticated users are redirected to login.
- Valid owner credentials create a session.
- Invalid login fails without leaking details.
- Logout clears auth cookies.
- `/api/auth/me` returns the current admin.
- Dashboard route is protected.
- Login success/failure and logout create audit log entries.
- No operational business collections are accessed directly.
- Tests cover password verification, token creation/verification, and protected route behavior where practical.

### Suggested Verification

- `npm run lint`
- `npm run test`
- Manual login/logout in local dev.

## Unit 2: Vantage API Proxy, Constants, Query Infrastructure

### Goal

Build the frontend-to-backend integration layer used by all pages and workflows.

### Scope

Implement:

- Server-only Vantage API client.
- Local Next.js proxy route conventions.
- Typed response parsing.
- Typed error handling.
- TanStack Query provider.
- Query key factory.
- Filter serialization utilities.
- URL search param utilities.
- CSV download helper.
- Frontend constants mirroring current Google Forms.
- Shared UI primitives for filters, scope selection, status badges, money/date formatting, and empty/error states.

### Key Folders And Files

Create or modify:

- `vantage-admin/server/vantage-api/client.ts`
- `vantage-admin/server/vantage-api/errors.ts`
- `vantage-admin/app/api/proxy/[...path]/route.ts` or route-specific proxy files
- `vantage-admin/lib/query/client.tsx`
- `vantage-admin/lib/query/keys.ts`
- `vantage-admin/lib/api/types.ts`
- `vantage-admin/lib/api/filters.ts`
- `vantage-admin/lib/constants/domain.ts`
- `vantage-admin/components/filters/`
- `vantage-admin/components/data-table/`
- `vantage-admin/components/record-detail/`
- `vantage-admin/components/layout/database-scope-selector.tsx`
- `vantage-admin/components/layout/global-search.tsx`

Relevant backend references:

- `vantage-main-server/api/middleware/requireApiSecret.ts`
- `vantage-main-server/api/routes/v1.routes.ts`
- `vantage-main-server/scripts/google_apps_scripts/create-booked-lead-form.gs`
- `vantage-main-server/docs/cancellation_form.gs`
- `vantage-main-server/api/config/domain/sources.ts`
- `vantage-main-server/api/config/domain/constants.ts`

### Dependencies

Depends on Unit 1 auth/session shell.

### Handoff Inputs

- `VANTAGE_API_BASE_URL`
- `VANTAGE_API_SECRET`
- Auth middleware from Unit 1.

### Handoff Outputs

- Server proxy that can call `vantage-main-server`.
- Shared query and filter infrastructure.
- Shared constants for agents, merchants, source labels, source companies, cancellation reasons, local types, and move sizes.
- Base components reusable by table/workflow/analytics units.

### Acceptance Criteria

- Browser requests never include `x-api-secret`.
- Server client attaches `x-api-secret`.
- Successful backend responses are normalized.
- Backend errors are surfaced with useful messages.
- Auth is required for proxy routes.
- Mutating proxy requests can call the audit helper.
- Constants match current Google Forms.
- Query provider works in the dashboard layout.

### Suggested Verification

- Inspect browser network tab to confirm no API secret exposure.
- Hit a health or simple list route through local proxy.
- Unit test filter serialization and response parsing.

## Unit 3: Backend Admin Read APIs, Global Search, And CSV Exports

### Goal

Add the backend read API surface required for admin tables, detail drawers, global search, historical read-only access, and CSV exports.

### Scope

In `vantage-main-server`, implement admin-specific routes and services for:

- Form lead admin browse/detail.
- Call lead admin browse/detail.
- Booking admin browse/detail.
- Cancellation admin browse/detail.
- Customer admin browse/detail.
- Agent admin browse/detail.
- Global search.
- CSV export endpoints for operational tables.
- Database scope support for production and historical reads.

Do not implement analytics in this unit unless a small helper is shared.

### Key Folders And Files

Read first:

- `vantage-main-server/.cursor/rules/project-organization.mdc`
- `vantage-main-server/api/routes/v1.routes.ts`
- `vantage-main-server/api/services/v1.service.ts`
- `vantage-main-server/api/models/`
- `vantage-main-server/scripts/historical/models/`
- `vantage-main-server/api/services/search/`
- `vantage-main-server/api/validation/v1/`

Likely create:

- `vantage-main-server/api/routes/admin.routes.ts` or admin route section in `v1.routes.ts`
- `vantage-main-server/api/services/admin/`
- `vantage-main-server/api/services/admin/adminScope.service.ts`
- `vantage-main-server/api/services/admin/adminBrowse.service.ts`
- `vantage-main-server/api/services/admin/adminDetail.service.ts`
- `vantage-main-server/api/services/admin/adminSearch.service.ts`
- `vantage-main-server/api/services/admin/adminExport.service.ts`
- `vantage-main-server/api/validation/v1/admin.validation.ts`
- `vantage-main-server/api/utils/csv.ts`

### Dependencies

Can run in parallel with Units 1 and 2 after specs are read.

Frontend table units depend on this unit for complete data.

### Handoff Inputs

- Backend API spec.
- Data/UI spec.
- Existing model and search service behavior.

### Handoff Outputs

- Admin read endpoints.
- Global search endpoint.
- CSV export endpoints.
- Tests for filters and scope behavior.
- Clear route list for frontend agents.

### Acceptance Criteria

- Every model has admin browse and detail endpoints.
- Browse endpoints support server-side pagination and sorting.
- Filters from the backend spec are implemented or explicitly documented as deferred.
- Historical scope is read-only.
- Detail endpoints populate linked records needed by the UI.
- Global search returns grouped results.
- CSV exports use the same filters as browse endpoints.
- Existing `/api/v1` routes still work.
- No delete routes are added or promoted for admin v1.

### Suggested Verification

- Backend unit/integration tests.
- Manual calls with `x-api-secret`.
- Compare production and historical scope output.
- Verify CSV content type and headers.

## Unit 4: Backend Analytics APIs

### Goal

Turn the existing historical analytics logic into production-ready typed API endpoints that support production, historical, and combined dashboard scopes.

### Scope

In `vantage-main-server`, implement:

- Shared analytics service layer.
- Connection/model selection by database scope.
- Date-range filters.
- Source, agent, merchant, local, and lead type filters where relevant.
- Production analytics.
- Historical analytics.
- Combined analytics merging.
- Analytics CSV exports or export support for Unit 3 export helper.

### Key Folders And Files

Read first:

- `vantage-main-server/scripts/historical/historical-analytics.ts`
- `vantage-main-server/scripts/historical/models/`
- `vantage-main-server/api/models/`
- `vantage-main-server/api/config/domain/`

Likely create:

- `vantage-main-server/api/services/analytics/analyticsScope.service.ts`
- `vantage-main-server/api/services/analytics/analyticsFilters.ts`
- `vantage-main-server/api/services/analytics/revenueTrend.service.ts`
- `vantage-main-server/api/services/analytics/sourcePerformance.service.ts`
- `vantage-main-server/api/services/analytics/agentPerformance.service.ts`
- `vantage-main-server/api/services/analytics/cancellationAnalytics.service.ts`
- `vantage-main-server/api/services/analytics/geographicAnalytics.service.ts`
- `vantage-main-server/api/validation/v1/analytics.validation.ts`
- Analytics route handlers under `/api/v1/admin/analytics`

### Dependencies

Can run after or alongside Unit 3 if both agents coordinate route names and shared scope utilities.

Frontend analytics depends on this unit.

### Handoff Inputs

- Historical analytics script.
- Backend API spec analytics section.
- Any shared admin scope utilities from Unit 3.

### Handoff Outputs

- Analytics endpoints:
  - `/summary`
  - `/revenue-trend`
  - `/source-company-performance`
  - `/agent-performance`
  - `/booking-cancellation-ratio`
  - `/source-company-funnel`
  - `/cancellation-reasons`
  - `/lead-source-performance`
  - `/local-vs-long-distance`
  - `/geographic-lanes`
- Tests for production, historical, and combined scope.
- Documented response shapes for frontend charts.

### Acceptance Criteria

- Existing historical analytics concepts are preserved.
- Production and historical pipelines can run independently.
- Combined analytics merge by stable text dimensions, not ObjectId.
- Date filters work.
- Common filters work where relevant.
- Endpoints return chart-friendly arrays.
- Long-running full scans are avoided where practical with leading `$match` stages.
- Tests cover at least one combined merge path and one date-filtered path.

### Suggested Verification

- Run backend analytics tests.
- Compare historical endpoint output against the existing historical script for a broad all-time range.
- Spot-check production output with known recent records.

## Unit 5: Frontend Operational Tables And Record Details

### Goal

Build the owner-facing operational pages for browsing, filtering, viewing, updating, and exporting records.

### Scope

Implement pages for:

- Form Leads
- Call Leads
- Bookings
- Cancellations
- Customers
- Agents
- Audit Log
- Exports list or export actions

Implement:

- Server-side table components wired to proxy routes.
- URL-synced filters.
- Detail drawers/pages.
- Production edit forms.
- Historical read-only behavior.
- CSV export buttons.
- Global search UI results navigation.

Do not implement booking/cancellation create workflows here unless small record action buttons link to Unit 6 routes.

### Key Folders And Files

Create or modify:

- `vantage-admin/app/(dashboard)/form-leads/page.tsx`
- `vantage-admin/app/(dashboard)/call-leads/page.tsx`
- `vantage-admin/app/(dashboard)/bookings/page.tsx`
- `vantage-admin/app/(dashboard)/cancellations/page.tsx`
- `vantage-admin/app/(dashboard)/customers/page.tsx`
- `vantage-admin/app/(dashboard)/agents/page.tsx`
- `vantage-admin/app/(dashboard)/audit-log/page.tsx`
- `vantage-admin/app/api/proxy/admin/...`
- `vantage-admin/components/data-table/`
- `vantage-admin/components/filters/`
- `vantage-admin/components/record-detail/`
- `vantage-admin/components/forms/edit-*.tsx`
- `vantage-admin/lib/api/admin-*.ts`
- `vantage-admin/lib/query/keys.ts`

### Dependencies

Depends on:

- Unit 1
- Unit 2
- Unit 3

Can start with mocked route handlers if Unit 3 is not complete, but must finish against real backend routes.

### Handoff Inputs

- Route list and response shapes from Unit 3.
- Shared table/filter components from Unit 2.
- Data/UI spec.

### Handoff Outputs

- Working model pages.
- Working detail views.
- Working edit mutations for supported production records.
- Working CSV export buttons.
- Global search integrated into top bar.
- Audit log viewer.

### Acceptance Criteria

- Every model page loads real data.
- Filters sync to URL.
- Pagination and sorting call the server.
- Historical mode hides mutation actions.
- Production mode never shows delete actions.
- Detail views show linked records.
- Edits use existing backend write endpoints through the Next.js proxy.
- Mutations invalidate relevant TanStack Query caches.
- Mutation attempts are audit logged by proxy layer.
- CSV exports download filtered data.

### Suggested Verification

- E2E smoke through each page.
- Browser check for no `x-api-secret`.
- Update a safe test record and verify audit log entry.
- Confirm historical rows are read-only.

## Unit 6: Booking, Cancellation, Analytics, And Final Hardening

### Goal

Implement the high-value workflows and analytics experience, then harden the complete app for production.

### Scope

Implement:

- Booking from selected form lead.
- Booking from selected call lead.
- Cancellation from selected booking.
- Cancellation from selected lead.
- Analytics dashboard and charts.
- Analytics CSV export actions.
- Overview dashboard cards.
- Cache invalidation for booking/cancellation workflows.
- Final tests and deployment documentation.

### Key Folders And Files

Create or modify:

- `vantage-admin/app/(dashboard)/bookings/new/page.tsx`
- `vantage-admin/app/(dashboard)/cancellations/new/page.tsx`
- `vantage-admin/app/(dashboard)/analytics/page.tsx`
- `vantage-admin/app/(dashboard)/page.tsx`
- `vantage-admin/components/forms/booking-form.tsx`
- `vantage-admin/components/forms/cancellation-form.tsx`
- `vantage-admin/components/charts/`
- `vantage-admin/components/analytics/`
- `vantage-admin/lib/api/analytics.ts`
- `vantage-admin/lib/api/workflows.ts`
- `vantage-admin/lib/constants/domain.ts`
- `vantage-admin/docs/deployment.md` if docs are added outside `.cursor`

Backend references:

- `vantage-main-server/api/services/bookings/bookedLead.service.ts`
- `vantage-main-server/api/services/bookings/bookedLeadFromSource.service.ts`
- `vantage-main-server/api/services/cancellations/cancelledLead.service.ts`
- `vantage-main-server/api/validation/v1/bookings.validation.ts`
- `vantage-main-server/api/validation/v1/cancellations.validation.ts`

### Dependencies

Depends on:

- Unit 1
- Unit 2
- Unit 3
- Unit 4
- Most of Unit 5

### Handoff Inputs

- Working proxy client.
- Working table/detail pages.
- Backend analytics endpoint response shapes.
- Existing booking/cancellation validations.

### Handoff Outputs

- Booking and cancellation workflows complete.
- Analytics pages complete.
- Overview dashboard complete.
- Production hardening checklist.
- E2E or integration tests for critical owner paths.

### Acceptance Criteria

- Booking a selected FormLead prefills `form_lead_id`, source context, and requires `job_no`.
- Booking a selected CallLead prefills `call_job_no` and/or `call_phone_number`.
- Split agent behavior splits binder 50/50.
- Booking submit calls `vantage-main-server` through the Next.js proxy.
- Booking success updates source lead and booking views after cache invalidation.
- Cancelling a selected booking submits `booked_lead`.
- Cancelling a selected lead submits `lead_id`.
- Already-cancelled bookings cannot be cancelled again from UI.
- Historical records cannot be booked or cancelled.
- Analytics charts respect date filters and database scope.
- Combined analytics clearly show combined scope.
- CSV export works for analytics result data.
- Critical paths are tested.

### Suggested Verification

- E2E: login, filter lead, create booking, view booking.
- E2E: login, filter booking, create cancellation, view cancellation.
- E2E: login, view analytics with production, historical, and combined scopes.
- E2E: export CSV from table and analytics page.
- Confirm Google Sheet sync still happens through existing backend behavior.

## Suggested Execution Order

1. Unit 1: Next.js Admin Foundation And Auth
2. Unit 2: Vantage API Proxy, Constants, Query Infrastructure
3. Unit 3: Backend Admin Read APIs, Global Search, And CSV Exports
4. Unit 4: Backend Analytics APIs
5. Unit 5: Frontend Operational Tables And Record Details
6. Unit 6: Booking, Cancellation, Analytics, And Final Hardening

## Parallelization Strategy

Possible parallel work:

- Unit 1 and Unit 3 can start at the same time.
- Unit 4 can start once Unit 3 chooses shared admin route and scope patterns.
- Unit 2 can start after Unit 1 creates the app shell, or in parallel if scaffold conventions are agreed.
- Unit 5 should wait for Unit 2 and enough of Unit 3.
- Unit 6 should wait for Units 2, 4, and most of Unit 5.

## Integration Milestones

### Milestone 1: Secure Shell

Units:

- Unit 1
- Unit 2 partial

Demo:

- Owner can log in.
- Dashboard shell loads.
- Proxy can call a backend endpoint without exposing secret.

### Milestone 2: Read-Only Command Center

Units:

- Unit 3
- Unit 5 partial

Demo:

- Owner can browse production and historical records.
- Owner can use filters and global search.
- Owner can export CSV.

### Milestone 3: Operational Workflows

Units:

- Unit 5 complete
- Unit 6 workflow portion

Demo:

- Owner can update records.
- Owner can book selected leads.
- Owner can cancel selected bookings or booked leads.
- Audit log records mutations.

### Milestone 4: Analytics Dashboard

Units:

- Unit 4
- Unit 6 analytics portion

Demo:

- Owner can view production, historical, and combined analytics.
- Owner can export analytics CSVs.

### Milestone 5: Production Readiness

Units:

- Unit 6 hardening

Demo:

- Critical E2E paths pass.
- Deployment env vars documented.
- No API secret in browser.
- No delete UI.
- Historical records are read-only.

## Ownership Map

### `vantage-admin`

Owns:

- Admin auth.
- Session cookies.
- Admin audit logs.
- Next.js route handlers.
- API proxy.
- UI.
- TanStack Query.
- Charts.
- Frontend constants.

Must not own:

- Operational write business rules.
- Google Sheet sync.
- Direct writes to production business collections.
- Direct reads from production or historical business collections for dashboard data.

### `vantage-main-server`

Owns:

- Operational models.
- Admin read endpoints.
- Booking and cancellation writes.
- Search.
- Analytics aggregation.
- CSV export generation.
- Production and historical database scope.
- Google Sheet sync.

Must not own:

- Owner login UI.
- Browser sessions for `vantage-admin`.
- Admin audit logs for UI activity, unless later explicitly moved.

## Final Definition Of Done

The admin app is complete when:

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
- `VANTAGE_API_SECRET` never reaches the browser.
- Critical tests pass.
- Deployment steps and env vars are documented.
