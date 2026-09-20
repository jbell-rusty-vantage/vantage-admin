"use client";

import { useQuery } from "@tanstack/react-query";
import { ownerCoverageSchema, readSalesIntelligence, settingsSchema, type OwnerCoverage } from "@/lib/api/salesIntelligence";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { copy } from "./sales-intelligence-copy";
import { formatDateTime } from "./lib/format";
import { Failure } from "./chrome";
import { SettingsForm } from "./settings-form";

function capabilityLabel(state: string | undefined) {
  if (state === "ok") return copy.coverage.ok;
  if (state === "denied") return copy.coverage.denied;
  if (state === "unavailable") return copy.coverage.unavailable;
  return copy.coverage.capabilityUnknown;
}

function cents(value: number | null) {
  return value == null ? copy.coverage.capabilityUnknown : `$${(value / 100).toFixed(2)}`;
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
  return (
    <div className="si-view si-coverageview">
      {coverage.error && <Failure error={coverage.error} retry={() => void coverage.refetch()} />}
      {coverage.isPending && <p role="status">Loading {copy.page.views.coverage}…</p>}
      {row && (
        <>
          <section className="si-card si-coverageview__history">
            <h3>{copy.coverage.history}</h3>
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
              <h3>{copy.coverage.recording}</h3>
              <p>
                Pending discovery {row.recordings.pending_discovery} · Media pending {row.recordings.media_pending} · Stored {row.recordings.media_stored} · No recording {row.recordings.no_recording} · Unavailable {row.recordings.unavailable} · Failed {row.recordings.failed} · Eligibility undetermined {row.recordings.eligibility_undetermined}
              </p>
              <p className="si-text--subtle">Denied access is not a zero count. Unavailable and unknown stay labeled as such.</p>
            </section>
          )}
          <section className="si-card">
            <h3>{copy.coverage.stages}</h3>
            <ul>
              <Stage name={copy.stages.recording} stage={row.stages.recording} />
              <Stage name={copy.stages.transcription} stage={row.stages.transcription} />
              <Stage name={copy.stages.analysis} stage={row.stages.analysis} />
              <Stage name={copy.stages.application} stage={row.stages.application} />
            </ul>
          </section>
          <section className="si-card si-budget">
            <h3>{copy.coverage.budget}</h3>
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
            <p>{row.backfill.available ? `Owner planning available for up to ${row.backfill.days} days per range` : "Historical planning is disabled"}</p>
            <p>Planned {row.backfill.planned ?? "unknown"} · Partial {row.backfill.partial ?? "unknown"} · Captured {row.backfill.complete ?? "unknown"} · Failed {row.backfill.failed ?? "unknown"}</p>
            <p>Capture watermark {row.backfill.known_complete_through ? formatDateTime(row.backfill.known_complete_through) : "unknown"}</p>
            {row.backfill.gaps.length > 0 && <ul>{row.backfill.gaps.map(gap => (
              <li key={`${gap.from}-${gap.to}-${gap.reason}`}>{formatDateTime(gap.from)} → {formatDateTime(gap.to)} · {gap.reason}</li>
            ))}</ul>}
            <p>{row.backfill.note}</p>
          </section>
        </>
      )}
      {settings.error && <Failure error={settings.error} retry={() => void settings.refetch()} />}
      {settings.data && <SettingsForm settings={settings.data.data} />}
    </div>
  );
}
