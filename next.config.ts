import type { NextConfig } from "next";

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
      {
        source: "/settings",
        destination: "/operations-registry?tab=moving-carriers",
        permanent: true,
      },
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
      { source: "/daily", destination: "/?tab=operations", permanent: true },
      { source: "/analytics", destination: "/insights", permanent: true },
      { source: "/reporting", destination: "/insights/sheets", permanent: true },
    ];
  },
};

export default nextConfig;
