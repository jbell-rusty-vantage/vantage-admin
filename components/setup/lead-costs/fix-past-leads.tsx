"use client";
/**
 * Fix past leads (`?view=fix`): the old Corrections flow, behaviour unchanged. Preview the impact for one feed and a
 * date window, confirm (the preview hash and target schedule revision are frozen into the job), follow the job every
 * two seconds until it ends, cancel while it is pending or running. A stale preview clears the preview and offers
 * *Preview again*. An optional `?entity=<job id>` opens that job.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CrmCard, CrmSelect, Pill, ReadFailure } from "@/components/ui/crm/primitives";
import { formatMoney } from "@/components/ui/crm/format";
import {
  cancelCplCorrection,
  createCplCorrection,
  fetchCplCorrection,
  isCplPreviewStaleError,
  previewCplCorrection,
  type CplCorrectionJob,
  type CplCorrectionPreviewResult,
} from "@/lib/api/registryCpl";
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import { fetchSourceCompanies, fetchSourceGranularities } from "@/lib/api/registrySources";
import { queryKeys } from "@/lib/query/keys";
import { LeadCostError } from "./lead-cost-error";
import { LEAD_COSTS_COPY } from "./lead-costs-copy";

const COPY = LEAD_COSTS_COPY.fix;

export type FixFeedOption = { value: string; label: string };

const JOB_PILL: Record<CplCorrectionJob["status"], "blue" | "green" | "red" | "gray"> = {
  pending: "blue",
  processing: "blue",
  completed: "green",
  failed: "red",
  cancelled: "gray",
};

export type FixPastLeadsViewProps = {
  feeds: FixFeedOption[];
  feedId: string;
  onFeed: (id: string) => void;
  from: string;
  onFrom: (value: string) => void;
  until: string;
  onUntil: (value: string) => void;
  reason: string;
  onReason: (value: string) => void;
  preview: CplCorrectionPreviewResult | null;
  job: CplCorrectionJob | null;
  error: unknown;
  message: string | null;
  readOnly: boolean;
  busy: boolean;
  onPreview: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function FixPastLeadsView(props: FixPastLeadsViewProps) {
  const { preview, job, error, message, readOnly, busy } = props;
  const canCancel = job !== null && (job.status === "pending" || job.status === "processing");
  return (
    <CrmCard title={COPY.title} subtitle={COPY.subtitle}>
      <p className="lc-notice" role="note">
        {COPY.notice}
      </p>
      {message ? (
        <p className="lc-saved" role="status">
          {message}
        </p>
      ) : null}
      {error ? <LeadCostError error={error} staleRevisionCopy={LEAD_COSTS_COPY.save.staleRevision} /> : null}
      {props.feeds.length === 0 ? (
        <p className="crm-empty">{COPY.empty}</p>
      ) : (
        <div className="su-fields lc-fix-fields">
          <div className="su-row">
            <span className="su-row__label">{COPY.feedLabel}</span>
            <CrmSelect<string> label={COPY.feedLabel} value={props.feedId} onChange={props.onFeed} options={props.feeds} />
          </div>
          <label className="su-row">
            <span className="su-row__label">{COPY.fromLabel}</span>
            <input className="su-input" type="date" value={props.from} disabled={readOnly} onChange={(event) => props.onFrom(event.target.value)} />
          </label>
          <label className="su-row">
            <span className="su-row__label">{COPY.untilLabel}</span>
            <input className="su-input" type="date" value={props.until} disabled={readOnly} onChange={(event) => props.onUntil(event.target.value)} />
          </label>
          <label className="su-row">
            <span className="su-row__label">{COPY.reasonLabel}</span>
            <input className="su-input" value={props.reason} disabled={readOnly} onChange={(event) => props.onReason(event.target.value)} />
          </label>
        </div>
      )}

      {readOnly ? (
        <p className="su-quiet">{COPY.readOnly}</p>
      ) : (
        <div className="su-actions lc-fix-actions">
          <button type="button" className="crm-button" disabled={busy || !props.feedId || !props.from || !props.until} onClick={props.onPreview}>
            {COPY.preview}
          </button>
          <button type="button" className="crm-button crm-button--primary" disabled={busy || !preview} onClick={props.onConfirm}>
            {COPY.confirm}
          </button>
          {canCancel ? (
            <button type="button" className="crm-button crm-button--danger" onClick={props.onCancel}>
              {COPY.cancel}
            </button>
          ) : null}
          {isCplPreviewStaleError(error) ? (
            <button type="button" className="crm-button" onClick={props.onPreview}>
              {COPY.repreview}
            </button>
          ) : null}
        </div>
      )}

      {preview ? (
        <div className="su-block" data-testid="fix-preview">
          <h3 className="su-block__head">{COPY.previewTitle}</h3>
          <dl className="lc-facts">
            <div>
              <dt>{COPY.matched}</dt>
              <dd>{preview.impact.matched_count}</dd>
            </div>
            <div>
              <dt>{COPY.wouldChange}</dt>
              <dd>{preview.impact.would_change_count}</dd>
            </div>
            <div>
              <dt>{COPY.wouldNoChange}</dt>
              <dd>{preview.impact.would_no_op_count}</dd>
            </div>
            <div>
              <dt>{COPY.forms}</dt>
              <dd>{preview.impact.form_lead_count}</dd>
            </div>
            <div>
              <dt>{COPY.calls}</dt>
              <dd>{preview.impact.call_lead_count}</dd>
            </div>
          </dl>
          {preview.impact.sample.length > 0 ? (
            <>
              <p className="su-row__label">{COPY.sampleTitle}</p>
              <ul className="lc-sample">
                {preview.impact.sample.slice(0, 5).map((row) => (
                  <li key={`${row.lead_model}-${row.lead_id}`}>
                    {COPY.sampleLine(
                      /call/i.test(row.lead_model) ? COPY.leadKind.call : COPY.leadKind.form,
                      formatMoney(row.current_cpl, { cents: true }),
                      formatMoney(row.target_cpl, { cents: true }),
                      !row.would_change,
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {job ? (
        <div className="su-block" data-testid="fix-job">
          <h3 className="su-block__head">
            {COPY.jobTitle}
            <Pill variant={JOB_PILL[job.status]}>{COPY.jobStatus[job.status]}</Pill>
          </h3>
          <p className="crm-small">{COPY.jobCounts(job.changed_count, job.no_op_count, job.failed_count)}</p>
          {job.last_error ? <p className="crm-text-red crm-small">{job.last_error}</p> : null}
        </div>
      ) : null}
    </CrmCard>
  );
}

export function FixPastLeads({ readOnly, initialJobId }: { readOnly: boolean; initialJobId: string | null }) {
  const queryClient = useQueryClient();
  const [pickedFeed, setPickedFeed] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<CplCorrectionPreviewResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const feedsQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceGranularities({ includeInactive: false }),
    queryFn: () => fetchSourceGranularities({ includeInactive: false }),
  });
  const companiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceCompanies(true),
    queryFn: () => fetchSourceCompanies({ includeInactive: true }),
  });
  const jobQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.cplCorrection(jobId ?? "none"),
    queryFn: () => fetchCplCorrection(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === "completed" || status === "failed" || status === "cancelled") return false;
      return 2000;
    },
  });

  const companyNames = new Map((companiesQuery.data ?? []).map((company) => [company.id, company.owner_label || company.name]));
  const feeds: FixFeedOption[] = (feedsQuery.data ?? []).map((feed) => ({
    value: feed.id,
    label: [companyNames.get(feed.source_company) ?? LEAD_COSTS_COPY.grid.noCompany, feed.owner_label, feed.local ? LEAD_COSTS_COPY.grid.local[feed.local] : null]
      .filter(Boolean)
      .join(" · "),
  }));
  const feedId = pickedFeed || feeds[0]?.value || "";
  const job = jobQuery.data ?? null;

  async function handlePreview() {
    setError(null);
    setBusy(true);
    try {
      setPreview(await previewCplCorrection({ source_granularity_id: feedId, window_from: from, window_until: until }));
    } catch (previewError) {
      if (isCplPreviewStaleError(previewError)) setPreview(null);
      setError(previewError);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setError(null);
    setBusy(true);
    try {
      const created = await createCplCorrection({
        source_granularity_id: feedId,
        window_from: from,
        window_until: until,
        target_schedule_revision: preview.target_schedule_revision,
        preview_hash: preview.preview_hash,
        confirm: true,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setJobId(created.id);
      await invalidateRegistryQueries(queryClient);
      setMessage(COPY.started);
    } catch (confirmError) {
      setError(confirmError);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!job) return;
    setError(null);
    try {
      await cancelCplCorrection(job.id, reason.trim() ? { reason: reason.trim() } : {});
      setMessage(COPY.cancelled);
      await jobQuery.refetch();
    } catch (cancelError) {
      setError(cancelError);
    }
  }

  if (feedsQuery.isError) {
    return <ReadFailure what={LEAD_COSTS_COPY.grid.readFailure} error={feedsQuery.error} onRetry={() => void feedsQuery.refetch()} />;
  }

  return (
    <FixPastLeadsView
      feeds={feeds}
      feedId={feedId}
      onFeed={setPickedFeed}
      from={from}
      onFrom={setFrom}
      until={until}
      onUntil={setUntil}
      reason={reason}
      onReason={setReason}
      preview={preview}
      job={job}
      error={error}
      message={message}
      readOnly={readOnly}
      busy={busy}
      onPreview={() => void handlePreview()}
      onConfirm={() => void handleConfirm()}
      onCancel={() => void handleCancel()}
    />
  );
}
