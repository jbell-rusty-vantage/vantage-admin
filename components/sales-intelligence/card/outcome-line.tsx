"use client";
/**
 * UI1-CLOSED: the outcome line (final spec §8, UI-1 §3.5, addendum §2.2). It replaces card line 6 on a closed
 * record through `OutreachCard`'s `line6Override`, in the Closed list and in Closed history.
 *
 * - Every date is the ET calendar day of a server instant, rendered as a `<time>` with the exact ET time in
 *   `title` and `aria-label`.
 * - `({n}d, {n} calls)`: whole days, floored, from the server's `time_to_close_ms` (null → no days, never `0d`);
 *   calls from `calls_total` (null → no Number, so no calls). Both absent → no parentheses.
 * - `granot_booked` adds `· now Granot Priority {code} ({label})` when `outcome.priority` holds a code other than
 *   the `5` that closed it (after 5 → 1).
 * - `Booked` sits in the green badge, the one green use (UI-0 §2.1).
 * - An unknown reason prints `Closed {date} · {reason as sent}`, never blank.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import type { ClosedOutcome } from "@/lib/api/salesIntelligence";
import { Chip } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { officialRecordHref } from "../lib/official-record";
import { useIsRep } from "../rep/viewer";
import { etDateKey, formatDate, formatExactFull } from "../lib/time";

const k = copy.ui1.closed;
const DAY_MS = 86_400_000;

/** Whole days, floored; null when the server has no duration. */
export function wholeDays(ms: number | null | undefined): number | null {
  return typeof ms === "number" && Number.isFinite(ms) && ms >= 0 ? Math.floor(ms / DAY_MS) : null;
}

/** `8d, 4 calls` / `8d` / `4 calls` / null. */
export function durationText(outcome: Pick<ClosedOutcome, "time_to_close_ms" | "calls_total">): string | null {
  const days = wholeDays(outcome.time_to_close_ms);
  const parts = [days != null ? k.days(days) : null, outcome.calls_total != null ? k.calls(outcome.calls_total) : null].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** The outcome word for a reason (the rail's labels, COPY §6 `outcomeFilter.*`). */
export function outcomeWord(reason: string): string {
  return copy.ui1.desk.rail.outcome[reason] ?? reason.replaceAll("_", " ");
}

/** The ET day of an instant (`Sep 12`, with the year when it isn't `asOf`'s). */
export function dayText(t: string, asOf: string): string {
  const key = etDateKey(t);
  return key ? formatDate(key, asOf) : formatDate("", asOf);
}

function Day({ t, asOf }: { t: string | null | undefined; asOf: string }) {
  if (!t) return <span className="si-time is-null">{formatDate("", asOf)}</span>;
  const exact = formatExactFull(t);
  return (
    <time dateTime={t} title={exact} aria-label={exact} className="si-time">
      {dayText(t, asOf)}
    </time>
  );
}

/** The `now Granot Priority …` suffix: only after the code moved away from the 5 that closed the record. */
export function nowPriorityText(outcome: Pick<ClosedOutcome, "reason" | "priority">): string | null {
  if (outcome.reason !== "granot_booked" || !outcome.priority || outcome.priority.code === "5") return null;
  return k.nowPriority(outcome.priority.code, outcome.priority.label);
}

export type OutcomeLineProps = {
  outcome: ClosedOutcome;
  asOf: string;
  /** The Outreach's `trigger_at` (`Received {date}` on the Booked line). */
  receivedAt?: string | null;
  /** `si_return` for the official Booking link (the current desk URL). */
  returnTo?: string | null;
};

export function OutcomeLine({ outcome, asOf, receivedAt, returnTo }: OutcomeLineProps) {
  // UI2-SCOPE (UI-2 §3): official-record pages are Owner-only, so a rep's Booked line has no `Open Booking` link.
  const rep = useIsRep();
  const duration = durationText(outcome);
  const tail = duration ? <span className="si-outcome__duration"> ({duration})</span> : null;
  const sep = k.sep;
  let body: ReactNode;
  switch (outcome.reason) {
    case "booked": {
      const booking = outcome.booking;
      body = (
        <>
          {k.received} <Day t={receivedAt} asOf={asOf} />
          {k.arrow}
          <Chip tone="green" icon={null} className="si-outcome__booked">{k.booked}</Chip>{" "}
          <Day t={booking?.book_date ?? outcome.closed_at} asOf={asOf} />
          {tail}
          {booking && !rep && (
            <>
              {sep}
              <Link className="si-link si-outcome__link" href={officialRecordHref("BookedLead", booking.id, returnTo)} data-action="open-booking">
                {k.openBooking}
              </Link>
            </>
          )}
        </>
      );
      break;
    }
    case "cancelled": {
      const reason = outcome.cancellation?.reason;
      const cancelledAt = outcome.cancellation?.cancel_date ?? outcome.closed_at;
      body = (
        <>
          {outcome.booking && (
            <>
              {k.booked} <Day t={outcome.booking.book_date} asOf={asOf} />
              {k.arrow}
            </>
          )}
          {k.cancelled} <Day t={cancelledAt} asOf={asOf} />
          {tail}
          {reason && <>{sep}{reason}</>}
        </>
      );
      break;
    }
    case "owner":
      body = (
        <>
          {k.byYou} <Day t={outcome.closed_at} asOf={asOf} />
          {tail}
          {outcome.note && <>{sep}{outcome.note}</>}
        </>
      );
      break;
    case "crm_dead":
    case "crm_bad_unusable":
      body = (
        <>
          {k.closed} <Day t={outcome.closed_at} asOf={asOf} />
          {tail}
          {sep}
          {outcome.priority ? k.crm(outcome.priority.code, outcome.priority.label) : outcomeWord(outcome.reason)}
        </>
      );
      break;
    case "granot_booked": {
      const now = nowPriorityText(outcome);
      body = (
        <>
          {k.closed} <Day t={outcome.closed_at} asOf={asOf} />
          {tail}
          {sep}
          {k.granotBookedTail}
          {now && <>{sep}{now}</>}
        </>
      );
      break;
    }
    default:
      body = (
        <>
          {k.closed} <Day t={outcome.closed_at} asOf={asOf} />
          {tail}
          {sep}
          {outcomeWord(outcome.reason)}
        </>
      );
  }
  return (
    <span className="si-outcome" data-outcome={outcome.reason}>
      {body}
    </span>
  );
}
