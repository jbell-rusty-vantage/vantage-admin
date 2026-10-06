import { Suspense } from "react";
import { ReportingDashboard } from "@/components/reporting/reporting-dashboard";
import { ReportingSubnav } from "@/components/reporting/reporting-subnav";

/** Insights → Sheets (doc 01, doc 07): the reporting front door. `/reporting` redirects here; its sub-pages stay. */
export default function InsightsSheetsPage() {
  return (
    <div className="space-y-5">
      <ReportingSubnav />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading reports…</p>}>
        <ReportingDashboard />
      </Suspense>
    </div>
  );
}
