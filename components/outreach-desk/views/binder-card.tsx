"use client";

import { useRepMetrics } from "../data/use-desk-reads";
import { useDeskLiveStatus } from "../data/use-desk-live";
import { absoluteTime } from "../lib/format";
import { deskCopy } from "../outreach-desk-copy";
import { ReadFailure, SkeletonLine } from "../primitives";

const c = deskCopy.binder;
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export function BinderCard({ agentId, available = true }: { agentId: string | null; available?: boolean }) {
  const query = useRepMetrics(agentId, available);
  const live = useDeskLiveStatus();
  const data = available ? query.data : undefined;
  const official = data?.official_binder;
  const potential = data?.assigned_potential;
  const unknown = potential ? [
    potential.missing_link_count ? c.missingLinks(potential.missing_link_count) : null,
    potential.dangling_link_count ? c.danglingLinks(potential.dangling_link_count) : null,
    potential.missing_amount_count ? c.missingAmounts(potential.missing_amount_count) : null,
    potential.mismatched_link_count ? c.mismatchedLinks(potential.mismatched_link_count) : null,
    potential.ambiguous_identity_count ? c.ambiguous(potential.ambiguous_identity_count) : null,
  ].filter(Boolean).join(" · ") : null;
  const potentialValue = potential
    ? potential.linked_booking_count - potential.missing_amount_count > 0 || potential.coverage === "complete"
      ? dollars.format(potential.known_binder_total)
      : c.noKnown
    : null;
  return (
    <section className="od-card od-binder" aria-labelledby="od-binder-title" aria-busy={query.isFetching} data-testid="binder-card">
      <h2 id="od-binder-title" className="od-card__title">{c.title}</h2>
      <p className="od-binder__note">{c.basis}</p>
      {!available ? <p className="od-binder__note">{c.unavailable}</p> : null}
      {available && query.error ? <ReadFailure inset what={c.title} error={query.error} staleAsOf={data?.as_of ?? null} onRetry={() => void query.refetch()} testId="binder-read-error" /> : null}
      <div className="od-binder__totals">
        {(["today", "last_week", "last_month", "all_time"] as const).map((window) => (
          <div key={window} title={official && window !== "all_time" ? `${official.windows[window].from} – ${official.windows[window].to}` : undefined}>
            <span className="od-binder__label">{c.windows[window]}{official && (official.missing_amount_count > 0 || (window !== "all_time" && official.missing_book_date_count > 0)) ? ` · ${c.knownSubtotal}` : ""}</span>
            <strong className="od-binder__value" data-testid={`binder-${window}`}>{official ? dollars.format(official[window]) : !available || query.error ? deskCopy.text.unavailable : <SkeletonLine width={90} />}</strong>
          </div>
        ))}
      </div>
      {official?.missing_amount_count ? <p className="od-binder__note od-text-amber">{c.missingAmounts(official.missing_amount_count)}</p> : null}
      {official?.missing_book_date_count ? <p className="od-binder__note od-text-amber">{c.missingDates(official.missing_book_date_count)}</p> : null}
      <div className="od-binder__potential">
        <h3 className="od-binder__label">{c.potential}{potential?.coverage === "partial" ? ` · ${c.known}` : ""}</h3>
        <strong className="od-binder__value" data-testid="binder-potential">{potentialValue ?? (!available || query.error ? deskCopy.text.unavailable : <SkeletonLine width={90} />)}</strong>
        <p className="od-binder__note">{c.potentialBasis}</p>
        {potential ? <p className={`od-binder__note ${potential.coverage === "partial" ? "od-text-amber" : ""}`} data-testid="binder-coverage">{potential.coverage === "partial" ? c.partial : c.complete} · {c.coverage(potential.eligible_lead_count, potential.linked_booking_count)}{unknown ? ` · ${unknown}` : ""}</p> : null}
        <p className="od-binder__note">{c.excluded}</p>
      </div>
      {data ? <p className="od-binder__note" title={absoluteTime(data.as_of)}>{deskCopy.live.updated}: {absoluteTime(data.as_of)}{live !== "live" ? ` · ${c.stale}` : ""}</p> : null}
    </section>
  );
}
