import { Suspense } from "react";
import "@/components/insights/analytics/analytics.css";
import { AnalyticsPage } from "@/components/insights/analytics/analytics-page";

/** Insights › Analytics (doc 09). `/analytics` redirects here (old `?tab=` values land on the matching view). */
export default function InsightsAnalyticsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading analytics…</p>}>
      <AnalyticsPage />
    </Suspense>
  );
}
