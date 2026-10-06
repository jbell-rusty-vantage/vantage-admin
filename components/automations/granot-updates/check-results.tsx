"use client";
/** Step 4 (doc 17): results per lead and per field, with Audit details and Export CSV. */
import { useState } from "react";
import { CircleCheck, Clock, Equal, XCircle } from "lucide-react";
import { RecordDrawer } from "@/components/records";
import { formatAbsolute, formatTime } from "@/components/ui/crm/format";
import { CrmCard, EvidenceChip, SummaryCard, Tabs, Track, type EvidenceState } from "@/components/ui/crm/primitives";
import type { GranotRun } from "@/lib/api/granotAutomation";
import {
  applyProgress,
  notSelectedActions,
  resultCounts,
  resultRows,
  resultsCsv,
  windowWords,
  type GranotCheck,
  type ResultKind,
  type ResultRow,
} from "@/lib/automations/granot-updates-model";
import { CHECK_COPY } from "./check-copy";
import { ChangesCell, JobCell, kindOf, LeadCell, type OpenLead } from "./check-cells";
import { GRANOT_UPDATES_COPY } from "./granot-updates-copy";

const RESULTS = GRANOT_UPDATES_COPY.results;
export type ResultTab = ResultKind | "notSelected";

const EVIDENCE: Record<ResultKind, EvidenceState> = { applied: "ok", same: "none", failed: "bad", pending: "warn" };

