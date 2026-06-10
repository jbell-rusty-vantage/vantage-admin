# Admin Operational Views UX Proposal

Scope: all Vantage Admin operational resource views:

- `Form Leads`
- `Duplicate Form Leads`
- `Call Leads`
- `Bookings`
- `Cancellations`
- `Customers`
- `Agents`

Reviewed files:

- `.cursor/rules/project-organization.mdc`
- `app/(dashboard)/page.tsx`
- `app/(dashboard)/form-leads/page.tsx`
- `components/layout/dashboard-shell.tsx`
- `components/layout/dashboard-nav.tsx`
- `components/operational/operational-resource-page.tsx`
- `components/data-table/table-shell.tsx`
- `components/data-table/pagination-controls.tsx`
- `components/filters/filter-bar.tsx`

## Current State

All operational views share one implementation through `OperationalResourcePage`, so the best path is to improve the shared operational page instead of making separate page-level layouts.

Current behavior:

- `app/(dashboard)/form-leads/page.tsx` only renders `<OperationalResourcePage resource="form-leads" />`.
- The same shared component also powers `duplicate-form-leads`, `call-leads`, `bookings`, `cancellations`, `customers`, and `agents`.
- Filters render as one top block through `FilterBar`.
- Tables render through `DataTable`, which has a single horizontal scroll container around the full table.
- Pagination uses URL state with `page` and `limit`, then renders `Previous` and `Next` buttons through `PaginationControls`.
- The dashboard sidebar is a static `w-64` desktop sidebar and is hidden on smaller screens.
- Form Leads now adds a compact inline `MarkBadLeadControl` at the start of each production row, which increases row width and makes the single bottom horizontal scrollbar more painful.

## Recommendation Summary

1. Keep the data table, but make it easier to scan:
   - Add sticky key columns and sticky row actions.
   - Keep row height compact.
   - Move secondary details out of the row and into the existing side panel.
   - Do not add a separate horizontal scrollbar to every row.

2. Replace page buttons with infinite loading:
   - Use the existing backend `page`, `limit`, and `has_next_page` contract.
   - Append pages client-side with `useInfiniteQuery`.
   - Preserve URL-synced filters and sort.
   - Add a bottom sentinel plus manual `Load more` fallback.

3. Add persistent, scroll-friendly filters:
   - On desktop, use a sticky left filter rail for operational views.
   - On tablet/mobile, use a sticky top filter summary with a slide-over filter drawer.
   - Keep active filter chips visible near the table title.

4. Make the dashboard sidebar collapsible:
   - Expanded: current labeled navigation.
   - Collapsed: narrow icon rail with tooltips and active state.
   - Mobile: hamburger opens the same navigation as a drawer.

## Row Length Strategy

Do not put horizontal scrolling on every row. It would create repeated scroll targets, hurt keyboard navigation, and make the table feel broken. The better solution is to reduce what must fit horizontally and keep important controls pinned.

Recommended table behavior:

- Pin the first action column so `Bad Lead`, `Book`, or `Cancel` controls stay visible.
- Pin the primary identity column, usually `Name` or `Customer`.
- Pin the right-side row affordance if one is added later, such as `View`.
- Let less important columns scroll inside the table body.
- Use truncation for long text like email, source labels, merchant names, and cancellation reasons.
- Show full values on hover tooltip or in the existing detail side panel.
- Convert booleans to compact badges or icons instead of full words where space matters.

For `Form Leads`, make the inline bad lead control shorter:

- Replace the full select plus button with a compact `Bad Lead` split action.
- Row default: show status chip only, for example `Bad: No Answer`.
- Click opens a small popover with reason options and `Save`.
- Keep the full bad lead editor in the detail side panel.

This keeps the row useful while avoiding a wide inline form in every row.

## Infinite Scroll Strategy

The backend already returns `{ items, page, limit, total, has_next_page }`, so we can implement infinite scroll without changing the API contract.

Recommended behavior:

- Initial load fetches page 1.
- Scrolling near the bottom fetches page 2, page 3, and so on.
- Filter, search, sort, date range, or database scope changes reset the loaded list to page 1.
- A visible footer says something like `Showing 150 of 1,284`.
- Include a `Load more` button as a fallback below the sentinel.
- Keep `limit` as an advanced density setting, defaulting to 50 or 100.
- Do not keep `page` as the main user-facing navigation control.

Back to top:

- Show after the user scrolls past roughly 2 table heights or 600px.
- Place as a floating button at bottom right.
- On click, scroll to the top of the operational view and keep filters visible.

## Filter Strategy

Filters need to be available when the user is deep in a long list. The current top-only filter bar will feel worse once pagination becomes infinite scroll.

Recommended desktop layout:

- Use a sticky left filter rail.
- Keep it below the sticky dashboard header.
- Give the rail its own scroll if there are many fields.
- The table scrolls independently in the main content area.
- Show active filter chips above the table so users can see what is applied even when the rail is collapsed.

Recommended tablet/mobile layout:

