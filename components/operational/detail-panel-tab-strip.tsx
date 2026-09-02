"use client";

import { OPERATIONAL_COPY, detailTabLabel } from "@/components/operational/operational-copy";
import type { DetailTabKey } from "@/components/operational/visible-detail-tabs";
import type { UiResource } from "@/lib/api/admin";
import { cn } from "@/lib/utils";

export function DetailPanelTabStrip({
  tabs,
  active,
  uiResource,
  onSelect,
}: {
  tabs: readonly DetailTabKey[];
  active: DetailTabKey;
  uiResource: UiResource;
  onSelect: (tab: DetailTabKey) => void;
}) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      className="flex gap-1 overflow-x-auto border-b px-5"
      role="tablist"
      aria-label={OPERATIONAL_COPY.tabs.list}
    >
      {tabs.map((tab) => {
        const selected = tab === active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`operational-panel-${tab}`}
            id={`operational-tab-${tab}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-navy font-semibold text-navy"
                : "border-transparent text-muted-foreground hover:text-navy",
            )}
          >
            {detailTabLabel(tab, uiResource)}
          </button>
        );
      })}
    </div>
  );
}
