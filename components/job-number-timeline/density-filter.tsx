import {
  DEFAULT_TIMELINE_VIEW,
  type TimelineDensityView,
} from "@/lib/api/jobNumberTimeline";
import { cn } from "@/lib/utils";

const OPTIONS: { value: TimelineDensityView; label: string }[] = [
  { value: "lifecycle", label: "Lifecycle story" },
  { value: "all", label: "All evidence" },
  { value: "attention", label: "Attention only" },
  { value: "customer", label: "Customer lifecycle" },
  { value: "system", label: "System processing" },
];

export function DensityFilter({
  view = DEFAULT_TIMELINE_VIEW,
  onViewChange,
}: {
  view?: TimelineDensityView;
  onViewChange: (view: TimelineDensityView) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Timeline density"
      className="flex flex-wrap gap-2"
    >
      {OPTIONS.map((option) => {
        const checked = view === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onViewChange(option.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide",
              "outline-none focus-visible:ring-2 focus-visible:ring-gold",
              checked
                ? "border-navy bg-navy text-white"
                : "border-steel-200 bg-white text-navy hover:border-gold",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