- Use a sticky top filter summary row.
- Include `Filters`, `Sort`, `Search`, `Reset`, and active chips.
- Open filters in a right or bottom drawer.

Filter improvements:

- Add active filter count to the filter button.
- Add removable active chips: `Source: Van Lines x`, `Booked: No x`, `Date: Last 30 days x`.
- Add grouped sections:
  - `Search`
  - `Date`
  - `Lead Status`
  - `Source`
  - `Customer`
  - `Money / Booking`
- Keep `Reset filters` visible in both full and collapsed filter modes.
- Consider applying text inputs on debounce or on Enter to reduce excessive refetching.

## Collapsible Sidebar

The dashboard sidebar should become a responsive navigation shell.

Expanded desktop:

```text
+-----------------------------------------------------------------------+
| [Logo] Vantage Admin                                                  |
|                                                                       |
| [<- Collapse]                                                         |
|                                                                       |
| Overview                                                              |
| Form Leads                                                            |
| Duplicate Form Leads                                                  |
| Call Leads                                                            |
| Bookings                                                              |
| Cancellations                                                         |
| Customers                                                             |
| Agents                                                                |
| Analytics                                                             |
| Agent Sales Report                                                    |
| Audit Log                                                             |
| Exports                                                               |
| Settings                                                              |
+-----------------------------------------------------------------------+
```

Collapsed desktop:

```text
+-----+---------------------------------------------------------------+
| VM  | Header: scope selector, global search, admin, logout           |
| []  |                                                               |
| H   | Main content                                                   |
| FL  |                                                               |
| CL  |                                                               |
| B   |                                                               |
| C   |                                                               |
| A   |                                                               |
+-----+---------------------------------------------------------------+
```

Mobile:

```text
+------------------------------------------------------+
| [Menu] Scope selector / Search              Logout   |
+------------------------------------------------------+
| Slide-over nav opens from left when Menu is tapped    |
+------------------------------------------------------+
```

Implementation notes:

- `DashboardShell` will need to become a client component or wrap a client `DashboardSidebar`.
- Persist collapsed state in local storage.
- Add icons to `DashboardNav` items.
- Keep current active route logic.
- Use accessible labels when collapsed.

## Operational View Wireframe

Desktop recommended layout:

```text
+----------------------------------------------------------------------------------+
| Sticky Header: [Scope] [Global Search........................] [Admin] [Logout]   |
+----------------------+-----------------------------------------------------------+
| Collapsible Sidebar  | Form Leads                                      [Export] |
|                      | Browse, inspect, edit, export, and book web form leads.   |
|                      |                                                           |
|                      | Active filters: [Production] [Date: Last 30] [Booked: No] |
|                      |                                                           |
|                      | +------------------+  +----------------------------------+ |
|                      | | Sticky Filters   |  | Sticky Table Header              | |
|                      | | Search           |  | Bad | Book | Created | Name | ... | |
|                      | | Date range       |  |-----+------+---------+------+-----| |
|                      | | Status           |  | chip| btn  | date    | name | ... | |
|                      | | Source           |  | chip| btn  | date    | name | ... | |
|                      | | Customer         |  | ...                              | |
|                      | | Reset filters    |  |                                  | |
|                      | +------------------+  | Loading more... / Load more       | |
|                      |                       +----------------------------------+ |
|                      |                                                           |
|                      |                                      [Back to Top]         |
+----------------------+-----------------------------------------------------------+
```

Tablet layout:

```text
+-------------------------------------------------------------------+
| Header                                                            |
+-------------------------------------------------------------------+
| Form Leads                                            [Export]    |
| [Search.................] [Filters (3)] [Sort] [Reset]            |
| Chips: [Booked: No x] [Source: MoveBuddha x]                      |
+-------------------------------------------------------------------+
| Horizontally scrollable table with sticky first columns            |
| Infinite rows append as user scrolls                               |
+-------------------------------------------------------------------+
| [Back to Top]                                                     |
+-------------------------------------------------------------------+
```

Mobile layout:

```text
+---------------------------------------------+
| [Menu] Vantage Admin                        |
+---------------------------------------------+
| Form Leads                         [Export] |
| [Search leads...] [Filters (3)]             |
| [Booked: No x] [Source: MoveBuddha x]       |
+---------------------------------------------+
| Card Row                                    |
| Name / phone / date                         |
| Source / status chips                       |
| [Book] [Bad Lead] [Open]                    |
+---------------------------------------------+
| Card Row                                    |
+---------------------------------------------+
| Loading more...                             |
| [Back to Top]                               |
+---------------------------------------------+
```

## View-Specific Notes

### Form Leads

Primary problems:

- The new bad lead reason workflow adds width to every row.
- There are many identity and lead status columns.
- Users likely need fast triage, not every field visible at once.

Recommended visible columns:

- Pinned actions: `Bad`, `Book`
- Pinned identity: `Name`
- Main columns: `Created`, `Phone`, `Source`, `Ref`, `Move`, `Booked`, `Cancelled`
- Hide or truncate: `First`, `Last`, `Email`

