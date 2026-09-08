"use client";

import { DAILY_COPY, dailyOperationsKindLabel } from "@/components/daily/daily-copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DAILY_OPERATIONS_DEFAULT_PANELS, type DailyOperationsPanelLane } from "@/lib/api/dailyOperations";
import {
  DAILY_OPERATIONS_KIND_TONES,
  DAILY_OPERATIONS_TONES,
  kindsForLane,
  kindToneFor,
  toneClasses,
  type DailyOperationsKind,
  type DailyOperationsKindToneOverrides,
  type DailyOperationsTone,
} from "@/lib/api/dailyOperationsColors";
import { cn } from "@/lib/utils";

const LANES: readonly DailyOperationsPanelLane[] = [...DAILY_OPERATIONS_DEFAULT_PANELS, "sheet_sync"];

/**
 * Colours panel: one row per Event kind, grouped by lane, with a swatch per
 * tone. Picking a swatch calls `onPick`; the shell persists to localStorage.
 * A kind whose tone differs from the catalog default shows `custom`.
 */
export function KindColorsPanel({
  overrides,
  onPick,
  onReset,
  onClose,
}: {
  overrides: DailyOperationsKindToneOverrides;
  onPick: (kind: DailyOperationsKind, tone: DailyOperationsTone) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const customCount = Object.keys(overrides).length;
  return (
    <Card data-panel="kind-colors" className="border-trust-blue/30 shadow-md">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 p-4 pb-2">
        <div>
          <h2 className="text-sm font-semibold text-navy">{DAILY_COPY.colorsTitle}</h2>
          <p className="text-xs text-muted-foreground">{DAILY_COPY.colorsSubtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-xs"
            disabled={customCount === 0}
            onClick={onReset}
          >
            {DAILY_COPY.colorsReset}
          </Button>
          <Button type="button" className="h-8 px-3 text-xs" onClick={onClose}>
            {DAILY_COPY.colorsClose}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 pt-2 md:grid-cols-2 xl:grid-cols-4">
        {LANES.map((lane) => (
          <section key={lane} className="space-y-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {DAILY_COPY.panelsLabels[lane]}
            </h3>
            <ul className="space-y-1">
              {kindsForLane(lane).map((kind) => {
                const current = kindToneFor(kind, overrides, lane);
                const classes = toneClasses(current);
                const isCustom = DAILY_OPERATIONS_KIND_TONES[kind] !== current;
                return (
                  <li
                    key={kind}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-steel-100 px-2 py-1.5"
                    data-kind={kind}
                    data-tone={current}
                  >
                    <span className={cn("size-2.5 rounded-full", classes.dot)} aria-hidden="true" />
                    <span className="text-xs font-medium text-navy">{dailyOperationsKindLabel(kind)}</span>
                    {isCustom ? (
                      <span className="rounded-full bg-steel-100 px-1.5 text-[10px] text-muted-foreground">
                        {DAILY_COPY.colorsCustom}
                      </span>
                    ) : null}
                    <span className="ml-auto flex gap-1" role="radiogroup" aria-label={dailyOperationsKindLabel(kind)}>
                      {DAILY_OPERATIONS_TONES.map((tone) => {
                        const swatch = toneClasses(tone);
                        const selected = tone === current;
                        return (
                          <button
                            key={tone}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={swatch.label}
                            title={swatch.label}
                            onClick={() => onPick(kind, tone)}
                            className={cn(
                              "size-4 rounded-full transition-transform hover:scale-110",
                              swatch.dot,
                              selected && cn("ring-2 ring-offset-1", swatch.ring),
                            )}
                          />
                        );
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
