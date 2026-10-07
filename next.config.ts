import type { NextConfig } from "next";
import { granotUpdatesRedirectRows } from "./lib/automations/granot-updates-redirects";
import { setupRedirectRows } from "./lib/setup/setup-redirects";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/ingestion/granot/lifecycle/health/:path*",
        destination: "/granot-lifecycle/health",
        permanent: true,
      },
      {
        source: "/ingestion/granot/lifecycle/health",
        destination: "/granot-lifecycle/health",
        permanent: true,
      },
      {
        source: "/ingestion/granot/lifecycle/jobs/:jobNo",
        destination: "/job-timeline?job=:jobNo",
        permanent: true,
      },
      {
        source: "/ingestion/granot/lifecycle",
        destination: "/intakes",
        permanent: true,
      },
      // Granot updates (doc 17): the old HTTP Automation page moved under the Automations tab. The table lives in
      // `lib/automations/granot-updates-redirects.ts` and is pinned by its test.
      ...granotUpdatesRedirectRows(),
      // Setup (doc 19): the Operations Registry's `?tab=` model, `/extension`, `/testimonials` and `/settings` became the
      // eight Setup sections. The table lives in `lib/setup/setup-redirects.ts` so a test keeps it equal to the running
      // page's own rewrite (`lib/setup/setup-links.ts`).
      ...setupRedirectRows(),
      // Dashboard redesign (docs 01–03): eighteen destinations became six. Old routes keep working as redirects with
      // the query string translated (`?record=` → `?lead=` / `?record=`); other query values pass through.
      { source: "/form-leads", has: [{ type: "query", key: "record", value: "(?<id>.*)" }], destination: "/leads?kind=form&lead=:id&lk=form", permanent: true },
      { source: "/form-leads", destination: "/leads?kind=form", permanent: true },
      { source: "/duplicate-form-leads", has: [{ type: "query", key: "record", value: "(?<id>.*)" }], destination: "/leads?kind=form&show=duplicates&lead=:id&lk=form", permanent: true },
      { source: "/duplicate-form-leads", destination: "/leads?kind=form&show=duplicates", permanent: true },
      { source: "/call-leads", has: [{ type: "query", key: "record", value: "(?<id>.*)" }], destination: "/leads?kind=call&lead=:id&lk=call", permanent: true },
      { source: "/call-leads", destination: "/leads?kind=call", permanent: true },
      { source: "/duplicate-call-leads", has: [{ type: "query", key: "record", value: "(?<id>.*)" }], destination: "/leads?kind=call&show=duplicates&lead=:id&lk=call", permanent: true },
      { source: "/duplicate-call-leads", destination: "/leads?kind=call&show=duplicates", permanent: true },
      { source: "/search", destination: "/leads", permanent: true },
      { source: "/manual", has: [{ type: "query", key: "tab", value: "attach" }], destination: "/bookings/reconciliation?connect=1", permanent: true },
      { source: "/manual", destination: "/leads?new=1", permanent: true },
      { source: "/job-timeline", destination: "/leads/timeline", permanent: true },
      { source: "/cancellations", destination: "/bookings/cancellations", permanent: true },
      { source: "/bookings", has: [{ type: "query", key: "tab", value: "cancellations" }], destination: "/bookings/cancellations", permanent: true },
      // A lane deep link lands on the Lanes sub-view (doc 16 solo semantics); the bare board lands on Board.
      { source: "/daily", has: [{ type: "query", key: "lane", value: "(?<lane>.*)" }], destination: "/?tab=operations&view=lanes&lane=:lane", permanent: true },
      { source: "/daily", destination: "/?tab=operations", permanent: true },
      // Analytics (doc 09): the old Geography and Text to booked tabs became "More breakdowns" on Sources; Receiver
      // Agents moved to Team. The destination's `tab` wins over the request's (Next merges destination query last).
      { source: "/analytics", has: [{ type: "query", key: "tab", value: "geography" }], destination: "/insights?tab=sources#more", permanent: true },
      { source: "/analytics", has: [{ type: "query", key: "tab", value: "text-to-booked" }], destination: "/insights?tab=sources#more", permanent: true },
      { source: "/analytics", has: [{ type: "query", key: "tab", value: "receiver-agents" }], destination: "/insights?tab=team", permanent: true },
      { source: "/analytics", destination: "/insights", permanent: true },
      { source: "/reporting", destination: "/insights/sheets", permanent: true },
    ];
  },
};

export default nextConfig;
