import type { StageAssessment, StageAssessmentState } from "@/lib/api/jobNumberTimeline";
import { cn } from "@/lib/utils";

function stateTone(state: StageAssessmentState): string {
  if (state === "attention") return "border-amber-500/40 bg-amber-50 text-navy";
  if (state === "unverifiable") return "border-gold/50 bg-pale-gold text-navy";
  if (state === "active") return "border-gold bg-pale-gold text-navy";
  if (state === "complete") return "border-navy/30 bg-navy text-white";
  if (state === "not_applicable") return "border-steel-200 bg-steel-100 text-steel";
  return "border-steel-200 bg-white text-steel";
}

export function StageStrip({ assessments }: { assessments: StageAssessment[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="What we know">
      {assessments.map((assessment) => (
        <li
          key={assessment.stage}
          data-stage={assessment.stage}
          data-state={assessment.state}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
            stateTone(assessment.state),
          )}
        >
          {assessment.label}
        </li>
      ))}
    </ul>
  );
}
