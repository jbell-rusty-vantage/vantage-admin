import { Suspense } from "react";
import { DailyOperationsPage } from "@/components/daily/daily-shell";
import { DAILY_COPY } from "@/components/daily/daily-copy";

export default function DailyOperationsRoute() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">{DAILY_COPY.loading}</p>}>
      <DailyOperationsPage />
    </Suspense>
  );
}
