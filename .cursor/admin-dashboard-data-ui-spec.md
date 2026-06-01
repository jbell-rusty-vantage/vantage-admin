# Vantage Admin Data And UI Spec

## UI Principles

- Production records are actionable.
- Historical records are read-only and clearly labeled.
- Every table is server-side filtered, sorted, and paginated.
- Every record has a detail view.
- Every mutation shows confirmation, success, and failure feedback.
- Delete controls are absent in v1.
- Owner-facing labels should stay close to the existing Google Forms where that helps recognition.

## Layout

Dashboard shell:

- Left sidebar navigation.
- Top bar with global search, database scope indicator, user menu, and logout.
- Main content area.
- Toast region.

Common page structure:

- Page title and description.
- Database scope selector where relevant.
- Filter bar.
- Table.
- Pagination controls.
- Export CSV button.
- Detail drawer or detail page.

## Database Scope UI

Use clear badges:

- Production
- Historical Read-Only
- Combined Analytics

Rules:

- Production operational pages show edit and workflow actions.
- Historical operational pages hide edit, booking, and cancellation actions.
- Analytics pages can use production, historical, or combined scope.

## Common Table Behavior

Each table must support:

- Server-side pagination.
- Server-side sorting.
- URL-synced filters.
- Loading state.
- Empty state.
- Error state with retry.
- CSV export of current filters.
- Row click opens detail view.

Default page size: 50.

Supported page sizes:

- 25
- 50
- 100

Default sort:

- Form leads: newest `timestamp` first.
- Call leads: newest `timestamp` first.
- Bookings: newest `book_date` first.
- Cancellations: newest `cancel_date` first.
- Customers: newest activity first if backend supports it, otherwise newest updated first.
- Agents: name ascending or performance sort on analytics views.

## Common Filters

Date presets:

- Today
- Yesterday
- Last 7 days
- Last 30 days
- Month to date
- Previous month
- Year to date
- All time
- Custom range

Identity filters:

- Free text `q`
- Name
- Email
- Phone
- Job number
- Mongo ObjectId where relevant

Business filters:

- Source company
- Source label
- Agent
- Merchant
- Local vs long-distance
- Booked status
- Cancelled status

Geographic filters:

- Pickup state
- Pickup zip
- Delivery state
- Delivery zip

Money filters:

- Deposit minimum and maximum
- Binder minimum and maximum
- Refund minimum and maximum

## Frontend Constants

Create:

```text
vantage-admin/lib/constants/domain.ts
```

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

Source company slugs:

- `tbm_leads`
- `tbm_prime_leads`
- `top10_leads`
- `best_relocation_leads`
- `main_site`
- `not_provided`

Cancellation reasons:

- `customer_cancelled`
- `price_too_high`
- `booked_with_competitor`
- `duplicate_booking`
- `bad_lead`
- `not_serviceable`
- `other`

Local types:

- `local`
- `long_distance`

Move sizes:

- Studio
- 2 Bedrooms
- 3 Bedrooms
- 4 Bedrooms
- 5+ Bedrooms
- Office

## Form Leads Page

Columns:

- Created/timestamp
- Name
- Phone
- Email
- Source company
- Ref number
- Pickup state/zip
- Delivery state/zip
- Move size
- Move date
- Booked status
- Cancelled status
- Quoted
- Sheet sync status if available

Filters:

- Date range
- Source company
- Name
- Email
- Phone
- Ref number
- Booked
- Cancelled
- Pickup state
- Pickup zip
- Delivery state
- Delivery zip
- Move size
- Free text

Detail view:

- Full lead fields.
- Booking summary.
- Cancellation summary.
- Customer summary through booking.
- Sheet sync details.
- Raw identifiers.

Production actions:

- Edit lead.
- Start booking.
- Copy Mongo ObjectId.
- Export current filter set.

Historical actions:

- View only.
- Copy Mongo ObjectId.
- Export current filter set.

## Call Leads Page

