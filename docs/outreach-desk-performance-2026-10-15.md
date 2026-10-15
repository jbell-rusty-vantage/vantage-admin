# Outreach Desk loading — October 15, 2026

My Work and the Rep desk now update filters and lead selection through the Next.js native History API. `useSearchParams` receives each canonical URL immediately, so the queue/detail client request starts without waiting for the server page to reread the session. Switching desk views still uses server navigation, because the page owns the view prop and role routing. The existing URL canonicalization, rapid-write composition, Back/Forward behavior and backend authorization stay in place.

`tests/e2e/queue-navigation.spec.ts` exercises New → Quoted → Other → Pool → New, lead selection, and Back. It asserts no React Server Component navigation requests occur during these client-only changes. Existing flow and Pool tests cover keyboard selection, role routing, reassignment, access loss, completion and revoked detail.

The server query change and measured service timings are documented in [Sales Outreach Desk Service](../../vantage-main-server/docs/knowledge/services/sales-outreach-desk.md#queue-loading-performance--october-15-2026). It requires no Admin API schema, environment, configuration or database migration. Rollback is a code revert and redeploy.

Validation: Admin typecheck, all 1,188 unit tests (15 skipped), production Next.js build, and eight focused browser tests passed. Next.js native History integration was checked against the installed 16.3.3 documentation and [official navigation guide](https://nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api).
