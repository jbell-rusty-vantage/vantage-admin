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
      {data ? <p className="od-binder__note" title={absoluteTime(data.as_of)}>{deskCopy.live.updated}: {absoluteTime(data.as_of)}{live !== "live" ? ` · ${c.stale}` : ""}</p> : null}
    </section>
  );
}
