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
  ["Overview summary", "/analytics?view=table&report=summary"],
  ["Revenue trend", "/analytics?tab=sales&view=table&report=revenue-trend"],
  ["Agent sales performance", "/analytics?tab=sales&view=table&report=agent-performance"],
  ["Source company performance", "/analytics?tab=lead-sources&view=table&report=source-company-performance"],
  ["Source company funnel", "/analytics?tab=lead-sources&view=table&report=source-company-funnel"],
  ["Receiver agent performance", "/analytics?tab=receiver-agents&view=table&report=receiver-agent-performance"],
  ["Receiver agent trend", "/analytics?tab=receiver-agents&view=table&report=receiver-agent-trend"],
  ["Receiver agent source breakdown", "/analytics?tab=receiver-agents&view=table&report=receiver-agent-source-breakdown"],
  ["Texted leads booked", "/analytics?tab=text-to-booked&view=table&report=sms-successfully-sent-then-booked"],
  ["Cancellation reasons", "/analytics?tab=cancellations&view=table&report=cancellation-reasons"],
  ["Geographic lanes", "/analytics?tab=geography&view=table&report=geographic-lanes"],
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
          {analyticsReports.map(([label, href]) => (
            <Link key={href} className="rounded-md border p-3 text-sm font-medium hover:bg-muted" href={href}>
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
