/** UI1-CHAT (UI-0 §2.7): `Today`, `Yesterday`, `Mon Sep 22` against the response's `as_of` (lib/time). */
import { formatDayHeader, formatExactFull } from "../lib/time";

export function DayDivider({ t, asOf }: { t: string; asOf: string }) {
  const text = formatDayHeader(t, asOf);
  return (
    <div className="si-daydivider" role="separator" aria-label={text} title={formatExactFull(t)}>
      <span className="si-daydivider__text">{text}</span>
    </div>
  );
}
