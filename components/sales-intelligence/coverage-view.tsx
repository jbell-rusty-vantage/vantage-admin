"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ownerCoverageSchema, readSalesIntelligence, settingsSchema, type OwnerCoverage } from "@/lib/api/salesIntelligence";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { copy } from "./sales-intelligence-copy";
import { formatDateTime } from "./lib/format";
import { Button } from "./atoms/button";
import { Failure } from "./chrome";
import { SettingsForm } from "./settings-form";
import { TooltipCard } from "./atoms/tooltip-card";
import { CaptureHealthRegion } from "./capture-health";

function capabilityLabel(state: string | undefined) {
  if (state === "ok") return copy.coverage.ok;
  if (state === "denied") return copy.coverage.denied;
  if (state === "unavailable") return copy.coverage.unavailable;
  return copy.coverage.capabilityUnknown;
}

function cents(value: number | null) {
  return value == null ? copy.coverage.capabilityUnknown : `$${(value / 100).toFixed(2)}`;
}

/**
 * Why a call analysis is or is not starting, with the numbers the server
 * evaluated. A paused pipeline used to read only as "budget reached" even when
 * the month had plenty left and one call's worst case was the real blocker.
 */
function AdmissionCard({ admission }: { admission: NonNullable<OwnerCoverage["analysis_admission"]> }) {
  const paused = admission.status !== "admitted";
  const fix = copy.coverage.admissionFix[admission.status];
  const unresolved = admission.unresolved_reservations;
  return (
    <section className="si-card si-budget" aria-label={copy.coverage.admission}>
      <TooltipCard title={copy.coverage.admission} guideTopic="coverage" label={<h3>{copy.coverage.admission}</h3>}>
        {copy.coverage.admissionSoWhat}
      </TooltipCard>
      <p role={paused ? "status" : undefined} className={paused ? "si-local-notice" : undefined}>{copy.coverage.admissionStatus[admission.status]}</p>
      {fix && <p className="si-text--subtle">{fix}</p>}
      <p>{copy.coverage.admissionEstimate(cents(admission.estimated_cents_per_conversation), cents(admission.per_recording_ceiling_cents))}</p>
      <p className="si-text--subtle">
        {copy.coverage.admissionLimits(admission.limits.steps, admission.limits.total_input_tokens.toLocaleString())} · {admission.model}{admission.pricing_version ? ` · pricing ${admission.pricing_version}` : ""}
      </p>
      <p className="si-text--subtle">{copy.coverage.admissionPaused(admission.paused.per_recording_ceiling, admission.paused.budget, admission.paused.configuration)}</p>
      {unresolved.count > 0 && <p className="si-text--subtle">{copy.coverage.admissionUnresolved(unresolved.count, cents(unresolved.estimated_cents))}</p>}
    </section>
  );
}

function Stage({ name, stage }: { name: string; stage: OwnerCoverage["stages"]["recording"] }) {
  return (
    <li>
      <strong>{name}</strong>
      {" · "}
      {stage.pending} pending · {stage.leased} leased · {stage.retry} retry · {stage.paused} paused · {stage.dead_letter} failed
      {" · "}
      {stage.oldest_queued_at ? `${copy.coverage.oldestQueued} ${formatDateTime(stage.oldest_queued_at)}` : copy.coverage.noQueuedAge}
    </li>
  );
}

