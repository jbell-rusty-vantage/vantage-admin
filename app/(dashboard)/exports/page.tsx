import Link from "next/link";

const operationalExports = [
  ["Form leads", "/form-leads"],
  ["Call leads", "/call-leads"],
  ["Bookings", "/bookings"],
  ["Cancellations", "/cancellations"],
  ["Customers", "/customers"],
  ["Agents", "/agents"],
] as const;

const analyticsReports = [
  "summary",
  "revenue-trend",
  "source-company-performance",
  "agent-performance",
  "booking-cancellation-ratio",
  "cancellation-reasons",
  "local-vs-long-distance",
  "geographic-lanes",
] as const;

export default function ExportsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Exports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operational exports live on each table so they can use the current filters. Analytics reports can be exported from the analytics cards.
        </p>
      </div>
      <section className="rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">Operational CSVs</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {operationalExports.map(([label, href]) => (
            <Link key={href} className="rounded-md border p-3 text-sm font-medium hover:bg-muted" href={href}>
              {label}
            </Link>
          ))}
        </div>
      </section>
      <section className="rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">Analytics CSVs</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {analyticsReports.map((report) => (
            <Link key={report} className="rounded-md border p-3 text-sm font-medium hover:bg-muted" href={`/analytics?report=${report}`}>
              {report}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
