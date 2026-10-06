"use client";
/**
 * The Lead costs grid (`?view=grid`): one row per feed, grouped by source company, one effective date, one Save. The
 * rules are the old Simple editor's, kept: the drafts diff against the snapshot (`computeSimpleCplChanges`), the
 * expected revision of every changed row rides in the command (`buildSimpleCplInput`), a stale revision reloads the
 * snapshot and keeps the drafts. Missing is a state in words, never $0.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { formatMoney, formatShortDate } from "@/components/ui/crm/format";
import { CrmCard, Pill, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import { floridaCalendarDateInputValue } from "@/lib/floridaTime";
import {
  applySimpleCplSchedule,
  buildSimpleCplInput,
  computeSimpleCplChanges,
  cplRowState,
  currentCplSince,
  fetchCplPeriods,
  fetchCplSnapshot,
  groupCplSnapshotByCompany,
  isRegistryStaleRevisionError,
  parseCplAmountInput,
  snapshotCurrentAmount,
  type CplCompanyGroup,
  type CplSnapshotItem,
} from "@/lib/api/registryCpl";
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import { fetchSourceCompanies } from "@/lib/api/registrySources";
import { queryKeys } from "@/lib/query/keys";
import { LeadCostError } from "./lead-cost-error";
import { LEAD_COSTS_COPY } from "./lead-costs-copy";

const COPY = LEAD_COSTS_COPY.grid;

export function feedDisplayName(item: CplSnapshotItem): string {
  return item.source_granularity.owner_label;
}

function CurrentCell({ item }: { item: CplSnapshotItem }) {
  const state = cplRowState(item.current_rate);
  if (state.kind === "resolved") return <span className="lc-amount">{formatMoney(state.amount, { cents: true })}</span>;
  if (state.kind === "not_needed") return <span className="crm-text-muted">{COPY.notNeeded}</span>;
  if (state.kind === "recorded_twice") {
    return (
      <Pill variant="amber" icon={TriangleAlert} title={COPY.recordedTwiceHint}>
        {COPY.recordedTwice}
      </Pill>
    );
  }
  return (
    <Pill variant="amber" icon={TriangleAlert} title={COPY.missingHint}>
      {COPY.missing}
    </Pill>
  );
}

export type LeadCostsGridTableProps = {
  groups: CplCompanyGroup[];
  /** Start date of each feed's current period; a feed absent from the map has not loaded yet. */
  sinceByFeed: Readonly<Record<string, string | null>>;
  drafts: Readonly<Record<string, string>>;
  onDraft: (feedId: string, value: string) => void;
  readOnly: boolean;
  /** The feed the *Set lead cost* deep link points at (its New amount input takes focus). */
  focusFeedId: string | null;
};

function GridTable({ groups, ...rest }: LeadCostsGridTableProps) {
  return (
    <div className="crm-table-wrap">
      <table className="crm-table lc-table">
        <thead>
          <tr>
            <th scope="col">{COPY.columns.company}</th>
            <th scope="col">{COPY.columns.feed}</th>
            <th scope="col">{COPY.columns.channel}</th>
            <th scope="col">{COPY.columns.current}</th>
            <th scope="col">{COPY.columns.since}</th>
            <th scope="col">{COPY.columns.next}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupRows key={group.companyId} group={group} {...rest} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  group,
  sinceByFeed,
  drafts,
  onDraft,
  readOnly,
  focusFeedId,
}: Omit<LeadCostsGridTableProps, "groups"> & { group: CplCompanyGroup }) {
  return (
    <>
      <tr className="lc-group">
        <th scope="colgroup" colSpan={6}>
          {group.companyName}
        </th>
      </tr>
      {group.items.map((item) => {
        const feed = item.source_granularity;
        const baseline = snapshotCurrentAmount(item.current_rate);
        const draft = drafts[feed.id];
        const value = draft ?? (baseline === null ? "" : String(baseline));
        const invalid = draft !== undefined && draft.trim() !== "" && parseCplAmountInput(draft) === null;
        const missing = cplRowState(item.current_rate).kind === "missing";
        const since = sinceByFeed[feed.id];
        return (
          <tr key={feed.id} className="lc-row" data-focused={focusFeedId === feed.id ? "true" : undefined}>
            <td />
            <td>
              <span className="crm-strong">{feedDisplayName(item)}</span>
              {feed.local ? <span className="crm-text-muted"> · {COPY.local[feed.local]}</span> : null}
            </td>
            <td>{COPY.channel[feed.channel]}</td>
            <td>
              <CurrentCell item={item} />
            </td>
            <td className="crm-text-muted">
              {since === undefined || since === null ? (missing ? "" : COPY.sinceUnknown) : formatShortDate(`${since}T12:00:00Z`)}
            </td>
            <td>
              <input
                className="crm-input lc-input"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                data-lc-feed={feed.id}
                aria-label={COPY.inputLabel(feedDisplayName(item))}
                aria-invalid={invalid || undefined}
                placeholder={missing ? COPY.missing : COPY.inputPlaceholder}
                value={value}
                disabled={readOnly}
                onChange={(event) => onDraft(feed.id, event.target.value)}
              />
            </td>
          </tr>
        );
      })}
    </>
  );
}

