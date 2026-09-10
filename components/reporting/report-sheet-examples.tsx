"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { REPORTING_COPY } from "@/components/reporting/reporting-copy";
import { SheetExampleGrid } from "@/components/reporting/sheet-example-grid";
import type { ReportingDatasetKey } from "@/lib/api/reporting";
import {
  REPORTING_SHEET_EXAMPLE_ORDER,
  REPORTING_SHEET_EXAMPLES,
  reportingSheetExampleLabel,
} from "@/lib/reporting/sheet-examples";
import { cn } from "@/lib/utils";

export function ReportSheetExamples({
  selectedDatasetKey,
}: {
  selectedDatasetKey?: ReportingDatasetKey;
}) {
  const [openKey, setOpenKey] = useState<ReportingDatasetKey | null>(
    selectedDatasetKey ?? "lead_outcome_detail",
  );

  useEffect(() => {
    if (selectedDatasetKey) setOpenKey(selectedDatasetKey);
  }, [selectedDatasetKey]);

  return (
    <section className="rounded-md border border-steel-200 bg-steel-100/60 p-3">
      <div className="mb-3">
        <h3 className="font-heading text-lg font-semibold text-navy">
          {REPORTING_COPY.exampleSheetsTitle}
        </h3>
        <p className="mt-1 text-sm text-steel">{REPORTING_COPY.exampleSheetsHint}</p>
      </div>
      <div className="space-y-2">
        {REPORTING_SHEET_EXAMPLE_ORDER.map((key) => {
          const example = REPORTING_SHEET_EXAMPLES[key];
          const open = openKey === key;
          const selected = selectedDatasetKey === key;
          return (
            <div
              key={key}
              className={cn(
                "overflow-hidden rounded-md border bg-white",
                selected ? "border-trust-blue/40" : "border-steel-200",
              )}
            >
              <button
                type="button"
                aria-expanded={open}
                className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
                onClick={() => setOpenKey(open ? null : key)}
              >
                <span>
                  <span className="block text-sm font-semibold text-navy">
                    {reportingSheetExampleLabel(example)}
                    {selected ? (
                      <span className="ml-2 rounded bg-trust-blue/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-trust-blue">
                        Selected
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-steel">{example.grain}</span>
                </span>
                <ChevronDown
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 text-steel transition-transform",
                    open && "rotate-180",
                  )}
                />
              </button>
              {open ? (
                <div className="border-t border-steel-100 px-3 pb-3 pt-2">
                  <SheetExampleGrid example={example} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
