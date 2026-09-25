"use client";
/**
 * UI1-TL: the side dialog's five-event preview (final spec §4, §10.1; UI-1 §2.4). The five newest events of the
 * `outreach` scope, routine rows left out (they sit under Processing details on the full timeline), then
 * `Open full timeline` → the Outreach route's Timeline tab. It plugs into `PreviewDialog`'s `timelinePreview` slot.
 */
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import type { TimelineEvent } from "@/lib/api/salesIntelligence";
import { siKeys } from "../data/query-keys";
import { useTimeline } from "../data/use-timeline";
import { Region } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { EventRow, EventRowSkeleton } from "./event-row";

const t = copy.ui1.timeline;
export const PREVIEW_COUNT = 5;

export const fullTimelineHref = (outreachId: string) => `/sales-intelligence/outreach/${encodeURIComponent(outreachId)}?tab=timeline`;

/** The newest `count` non-routine events, in the server's order. */
export function previewItems(items: readonly TimelineEvent[], count = PREVIEW_COUNT): TimelineEvent[] {
  return items.filter((item) => !item.routine).slice(0, count);
}

/** Pure markup (tests, gallery). */
export function TimelinePreviewList({ outreachId, items, asOf }: { outreachId: string; items: readonly TimelineEvent[]; asOf: string }) {
  const shown = previewItems(items);
  return (
    <div className="si-timeline si-timeline--preview">
      {shown.length === 0 ? (
        <p className="si-timeline__empty">{t.previewEmpty}</p>
      ) : (
        <ol className="si-timeline__rows" aria-label={t.previewTitle}>
          {shown.map((item) => (
            <EventRow key={item.id} item={item} asOf={asOf} compact />
          ))}
        </ol>
      )}
      <Link className="si-btn si-btn--secondary si-btn--md si-hit si-timeline__full" href={fullTimelineHref(outreachId)}>
        {t.openFullTimeline}
      </Link>
    </div>
  );
}

export function TimelinePreviewSkeleton() {
  return (
    <div className="si-timeline si-timeline--preview is-skeleton" aria-hidden>
      <ol className="si-timeline__rows">
        {Array.from({ length: PREVIEW_COUNT }, (_, i) => (
          <EventRowSkeleton key={i} />
        ))}
      </ol>
    </div>
  );
}

function PreviewData({ outreachId, asOf }: { outreachId: string; asOf?: string }) {
  const query = useTimeline({ scope: "outreach", id: outreachId });
  // The first page (50) always holds the five newest non-routine events unless routine rows crowd it out.
  return <TimelinePreviewList outreachId={outreachId} items={query.data.pages[0]?.data.items ?? []} asOf={asOf ?? query.asOf} />;
}

/**
 * `asOf`: the dialog's own `as_of`, so the preview's dates read the same as the header above it; without it the
 * timeline response's `as_of` is used. It shares the full timeline's query key (no filter), so opening the route
 * after the dialog reads from cache.
 */
export function TimelinePreview({ outreachId, asOf }: { outreachId: string; asOf?: string }) {
  const queryClient = useQueryClient();
  return (
    <Region
      name="timeline-preview"
      skeleton={<TimelinePreviewSkeleton />}
      onRetry={() => void queryClient.resetQueries({ queryKey: siKeys.timeline("outreach", outreachId, []) })}
    >
      <PreviewData outreachId={outreachId} asOf={asOf} />
    </Region>
  );
}
TimelinePreview.Skeleton = TimelinePreviewSkeleton;
