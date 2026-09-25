import { cx } from "../lib/format";
import { formatCountdown, formatExact, formatExactFull, formatRelative } from "../lib/time";

type Common = {
  asOf: string | null;
  mode: "relative" | "exact" | "countdown";
  /** Printed before the phrase and the accessible label: `Due`, `Updated`. */
  prefix?: string;
  /**
   * Countdown only: the server's overdue state. When given it decides the amber text; when omitted, a countdown
   * that reads `overdue …` is amber (the wording and the colour stay in step).
   */
  overdue?: boolean;
  className?: string;
};

type TimeTextProps = Common & ({ t: string; nullText?: string } | { t: string | null; nullText: string });

/** The words for `t`, without markup. An unknown `asOf` falls back to the exact time with the year. */
export function timePhrase(t: string, asOf: string | null, mode: Common["mode"]): { text: string; overdue: boolean } {
  if (!asOf) return { text: formatExactFull(t), overdue: false };
  if (mode === "exact") return { text: formatExact(t, asOf), overdue: false };
  if (mode === "countdown") {
    const countdown = formatCountdown(t, asOf);
    return { text: countdown.text, overdue: countdown.kind === "overdue" };
  }
  return { text: formatRelative(t, asOf), overdue: false };
}

/**
 * Every displayed time (UI-0 §8.5): a `<time>` with `title` and `aria-label` carrying the exact ET time
 * (`Sep 20, 2026, 3:10 PM ET`). `t: null` prints the specific null wording instead.
 */
export function TimeText({ t, asOf, mode, prefix, overdue, nullText, className }: TimeTextProps) {
  if (t == null || t === "") return <span className={cx("si-time is-null", className)}>{nullText}</span>;
  const exact = formatExactFull(t);
  const phrase = timePhrase(t, asOf, mode);
  const amber = mode === "countdown" && (overdue ?? phrase.overdue);
  const lead = prefix ? `${prefix} ` : "";
  const label = mode === "countdown" ? `${lead}${exact}, ${phrase.text}` : `${lead}${exact}`;
  return (
    <time dateTime={t} title={exact} aria-label={label} className={cx("si-time", amber && "si-text--amber", className)}>
      {lead}
      {phrase.text}
    </time>
  );
}
