"use client";

import { StatusBadge } from "@/components/data-table/status-badge";
import { OPERATIONAL_COPY } from "@/components/operational/operational-copy";
import { SidePanel } from "@/components/ui/side-panel";
import type { SheetContainsItem, SheetContainsResult, SheetContainsVerdict } from "@/lib/api/admin";
import { isHiddenFromMasterLeadsContainsReason } from "@/lib/sheet-contains";

const copy = OPERATIONAL_COPY.sheetContains;

const verdictTone: Record<SheetContainsVerdict, "success" | "warning" | "destructive" | "muted"> = {
  found: "success",
  missing: "destructive",
  wrong_tab: "warning",
  not_expected: "muted",
  not_found: "destructive",
};

const verdictLabel: Record<SheetContainsVerdict, string> = {
  found: copy.verdictFound,
  missing: copy.verdictMissing,
  wrong_tab: copy.verdictWrongTab,
  not_expected: copy.verdictNotExpected,
  not_found: copy.verdictNotFound,
};

export function SheetContainsPanel({
  open,
  result,
  error,
  isChecking,
  onClose,
}: {
  open: boolean;
  result: SheetContainsResult | null;
  error?: string | null;
  isChecking: boolean;
  onClose: () => void;
}) {
  return (
    <SidePanel title={copy.panelTitle} description={copy.panelDescription} open={open} onClose={onClose}>
      {isChecking ? <p className="text-sm text-muted-foreground">{copy.checking}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result ? (
        <div className="space-y-4">
          {result.items.map((item) => (
            <SheetContainsResultCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </SidePanel>
  );
}

function SheetContainsResultCard({ item }: { item: SheetContainsItem }) {
  return (
    <article className="rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{item.label}</h3>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{item.id}</p>
        </div>
        <StatusBadge tone={verdictTone[item.verdict]}>{verdictLabel[item.verdict]}</StatusBadge>
      </div>

      {item.expected_tabs.length > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {copy.expected}: {item.expected_tabs.join(", ")}
        </p>
      ) : null}

      {item.reason === "created_on_unmatched" ? (
        <p className="mt-2 text-sm">{copy.unmatchedCall}</p>
      ) : null}
      {isHiddenFromMasterLeadsContainsReason(item.reason) ? (
        <p className="mt-2 text-sm">{copy.hiddenFromMasterLeads}</p>
      ) : null}
      {item.reason === "missing_from_mongo" ? (
        <p className="mt-2 text-sm">{copy.missingMongo}</p>
      ) : null}

      {item.missing_expected_tabs.length > 0 ? (
        <p className="mt-2 text-sm">
          {copy.missingExpected} {item.missing_expected_tabs.join(", ")}
        </p>
      ) : null}

      {item.found.length === 0 && item.verdict === "missing" ? (
        <p className="mt-2 text-sm text-muted-foreground">{copy.emptyEvidence}</p>
      ) : null}

      <div className="mt-3 space-y-3">
        {item.found.map((location) => (
          <div key={`${location.tab_name}:${location.row_number}`} className="rounded-md border p-3 text-sm">
            <div className="font-medium">
              {location.workbook} / {location.tab_name}
            </div>
            <div className="mt-1 text-muted-foreground">
              {copy.row} {location.row_number}
              {location.role === "sibling" ? ` · ${copy.verdictWrongTab}` : null}
            </div>
            <ul className="mt-2 space-y-1">
              {location.evidence.map((cell) => (
                <li key={cell.header}>
                  <span className="text-muted-foreground">{cell.header}:</span> {cell.value || "—"}
                </li>
              ))}
            </ul>
            {location.sheet_url ? (
              <a
                href={location.sheet_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {copy.openSheet}
              </a>
            ) : null}
          </div>
        ))}
      </div>

      {item.open_job ? (
        <p className="mt-3 text-sm text-amber-800">
          {copy.pendingJob}: {item.open_job.status}
        </p>
      ) : null}

      {item.sheet_sync_hint.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {copy.hint}:{" "}
          {item.sheet_sync_hint
            .map((hint) => `${hint.tab_name}${hint.row_number ? ` #${hint.row_number}` : ""} (${hint.status})`)
            .join(" · ")}
        </p>
      ) : null}
    </article>
  );
}
