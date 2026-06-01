# Vantage Admin Backend API Spec

## Purpose

This document specifies the `vantage-main-server` API surface needed by `vantage-admin`.

The admin app must not read or write operational business collections directly. All operational data, analytics, and CSV exports must flow through `vantage-main-server`.

## Existing Backend Surface

Current routes live in:

- `vantage-main-server/api/routes/v1.routes.ts`

Current service facade:

- `vantage-main-server/api/services/v1.service.ts`

Current models:

- `vantage-main-server/api/models/FormLead.ts`
- `vantage-main-server/api/models/CallLead.ts`
- `vantage-main-server/api/models/BookedLead.ts`
- `vantage-main-server/api/models/CancelledLead.ts`
- `vantage-main-server/api/models/Customer.ts`
- `vantage-main-server/api/models/Agent.ts`

Historical models:

- `vantage-main-server/scripts/historical/models/`

Current useful endpoints:

- `GET /api/v1/form-leads`
- `GET /api/v1/form-leads/:id`
- `POST /api/v1/form-leads/search`
- `POST /api/v1/form-leads`
- `PATCH /api/v1/form-leads/:id`
- `DELETE /api/v1/form-leads/:id`
- `GET /api/v1/call-leads`
- `POST /api/v1/call-leads/search`
- `POST /api/v1/call-leads`
- `PATCH /api/v1/call-leads/:id`
- `DELETE /api/v1/call-leads/:id`
- `GET /api/v1/booked-leads`
- `POST /api/v1/booked-leads`
- `POST /api/v1/booked-leads/from-source`
- `PATCH /api/v1/booked-leads/:id`
- `DELETE /api/v1/booked-leads/:id`
- `GET /api/v1/cancelled-leads`
- `POST /api/v1/cancelled-leads`
- `PATCH /api/v1/cancelled-leads/:id`
- `DELETE /api/v1/cancelled-leads/:id`
- `GET /api/v1/customers`
- `POST /api/v1/customers`
- `PATCH /api/v1/customers/:id`
- `DELETE /api/v1/customers/:id`

Known gaps:

- Missing admin-grade browse/search for bookings, cancellations, customers, and agents.
- Missing full detail endpoints for call leads, bookings, cancellations, customers, and agents.
- Existing booking and cancellation list endpoints are capped and not filter-rich.
- Historical database is not exposed through API routes.
- Historical analytics script is not exposed as reusable API services.
- No CSV export endpoints.
- No global search endpoint.

## API Conventions

All admin endpoints should use:

```json
{
  "ok": true,
  "data": {}
}
```

or:

```json
{
  "ok": false,
  "error": "Message"
}
```

Admin API routes remain protected by `x-api-secret`.

The Next.js admin app is responsible for owner login. `vantage-main-server` should continue to trust only the API secret for admin backend calls.

## Database Scope

Use `database_scope` on admin browse, detail, analytics, search, and export endpoints.

Allowed values:

- `production`
- `historical`
- `combined`

Rules:

- Writes only support `production`.
- `historical` is read-only.
- `combined` is for analytics, global search, and exports only where explicitly supported.
- Detail endpoints should generally support `production` or `historical`, not `combined`.

## Pagination

Use server-side pagination on every browse endpoint.

Preferred response shape:

```json
{
  "items": [],
  "page": 1,
  "limit": 50,
  "total": 1234,
  "has_next_page": true
}
```

If cursor pagination is easier for large collections, use:

```json
{
  "items": [],
  "cursor": "next-cursor",
  "limit": 50,
  "has_next_page": true
}
```

Do not fetch all records for browser-side filtering.

## Common Query Params

Use only where relevant:

- `database_scope`
- `q`
- `from`
- `to`
- `date_field`
- `source_company`
- `source_label`
- `agent`
- `customer_name`
- `customer_phone`
- `customer_email`
- `job_no`
- `merchant`
- `local`
- `booked`
- `cancelled`
- `pickup_state`
- `pickup_zip`
- `delivery_state`
- `delivery_zip`
- `deposit_min`
- `deposit_max`
- `binder_min`
- `binder_max`
- `refund_min`
- `refund_max`
- `reason`
- `cancelled_by`
- `limit`
- `page` or `cursor`
- `sort`
- `direction`

## Required Browse And Detail Endpoints

### Form Leads

Existing endpoint can be extended:

- `GET /api/v1/admin/form-leads`
- `GET /api/v1/admin/form-leads/:id`

