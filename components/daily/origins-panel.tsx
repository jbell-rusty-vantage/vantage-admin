"use client";

import { DAILY_COPY } from "@/components/daily/daily-copy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DAILY_OPERATIONS_ORIGIN_KEYS,
  ensureSnapshotOrigins,
  type DailyOperationsOriginKey,
} from "@/lib/api/dailyOperations";

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function OriginsPanel({
  origins,
  loading,
}: {
  origins?: Partial<Record<DailyOperationsOriginKey, number>>;
  loading?: boolean;
}) {
  const rows = ensureSnapshotOrigins(origins);
  const top = Math.max(...DAILY_OPERATIONS_ORIGIN_KEYS.map((key) => rows[key]), 0);

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {DAILY_COPY.origins}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2">
        {DAILY_OPERATIONS_ORIGIN_KEYS.map((key) => {
          const value = rows[key];
          const pct = top > 0 ? Math.round((value / top) * 100) : 0;
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-navy">{DAILY_COPY.originsLabels[key]}</span>
                <span className="tabular-nums text-navy">
                  {loading ? DAILY_COPY.missingYesterday : formatCount(value)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-steel-100">
                <div className="h-full rounded-full bg-trust-blue" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