/** The pure grid body: active feeds, then (when opened) the feeds that are off. */
export function LeadCostsGridView({
  offGroups,
  showOff,
  onToggleOff,
  ...table
}: LeadCostsGridTableProps & { offGroups: CplCompanyGroup[]; showOff: boolean; onToggleOff: () => void }) {
  const offCount = offGroups.reduce((sum, group) => sum + group.items.length, 0);
  return (
    <>
      {table.groups.length === 0 ? <p className="crm-empty">{COPY.empty}</p> : <GridTable {...table} />}
      {offCount > 0 ? (
        <div className="lc-off">
          <button type="button" className="crm-linkbutton" aria-expanded={showOff} onClick={onToggleOff}>
            {showOff ? COPY.offHide : COPY.offToggle(offCount)}
          </button>
          {showOff ? <GridTable {...table} groups={offGroups} /> : null}
        </div>
      ) : null}
    </>
  );
}

export function LeadCostsGrid({ readOnly, focusFeedId }: { readOnly: boolean; focusFeedId: string | null }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [effectiveDate, setEffectiveDate] = useState(() => floridaCalendarDateInputValue());
  const [reason, setReason] = useState("");
  const [showOff, setShowOff] = useState(false);
  const [mutationError, setMutationError] = useState<unknown>(null);
  const [savedFrom, setSavedFrom] = useState<string | null>(null);
  const focusedFor = useRef<string | null>(null);

  const snapshotQuery = useQuery({ queryKey: queryKeys.operationsRegistry.cplSnapshot(), queryFn: fetchCplSnapshot });
  const companiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceCompanies(true),
    queryFn: () => fetchSourceCompanies({ includeInactive: true }),
  });
  const snapshot = snapshotQuery.data;
  const today = floridaCalendarDateInputValue();

  const periodQueries = useQueries({
    queries: (snapshot?.items ?? []).map((item) => ({
      queryKey: queryKeys.operationsRegistry.cplPeriods(item.source_granularity.id),
      queryFn: () => fetchCplPeriods(item.source_granularity.id),
      enabled: cplRowState(item.current_rate).kind === "resolved",
    })),
  });

  const saveMutation = useMutation({
    mutationFn: applySimpleCplSchedule,
    onSuccess: async (_result, body) => {
      await invalidateRegistryQueries(queryClient);
      setDrafts({});
      setMutationError(null);
      setSavedFrom(body.effective_date);
    },
    onError: async (error) => {
      setMutationError(error);
      setSavedFrom(null);
      // Keep the drafts; reload the revisions so the retry carries the current expected revisions.
      if (isRegistryStaleRevisionError(error)) await snapshotQuery.refetch();
    },
  });

  const companyNames = new Map((companiesQuery.data ?? []).map((company) => [company.id, company.owner_label || company.name]));
  const items = snapshot?.items ?? [];
  const groupsOf = (list: CplSnapshotItem[]) => groupCplSnapshotByCompany(list, (id) => companyNames.get(id) ?? COPY.noCompany);
  const activeGroups = groupsOf(items.filter((item) => item.source_granularity.active !== false));
  const offGroups = groupsOf(items.filter((item) => item.source_granularity.active === false));
  const focusIsOff = offGroups.some((group) => group.items.some((item) => item.source_granularity.id === focusFeedId));
  const offOpen = showOff || focusIsOff;

  const sinceByFeed: Record<string, string | null> = {};
  items.forEach((item, index) => {
    const result = periodQueries[index];
    if (result?.data) {
      const periodId = item.current_rate.status === "resolved" ? item.current_rate.period_id : undefined;
      sinceByFeed[item.source_granularity.id] = currentCplSince(result.data.periods, today, periodId);
    }
  });

  const changes = snapshot ? computeSimpleCplChanges(snapshot, drafts) : [];
  const invalidCount = Object.values(drafts).filter((value) => value.trim() !== "" && parseCplAmountInput(value) === null).length;

  useEffect(() => {
    if (!focusFeedId || !snapshot || focusedFor.current === focusFeedId) return;
    const input = document.querySelector<HTMLInputElement>(`[data-lc-feed="${CSS.escape(focusFeedId)}"]`);
    if (!input) return;
    focusedFor.current = focusFeedId;
    input.scrollIntoView({ block: "center" });
    input.focus();
  }, [focusFeedId, snapshot, offOpen]);

  if (snapshotQuery.isPending) {
    return (
      <CrmCard title={COPY.title} subtitle={COPY.subtitle}>
        <div className="lc-loading" aria-label={COPY.loading}>
          <SkeletonLine width="70%" />
          <SkeletonLine width="90%" />
          <SkeletonLine width="60%" />
        </div>
      </CrmCard>
    );
  }
  if (snapshotQuery.isError) {
    return <ReadFailure what={COPY.readFailure} error={snapshotQuery.error} onRetry={() => void snapshotQuery.refetch()} />;
  }

  const save = LEAD_COSTS_COPY.save;
  return (
    <CrmCard title={COPY.title} subtitle={COPY.subtitle}>
      {savedFrom ? (
        <p className="lc-saved" role="status">
          {save.savedFrom(formatShortDate(`${savedFrom}T12:00:00Z`))}
        </p>
      ) : null}
      {mutationError ? <LeadCostError error={mutationError} staleRevisionCopy={save.staleRevision} /> : null}
      <LeadCostsGridView
        groups={activeGroups}
        offGroups={offGroups}
        showOff={offOpen}
        onToggleOff={() => setShowOff((open) => !open)}
        sinceByFeed={sinceByFeed}
        drafts={drafts}
        onDraft={(feedId, value) => {
          setSavedFrom(null);
          setDrafts((current) => ({ ...current, [feedId]: value }));
        }}
        readOnly={readOnly}
        focusFeedId={focusFeedId}
      />
      {!readOnly ? (
        <div className="lc-savebar">
          <label className="lc-field">
            <span className="su-row__label">{save.dateLabel}</span>
            <input className="su-input" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
          </label>
          <label className="lc-field lc-field--grow">
            <span className="su-row__label">{save.reasonLabel}</span>
            <input className="su-input" value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <div className="lc-savebar__go">
            <button
              type="button"
              className="crm-button crm-button--primary"
              disabled={changes.length === 0 || saveMutation.isPending || !effectiveDate}
              onClick={() => saveMutation.mutate(buildSimpleCplInput(changes, effectiveDate, reason))}
            >
              {saveMutation.isPending ? save.saving : save.button(changes.length)}
            </button>
            <span className="su-quiet">
              {invalidCount > 0 ? save.invalidAmounts(invalidCount) : changes.length === 0 ? save.nothingToSave : save.dateHint}
            </span>
          </div>
        </div>
      ) : null}
    </CrmCard>
  );
}