Filters:

- `database_scope`
- `q`
- `from`
- `to`
- `date_field=timestamp|createdAt|move_date`
- `source_company`
- `name`
- `email`
- `phone_number`
- `ref_no`
- `booked`
- `cancelled`
- `pickup_state`
- `pickup_zip`
- `delivery_state`
- `delivery_zip`
- `move_size`
- `local`
- `limit`
- `page`
- `sort`
- `direction`

Detail response should include:

- Full form lead document.
- Linked booking summary.
- Linked cancellation summary.
- Customer summary if linked through booking.
- Sheet sync status if present.

### Call Leads

- `GET /api/v1/admin/call-leads`
- `GET /api/v1/admin/call-leads/:id`

Filters:

- `database_scope`
- `q`
- `from`
- `to`
- `date_field=timestamp|createdAt|start_time|end_time`
- `source_company`
- `name`
- `email`
- `phone_number`
- `job_no`
- `booked`
- `cancelled`
- `pickup_state`
- `pickup_zip`
- `delivery_state`
- `delivery_zip`
- `local`
- `limit`
- `page`
- `sort`
- `direction`

Detail response should include:

- Full call lead document.
- Linked booking summary.
- Linked cancellation summary.
- Customer summary if linked through booking.
- Sheet sync status if present.

### Bookings

- `GET /api/v1/admin/booked-leads`
- `GET /api/v1/admin/booked-leads/:id`

Filters:

- `database_scope`
- `q`
- `from`
- `to`
- `date_field=book_date|timestamp|createdAt`
- `source_company`
- `source`
- `agent`
- `customer_name`
- `customer_phone`
- `customer_email`
- `job_no`
- `merchant`
- `local`
- `cancelled`
- `deposit_min`
- `deposit_max`
- `binder_min`
- `binder_max`
- `limit`
- `page`
- `sort`
- `direction`

Detail response should include:

- Full booking document.
- Populated customer.
- Populated source lead.
- Populated cancellation if present.
- Agent allocation details.
- Sheet sync status if present.

### Cancellations

- `GET /api/v1/admin/cancelled-leads`
- `GET /api/v1/admin/cancelled-leads/:id`

Filters:

- `database_scope`
- `q`
- `from`
- `to`
- `date_field=cancel_date|timestamp|createdAt|book_date`
- `source_company`
- `source`
- `agent`
- `customer_name`
- `customer_phone`
- `customer_email`
- `job_no`
- `merchant`
- `reason`
- `cancelled_by`
- `refund_min`
- `refund_max`
- `limit`
- `page`
- `sort`
- `direction`

Detail response should include:

- Full cancellation document.
- Populated booking.
- Populated customer.
- Populated source lead.
- Snapshot fields.
- Sheet sync status if present.

### Customers

- `GET /api/v1/admin/customers`
- `GET /api/v1/admin/customers/:id`

Filters:

- `database_scope`
- `q`
- `name`
- `phone_number`
- `email`
- `from`
- `to`
- `limit`
- `page`
- `sort`
- `direction`

Detail response should include:

- Customer document.
- Related leads.
- Related bookings.
- Related cancellations.
- Aggregate counts and totals.

### Agents

- `GET /api/v1/admin/agents`
- `GET /api/v1/admin/agents/:id`

Filters:

- `database_scope`
- `q`
- `name`
- `active`
- `role`
- `from`
- `to`
- `limit`
- `page`
- `sort`
- `direction`

Detail response should include:

- Agent document.
- Booking count.
- Total binder amount.
- Total deposit amount for bookings they participated in.
- Cancellation count and rate.
- Recent bookings.

## Global Search Endpoint

- `GET /api/v1/admin/search`

Params:

- `database_scope=production|historical|combined`
- `q`
- `limit`

Search across:

- Form leads
- Call leads
- Bookings
- Cancellations
- Customers
- Agents

Result shape:

```json
{
  "groups": [
    {
      "record_type": "booked_lead",
      "items": [
        {
          "id": "string",
          "database_scope": "production",
          "primary_label": "Job 12345",
          "secondary_label": "Customer Name",
          "badges": ["booked"],
          "href": "/bookings/string"
        }
      ]
    }
  ]
}
```

## Write Endpoints

Use existing write endpoints where possible:

