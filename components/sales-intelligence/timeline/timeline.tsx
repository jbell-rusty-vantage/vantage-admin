"use client";
/**
 * UI1-TL: the Timeline on both scopes (final spec §10, UI-1 §5.3). `scope: "outreach" | "number"` so UI-3 reuses it for
 * a Number. Newest first, grouped by ET day, routine rows under `Processing details ({n})`, filter chips that send
 * `kinds[]`, `Load older activity` (50 a page, keyset cursor), the truncated note, and the empty sentence.
 *
 * Loading (UI-0 §2.4): the list reads with `useSuspenseInfiniteQuery` inside its own `Region`. A filter change runs in a
 * transition, so the old rows stay on screen with the 2 px progress bar instead of the skeleton; so does a live refetch.
 * Times use the response's `as_of` (UI-0 §2.1); the browser clock is never read.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition, type ReactNode } from "react";
import type { TimelineEvent } from "@/lib/api/salesIntelligence";
import { Button } from "../atoms/button";
import { siKeys } from "../data/query-keys";
import type { TimelineScope } from "../data/requests";
import { useTimeline } from "../data/use-timeline";
import { Region, RegionProgress, SkeletonLines } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { DayGroup, groupByDay } from "./day-group";
import { EventRowSkeleton } from "./event-row";
import { kindsForGroups, type TimelineGroup } from "./event-kinds";
import { TimelineFilters } from "./filters";

const t = copy.ui1.timeline;

export type TimelineViewProps = {
  scope: TimelineScope;
  items: readonly TimelineEvent[];
  asOf: string;
  truncatedSources?: readonly string[];
  hasMore?: boolean;
  loadingMore?: boolean;
  loadMoreFailed?: boolean;
  onLoadMore?: () => void;
  refreshing?: boolean;
  /** The filter chips, rendered above the list (outside the region, so they survive a refetch). */
  filters?: ReactNode;
  className?: string;
};

/** The timeline's markup for a set of already-read items (pure: the tests and the gallery render it from fixtures). */
export function TimelineView({ scope, items, asOf, truncatedSources = [], hasMore = false, loadingMore = false, loadMoreFailed = false, onLoadMore, refreshing = false, filters, className }: TimelineViewProps) {
  const days = groupByDay(items, asOf);
  const idPrefix = `si-tl-${scope}`;
  return (
    <div className={cx("si-timeline", className)} data-scope={scope}>
      {filters}
      <div className="si-timeline__listwrap">
        <RegionProgress active={refreshing} />
        {days.length === 0 ? (
          <p className="si-timeline__empty">{t.empty}</p>
        ) : (
          <ol className="si-timeline__days" aria-label={t.regionLabel}>
            {days.map((day) => (
              <DayGroup key={day.key} day={day} asOf={asOf} idPrefix={idPrefix} />
            ))}
          </ol>
        )}
      </div>
      {truncatedSources.length > 0 && (
        <p className="si-timeline__note" data-truncated={truncatedSources.join(",")}>
          {t.truncated}
        </p>
      )}
      {hasMore && (
        <div className="si-timeline__more">
          <Button variant="secondary" className="si-hit" disabled={loadingMore || !onLoadMore} aria-busy={loadingMore || undefined} onClick={onLoadMore}>
            {loadingMore ? t.loadingOlder : t.loadOlder}
          </Button>
        </div>
      )}
      {loadMoreFailed && (
        <p className="si-timeline__morefail" role="alert">
          {t.loadOlderFailed}
        </p>
      )}
    </div>
  );
}

/** The shaped skeleton: a day header and rows with icon circles (UI-0 §2.4). */
export function TimelineSkeleton({ rows = 5 }: { rows?: number }) {
  const widths: string[][] = [["58%", "82%"], ["46%", "74%"], ["64%", "88%"], ["52%", "70%"], ["60%", "78%"]];
  return (
    <div className="si-timeline is-skeleton" aria-hidden>
      <ol className="si-timeline__days">
        <li className="si-timeline__day">
          <span className="si-timeline__dayhead">
            <SkeletonLines lines={1} widths={[88]} />
          </span>
          <ol className="si-timeline__rows">
            {Array.from({ length: rows }, (_, i) => (
              <EventRowSkeleton key={i} widths={widths[i % widths.length]} />
            ))}
          </ol>
        </li>
      </ol>
    </div>
  );
}

function TimelineData({ scope, id, kinds, pending, filters }: { scope: TimelineScope; id: string; kinds: string[]; pending: boolean; filters: ReactNode }) {
  const query = useTimeline({ scope, id, kinds });
  return (
    <TimelineView
      scope={scope}
      items={query.items}
      asOf={query.asOf}
      truncatedSources={query.truncatedSources}
      hasMore={query.hasNextPage}
      loadingMore={query.isFetchingNextPage}
      loadMoreFailed={query.isFetchNextPageError}
      onLoadMore={() => void query.fetchNextPage()}
      refreshing={pending || (query.isRefetching && !query.isFetchingNextPage)}
      filters={filters}
    />
  );
}

/** The Timeline tab (Outreach route) and the Number route's timeline (UI-3). */
export function Timeline({ scope, id, className }: { scope: TimelineScope; id: string; className?: string }) {
  const queryClient = useQueryClient();
  const [groups, setGroups] = useState<TimelineGroup[]>([]);
  const [pending, startTransition] = useTransition();
  const kinds = kindsForGroups(groups);
  const filters = <TimelineFilters selected={groups} onChange={(next) => startTransition(() => setGroups(next))} />;
  return (
    <Region
      name={`timeline-${scope}`}
      className={className}
      skeleton={<TimelineSkeleton />}
      onRetry={() => void queryClient.resetQueries({ queryKey: siKeys.timeline(scope, id, kinds) })}
    >
      <TimelineData scope={scope} id={id} kinds={kinds} pending={pending} filters={filters} />
    </Region>
  );
}
Timeline.Skeleton = TimelineSkeleton;
