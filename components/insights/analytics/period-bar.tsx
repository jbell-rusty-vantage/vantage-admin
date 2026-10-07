"use client";
/**
 * The controls every Analytics tab shares (doc 09): a period preset, what it is compared with, which source
 * companies count, and the chosen dates in words. Sticky at the top of the page on wider screens.
 */
import { useEffect, useRef, useState } from "react";
import { CalendarRange, Filter, GitCompareArrows } from "lucide-react";
import {
  INSIGHTS_COMPARE_LABELS,
  INSIGHTS_COMPARE_MODES,
  INSIGHTS_PERIOD_LABELS,
  INSIGHTS_PERIOD_PRESETS,
  type InsightsAnalyticsReport,
  type InsightsCompareMode,
  type InsightsPeriodPreset,
  type InsightsQuery,
} from "@/lib/api/insights";
import { coverageNote, periodCaption } from "@/lib/insights/format";
import { CrmSelect, Pill, cx, newYorkDayKey } from "@/components/ui/crm";

const DAY_MS = 86_400_000;

/** Custom dates to start from: the report's own range, or the last 30 New York days. */
function seedRange(report: Pick<InsightsAnalyticsReport, "period"> | undefined): { from: string; to: string } {
  if (report?.period.start && report.period.end) return { from: report.period.start, to: report.period.end };
  const now = Date.now();
  return { from: newYorkDayKey(now - 29 * DAY_MS), to: newYorkDayKey(now) };
}

function SourcePicker({ options, selected, onChange }: { options: InsightsAnalyticsReport["source_options"]; selected: readonly string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([...selected]);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  const labelOf = (key: string) => options.find((option) => option.key === key)?.label ?? key;
  const summary = selected.length === 0 ? "All sources" : selected.length === 1 ? labelOf(selected[0]!) : `${selected.length} sources`;
  const toggle = (key: string) => setDraft((current) => (current.includes(key) ? current.filter((value) => value !== key) : [...current, key]));
  return (
    <div className="ia-sources" ref={rootRef}>
      <button
        type="button"
        className={cx("crm-chip", selected.length > 0 && "crm-chip--active")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setDraft([...selected]);
          setOpen((current) => !current);
        }}
      >
        <Filter aria-hidden="true" />
        {summary}
      </button>
      {open ? (
        <div className="ia-sources__pop" role="dialog" aria-label="Choose sources">
          {options.length === 0 ? (
            <p className="ia-empty">No sources to choose from yet.</p>
          ) : (
            <div className="ia-sources__list">
              {options.map((option) => (
                <label key={option.key} className="ia-sources__item">
                  <input type="checkbox" checked={draft.includes(option.key)} onChange={() => toggle(option.key)} />
                  <span>
                    <span className="ia-sources__name">{option.label}</span>
                    {option.feeds.length ? <span className="ia-sources__feeds">Feeds: {option.feeds.map((feed) => feed.label).join(", ")}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="ia-sources__foot">
            <button
              type="button"
              className="crm-button crm-button--quiet crm-button--sm"
              onClick={() => {
                setDraft([]);
                onChange([]);
                setOpen(false);
              }}
            >
              All sources
            </button>
            <button
              type="button"
              className="crm-button crm-button--primary crm-button--sm"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              {draft.length === 0 ? "Show all" : `Show ${draft.length} ${draft.length === 1 ? "source" : "sources"}`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PeriodBar({ query, report, onChange, updating }: { query: InsightsQuery; report: InsightsAnalyticsReport | undefined; onChange: (next: InsightsQuery) => void; updating: boolean }) {
  const setPeriod = (period: InsightsPeriodPreset) => {
    if (period === "custom") {
      const seed = query.from && query.to ? { from: query.from, to: query.to } : seedRange(report);
      onChange({ ...query, period, ...seed });
      return;
    }
    onChange({ period, compare: query.compare, sources: query.sources });
  };
  const setDate = (side: "from" | "to", value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const next = { ...query, [side]: value };
    if (next.from && next.to && next.from > next.to) {
      if (side === "from") next.to = value;
      else next.from = value;
    }
    onChange(next);
  };
  const note = report ? coverageNote(report.comparison, query.compare) : null;
  return (
    <section className="crm-card ia-periodbar" aria-label="Period and comparison" data-testid="period-bar">
      <div className="ia-periodbar__controls">
        <CrmSelect<InsightsPeriodPreset>
          label="Period"
          icon={CalendarRange}
          value={query.period}
          onChange={setPeriod}
          options={INSIGHTS_PERIOD_PRESETS.map((value) => ({ value, label: INSIGHTS_PERIOD_LABELS[value] }))}
        />
        {query.period === "custom" ? (
          <span className="ia-periodbar__dates">
            <label>
              <span className="sr-only">From</span>
              <input type="date" value={query.from ?? ""} max={query.to} onChange={(event) => setDate("from", event.target.value)} aria-label="From" />
            </label>
            <span className="ia-periodbar__word">to</span>
            <label>
              <span className="sr-only">To</span>
              <input type="date" value={query.to ?? ""} min={query.from} onChange={(event) => setDate("to", event.target.value)} aria-label="To" />
            </label>
          </span>
        ) : null}
        <span className="ia-periodbar__word">compared with</span>
        <CrmSelect<InsightsCompareMode>
          label="Compared with"
          icon={GitCompareArrows}
          value={query.compare}
          onChange={(compare) => onChange({ ...query, compare })}
          options={INSIGHTS_COMPARE_MODES.map((value) => ({ value, label: INSIGHTS_COMPARE_LABELS[value] }))}
        />
        <SourcePicker options={report?.source_options ?? []} selected={query.sources ?? []} onChange={(sources) => onChange({ ...query, sources })} />
      </div>
      <p className="ia-periodbar__caption" aria-live="polite">
        {report ? <span>{periodCaption(report.period, report.comparison)}</span> : <span className="ia-note">Reading the period…</span>}
        {report?.period.includes_today ? (
          <Pill variant="amber" title="This period includes today, so its numbers are still moving">
            Still moving
          </Pill>
        ) : null}
        {updating && report ? <span className="ia-note">Updating…</span> : null}
        {note ? <span className="ia-periodbar__note">{note}</span> : null}
      </p>
    </section>
  );
}
