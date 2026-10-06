"use client";
/** Step 3 (doc 17): four summary cards, one active tab, and the sticky approve bar. Pure over its props. */
import { CircleCheck, CircleHelp, Equal, TriangleAlert } from "lucide-react";
import { Chip, EvidenceChip, Pill, SummaryCard, Tabs } from "@/components/ui/crm/primitives";
import type { GranotAction, GranotRun } from "@/lib/api/granotAutomation";
import { bucketOf, fourBuckets, isFallbackMatch, jobNoOf, matchedBy, type Bucket, type GranotCheck } from "@/lib/automations/granot-updates-model";
import { CHECK_COPY } from "./check-copy";
import { ChangesCell, JobCell, kindOf, LeadCell, type ActionRef, type OpenLead } from "./check-cells";
import { GRANOT_UPDATES_COPY } from "./granot-updates-copy";

const REVIEW = GRANOT_UPDATES_COPY.review;

export type ReviewTab = Bucket | "sources";
export type LeadTypeFilter = "all" | "form" | "call";
export type SelectionEntry = { runId: string; actionId: string };

export type CheckReviewProps = {
  check: GranotCheck;
  runs: GranotRun[];
  tab: ReviewTab;
  onTab: (tab: ReviewTab) => void;
  selectedOf: (runId: string) => ReadonlySet<string>;
  onSetSelected: (entries: SelectionEntry[], on: boolean) => void;
  hideFallback: boolean;
  onHideFallback: (on: boolean) => void;
  leadTypeFilter: LeadTypeFilter;
  onLeadType: (value: LeadTypeFilter) => void;
  onOpenLead: OpenLead;
  onApply: () => void;
};

function rowsOf(runs: readonly GranotRun[], bucket: Bucket, filter: LeadTypeFilter): ActionRef[] {
  const rows: ActionRef[] = [];
  for (const run of runs) {
    if (filter !== "all" && kindOf(run.operation) !== filter) continue;
    for (const action of run.actions ?? []) if (bucketOf(action) === bucket) rows.push({ run, action });
  }
  return rows;
}

function candidateIds(action: GranotAction): string[] {
  const raw = action.preview?.candidates ?? action.preview?.candidate_ids;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (typeof entry === "string") return [entry];
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const id = [record.lead_id, record.id, record._id].find((value): value is string => typeof value === "string");
      return id ? [id] : [];
    }
    return [];
  });
}

function MatchedByCell({ action }: { action: GranotAction }) {
  const match = matchedBy(action);
  const sentence = action.match_method === "phone_only" ? REVIEW.phoneWarning : isFallbackMatch(action) ? REVIEW.fallbackWarning : "";
  const title = [...match.warnings, sentence].filter(Boolean).join(" ");
  return match.warn ? (
    <EvidenceChip state="warn" title={title || undefined}>
      {match.label}
    </EvidenceChip>
  ) : (
    <span title={title || undefined}>{match.label}</span>
  );
}

