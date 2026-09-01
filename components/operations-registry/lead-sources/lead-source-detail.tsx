import { FeedbackMessage } from "@/components/ui/feedback";
import type { LeadSourceDetail, OwnerReadinessPlanRow } from "@/lib/api/leadSources";
import { FeedCard } from "./feed-card";
import { ReadinessChecklist } from "./readiness-checklist";

export function LeadSourceDetailView({
  detail,
  readOnly,
  isPending,
  onReadinessAction,
}: {
  detail: LeadSourceDetail;
  readOnly: boolean;
  isPending?: boolean;
  onReadinessAction: (row: OwnerReadinessPlanRow) => void;
}) {
  const feedNames = detail.feeds.items.map((feed) => feed.display_name);
  const readyCount = detail.feeds.items.filter((feed) => feed.readiness.live).length;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-navy">{detail.name}</h2>
        <p className="text-sm text-muted-foreground">Show it as {detail.owner_label}</p>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">What is this source called?</dt>
            <dd className="font-medium text-navy">{detail.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Which feeds exist?</dt>
            <dd className="font-medium text-navy">
              {detail.feeds.empty
                ? "This lead source has no feeds yet."
                : feedNames.join(", ")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">What external names or numbers enter each feed?</dt>
            <dd className="font-medium text-navy">
              {detail.feeds.empty
                ? "Nothing lands here yet."
                : "Each feed card below lists sheet names, Granot names, and inbound numbers."}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Is each connection ready and live?</dt>
            <dd className="font-medium text-navy">
              {detail.feeds.empty
                ? "No connections yet."
                : `${readyCount} of ${detail.feeds.items.length} feeds live`}
            </dd>
          </div>
        </dl>
        {detail.feeds.empty ? (
          <FeedbackMessage tone="info">This lead source has no feeds yet.</FeedbackMessage>
        ) : null}
      </header>

      <section className="space-y-3" aria-label="Feeds">
        {detail.feeds.items.map((feed) => (
          <FeedCard key={feed.id} feed={feed} leadSourceName={detail.name} />
        ))}
      </section>

      <section className="space-y-3" aria-label="Findings">
        <h3 className="text-sm font-semibold text-navy">What needs attention</h3>
        {detail.findings.length === 0 ? (
          <FeedbackMessage tone="success">No findings. This lead source looks clear.</FeedbackMessage>
        ) : (
          <ul className="grid gap-2">
            {detail.findings.map((finding, index) => (
              <li key={`${finding.code}-${index}`} className="rounded-md border p-3 text-sm">
                <p className="font-medium text-navy">{finding.owner_message}</p>
                <p className="mt-1">
                  <a href={finding.deep_link} className="font-medium text-primary underline">
                    {finding.owner_action}
                  </a>
                </p>
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary>Advanced</summary>
                  <p>{finding.advanced.raw_code}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReadinessChecklist
        rows={detail.readiness_plan}
        readOnly={readOnly}
        isPending={isPending}
        onAction={onReadinessAction}
      />
    </div>
  );
}
