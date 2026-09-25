import type { Followup, Agent } from "@/lib/api/salesIntelligence";
import { Badge } from "./atoms/badge";
import { OwnershipSplit } from "./ownership";
import { TimeText } from "./primitives";
import { copy } from "./sales-intelligence-copy";
import { useIsRep } from "./rep/viewer";
import { cx, formatDateTime, label } from "./lib/format";

/**
 * One follow-up. With `asOf` (UI1-SHELL Work tab, UI-1 §5.4) the due time is a `TimeText` against the response's
 * `as_of` (exact + countdown, amber only from the server's `overdue`), the retry reads `Try again ({attempt} of 2)`
 * from `promise_chain`, and `cancel_reason = superseded_by_specific_plan` reads `Replaced by a specific plan`.
 * Without `asOf` it renders as before (legacy callers).
 */
export function FollowupCard({ followup: f, overallOwner, asOf }: { followup: Followup; overallOwner: Agent | null; asOf?: string }) {
  const legacyDue = f.due_at
    ? f.snoozed_until
      ? copy.time.dueAndSnoozed(formatDateTime(f.due_at), formatDateTime(f.snoozed_until))
      : copy.time.due(formatDateTime(f.due_at))
    : f.status === "open"
      ? copy.time.dueDateNeeded
      : copy.time.noDueRecorded;
  const due = asOf === undefined ? legacyDue : f.due_at ? (
    <>
      <TimeText t={f.due_at} asOf={asOf} mode="exact" prefix={copy.ui1.card.due} />
      {f.status === "open" && <>{" ("}<TimeText t={f.due_at} asOf={asOf} mode="countdown" overdue={f.overdue} />{")"}</>}
    </>
  ) : f.status === "open" ? copy.time.dueDateNeeded : copy.time.noDueRecorded;
  const rep = useIsRep();
  // UI2: an Owner-set follow-up reads `Set by the Owner` to a rep (the Owner's copy says `Set by you`).
  const origin = rep && f.origin === "owner" ? copy.ui2.scope.ownerWords.setBy : (copy.followupOrigin as Record<string, string>)[f.origin] ?? label(f.origin);
  return (
    <article className={cx("si-followup-card", !f.due_at && "si-followup-card--undated", f.overdue && "si-followup-card--overdue")} data-followup-status={f.status}>
      <header className="si-followup-card__header">
        <h4 className="si-followup-card__kind">{label(f.kind)}</h4>
        <Badge>{asOf === undefined ? label(f.origin) : origin} · {label(f.status)}</Badge>
        {asOf !== undefined && f.promise_chain?.attempt != null && <Badge>{copy.ui1.chip.retry(f.promise_chain.attempt)}</Badge>}
      </header>
      <p className="si-followup-card__desc">{f.description}</p>
      <p className={cx("si-snooze-due", !f.due_at && "is-needed")}>
        {due}
        {asOf === undefined && f.overdue && ` · ${copy.signals.overdue}`}
      </p>
      {asOf !== undefined && f.cancel_reason === "superseded_by_specific_plan" && (
        <p className="si-text--sm si-text--subtle" data-cancel-reason={f.cancel_reason}>{copy.ui1.outreach.work.superseded}</p>
      )}
      {f.paused_channels.map((channel) => (
        <Badge key={channel} tone="amber">{label(channel)} paused</Badge>
      ))}
      {f.disposition && <p>Outcome: {label(f.disposition)}{f.completion_basis ? ` · ${label(f.completion_basis)}` : ""}</p>}
      <OwnershipSplit promisedBy={f.origin === "rep_promise" ? f.promised_by : undefined} assignedTo={f.assignment.agent} overallOwner={overallOwner} />
    </article>
  );
}