Columns:

- Created/timestamp
- Name
- Phone
- Email
- Job number
- Source company
- Duration
- Start time
- End time
- Pickup state/zip
- Delivery state/zip
- Local
- Booked status
- Cancelled status
- Sheet sync status if available

Filters:

- Date range
- Source company
- Name
- Email
- Phone
- Job number
- Booked
- Cancelled
- Pickup state
- Pickup zip
- Delivery state
- Delivery zip
- Local
- Free text

Detail view:

- Full call lead fields.
- Booking summary.
- Cancellation summary.
- Customer summary through booking.
- Sheet sync details.
- Raw identifiers.

Production actions:

- Edit call lead.
- Start booking.
- Copy Mongo ObjectId.
- Export current filter set.

## Bookings Page

Columns:

- Book date
- Job number
- Customer
- Phone
- Source company
- Source
- Agent allocation summary
- Total binder amount
- Deposit amount
- Merchant
- Local
- Cancelled status
- Sheet sync status if available

Filters:

- Book date range
- Source company
- Source
- Agent
- Customer name
- Customer phone
- Customer email
- Job number
- Merchant
- Local
- Cancelled
- Deposit range
- Binder range
- Free text

Detail view:

- Full booking fields.
- Customer.
- Source lead.
- Agent allocations.
- Cancellation if present.
- Sheet sync details.
- Raw identifiers.

Production actions:

- Edit booking.
- Start cancellation if not already cancelled.
- Copy booking id.
- Copy source lead id.
- Export current filter set.

Historical actions:

- View only.
- Copy ids.
- Export current filter set.

## Cancellations Page

Columns:

- Cancellation date
- Job number
- Customer
- Source company/source
- Agent snapshot
- Merchant
- Refund amount
- Reason
- Cancelled by
- Book date
- Sheet sync status if available

Filters:

- Cancellation date range
- Book date range
- Source company
- Source
- Agent
- Customer name
- Customer phone
- Customer email
- Job number
- Merchant
- Reason
- Cancelled by
- Refund range
- Free text

Detail view:

- Full cancellation fields.
- Linked booking.
- Linked source lead.
- Customer.
- Snapshot fields.
- Sheet sync details.
- Raw identifiers.

Production actions:

- Edit cancellation.
- Copy cancellation id.
- Copy booking id.
- Copy lead id.
- Export current filter set.

Historical actions:

- View only.
- Copy ids.
- Export current filter set.

## Customers Page

Columns:

- Name
- Phone
- Email
- Booking count
- Cancellation count
- Deposit total
- Last activity

Filters:

- Name
- Phone
- Email
- Date range
- Free text

Detail view:

- Customer contact fields.
- Related form leads.
- Related call leads.
- Related bookings.
- Related cancellations.
- Aggregate totals.

Production actions:

- Edit customer.
- Copy customer id.
- Export current filter set.

## Agents Page

Columns:

- Name
- Active
- Role
- Booking count
- Total binder amount
- Total deposit amount
- Cancellation count
- Cancellation rate

Filters:

- Name
- Active
- Role
- Date range
- Free text

Detail view:

- Agent document fields.
- Performance summary.
- Recent bookings.
- Related cancellations.
- Time-range analytics.

Production actions:

- View.
- Copy agent id.
- Export current filter set.

Agent editing is optional in v1 because booking workflows already upsert agents by selected name.

## Booking Form UX

Route options:

- `/bookings/new?lead_type=FormLead&lead_id=...`
- `/bookings/new?lead_type=CallLead&lead_id=...`
- Modal/drawer opened from selected lead row.

Step 1: selected lead context.

Show:

- Lead type.
- Lead id.
- Name.
- Phone.
- Email.
- Job number or ref number.
- Source company.
- Pickup and delivery.
- Existing booking status.

Step 2: booking fields.

Fields:

- Job Number.
- Book Date.
- Agent.
- SplitAgent.
- Binder Amount.
- Deposit Amount.
- Merchant.
- Source Label.