function ReadyTable({ rows, selectedOf, onSetSelected, onOpenLead }: { rows: ActionRef[]; selectedOf: CheckReviewProps["selectedOf"]; onSetSelected: CheckReviewProps["onSetSelected"]; onOpenLead: OpenLead }) {
  const selectable = rows.filter(({ action }) => action.syncable === true);
  const allOn = selectable.length > 0 && selectable.every(({ run, action }) => selectedOf(run.run_id).has(action.action_id));
  const toEntries = (list: ActionRef[]) => list.map(({ run, action }) => ({ runId: run.run_id, actionId: action.action_id }));
  return (
    <div className="crm-table-wrap">
      <table className="crm-table">
        <thead>
          <tr>
            <th>
              <input type="checkbox" aria-label={REVIEW.selectAll} checked={allOn} disabled={selectable.length === 0} onChange={(event) => onSetSelected(toEntries(selectable), event.target.checked)} />
            </th>
            <th>{REVIEW.columns.job}</th>
            <th>{REVIEW.columns.lead}</th>
            <th>{REVIEW.columns.source}</th>
            <th>{REVIEW.columns.changes}</th>
            <th>{REVIEW.columns.matchedBy}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ run, action }) => (
            <tr key={`${run.run_id}:${action.action_id}`}>
              <td>
                <input
                  type="checkbox"
                  aria-label={REVIEW.selectOne(jobNoOf(action) ?? REVIEW.unknownJob)}
                  checked={selectedOf(run.run_id).has(action.action_id)}
                  disabled={action.syncable !== true}
                  onChange={(event) => onSetSelected(toEntries([{ run, action }]), event.target.checked)}
                />
              </td>
              <td><JobCell action={action} /></td>
              <td><LeadCell action={action} kind={kindOf(run.operation)} onOpenLead={onOpenLead} /></td>
              <td>{action.source_label ?? CHECK_COPY.unknown}</td>
              <td><ChangesCell action={action} /></td>
              <td><MatchedByCell action={action} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WhyTable({ rows, why, withCandidates, onOpenLead }: { rows: ActionRef[]; why: (action: GranotAction) => string; withCandidates: boolean; onOpenLead: OpenLead }) {
  return (
    <div className="crm-table-wrap">
      <table className="crm-table">
        <thead>
          <tr>
            <th>{REVIEW.columns.job}</th>
            <th>{REVIEW.columns.source}</th>
            <th>{REVIEW.columns.reason}</th>
            {withCandidates ? <th>{REVIEW.columns.lead}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ run, action }) => (
            <tr key={`${run.run_id}:${action.action_id}`}>
              <td><JobCell action={action} /></td>
              <td>{action.source_label ?? CHECK_COPY.unknown}</td>
              <td>{why(action)}</td>
              {withCandidates ? (
                <td>
                  <span className="gu-check-candidates">
                    {candidateIds(action).map((id) => (
                      <button key={id} type="button" className="crm-link gu-check-link" onClick={() => onOpenLead(id, kindOf(run.operation))}>
                        {REVIEW.openLead}
                      </button>
                    ))}
                    {action.lead_id ? <LeadCell action={action} kind={kindOf(run.operation)} onOpenLead={onOpenLead} /> : null}
                  </span>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SameList({ rows, onOpenLead }: { rows: ActionRef[]; onOpenLead: OpenLead }) {
  return (
    <details className="gu-check-same">
      <summary>{REVIEW.sameCollapsed(rows.length)}</summary>
      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              <th>{REVIEW.columns.job}</th>
              <th>{REVIEW.columns.lead}</th>
              <th>{REVIEW.columns.source}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ run, action }) => (
              <tr key={`${run.run_id}:${action.action_id}`}>
                <td><JobCell action={action} /></td>
                <td><LeadCell action={action} kind={kindOf(run.operation)} onOpenLead={onOpenLead} /></td>
                <td>{action.source_label ?? CHECK_COPY.unknown}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function SourcesTable({ runs }: { runs: readonly GranotRun[] }) {
  const read = runs.flatMap((run) => (run.collection_summaries ?? []).map((summary) => ({ key: `${run.run_id}:${summary.source_label}`, summary })));
  const missing = [...new Set(runs.flatMap((run) => run.collection?.not_observed_source_labels ?? []))];
  if (read.length === 0 && missing.length === 0) return <p className="crm-empty">{REVIEW.sourcesEmpty}</p>;
  return (
    <div className="crm-table-wrap">
      <table className="crm-table">
        <thead>
          <tr>
            <th>{REVIEW.sourcesColumns.name}</th>
            <th>{REVIEW.sourcesColumns.booked}</th>
            <th>{REVIEW.sourcesColumns.followUp}</th>
            <th>{REVIEW.sourcesColumns.rows}</th>
          </tr>
        </thead>
        <tbody>
          {read.map(({ key, summary }) => (
            <tr key={key}>
              <td>{summary.source_label}</td>
              <td>{summary.booked_jobs}</td>
              <td>{summary.follow_up_estimates}</td>
              <td>{summary.row_count}</td>
            </tr>
          ))}
          {missing.map((label) => (
            <tr key={`missing:${label}`}>
              <td>
                {label} <Pill variant="amber" icon={TriangleAlert}>{REVIEW.notObserved}</Pill>
              </td>
              <td>{CHECK_COPY.sourcesNone}</td>
              <td>{CHECK_COPY.sourcesNone}</td>
              <td>{CHECK_COPY.sourcesNone}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CheckReview(props: CheckReviewProps) {
  const { check, runs, tab, onTab, selectedOf, onSetSelected, hideFallback, onHideFallback, leadTypeFilter, onLeadType, onOpenLead, onApply } = props;
  const buckets = fourBuckets(runs);
  const both = check.operations.length > 1;
  const readyRows = rowsOf(runs, "ready", leadTypeFilter).filter(({ action }) => !(hideFallback && isFallbackMatch(action)));
  let form = 0;
  let call = 0;
  for (const run of runs) {
    const count = (run.actions ?? []).filter((action) => action.syncable === true && selectedOf(run.run_id).has(action.action_id)).length;
    if (kindOf(run.operation) === "call") call += count;
    else form += count;
  }
  const selected = form + call;
  const canApply = selected > 0 && check.status === "awaiting";
  const lookWhy = (action: GranotAction) => (REVIEW.lookReason as Record<string, string>)[action.reason ?? ""] ?? action.summary ?? REVIEW.cannotSelect;
  const missingWhy = (action: GranotAction) => action.summary ?? REVIEW.missingReason;

  let body;
  if (tab === "sources") body = <SourcesTable runs={runs} />;
  else {
    const rows = tab === "ready" ? readyRows : rowsOf(runs, tab, leadTypeFilter);
    if (rows.length === 0) body = <p className="crm-empty">{REVIEW.emptyTab}</p>;
    else if (tab === "ready") body = <ReadyTable rows={rows} selectedOf={selectedOf} onSetSelected={onSetSelected} onOpenLead={onOpenLead} />;
    else if (tab === "look") body = <WhyTable rows={rows} why={lookWhy} withCandidates onOpenLead={onOpenLead} />;
    else if (tab === "missing") body = <WhyTable rows={rows} why={missingWhy} withCandidates={false} onOpenLead={onOpenLead} />;
    else body = <SameList rows={rows} onOpenLead={onOpenLead} />;
  }

  return (
    <div className="gu-check-stack">
      <div className="crm-summary-row">
        <SummaryCard icon={CircleCheck} tone="green" title={REVIEW.cards.ready.title} value={buckets.ready} caption={REVIEW.cards.ready.caption(buckets.readyForm, buckets.readyCall)} />
        <SummaryCard icon={TriangleAlert} tone="amber" title={REVIEW.cards.look.title} value={buckets.look} caption={REVIEW.cards.look.caption} />
        <SummaryCard icon={CircleHelp} tone="gray" title={REVIEW.cards.missing.title} value={buckets.missing} caption={REVIEW.cards.missing.caption} />
        <SummaryCard icon={Equal} tone="blue" title={REVIEW.cards.same.title} value={buckets.same} caption={REVIEW.cards.same.caption} />
      </div>
      <Tabs
        label={CHECK_COPY.reviewTabsLabel}
        value={tab}
        onChange={onTab}
        tabs={[
          { value: "ready", label: REVIEW.tabs.ready, badge: buckets.ready },
          { value: "look", label: REVIEW.tabs.look, badge: buckets.look },
          { value: "missing", label: REVIEW.tabs.missing, badge: buckets.missing },
          { value: "same", label: REVIEW.tabs.same, badge: buckets.same },
          { value: "sources", label: REVIEW.tabs.sources, badge: check.source_labels.length },
        ]}
      />
      {tab !== "sources" && (both || tab === "ready") ? (
        <div className="crm-chips" role="group" aria-label={CHECK_COPY.leadTypeLabel}>
          {both
            ? (["all", "form", "call"] as const).map((value) => (
                <Chip key={value} active={leadTypeFilter === value} onClick={() => onLeadType(value)}>
                  {REVIEW.leadTypeChip[value]}
                </Chip>
              ))
            : null}
          {tab === "ready" ? (
            <Chip active={hideFallback} onClick={() => onHideFallback(!hideFallback)}>
              {REVIEW.hideFallback}
            </Chip>
          ) : null}
        </div>
      ) : null}
      <div className="crm-card">{body}</div>
      <div className="crm-card gu-check-bar">
        <span className="crm-strong">{REVIEW.bar.selected(selected)}</span>
        <span className="crm-text-muted" aria-hidden="true">{" · "}</span>
        <span className="crm-text-muted">{REVIEW.bar.split(form, call)}</span>
        <button type="button" className="crm-button crm-button--primary" disabled={!canApply} onClick={onApply}>
          {selected === 0 ? REVIEW.bar.none : REVIEW.bar.apply(selected)}
        </button>
      </div>
    </div>
  );
}