- `PATCH /api/v1/form-leads/:id`
- `PATCH /api/v1/call-leads/:id`
- `PATCH /api/v1/booked-leads/:id`
- `POST /api/v1/booked-leads`
- `POST /api/v1/booked-leads/from-source`
- `POST /api/v1/cancelled-leads`
- `PATCH /api/v1/cancelled-leads/:id`
- `PATCH /api/v1/customers/:id`

V1 admin UI must not call delete endpoints.

## Booking Create API

The preferred admin workflow is source-driven.

Form lead:

```json
{
  "lead_ref": "form lead object id",
  "lead_model": "FormLead",
  "job_no": "required",
  "book_date": "2026-05-31",
  "agent_allocations": [
    {
      "agent_name": "Austin",
      "binder_amount": 500
    }
  ],
  "total_binder_amount": 500,
  "deposit_amount": 2500,
  "merchant": "Elavon",
  "source": "main_site"
}
```

Call lead:

```json
{
  "lead_type": "CallLead",
  "call_job_no": "optional if phone exists",
  "call_phone_number": "optional if job exists",
  "book_date": "2026-05-31",
  "agent": "Austin",
  "split_agent": "Brian",
  "binder_amount": 500,
  "deposit_amount": 2500,
  "merchant": "Elavon",
  "source_company": "Top10 Inbounds"
}
```

The UI should split binder 50/50 for split agent when using the direct `agent_allocations` shape.

## Cancellation Create API

Preferred payload from selected booking:

```json
{
  "booked_lead": "booking object id",
  "cancel_date": "2026-05-31",
  "refund_amount": 500,
  "reason": "customer_cancelled",
  "cancelled_by": "Owner",
  "notes": "Optional notes"
}
```

Payload from selected lead:

```json
{
  "lead_id": "form or call lead object id",
  "cancel_date": "2026-05-31",
  "refund_amount": 500,
  "reason": "customer_cancelled",
  "cancelled_by": "Owner",
  "notes": "Optional notes"
}
```

Backend resolves the attached booking and rejects conflicts.

## Analytics Endpoints

Use typed endpoints grouped by dashboard view.

Base prefix:

- `/api/v1/admin/analytics`

Common params:

- `database_scope=production|historical|combined`
- `from`
- `to`
- `source_company`
- `source`
- `agent`
- `merchant`
- `local`
- `lead_type`

Endpoints:

- `GET /summary`
- `GET /revenue-trend`
- `GET /source-company-performance`
- `GET /agent-performance`
- `GET /booking-cancellation-ratio`
- `GET /source-company-funnel`
- `GET /cancellation-reasons`
- `GET /lead-source-performance`
- `GET /local-vs-long-distance`
- `GET /geographic-lanes`

Historical analytics starting point:

- `vantage-main-server/scripts/historical/historical-analytics.ts`

Extraction target:

- `vantage-main-server/api/services/analytics/`

Route target:

- `vantage-main-server/api/routes/v1.routes.ts`

Important implementation rule:

When `database_scope=combined`, run production and historical pipelines separately, then merge in service code by stable text dimensions. Do not merge by ObjectId.

## CSV Export Endpoints

Base prefix:

- `/api/v1/admin/exports`

Endpoints:

- `GET /form-leads.csv`
- `GET /call-leads.csv`
- `GET /booked-leads.csv`
- `GET /cancelled-leads.csv`
- `GET /customers.csv`
- `GET /agents.csv`
- `GET /analytics/:report.csv`

Exports use the same filters as their corresponding browse or analytics endpoints.

Responses:

- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="...csv"`

The Next.js app records an audit log entry for every export request.

## Indexing Considerations

Review or add indexes for:

- Lead timestamp/date fields.
- `source_company`.
- `phone_number` and normalized phone where present.
- `email`.
- `name`.
- `job_no`.
- `book_date`.
- `cancel_date`.
- `merchant`.
- `agent_allocations.agent_name_snapshot`.
- `customer`.
- `lead_ref`.
- `cancelled`.
- `booked`.

Avoid broad unindexed regex scans where possible. Prefer normalized fields for common identity search.

## Backend Acceptance Criteria

- All required admin browse endpoints support pagination, sorting, and relevant filters.
- Detail endpoints return linked records needed by the UI.
- Historical scope is read-only.
- Analytics endpoints work for production, historical, and combined scopes.
- CSV exports use the same filters as UI tables and charts.
- Existing booking and cancellation side effects continue to work.
- Existing public or extension API behavior is not broken.
- Tests cover filters, scope selection, analytics merging, and write conflict behavior.
