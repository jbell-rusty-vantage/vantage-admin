"use client";
/**
 * UI1-COVER gallery section: the Coverage capture health block for each `capture_health.status` fixture, the
 * `subscription_missing` renewal error, a never-swept Call Log, and the skeleton. The records are copied from the
 * S5c coverage fixtures (the page can't read the workspace at runtime); each names its source.
 */
import type { CaptureHealth as CaptureHealthDto } from "@/lib/api/salesIntelligence";
import { CaptureHealth } from "@/components/sales-intelligence/capture-health";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { GallerySection, Sample } from "./section";

/** S5c/coverage__capture-health-ok__synthetic.json `data.coverage.capture_health` (trimmed `last_sweep`). */
export const COVERAGE_OK: CaptureHealthDto = {
  as_of: "2026-09-24T18:39:44.697Z", status: "ok", reasons: [], known_complete_through: "2026-09-24T18:28:32.469Z",
  call_log: { sync_mode: "off", last_reconcile_at: "2026-09-24T18:33:32.469Z", quarantined_count: 0, oldest_quarantined_at: null, last_sweep: { ran_at: "2026-09-24T13:38:32.469Z", recovered_calls: 2 } },
  webhook: { state: "healthy", subscription_id_suffix: "00a1b2", subscription_expires_at: "2046-09-19T18:39:00.025Z", last_receipt_at: "2026-09-24T18:38:44.697Z", receipts_1h: 14, last_renewal_at: "2026-09-24T18:39:00.025Z", last_renewal_error: null },
  in_progress_calls: 1, pending_finalization: 0,
};

/** S5c/coverage__seed.json `data.coverage.capture_health` (status `attention`). */
export const COVERAGE_ATTENTION: CaptureHealthDto = {
  as_of: "2026-09-24T18:39:44.648Z", status: "attention", reasons: ["quarantine", "pending_finalization"], known_complete_through: "2026-09-24T18:28:32.469Z",
  call_log: { sync_mode: "off", last_reconcile_at: "2026-09-24T18:33:32.469Z", quarantined_count: 1, oldest_quarantined_at: "2026-09-24T16:38:32.469Z", last_sweep: { ran_at: "2026-09-24T13:38:32.469Z", recovered_calls: 2 } },
  webhook: { state: "healthy", subscription_id_suffix: "00a1b2", subscription_expires_at: "2046-09-19T18:39:00.025Z", last_receipt_at: "2026-09-24T18:37:32.469Z", receipts_1h: 1, last_renewal_at: "2026-09-24T18:39:00.025Z", last_renewal_error: null },
  in_progress_calls: 2, pending_finalization: 1,
};

/** S5c/coverage__capture-health-broken__synthetic.json `data.coverage.capture_health` (status `broken`). */
export const COVERAGE_BROKEN: CaptureHealthDto = {
  as_of: "2026-09-24T18:39:44.697Z", status: "broken", reasons: ["webhook_down", "quarantine_over_24h", "pending_finalization"], known_complete_through: "2026-09-24T18:28:32.469Z",
  call_log: { sync_mode: "off", last_reconcile_at: "2026-09-24T18:33:32.469Z", quarantined_count: 1, oldest_quarantined_at: "2026-09-23T17:39:44.697Z", last_sweep: { ran_at: "2026-09-24T13:38:32.469Z", recovered_calls: 2 } },
  webhook: { state: "down", subscription_id_suffix: "00c3d4", subscription_expires_at: "2026-09-22T18:38:32.469Z", last_receipt_at: "2026-09-23T16:39:44.697Z", receipts_1h: 0, last_renewal_at: "2026-09-15T18:38:32.469Z", last_renewal_error: null },
  in_progress_calls: 1, pending_finalization: 1,
};

/**
 * Synthetic (no fixture carries it): the ok record with `last_renewal_error: "subscription_missing"` (the production
 * renewal cron state, SERVER-STATE-FOR-UI §3), no sweep yet and history coverage unknown.
 */
export const COVERAGE_SUBSCRIPTION_MISSING: CaptureHealthDto = {
  ...COVERAGE_OK,
  known_complete_through: null,
  call_log: { ...COVERAGE_OK.call_log, last_sweep: null },
  webhook: { ...COVERAGE_OK.webhook, last_renewal_error: "subscription_missing" },
};

const SAMPLES: { id: string; label: string; health: CaptureHealthDto; source: string }[] = [
  { id: "ok", label: copy.ui1.coverage.status.ok ?? "ok", health: COVERAGE_OK, source: "S5c/coverage__capture-health-ok__synthetic.json" },
  { id: "attention", label: copy.ui1.coverage.status.attention ?? "attention", health: COVERAGE_ATTENTION, source: "S5c/coverage__seed.json" },
  { id: "broken", label: copy.ui1.coverage.status.broken ?? "broken", health: COVERAGE_BROKEN, source: "S5c/coverage__capture-health-broken__synthetic.json" },
  { id: "subscription-missing", label: copy.ui1.coverage.webhook.renewalError("subscription_missing"), health: COVERAGE_SUBSCRIPTION_MISSING, source: "synthetic: ok + subscription_missing, never swept, history unknown" },
];

export function CoverageSection() {
  return (
    <GallerySection id="coverage" title={copy.ui1.gallery.sections.coverage}>
      <div className="si-gallery__grid">
        {SAMPLES.map((sample) => (
          <Sample key={sample.id} label={sample.label} copyKey={`copy.ui1.coverage · ${sample.source}`} wide>
            <div data-coverage-sample={sample.id}>
              <CaptureHealth health={sample.health} asOf={sample.health.as_of} />
            </div>
          </Sample>
        ))}
        <Sample label="CaptureHealth.Skeleton" copyKey="components/sales-intelligence/capture-health.tsx" wide>
          <div data-coverage-sample="skeleton">
            <CaptureHealth.Skeleton />
          </div>
        </Sample>
      </div>
    </GallerySection>
  );
}