/** The only place ids and the full plan checksum appear; inside <details> so the Owner-language check skips it. */
export function AuditDrawer({ row, run, onClose }: { row: ResultRow; run: GranotRun | undefined; onClose: () => void }) {
  const receipt = row.receipt;
  const lines: Array<[string, string]> = [
    [RESULTS.auditRows.receipt, receipt.lifecycle_receipt_id ?? receipt.receipt_id],
    [RESULTS.auditRows.observation, receipt.observation_id ?? CHECK_COPY.unknown],
    [RESULTS.auditRows.decision, receipt.decision_id ?? CHECK_COPY.unknown],
    [RESULTS.auditRows.plan, run?.plan_checksum ?? CHECK_COPY.unknown],
    [RESULTS.auditRows.action, receipt.action_id],
    [RESULTS.auditRows.applied, formatAbsolute(receipt.applied_at)],
    [RESULTS.auditRows.error, receipt.error_code ?? CHECK_COPY.unknown],
  ];
  return (
    <RecordDrawer title={RESULTS.auditTitle} onClose={onClose}>
      <details open>
        <summary className="sr-only">{RESULTS.auditTitle}</summary>
        <dl className="gu-check-audit">
          {lines.map(([label, value]) => (
            <div key={label}>
              <dt className="crm-small crm-text-muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </RecordDrawer>
  );
}

function downloadCsv(runs: readonly GranotRun[], name: string) {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(new Blob([resultsCsv(runs)], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function CheckResults({
  check,
  runs,
  tab,
  onTab,
  onOpenLead,
}: {
  check: GranotCheck;
  runs: GranotRun[];
  tab: ResultTab;
  onTab: (tab: ResultTab) => void;
  onOpenLead: OpenLead;
}) {
  const [audit, setAudit] = useState<ResultRow | null>(null);
  const counts = resultCounts(runs);
  const notSelected = notSelectedActions(runs);
  const rows = resultRows(runs);
  const latest = runs.map((run) => run.receipts?.map((receipt) => receipt.applied_at).find(Boolean) ?? run.updated_at).filter(Boolean).sort().pop();
  const progress = applyProgress(runs);
  const title = RESULTS.title(windowWords(check.from, check.to), formatTime(latest));
  const shown = tab === "notSelected" ? [] : rows.filter((row) => row.kind === tab);

  if (counts.total === 0 && notSelected.length === 0) {
    return (
      <CrmCard title={title}>
        <p className="crm-empty">{RESULTS.none}</p>
      </CrmCard>
    );
  }

  return (
    <div className="gu-check-stack">
      <p className="crm-strong">{title}</p>
      {check.status === "applying" ? (
        <div className="gu-check-stack">
          <Track progress={progress.total > 0 ? progress.done / progress.total : null} label={CHECK_COPY.applyLabel} />
          <p className="crm-small">{RESULTS.applying(progress.done, progress.total)}</p>
        </div>
      ) : null}
      <div className="crm-summary-row">
        <SummaryCard icon={CircleCheck} tone="green" title={RESULTS.cards.applied} value={counts.applied} />
        <SummaryCard icon={Equal} tone="blue" title={RESULTS.cards.same} value={counts.same} />
        <SummaryCard icon={XCircle} tone="red" title={RESULTS.cards.failed} value={counts.failed} />
        <SummaryCard icon={Clock} tone="gray" title={RESULTS.cards.pending} value={counts.pending} />
      </div>
      <div className="gu-check-tabs-row">
        <Tabs
          label={CHECK_COPY.resultsTabsLabel}
          value={tab}
          onChange={onTab}
          tabs={[
            { value: "applied", label: RESULTS.tabs.applied, badge: counts.applied },
            { value: "same", label: RESULTS.tabs.same, badge: counts.same },
            { value: "failed", label: RESULTS.tabs.failed, badge: counts.failed },
            { value: "pending", label: RESULTS.tabs.pending, badge: counts.pending },
            { value: "notSelected", label: RESULTS.tabs.notSelected, badge: notSelected.length },
          ]}
        />
        <button type="button" className="crm-button crm-button--sm" onClick={() => downloadCsv(runs, RESULTS.csvName(CHECK_COPY.checkWindowKey(check.from, check.to)))}>
          {RESULTS.exportCsv}
        </button>
      </div>
      <div className="crm-card">
        {tab === "notSelected" ? (
          <>
            <p className="crm-small crm-text-muted gu-check-hint">{RESULTS.notSelectedHint}</p>
            {notSelected.length === 0 ? (
              <p className="crm-empty">{RESULTS.empty}</p>
            ) : (
              <div className="crm-table-wrap">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>{RESULTS.columns.job}</th>
                      <th>{RESULTS.columns.lead}</th>
                      <th>{RESULTS.columns.changes}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notSelected.map(({ run, action }) => (
                      <tr key={`${run.run_id}:${action.action_id}`}>
                        <td><JobCell action={action} /></td>
                        <td><LeadCell action={action} kind={kindOf(run.operation)} onOpenLead={onOpenLead} /></td>
                        <td><ChangesCell action={action} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : shown.length === 0 ? (
          <p className="crm-empty">{RESULTS.empty}</p>
        ) : (
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>{RESULTS.columns.job}</th>
                  <th>{RESULTS.columns.lead}</th>
                  <th>{RESULTS.columns.changes}</th>
                  <th>{RESULTS.columns.result}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.key}>
                    <td>{row.action ? <JobCell action={row.action} /> : <strong className="crm-strong">{row.job_no ?? CHECK_COPY.unknown}</strong>}</td>
                    <td>{row.action ? <LeadCell action={row.action} kind={kindOf(row.operation)} onOpenLead={onOpenLead} /> : CHECK_COPY.unknown}</td>
                    <td>{row.action ? <ChangesCell action={row.action} /> : CHECK_COPY.unknown}</td>
                    <td>
                      <EvidenceChip state={EVIDENCE[row.kind]}>
                        {row.receipt.applied_at ? RESULTS.resultAt(row.words, formatTime(row.receipt.applied_at)) : row.words}
                      </EvidenceChip>
                    </td>
                    <td>
                      <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={() => setAudit(row)}>
                        {RESULTS.audit}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {audit ? <AuditDrawer row={audit} run={runs.find((run) => run.run_id === audit.run_id)} onClose={() => setAudit(null)} /> : null}
    </div>
  );
}
