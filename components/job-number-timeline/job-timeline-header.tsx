import { formatDateTime } from "@/components/data-table/formatters";
import {
  PROOF_SHAPE_LABELS,
  isEnhancedJobTimelinePage,
  type JobTimelinePage,
} from "@/lib/api/jobNumberTimeline";
import { CoverageChips } from "./coverage-chips";
import { StageStrip } from "./stage-strip";

export function JobTimelineHeader({ page }: { page: JobTimelinePage }) {
  const jobNumber = page.job_no_snapshot || page.normalized_job_no;
  const sourceBits = [
    page.source.source_company_label,
    page.source.source_granularity_label,
  ].filter(Boolean);

  if (!isEnhancedJobTimelinePage(page)) {
    return (
      <header className="space-y-3 rounded-md border border-gold/40 bg-pale-gold/40 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-steel">Job Number</p>
        <h2 className="font-heading text-2xl font-extrabold text-navy">{jobNumber}</h2>
        <p className="text-sm text-navy/80">
          {PROOF_SHAPE_LABELS[page.proof_shape]}
          {sourceBits.length > 0 ? ` · ${sourceBits.join(" / ")}` : null}
        </p>
        <CoverageChips coverage={page.coverage} />
      </header>
    );
  }

  return (
    <header className="space-y-3 rounded-md border border-gold/40 bg-pale-gold/40 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-steel">Job Number</p>
      <h2 className="font-heading text-2xl font-extrabold text-navy">{jobNumber}</h2>
      <p className="font-heading text-lg font-bold text-navy">{page.summary.headline}</p>
      <p className="text-sm text-navy/80">
        {page.summary.origin_label}
        {sourceBits.length > 0 ? ` · ${sourceBits.join(" / ")}` : null}
        {` · ${PROOF_SHAPE_LABELS[page.proof_shape]}`}
      </p>
      <dl className="grid gap-2 text-xs text-steel sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-bold uppercase tracking-wide">Latest activity</dt>
          <dd>
            {page.summary.latest_activity_at
              ? formatDateTime(page.summary.latest_activity_at)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-wide">Assembled</dt>
          <dd>{formatDateTime(page.assembled_at)}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-wide">Events</dt>
          <dd>{page.summary.event_count}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-wide">Attention</dt>
          <dd>{page.summary.attention_count}</dd>
        </div>
      </dl>
      {page.freshness.ringcentral_covered_through ? (
        <p className="text-xs text-steel">
          RingCentral covered through {formatDateTime(page.freshness.ringcentral_covered_through)}
          {page.freshness.ringcentral_cursor_lag_seconds != null
            ? ` · cursor lag ${page.freshness.ringcentral_cursor_lag_seconds}s`
            : null}
        </p>
      ) : null}
      <StageStrip assessments={page.stage_assessments} />
    </header>
  );
}
