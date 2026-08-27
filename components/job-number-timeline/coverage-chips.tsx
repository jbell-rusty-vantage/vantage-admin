import type { JobTimelinePage } from "@/lib/api/jobNumberTimeline";
import { cn } from "@/lib/utils";

function chipTone(active: boolean, warning = false): string {
  if (warning) return "border-amber-500/40 bg-amber-50 text-navy";
  if (active) return "border-gold bg-pale-gold text-navy";
  return "border-steel-200 bg-white text-steel";
}

export function CoverageChips({ coverage }: { coverage: JobTimelinePage["coverage"] }) {
  const chips = [
    {
      key: "lead",
      label: coverage.lead === "resolved" ? "Lead" : "Lead unresolved",
      active: coverage.lead === "resolved",
      warning: coverage.lead === "unresolved",
    },
    {
      key: "text",
      label: coverage.lead_message === "present" ? "Text" : "Text absent",
      active: coverage.lead_message === "present",
    },
    {
      key: "intake",
      label:
        coverage.booking_intake === "absent" && coverage.cancellation_intake === "absent"
          ? "Intake absent"
          : `Intake ${[coverage.booking_intake !== "absent" ? `booking ${coverage.booking_intake}` : null, coverage.cancellation_intake !== "absent" ? `cancellation ${coverage.cancellation_intake}` : null].filter(Boolean).join(" · ")}`,
      active: coverage.booking_intake !== "absent" || coverage.cancellation_intake !== "absent",
    },
    {
      key: "booking",
      label: coverage.official_booking ? "Booking" : "Booking absent",
      active: coverage.official_booking,
    },
    {
      key: "cancellation",
      label: coverage.official_cancellation ? "Cancellation" : "Cancellation absent",
      active: coverage.official_cancellation,
    },
    {
      key: "sheet",
      label: coverage.sheet_sync === "absent" ? "Sheet absent" : `Sheet ${coverage.sheet_sync}`,
      active: coverage.sheet_sync !== "absent",
      warning: coverage.sheet_sync === "failed" || coverage.sheet_sync === "mixed",
    },
  ];

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Coverage">
      {chips.map((chip) => (
        <li
          key={chip.key}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
            chipTone(chip.active, chip.warning),
          )}
        >
          {chip.label}
        </li>
      ))}
    </ul>
  );
}
