"use client";
/**
 * UI1-COVER (UI-1 §6, COPY-UI1 §11): the capture health block at the top of Coverage. Every state is the server's
 * (`capture_health.status`, `reasons[]`, the counts); the browser only words them. Times go through `TimeText`
 * against the response `as_of`. Red is used only for `broken` (UI-0 §2).
 */
import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, OctagonAlert, type LucideIcon } from "lucide-react";
import type { CaptureHealth as CaptureHealthDto } from "@/lib/api/salesIntelligence";
import { copy } from "./sales-intelligence-copy";
import { cx } from "./lib/format";
import { useCoverage } from "./data/use-coverage";
import { siKeys } from "./data/query-keys";
import { Region, RegionProgress, SkeletonLines, TimeText } from "./primitives";

const c = copy.ui1.coverage;

const STATUS_ICON: Record<string, LucideIcon> = { ok: CircleCheck, attention: CircleAlert, broken: OctagonAlert };

/** A reason key the copy doesn't know: underscores as spaces, first letter capitalised (never blank). */
function reasonFallback(key: string) {
  const words = key.replace(/_/g, " ").trim();
  return words ? `${words[0].toUpperCase()}${words.slice(1)}.` : key;
}

/** The sentence for one `reasons[]` key, with the count the server sent where the copy has `{n}`. */
export function captureReasonText(key: string, health: CaptureHealthDto): string {
  const sentence = c.reason[key];
  if (!sentence) return reasonFallback(key);
  if (key === "quarantine") return sentence(health.call_log.quarantined_count);
  if (key === "pending_finalization") return sentence(health.pending_finalization);
  return sentence(0);
}

export function captureStatusText(status: string) {
  return c.status[status] ?? c.statusOther(status);
}

function Dot() {
  return <span aria-hidden> · </span>;
}

export function CaptureHealth({ health, asOf }: { health: CaptureHealthDto; asOf: string | null }) {
  const Icon = STATUS_ICON[health.status] ?? CircleAlert;
  const broken = health.status === "broken";
  const { call_log: log, webhook } = health;
  const sweep = log.last_sweep;
  return (
    <section className={cx("si-card si-caphealth", `is-${health.status}`)} aria-labelledby="si-caphealth-title" data-capture-status={health.status}>
      <h3 id="si-caphealth-title" className="si-heading si-heading--3">{c.title}</h3>
      <p className={cx("si-caphealth__status", broken && "si-text--danger")} role={broken ? "alert" : "status"}>
        <Icon size={18} aria-hidden className="si-caphealth__icon" />
        <span>{captureStatusText(health.status)}</span>
      </p>
      {health.reasons.length > 0 && (
        <ul className="si-caphealth__reasons" aria-label={c.reasonsLabel}>
          {health.reasons.map((key) => (
            <li key={key} data-reason={key}>
              {captureReasonText(key, health)}
              {key === "pending_finalization" && <span className="si-caphealth__explain si-text--subtle">{c.pendingExplain}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="si-caphealth__line">
        <TimeText t={health.known_complete_through} asOf={asOf} mode="exact" prefix={c.knownThrough} nullText={c.knownUnknown} />
      </p>
      <div className="si-caphealth__group">
        <h4 className="si-heading si-heading--4">{c.callLogTitle}</h4>
        <p className="si-caphealth__line" data-caphealth="call-log">
          <span>{c.syncMode(c.syncModeWord[log.sync_mode] ?? log.sync_mode)}</span>
          <Dot />
          <span>
            {c.quarantine(log.quarantined_count)}
            {log.oldest_quarantined_at && (
              <>
                {" ("}
                <TimeText t={log.oldest_quarantined_at} asOf={asOf} mode="exact" prefix={c.quarantineOldest} />
                {")"}
              </>
            )}
          </span>
          <Dot />
          <span>{sweep ? c.lastSweep(sweep.recovered_calls) : c.neverSwept}</span>
        </p>
      </div>
      <div className="si-caphealth__group">
        <h4 className="si-heading si-heading--4">{c.webhookTitle}</h4>
        <p className="si-caphealth__line" data-caphealth="webhook">
          <span>{c.webhook.state[webhook.state] ?? c.webhook.stateOther(webhook.state)}</span>
          {webhook.subscription_id_suffix && (
            <>
              <Dot />
              <span>{c.webhook.subscription(webhook.subscription_id_suffix)}</span>
            </>
          )}
          <Dot />
          <TimeText t={webhook.last_receipt_at} asOf={asOf} mode="relative" prefix={c.webhook.lastReceipt} nullText={c.webhook.noReceipt} />
          <Dot />
          <span>{c.webhook.receipts1h(webhook.receipts_1h)}</span>
          {webhook.last_renewal_error && (
            <>
              <Dot />
              <span>{c.webhook.renewalError(webhook.last_renewal_error)}</span>
            </>
          )}
        </p>
        {webhook.last_renewal_error === "subscription_missing" && <p className="si-caphealth__explain si-text--subtle">{c.webhook.subscriptionMissing}</p>}
      </div>
      <div className="si-caphealth__group">
        <h4 className="si-heading si-heading--4">{c.callsTitle}</h4>
        <p className="si-caphealth__line" data-caphealth="calls">
          <span>{c.inProgress(health.in_progress_calls)}</span>
          <Dot />
          <span>{c.pendingFinalization(health.pending_finalization)}</span>
        </p>
        {health.pending_finalization > 0 && !health.reasons.includes("pending_finalization") && (
          <p className="si-caphealth__explain si-text--subtle">{c.pendingExplain}</p>
        )}
      </div>
    </section>
  );
}

/** Shaped like the block: title, status line, two reasons, then the three groups. */
function CaptureHealthSkeleton() {
  return (
    <section className="si-card si-caphealth is-skeleton" aria-hidden>
      <SkeletonLines lines={1} widths={["30%"]} />
      <SkeletonLines lines={3} widths={["55%", "70%", "60%"]} />
      <SkeletonLines lines={2} widths={["20%", "65%"]} />
      <SkeletonLines lines={2} widths={["20%", "80%"]} />
      <SkeletonLines lines={2} widths={["20%", "40%"]} />
    </section>
  );
}
CaptureHealth.Skeleton = CaptureHealthSkeleton;

function CaptureHealthRead() {
  const { captureHealth, asOf, isFetching } = useCoverage();
  if (!captureHealth) return null; // a server before S5c-HEALTH: Coverage shows the rest unchanged
  return (
    <>
      <RegionProgress active={isFetching} />
      <CaptureHealth health={captureHealth} asOf={asOf} />
    </>
  );
}

/** Its own region (UI-0 §2.4) on the coverage read, which the header's live indicator shares. */
export function CaptureHealthRegion() {
  const queryClient = useQueryClient();
  return (
    <Region name="capture-health" skeleton={<CaptureHealth.Skeleton />} onRetry={() => void queryClient.resetQueries({ queryKey: siKeys.coverage() })}>
      <CaptureHealthRead />
    </Region>
  );
}
