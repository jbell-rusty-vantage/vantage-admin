# Vantage Admin Dashboard Product Spec

## Purpose

Build a secure owner-facing admin dashboard for Vantage Movers that lets the owner search, inspect, correct, book, cancel, analyze, and export operational data from the Vantage moving business.

The dashboard replaces manual Google Form workflows for owner operations while preserving the backend side effects that currently keep MongoDB and Google Sheets synchronized.

## Product Goals

- Give the owner a single command center for production records in `vantagemovers`.
- Make historical data in `vantagemovershistorical` searchable and analyzable without allowing accidental edits.
- Preserve current booking and cancellation business rules by routing writes through `vantage-main-server`.
- Surface revenue, source, agent, cancellation, and lead-funnel analytics through clear charts.
- Let the owner export filtered operational and analytics data as CSV.
- Partition the implementation into agent-sized work units that can be handed off and verified independently.

## Non-Goals For V1

- No public customer portal.
- No employee self-service accounts beyond owner/admin users.
- No destructive deletes in the UI.
- No direct browser calls to `vantage-main-server`.
- No frontend direct access to operational collections.
- No PDF reports or scheduled email reports.
- No full dropdown-management UI. V1 uses frontend constants that mirror the current Google Forms.

## Users

### Owner

The owner signs in with email and password, views all operational data, creates bookings, creates cancellations, updates records, views analytics, and exports CSVs.

### Future Admin Staff

The architecture should allow more admin users later, but v1 can ship with one or a small number of seeded admin users.

## Databases

### Production

Database: `vantagemovers`

Use for all live operations:

- Form leads
- Call leads
- Booked leads
- Cancelled leads
- Customers
- Agents

Production data is writable through controlled dashboard workflows, except deletes are disabled in v1.

### Historical

Database: `vantagemovershistorical`

Use for past leads, bookings, cancellations, customers, and agents from before the operational modernization.

Historical data is read-only in v1. It is included in:

- Historical record views
- Historical analytics
- Combined analytics
- CSV exports where the user selects historical or combined scope

## Database Scope Rules

Operational pages default to production.

Historical can be selected for read-only browsing and detail inspection. Historical views must visibly show a read-only badge.

Analytics support three scopes:

- Production
- Historical
- Combined

Combined analytics must merge records by stable text dimensions, such as `source_company`, source label, merchant, state, and `agent_name_snapshot`. It must not merge by Mongo ObjectId across databases.

## Top-Level Navigation

The dashboard should include these sections:

- Overview
- Form Leads
- Call Leads
- Bookings
- Cancellations
- Customers
- Agents
- Analytics
- Audit Log
- Exports
- Settings

## Core Pages

### Overview

Shows high-level cards and recent activity:

- Production leads today
- Bookings today
- Deposit total for selected time range
- Cancellation count and cancellation rate
- Top source companies
- Top agents by binder amount
- Failed or pending sheet sync count, if exposed by backend
- Recent admin mutations from `AdminAuditLog`

### Form Leads

The owner can:

- Browse form leads with server-side pagination.
- Filter by date, source company, status, identity, geography, move details, and booking/cancellation state.
- Open a detail drawer or detail page.
- Update safe editable fields.
- Select a lead and start a booking workflow.
- Export the filtered result set as CSV.

V1 disables deletion.

### Call Leads

The owner can:

- Browse call leads with server-side pagination.
- Filter by date, source company, job number, phone, name, email, pickup/delivery geography, local/long-distance, and booking/cancellation state.
- Open a detail drawer or detail page.
- Update safe editable fields.
- Select a call lead and start a booking workflow.
- Export filtered results as CSV.

V1 disables deletion.

### Bookings

The owner can:

- Browse production bookings.
- Browse historical bookings in read-only mode.
- Filter by book date, source company, booking source, agent, customer, job number, merchant, local/long-distance, deposit range, binder range, cancellation state, and free-text search.
- Open booking details showing customer, source lead, agent allocations, sheet sync state, and linked cancellation if present.
- Update editable booking fields.
- Select a booking and start cancellation workflow.
- Export filtered results as CSV.

### Cancellations

The owner can:

- Browse production cancellations.
- Browse historical cancellations in read-only mode.
- Filter by cancellation date, book date, source company, source, agent, customer, job number, merchant, reason, cancelled by, refund range, and free-text search.
- Open cancellation details showing linked booking, source lead, customer, refund, reason, notes, and sheet sync state.
- Create a cancellation from a selected booking or selected lead.
- Update editable cancellation fields.
- Export filtered results as CSV.

### Customers

The owner can:

- Browse customers.
- Filter by name, phone, email, booking count, cancellation count, and last activity date.
- Open customer details showing linked leads, bookings, and cancellations.
- Update customer contact fields.
- Export filtered results as CSV.

### Agents

The owner can:

- Browse agents.
- Filter by active status, name, role, created source, booking count, binder total, deposit total, and cancellation rate.
- Open agent performance details.
- View agent analytics for a selected time range.

Agent management can be minimal in v1. Existing booking workflows upsert agents by name.

### Analytics