export function CoverageView() {
  const [healthOpen, setHealthOpen] = useState(false);
  const coverage = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "coverage"],
    queryFn: ({ signal }) => readSalesIntelligence("coverage", ownerCoverageSchema, signal),
    retry: false,
  });
  const settings = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "settings"],
    queryFn: ({ signal }) => readSalesIntelligence("settings", settingsSchema, signal),
    retry: false,
  });
  const row = coverage.data?.data.coverage;
  const policy = settings.data?.data.policy;
  return (
    <div className="si-view si-coverageview">
      <p className="si-viewintro">{copy.coverage.intro}</p>
      {/* UI1-COVER: capture health first (UI-1 §6). Everything below is the kept Coverage view, unchanged. */}
      <CaptureHealthRegion />
      <h2 className="si-coverageview__layer">{copy.coverage.ownerLayer}</h2>
      {coverage.error && <Failure error={coverage.error} retry={() => void coverage.refetch()} />}
      {coverage.isPending && <p role="status">Loading {copy.page.views.coverage}…</p>}
      {row && (
        <>
          <section className="si-card si-coverageview__history">
            <TooltipCard title={copy.coverage.history} guideTopic="coverage" label={<h3>{copy.coverage.history}</h3>}>
              {copy.live.historyThroughTip}
            </TooltipCard>
            <p>{copy.coverage.historySoWhat}</p>
            <p>
              {row.known_through ? copy.coverage.knownThrough(formatDateTime(row.known_through)) : copy.coverage.unknown}
              {" · "}
              {copy.coverage.asOf(formatDateTime(coverage.data!.data.as_of))}
            </p>
            <p>Call log {capabilityLabel(row.capabilities.call_log)} · Recording {capabilityLabel(row.capabilities.recording_content)} · Webhook {capabilityLabel(row.capabilities.webhook)}</p>
            <h4>{copy.coverage.gaps}</h4>
            {row.gaps.length ? (
              <ul>
                {row.gaps.map((gap) => (
                  <li key={`${gap.from}-${gap.to}`}>{formatDateTime(gap.from)} → {formatDateTime(gap.to)} · {gap.reason}</li>
                ))}
              </ul>
            ) : <p className="si-text--subtle">{copy.coverage.noGaps}</p>}
          </section>
          {row.recordings && (
            <section className="si-card">
              <TooltipCard title={copy.coverage.recording} guideTopic="coverage" label={<h3>{copy.coverage.recording}</h3>}>
                {copy.coverage.recordingSoWhat}
              </TooltipCard>
              <p>{copy.coverage.recordingSoWhat}</p>
              <p>
                Pending discovery {row.recordings.pending_discovery} · Media pending {row.recordings.media_pending} · Stored {row.recordings.media_stored} · No recording {row.recordings.no_recording} · Unavailable {row.recordings.unavailable} · Failed {row.recordings.failed} · Eligibility undetermined {row.recordings.eligibility_undetermined}
              </p>
            </section>
          )}
          <section className="si-card">
            <TooltipCard title={copy.coverage.clocksInUse} guideTopic="coverage" label={<h3>{copy.coverage.clocksInUse}</h3>}>
              {copy.coverage.clocksSoWhat}
            </TooltipCard>
            <p>{copy.coverage.clocksSoWhat}</p>
            {policy && (
              <p>
                {policy.timezone} · first action {policy.first_action_due_staffed_minutes} staffed minutes · missed callback {policy.missed_callback_due_staffed_minutes} · going cold {policy.going_cold_staffed_minutes} · per-recording ceiling {cents(policy.per_recording_ceiling_cents)}
              </p>
            )}
          </section>
          <section className="si-card si-budget">
            <TooltipCard title={copy.coverage.budget} guideTopic="coverage" label={<h3>{copy.coverage.budget}</h3>}>
              {copy.coverage.budgetSoWhat}
            </TooltipCard>
            <p>{copy.coverage.budgetSoWhat}</p>
            {row.ai_paused && <p role="status">{copy.coverage.budgetExhausted}</p>}
            {row.budget.status === "unknown" ? <p>{copy.coverage.budgetUnknown}</p> : (
              <dl className="si-budget__metrics">
                <div><dt>Actual</dt><dd>{cents(row.budget.actual_cents)}</dd></div>
                <div><dt>Reserved</dt><dd>{cents(row.budget.reserved_cents)}</dd></div>
                <div><dt>Remaining</dt><dd>{cents(row.budget.remaining_cents)}</dd></div>
                <div><dt>Ceiling</dt><dd>{cents(row.budget.ceiling_cents)}</dd></div>
              </dl>
            )}
          </section>
          {row.analysis_admission && <AdmissionCard admission={row.analysis_admission} />}
        </>
      )}
      {settings.error && <Failure error={settings.error} retry={() => void settings.refetch()} />}
      {settings.data && <SettingsForm settings={settings.data.data} />}
      {row && (
        <>
          <Button variant="secondary" onClick={() => setHealthOpen((open) => !open)}>
            {healthOpen ? copy.coverage.systemHealthHide : copy.coverage.systemHealthShow}
          </Button>
          {healthOpen && (
            <div className="si-local-stack">
              <h2 className="si-coverageview__layer">{copy.coverage.systemHealth}</h2>
              <section className="si-card">
                <h3>{copy.coverage.stages}</h3>
                <p className="si-field__hint">{copy.coverage.pendingMeans} {copy.coverage.leasedMeans} {copy.coverage.deadLetterMeans}</p>
                <ul>
                  <Stage name={copy.stages.recording} stage={row.stages.recording} />
                  <Stage name={copy.stages.transcription} stage={row.stages.transcription} />
                  <Stage name={copy.stages.analysis} stage={row.stages.analysis} />
                  <Stage name={copy.stages.application} stage={row.stages.application} />
                </ul>
              </section>
              <section className="si-card">
                <h3>{copy.coverage.mapping}</h3>
                <p>Unmapped inbound numbers {row.mapping_hygiene.unmapped_inbound_numbers}</p>
                <p>Directory users without a reviewed link {row.mapping_hygiene.unmapped_directory_users ?? copy.coverage.capabilityUnknown}</p>
                <p>Directory last synced {row.mapping_hygiene.last_directory_sync_at ? formatDateTime(row.mapping_hygiene.last_directory_sync_at) : copy.coverage.capabilityUnknown}</p>
              </section>
              <section className="si-card">
                <h3>{copy.coverage.flags}</h3>
                <ul>
                  {Object.entries(row.flags).map(([flag, enabled]) => (
                    <li key={flag}>{flag} · {enabled ? "on" : "off"}</li>
                  ))}
                </ul>
                <h4>{copy.coverage.models}</h4>
                <p>Extraction {row.models.extraction.name} · {row.models.extraction.enabled ? "enabled" : "off"}</p>
                <p>Transcription {row.models.transcription.name} · {row.models.transcription.enabled ? "enabled" : "off"}</p>
              </section>
              <section className="si-card">
                <h3>{copy.coverage.backfill}</h3>
                <p className="si-field__hint">{copy.coverage.watermarkMeans}</p>
                <p>{row.backfill.available ? `Owner planning available for up to ${row.backfill.days} days per range` : "Historical planning is disabled"}</p>
                <p>Planned {row.backfill.planned ?? "unknown"} · Partial {row.backfill.partial ?? "unknown"} · Captured {row.backfill.complete ?? "unknown"} · Failed {row.backfill.failed ?? "unknown"}</p>
                <p>Capture watermark {row.backfill.known_complete_through ? formatDateTime(row.backfill.known_complete_through) : "unknown"}</p>
                {row.backfill.gaps.length > 0 && <ul>{row.backfill.gaps.map((gap) => (
                  <li key={`${gap.from}-${gap.to}-${gap.reason}`}>{formatDateTime(gap.from)} → {formatDateTime(gap.to)} · {gap.reason}</li>
                ))}</ul>}
                <p>{row.backfill.note}</p>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
