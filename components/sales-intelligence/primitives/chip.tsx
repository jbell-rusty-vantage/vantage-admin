import { Radio } from "lucide-react";
import { type ReactNode } from "react";
import { cx } from "../lib/format";

export type ChipTone = "neutral" | "amber" | "red" | "green" | "live" | "blue";

/**
 * UI-0 §7.2 chips. Tones follow the colour law: amber for overdue / disagree / newer call / call blockers,
 * red for failed delivery and broken capture, green once (Booked). `live` is neutral text + a pulsing
 * `--si-live` dot + `radio`, never amber.
 */
/** `icon: null` on a live chip means no icon at all (UI-0 §7.2 `In progress`); `undefined` keeps the default radio. */
export function Chip({ tone = "neutral", icon, children, title, className }: { tone?: ChipTone; icon?: ReactNode | null; children: ReactNode; title?: string; className?: string }) {
  return (
    <span className={cx("si-badge si-chip", tone === "live" ? "si-chip--live" : `si-badge--${tone}`, className)} title={title}>
      {tone === "live" && (
        <>
          <span className="si-livedot is-pulse" aria-hidden />
          {icon === undefined && <Radio size={12} aria-hidden />}
        </>
      )}
      {icon}
      <span>{children}</span>
    </span>
  );
}
