import { Suspense } from "react";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

/** Insights → Analytics (doc 01). `/analytics` redirects here. */
export default function InsightsAnalyticsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading analytics…</p>}>
      <AnalyticsDashboard />
    </Suspense>
  );
}