Recommended bad lead UX:

- Replace inline select with status chip plus popover.
- Detail panel keeps the complete reason selector.
- Add filters for `Bad Lead` and `Bad Lead Reason` if backend supports them, or queue as backend follow-up.

### Duplicate Form Leads

This view should receive the same table, filter, sticky header, and infinite loading improvements as `Form Leads`, but it should remain read-only.

Recommended visible columns:

- Pinned identity: `Name`
- Main columns: `Created`, `Phone`, `Source`, `Ref`, `Move`, `Booked`, `Cancelled`
- Hide actions that mutate records: `Book`, `Bad Lead`, `Cancel`, and edit controls
- Hide or truncate: `First`, `Last`, `Email`

Useful filters:

- `Source company`
- `Name`
- `Email`
- `Phone`
- `Ref number`
- `Booked`
- `Cancelled`
- `Move size`

### Call Leads

Recommended visible columns:

- Pinned action: `Book`
- Pinned identity: `Name`
- Main columns: `Created`, `Phone`, `Job`, `Source`, `Local`, `Booked`, `Cancelled`
- Hide or truncate: `First`, `Last`, `Email`

Useful filters:

- `Booked`
- `Cancelled`
- `Local type`
- `Source company`
- `Phone`
- `Job number`

### Bookings

Recommended visible columns:

- Pinned action: `Cancel`
- Pinned identity: `Customer`
- Main columns: `Book Date`, `Job`, `Phone`, `Source`, `Binder`, `Deposit`, `Merchant`, `Cancelled`

Useful filters:

- `Agent`
- `Merchant`
- `Source`
- `Cancelled`
- `Customer`
- `Job number`

### Cancellations

Recommended visible columns:

- Pinned identity: `Customer`
- Main columns: `Cancelled`, `Job`, `Source`, `Merchant`, `Refund`, `Reason`, `By`

Useful filters:

- `Reason`
- `Agent`
- `Merchant`
- `Source`
- `Customer`
- `Job number`

### Customers

Customers have fewer workflow actions, but they still need the same sticky filters and infinite loading because this can become a long operational lookup view.

Recommended visible columns:

- Pinned identity: `Name`
- Main columns: `Phone`, `Email`, `Bookings`, `Cancellations`, `Deposit`, `Last Activity`
- Keep row click opening the detail panel for linked bookings and cancellations.

Useful filters:

- `Name`
- `Phone`
- `Email`

### Agents

Agents are read-only in v1, but the table still benefits from the same density, sticky header, and persistent filters.

Recommended visible columns:

- Pinned identity: `Name`
- Main columns: `Active`, `Role`, `Bookings`, `Binder`, `Deposit`, `Cancellations`, `Cancel Rate`
- Keep the detail panel focused on performance context rather than edit actions.

Useful filters:

- `Name`
- `Active`
- `Role`

## Suggested Implementation Phases

Phase 1: layout foundation

- Add collapsible dashboard sidebar.
- Add reusable `BackToTopButton`.
- Add sticky filter shell that can render as left rail on desktop and drawer/top summary on smaller screens.

Phase 2: table usability

- Extend `DataTable` to support sticky columns, sticky header, column widths, and truncation.
- Replace Form Leads inline bad lead select with a compact popover action.
- Add resource-specific visible column priorities.

Phase 3: infinite loading

- Replace `PaginationControls` on operational views with an infinite list footer.
- Use `useInfiniteQuery` in `OperationalResourcePage`.
- Keep existing URL filter/sort state and remove page buttons from the UI.
- Reset loaded pages when filters change.

Phase 4: polish and validation

- Add active filter chips.
- Add responsive mobile card rows for narrow screens if table density remains poor.
- Verify keyboard and screen reader behavior for sidebar collapse, filter drawer, sticky actions, and infinite loading.
- Test all four views in production and historical scopes.

## Implementation Targets

Likely shared files to update:

- `components/layout/dashboard-shell.tsx`
- `components/layout/dashboard-nav.tsx`
- `components/filters/filter-bar.tsx`
- `components/data-table/table-shell.tsx`
- `components/operational/operational-resource-page.tsx`
- New `components/operational/operational-filter-panel.tsx`
- New `components/operational/infinite-table-footer.tsx`
- New `components/layout/collapsible-dashboard-sidebar.tsx`
- New `components/ui/back-to-top-button.tsx`

Open backend/API questions:

- Should bad lead reason be filterable server-side?
- Should infinite scrolling eventually move from page-based loading to cursor-based loading for very large datasets?
- Should admins be able to save preferred columns or filter presets per view?

## Recommended First Build

Start with shared UX infrastructure, not one-off page changes:

1. Add collapsible sidebar.
2. Add sticky filter panel and active filter chips.
3. Add sticky table header and pinned key columns.
4. Convert operational pagination to infinite loading.
5. Simplify Form Leads bad lead row action.

This gives immediate UX improvements to all operational resource views while keeping the app aligned with the current shared operational architecture.
