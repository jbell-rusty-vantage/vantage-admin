import {
  PROOF_SHAPE_LABELS,
  type JobTimelinePage,
} from "@/lib/api/jobNumberTimeline";
import { CoverageChips } from "./coverage-chips";

export function JobTimelineHeader({ page }: { page: JobTimelinePage }) {
  const jobNumber = page.job_no_snapshot || page.normalized_job_no;
  const sourceBits = [
    page.source.source_company_label,
    page.source.source_granularity_label,
  ].filter(Boolean);

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
