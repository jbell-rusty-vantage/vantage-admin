# Outreach Desk rep performance

October 16, 2026. Implemented on `main`, with local build, test and browser verification.

The canonical packet lives in the server repository:

- [Specification and approved interview decisions](../../../vantage-main-server/docs/outreach-performance/SPECIFICATION.md)
- [Codebase exploration and proposed architecture](../../../vantage-main-server/docs/outreach-performance/EXPLORATION.md)
- [Implementation and operating instructions](../../../vantage-main-server/docs/outreach-performance/IMPLEMENTATION.md)

Owner/Manager Team Overview gets one Rep performance block with Calls / Texts, week navigation, ranked rows and expandable daily detail. Reuse the current Desk design tokens and typed server reads. The server owns counts, historical responsibility, completion rates and ranks. No new Rep view, global text goal or cadence policy.

## Admin implementation (October 16, 2026)

`components/outreach-desk/views/rep-performance.tsx` renders the Owner/Manager Team Overview card after Daily call goals and before Leads needing attention. Local report week/channel state does not alter queue filters. The current week follows New York rollover; historical selection remains fixed. Calls and Texts use the server's independent ranks, counts and fractional completion rate; future days, null volume, pending facts and provisional rankings remain explicit. Each Rep carries seven daily rows in the same response, with keyboard tabs and native disclosure buttons; past weeks omit Today.

Transport: `lib/api/salesOutreach.ts` mirrors the performance DTO and path; `usePerformance` polls the selected week through the existing Desk read lifecycle. `outreachKeys.performanceAll()` invalidates every cached historical week on call-goal and Desk evidence hints. The Manager proxy permits only exact `GET /performance`; Rep and generic Admin receive no access.

Verification: `tests/outreach-desk/performance.test.ts` checks calendar/DST boundaries, server counts/rates, null versus zero, seven-date disclosure, independent week cache and historical invalidation. Existing proxy tests include Manager-only performance reads plus wrong-method/trailing-path refusal. No additional environment variables are required.

## Browser acceptance evidence

`tests/e2e/performance.spec.ts` passes against the existing local mock Desk with a real local Manager session and intercepted synthetic performance responses. It verifies channel-specific ranks, daily expansion retained on tab/week changes, keyboard tab focus, current/historical week navigation, disabled future navigation, and 390px containment with horizontal table scrolling. Six screenshots in [`evidence/`](evidence/) capture desktop Calls, Texts and history plus narrow Calls, Texts and the table scrolled right. The full expanded card was visually inspected at desktop and narrow widths. No UI defects were found.

The Admin schema also parsed an actual `composeTeamPerformance` output from the server implementation (one Rep, seven dates, null source coverage) successfully. These are synthetic/local acceptance checks, not a production data reconciliation.
