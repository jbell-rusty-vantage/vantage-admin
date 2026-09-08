"use client";

import { AnimatedNumber } from "@/components/daily/animated-number";
import { DAILY_COPY } from "@/components/daily/daily-copy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ensureSnapshotCompanies,
  sourceCompanyLabel,
  type DailyOperationsSnapshotCompany,
} from "@/lib/api/dailyOperations";
import { cn } from "@/lib/utils";

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function CompaniesTable({
  companies,
  selectedCompany,
  loading,
  onSelectCompany,
}: {
  companies?: DailyOperationsSnapshotCompany[];
  selectedCompany: string | null;
  loading?: boolean;
  onSelectCompany: (slug: string) => void;
}) {
  const rows = ensureSnapshotCompanies(companies);
  const top = Math.max(...rows.map((row) => row.total), 0);

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {DAILY_COPY.companies}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2">
        {rows.map((row) => {
          const pct = top > 0 ? Math.round((row.total / top) * 100) : 0;
          const selected = selectedCompany === row.source_company;
          return (
            <button
              key={row.source_company}
              type="button"
              onClick={() => onSelectCompany(row.source_company)}
              aria-pressed={selected}
              className={cn(
                "w-full space-y-1 rounded-md px-1 py-1 text-left",
                selected && "bg-trust-blue/5 ring-1 ring-trust-blue/30",
              )}
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-navy">
                  {sourceCompanyLabel(row.source_company)}
                </span>
                <span className="tabular-nums text-navy">
                  {loading ? DAILY_COPY.missingYesterday : <AnimatedNumber value={row.total} format={formatCount} />}
                </span>
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">
                {DAILY_COPY.form} <AnimatedNumber value={row.form} format={formatCount} /> · {DAILY_COPY.call}{" "}
                <AnimatedNumber value={row.call} format={formatCount} />
                {row.yesterday_total == null
                  ? ` · ${DAILY_COPY.yesterdayFull} ${DAILY_COPY.missingYesterday}`
                  : ` · ${DAILY_COPY.yesterdayFull} ${formatCount(row.yesterday_total)}`}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-steel-100">
                <div
                  className={cn("daily-bar h-full rounded-full", selected ? "bg-navy" : "bg-trust-blue")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