Analytics must support:

- Date presets: today, yesterday, last 7 days, last 30 days, month to date, previous month, year to date, all time, custom range.
- Database scope: production, historical, combined.
- Source company filter.
- Agent filter.
- Merchant filter.
- Local/long-distance filter.
- Lead type filter where relevant.

Charts:

- Deposit totals over time.
- Total binder amount over time.
- Bookings vs cancellations over time.
- Cancellation rate by source company.
- Top agents by binder amount.
- Agent booking count and deposit totals.
- Source company funnel: leads, booked, cancelled, booking rate, cancellation rate.
- Deposit totals by source company.
- Cancellation reasons.
- Local vs long-distance performance.
- Geographic lanes by pickup and delivery state.

### Audit Log

Shows admin activity recorded by `vantage-admin`.

Events:

- Login success
- Login failure
- Logout
- Token refresh failure
- Create booking
- Update booking
- Create cancellation
- Update cancellation
- Update form lead
- Update call lead
- Update customer
- Export requested

Fields:

- Timestamp
- Admin user id/email
- Action
- Entity type
- Entity id
- Database scope
- Request payload summary
- Result status
- Error message, if any
- Request id or correlation id, if available

### Exports

The owner can export:

- Filtered form leads
- Filtered call leads
- Filtered bookings
- Filtered cancellations
- Filtered customers
- Filtered agents
- Analytics result tables behind charts

Exports are CSV only in v1.

## Global Search

The dashboard includes a global search box that searches across record types.

Searchable fields:

- Mongo ObjectId
- Job number
- Customer name
- Customer phone
- Customer email
- Form lead `ref_no`
- Call lead `job_no`
- Source company
- Agent name

Results should be grouped by record type:

- Form leads
- Call leads
- Bookings
- Cancellations
- Customers
- Agents

Each result must show:

- Record type
- Primary label
- Secondary identifiers
- Database scope
- Status badges
- Shortcut action, such as view details or start booking/cancellation

## V1 Filter Set

Use server-side filtering for all table pages.

Common filters:

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
- `cursor` or `page`
- `sort`
- `direction`

Each endpoint should expose only the filters that make sense for that model.

## Booking Workflow

The booking workflow starts by selecting a source lead from Form Leads, Call Leads, or Global Search.

Form lead booking:

- Prefill `form_lead_id`.
- Prefill source lead details.
- Require owner to enter or confirm `job_no`.
- Require `book_date`.
- Require primary agent.
- Optional split agent.
- Require binder amount.
- Require deposit amount.
- Require merchant.
- Optional source label override.
- Submit through `vantage-main-server` so existing booking sync happens.

Call lead booking:

- Prefill `call_job_no` when present.
- Prefill `call_phone_number` when present.
- Require at least job number or phone number.
- Require `book_date`.
- Require primary agent.
- Optional split agent.
- Require binder amount.
- Require deposit amount.
- Require merchant.
- Optional source label override.
- Submit through `vantage-main-server` so existing booking sync happens.

Split agent behavior mirrors the current Google Form: split the binder amount 50/50 when a split agent is selected.

## Cancellation Workflow

The cancellation workflow starts from:

- A selected production booking.
- A selected production form lead or call lead that has a booking.
- A manual lead id lookup.

The UI should resolve and show:

- Booking id
- Source lead id and type
- Job number
- Customer
- Book date
- Agent
- Source
- Merchant
- Existing cancellation status

Required fields:

- Refund amount
- Cancellation reason

Optional fields:

- Cancellation date
- Cancelled by
- Notes

Submit through `vantage-main-server` so existing cancellation sync happens.

## Dropdown Constants For V1

V1 keeps these in `vantage-admin` frontend constants.

Agent choices:

- Austin
- Brian
- Dylan
- Jacob
- Josh
- Jason
- Mike
- Patrick
- Sil
- Roys
- House

Merchant choices:

- Elavon
- Maverick
- Cardpointe
- EMS
- Paper Check
- Seamless
- Wire Transfer ACH

Source label choices:

- TBM Forms
- 10best Inbounds
- TBM Prime Forms
- TBM Prime Inbounds
- Top10 Forms
- Top10 Inbounds
- Best Relocation Forms
- Best Relocation Locals
- Best Relocation Inbounds
- Main Site Forms
- Main Site Inbounds

Cancellation reason choices:

- customer_cancelled
- price_too_high
- booked_with_competitor
- duplicate_booking
- bad_lead
- not_serviceable
- other

## Permissions

V1 can use a simple admin role model:

- `owner`: all v1 actions
- `admin`: all v1 actions except future user management

No deletes are available to either role in v1.

## Success Criteria

- Owner can sign in securely.
- Owner can browse and filter every model.
- Owner can view production and historical records with clear scope labels.
- Owner can update leads, bookings, cancellations, and customers where supported.
- Owner can book selected form and call leads.
- Owner can cancel selected production bookings or booked source leads.
- Owner can view analytics across production, historical, and combined scopes.
- Owner can export filtered CSVs.
- Every write uses `vantage-main-server`.
- Every write is audit logged.