Behavior:

- FormLead requires `form_lead_id` and `job_no`.
- CallLead requires `call_job_no` or `call_phone_number`.
- If split agent is selected, binder allocation is split 50/50.
- Source Label can override or provide source company.
- Submit button disabled for historical records.
- Submit success invalidates lead, booking, customer, agent, and analytics queries.

## Cancellation Form UX

Route options:

- `/cancellations/new?booked_lead=...`
- `/cancellations/new?lead_id=...`
- Modal/drawer opened from selected booking row.

Step 1: selected booking or lead context.

Show:

- Booking id.
- Lead id.
- Lead type.
- Job number.
- Customer.
- Agent.
- Source.
- Merchant.
- Book date.
- Existing cancellation status.

Step 2: cancellation fields.

Fields:

- Refund Amount.
- Cancellation Reason.
- Cancellation Date.
- Cancelled By.
- Notes.

Behavior:

- Prefer `booked_lead` when launched from booking.
- Use `lead_id` when launched from lead.
- Backend resolves lead-to-booking.
- Submit disabled when booking is already cancelled.
- Submit disabled for historical records.
- Submit success invalidates lead, booking, cancellation, customer, agent, and analytics queries.

## Edit Forms

Use model-specific edit forms rather than raw JSON.

Form lead editable fields:

- Source company
- Name
- Source company site
- Timestamp
- Pickup zip
- Destination zip
- Pickup state
- Delivery state
- Move size
- Move date
- Ref number
- Email
- Phone number
- Quoted
- Cubic feet

Call lead editable fields:

- Source company
- Source company site
- Timestamp
- Job number
- Name
- Email
- Phone number
- Duration
- Start time
- End time
- Local
- Pickup zip
- Delivery zip
- Pickup state
- Delivery state
- Cubic feet

Booking editable fields:

- Book date
- Job number
- Agent allocations
- Total binder amount
- Deposit amount
- Merchant
- Source
- Local

Cancellation editable fields:

- Cancellation date
- Refund amount
- Reason
- Notes
- Cancelled by

Customer editable fields:

- Full name
- Phone number
- Email

## Analytics UI

Analytics sections:

- Summary cards.
- Revenue trend.
- Source company performance.
- Agent performance.
- Booking and cancellation ratio.
- Source company funnel.
- Cancellation reasons.
- Lead source performance.
- Local vs long-distance.
- Geographic lanes.

Every analytics section should support:

- Shared filter bar.
- Chart.
- Data table.
- CSV export.

## Empty States

Examples:

- No records match these filters.
- No historical records available for this model.
- This production record has no booking yet.
- This booking has not been cancelled.
- No analytics data for this date range.

## Mutation Confirmation Rules

Confirm before:

- Creating booking.
- Creating cancellation.
- Updating booking deposit or binder amounts.
- Updating source company/source.
- Updating customer identity fields.

No delete confirmations are needed because v1 does not expose delete actions.

## Cache Invalidation

After form lead update:

- Form leads list.
- Form lead detail.
- Global search.
- Analytics that depend on lead fields.

After call lead update:

- Call leads list.
- Call lead detail.
- Global search.
- Analytics that depend on lead fields.

After booking create/update:

- Source lead detail.
- Bookings list/detail.
- Customers.
- Agents.
- Global search.
- Analytics.

After cancellation create/update:

- Source lead detail.
- Booking detail.
- Cancellations list/detail.
- Customers.
- Agents.
- Global search.
- Analytics.

After export:

- Audit log.

## UI Acceptance Criteria

- All pages are protected by login.
- Filters are reflected in the URL.
- Refreshing a filtered page preserves filters.
- Historical pages cannot mutate records.
- Production pages never show delete actions.
- Booking and cancellation forms prefill identifiers from selected records.
- Dropdown options mirror current Google Forms.
- CSV export uses current filters.
- Write success and failure are visible to the owner.
