"use client";
/**
 * The check page (doc 17 steps 2 to 4): one page whose body follows the check's status. Owns the reads (through the
 * shared hooks), the URL state of the lead panel, the selection and the approve / re-check writes.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { operationalConfigs, withFacetOptions } from "@/components/operational/operational-configs";
import { DetailPanel } from "@/components/operational/operational-detail-panel";
import type { DetailTabKey } from "@/components/operational/visible-detail-tabs";
import { useUrlState } from "@/components/records";
import { formatRelative } from "@/components/ui/crm/format";
import { CrmCard, Notice, PageHeader, Pill, ReadFailure, SkeletonLine, type PillVariant } from "@/components/ui/crm/primitives";
import { approveGranotRun, GranotAutomationApiError, type GranotAction, type GranotRun } from "@/lib/api/granotAutomation";
import { useFacetOptions } from "@/lib/api/facets";
import type { UrlStateUpdate } from "@/lib/api/url-state-update";
import { granotCheckHref, GRANOT_UPDATES_HREF } from "@/lib/automations/granot-updates-redirects";
import {
  checkById,
  checkChoices,
  checkOf,
  expiresInWords,
  isFallbackMatch,
  leadTypeWords,
  resultCounts,
  windowWords,
  type CheckStatus,
} from "@/lib/automations/granot-updates-model";
import { queryKeys } from "@/lib/query/keys";
import { ApproveDialog } from "./check-approve-dialog";
import type { LeadKind } from "./check-cells";
import { CHECK_COPY } from "./check-copy";
import { CheckProgress } from "./check-progress";
import { CheckResults, type ResultTab } from "./check-results";
import { CheckReview, type LeadTypeFilter, type ReviewTab, type SelectionEntry } from "./check-review";
import { GRANOT_UPDATES_COPY } from "./granot-updates-copy";
import {
  GRANOT_RUNS_LIMIT,
  recallCheckChoices,
  startGranotCheck,
  useGranotRunDetail,
  useGranotRuns,
  useGranotSources,
  useTodayKey,
} from "./use-granot-updates";

const COPY = GRANOT_UPDATES_COPY;
const STATUS_PILL: Record<CheckStatus, PillVariant> = { checking: "blue", awaiting: "amber", applying: "blue", done: "green", done_with_errors: "amber", failed: "red", expired: "gray" };

type PanelPatch = { lead?: string | null; lk?: LeadKind | null; panel?: string | null };

/** The three URL keys of the lead panel (the Leads page shape, `leadsUrlUpdate`, for just these keys). */
function leadPanelUpdate(patch: PanelPatch): UrlStateUpdate {
  const out: UrlStateUpdate = {};
  if ("lead" in patch) out.lead = patch.lead ?? null;
  if ("lk" in patch) out.lk = patch.lk ?? null;
  if ("panel" in patch) out.panel = patch.panel ?? null;
  return out;
}

function useNowMs(): number {
  const subscribe = useCallback((onChange: () => void) => {
    const timer = setInterval(onChange, 30_000);
    return () => clearInterval(timer);
  }, []);
  return useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 30_000) * 30_000, () => 0);
}

type Selection = Map<string, Set<string>> | null;

function syncableIds(run: GranotRun): string[] {
  return (run.actions ?? []).filter((action) => action.syncable === true).map((action) => action.action_id);
}

