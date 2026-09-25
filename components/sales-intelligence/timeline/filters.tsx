/**
 * UI1-TL: the filter chips `Calls · Lead updates · Work · Messages · Analysis` (final spec §10.1). Each chip toggles
 * one group; the timeline sends the groups' registered kinds as `kinds[]` (the server has no group parameter,
 * S4 CONTRACT "Query"). No chip pressed means no filter.
 */
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { TIMELINE_GROUPS, type TimelineGroup } from "./event-kinds";

const t = copy.ui1.timeline;

export function toggleGroup(groups: readonly TimelineGroup[], group: TimelineGroup): TimelineGroup[] {
  const next = groups.includes(group) ? groups.filter((g) => g !== group) : [...groups, group];
  return TIMELINE_GROUPS.filter((g) => next.includes(g));
}

export function TimelineFilters({ selected, onChange, disabled }: { selected: readonly TimelineGroup[]; onChange?: (groups: TimelineGroup[]) => void; disabled?: boolean }) {
  return (
    <div className="si-timeline__filters" role="group" aria-label={t.filtersLabel}>
      {TIMELINE_GROUPS.map((group) => {
        const on = selected.includes(group);
        return (
          <button
            key={group}
            type="button"
            className={cx("si-timeline__filter", on && "is-on")}
            aria-pressed={on}
            data-group={group}
            disabled={disabled || !onChange}
            onClick={() => onChange?.(toggleGroup(selected, group))}
          >
            {t.filters[group]}
          </button>
        );
      })}
    </div>
  );
}