export function GranotCheckPage({ checkId }: { checkId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const nowMs = useNowMs();
  const todayKey = useTodayKey();
  const facets = useFacetOptions();
  const update = useUrlState(leadPanelUpdate);
  const runsQuery = useGranotRuns();
  const sourcesQuery = useGranotSources();
  const listCheck = runsQuery.data ? checkById(runsQuery.data, checkId) : null;
  const detailA = useGranotRunDetail(listCheck?.runs[0]?.run_id ?? null);
  const detailB = useGranotRunDetail(listCheck?.runs[1]?.run_id ?? null);
  const [selection, setSelection] = useState<Selection>(null);
  const [hideFallback, setHideFallback] = useState(false);
  const [leadType, setLeadType] = useState<LeadTypeFilter>("all");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("ready");
  const [resultTab, setResultTab] = useState<ResultTab>("applied");
  const [confirming, setConfirming] = useState(false);

  const detailed: GranotRun[] = (listCheck?.runs ?? []).map((run, index) => (index === 0 ? detailA.data : index === 1 ? detailB.data : undefined) ?? run);
  const check = listCheck ? checkOf(detailed) : null;
  const detailsLoading = (detailA.isLoading && Boolean(listCheck?.runs[0])) || (detailB.isLoading && Boolean(listCheck?.runs[1]));
  const detailError = detailA.error ?? detailB.error;

  const invalidate = (runs: readonly GranotRun[]) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.granotAutomation.runsPage(GRANOT_RUNS_LIMIT) });
    for (const run of runs) void queryClient.invalidateQueries({ queryKey: queryKeys.granotAutomation.run(run.run_id) });
  };

  const recheck = useMutation({
    mutationFn: async () => {
      const choices = recallCheckChoices(checkId) ?? (check ? checkChoices(check) : null);
      if (!choices) throw new Error(COPY.createFailed);
      return startGranotCheck(choices, sourcesQuery.data ?? []);
    },
    onSuccess: (group) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.granotAutomation.runsPage(GRANOT_RUNS_LIMIT) });
      router.push(granotCheckHref(group.run_group_id));
    },
  });
  const recheckNow = () => recheck.mutate();
  const recheckBusy = recheck.isPending || !sourcesQuery.data;

  const selectedOf = (runId: string): ReadonlySet<string> => {
    if (selection) return selection.get(runId) ?? new Set<string>();
    const run = detailed.find((item) => item.run_id === runId);
    return new Set(run ? syncableIds(run) : []);
  };
  const baseSelection = (): Map<string, Set<string>> => new Map(detailed.map((run) => [run.run_id, new Set(selectedOf(run.run_id))]));
  const onSetSelected = (entries: SelectionEntry[], on: boolean) => {
    const next = baseSelection();
    for (const { runId, actionId } of entries) {
      const set = next.get(runId) ?? new Set<string>();
      if (on) set.add(actionId);
      else set.delete(actionId);
      next.set(runId, set);
    }
    setSelection(next);
  };
  const onHideFallback = (on: boolean) => {
    setHideFallback(on);
    if (!on) return;
    const next = baseSelection();
    for (const run of detailed) for (const action of run.actions ?? []) if (isFallbackMatch(action)) next.get(run.run_id)?.delete(action.action_id);
    setSelection(next);
  };

  const selectedEntries: Array<{ run: GranotRun; action: GranotAction }> = detailed.flatMap((run) => {
    const ids = selectedOf(run.run_id);
    return (run.actions ?? []).filter((action) => action.syncable === true && ids.has(action.action_id)).map((action) => ({ run, action }));
  });

  const approve = useMutation({
    mutationFn: async () => {
      for (const run of detailed) {
        const ids = selectedEntries.filter((entry) => entry.run.run_id === run.run_id).map((entry) => entry.action.action_id);
        if (ids.length === 0) continue;
        await approveGranotRun({ runId: run.run_id, plan_checksum: run.plan_checksum ?? "", selected_action_ids: ids });
      }
    },
    onSuccess: () => setConfirming(false),
    onSettled: () => invalidate(detailed),
  });

  const lead = params.get("lead");
  const lk = params.get("lk") === "call" ? "call" : "form";
  const openLead = (leadId: string, kind: LeadKind) => update({ lead: leadId, lk: kind, panel: "summary" });
  const panelUi = lk === "call" ? "call-leads" : "form-leads";
  const panelConfig = withFacetOptions(operationalConfigs[panelUi], facets);

  const back = (
    <Link href={GRANOT_UPDATES_HREF} className="crm-link">
      {CHECK_COPY.backLabel(COPY.back)}
    </Link>
  );

  if (runsQuery.isError) {
    return (
      <div className="crm-page crm-stack">
        <PageHeader eyebrow={back} title={COPY.title} />
        <ReadFailure what={COPY.loadFailed} error={runsQuery.error} onRetry={() => void runsQuery.refetch()} />
      </div>
    );
  }
  if (!runsQuery.data) {
    return (
      <div className="crm-page crm-stack">
        <PageHeader eyebrow={back} title={COPY.title} />
        <CrmCard>
          <p className="crm-text-muted">{COPY.loading}</p>
          <SkeletonLine width="60%" />
          <SkeletonLine width="80%" />
        </CrmCard>
      </div>
    );
  }
  if (!check) {
    return (
      <div className="crm-page crm-stack">
        <PageHeader eyebrow={back} title={COPY.title} />
        <CrmCard>
          <p>{COPY.notFound}</p>
          <Link href={GRANOT_UPDATES_HREF} className="crm-link">{COPY.back}</Link>
        </CrmCard>
      </div>
    );
  }

  const expires = check.status === "awaiting" ? expiresInWords(check.expires_at, nowMs) : null;
  const hasReceipts = check.receipt_count > 0 || resultCounts(detailed).total > 0;
  const approveError = approve.error;
  const stale = approveError instanceof GranotAutomationApiError && approveError.status === 409;
  const disabledApply = approveError instanceof GranotAutomationApiError && approveError.code === "APPLY_DISABLED";

  let body;
  if (check.status === "checking") body = <CheckProgress runs={detailed} check={check} />;
  else if (check.status === "failed") body = <CheckProgress runs={detailed} check={check} failed onTryAgain={recheckNow} retrying={recheckBusy} />;
  else if (check.status === "awaiting") {
    body = detailError ? (
      <ReadFailure what={COPY.loadFailed} error={detailError} />
    ) : detailsLoading ? (
      <CrmCard>
        <p className="crm-text-muted">{CHECK_COPY.loadingDetail}</p>
        <SkeletonLine width="70%" />
      </CrmCard>
    ) : (
      <>
        {stale ? (
          <Notice icon={Clock} tone="amber" title={COPY.review.stale}>
            <button type="button" className="crm-button crm-button--primary" onClick={recheckNow} disabled={recheckBusy}>{COPY.review.checkAgain}</button>
          </Notice>
        ) : disabledApply ? (
          <Notice icon={Clock} tone="amber" title={COPY.review.applyDisabled} />
        ) : approveError ? (
          <ReadFailure what={COPY.review.approveFailed} error={approveError} />
        ) : null}
        <CheckReview
          check={check}
          runs={detailed}
          tab={reviewTab}
          onTab={setReviewTab}
          selectedOf={selectedOf}
          onSetSelected={onSetSelected}
          hideFallback={hideFallback}
          onHideFallback={onHideFallback}
          leadTypeFilter={leadType}
          onLeadType={setLeadType}
          onOpenLead={openLead}
          onApply={() => setConfirming(true)}
        />
        {confirming ? <ApproveDialog selected={selectedEntries} pending={approve.isPending} onCancel={() => setConfirming(false)} onConfirm={() => approve.mutate()} /> : null}
      </>
    );
  } else if (check.status === "expired") {
    body = (
      <>
        <Notice icon={Clock} tone="amber" title={COPY.review.expired}>
          <button type="button" className="crm-button crm-button--primary" onClick={recheckNow} disabled={recheckBusy}>{COPY.review.checkAgain}</button>
        </Notice>
        {hasReceipts ? <CheckResults check={check} runs={detailed} tab={resultTab} onTab={setResultTab} onOpenLead={openLead} /> : null}
      </>
    );
  } else body = <CheckResults check={check} runs={detailed} tab={resultTab} onTab={setResultTab} onOpenLead={openLead} />;

  return (
    <div className="crm-page crm-stack">
      <PageHeader
        eyebrow={back}
        title={CHECK_COPY.title(windowWords(check.from, check.to, todayKey), check.source_labels.length)}
        subtitle={CHECK_COPY.subtitle(leadTypeWords(check.operations), formatRelative(check.created_at))}
        right={
          <>
            <Pill variant={STATUS_PILL[check.status]}>{COPY.status[check.status]}</Pill>
            {expires ? <span className="crm-small crm-text-muted">{COPY.review.expires(expires)}</span> : null}
          </>
        }
      />
      {recheck.isError ? <ReadFailure what={COPY.createFailed} error={recheck.error} /> : null}
      {body}
      {lead ? (
        <DetailPanel
          config={panelConfig}
          resource={panelUi}
          uiResource={panelUi}
          selected={{ _id: lead, __url_placeholder: true }}
          filters={{ page: 1 }}
          requestedPanel={params.get("panel") ?? undefined}
          onPanelChange={(panel: DetailTabKey) => update({ panel })}
          onClose={() => update({ lead: null, lk: null, panel: null })}
          readOnly={false}
          canDelete={false}
          onRequestDelete={() => undefined}
        />
      ) : null}
    </div>
  );
}
