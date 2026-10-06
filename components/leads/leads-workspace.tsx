"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, FileText, ListChecks, Phone, Plus, ShieldCheck, SlidersHorizontal, Users, X } from "lucide-react";
import { CreateLeadForm } from "@/components/manual/create-lead-form";
import { DASHBOARD_MAIN_ID } from "@/components/layout/dashboard-ids";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { operationalConfigs, withFacetOptions } from "@/components/operational/operational-configs";
import { DetailPanel } from "@/components/operational/operational-detail-panel";
import { duplicateReadOnlyBannerCopy } from "@/components/operational/operational-copy";
import { invalidateOperationalMutations } from "@/components/operational/operational-helpers";
import { SheetContainsPanel } from "@/components/operational/sheet-contains-panel";
import type { DetailTabKey } from "@/components/operational/visible-detail-tabs";
import { formatCount } from "@/components/ui/crm/format";
import {
  Chip,
  CrmCard,
  CrmSelect,
  DensityToggle,
  Notice,
  PageHeader,
  ReadFailure,
  RemovableChip,
  SearchBox,
  Segmented,
  SkeletonLine,
  SummaryCard,
  useDensity,
} from "@/components/ui/crm/primitives";
import {
  checkSheetContains,
  fetchAdminDetail,
  fetchAdminList,
  getRecordId,
  updateLeadNoSync,
  updateProductionRecord,
  type AdminRecord,
  type SheetContainsEntityModel,
  type SheetContainsItem,
  type SheetContainsResult,
} from "@/lib/api/admin";
import { useFacetOptions } from "@/lib/api/facets";
import {
  effectiveLeadKinds,
  leadClientNarrowing,
  leadListFilters,
  mergeLeadPages,
  tagLeadItems,
  type LeadItem,
  type LeadKind,
  type LeadSort,
  type LeadStatus,
  type LeadShow,
} from "@/lib/api/leads";
import { applyUrlStateUpdate } from "@/lib/api/url-state-update";
import { LOCAL_TYPE_OPTIONS, MOVE_SIZE_OPTIONS } from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";
import { SHEET_CONTAINS_MAX_IDS } from "@/lib/sheet-contains";
import { LeadCard } from "./lead-card";
import { isBadLead, isUnassigned } from "./lead-card-model";
import { LEADS_COPY } from "./leads-copy";
import { activeLeadFilters, CLEAR_ALL_FILTERS, leadsUrlUpdate, parseLeadsUrl, type LeadsUrlState } from "./leads-url";

const MIN_VISIBLE_BEFORE_SCROLL = 25;

function useLeadList(kind: LeadKind, enabled: boolean, filters: ReturnType<typeof leadListFilters>) {
  const resource = kind === "form" ? "form-leads" : "call-leads";
  return useInfiniteQuery({
    queryKey: queryKeys.lists.resource(`leads-${kind}`, filters),
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchAdminList<AdminRecord>(resource, { ...filters, page: Number(pageParam) }),
    getNextPageParam: (lastPage) => (lastPage.has_next_page ? lastPage.page + 1 : undefined),
  });
}

function scrollRoot(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.getElementById(DASHBOARD_MAIN_ID);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function LeadsWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const facets = useFacetOptions();
  const role = useDashboardRole();
  const isOwner = role === "owner";
  const [density, setDensity] = useDensity(LEADS_COPY.density);

  const state = useMemo(() => parseLeadsUrl(searchParams), [searchParams]);

  // Several updates in one tick (a filter plus its dependent feed) must build on each other, so keep the latest query.
  const latestQuery = useRef(searchParams.toString());
  const pendingPush = useRef(false);
  useEffect(() => {
    const current = searchParams.toString();
    if (current === latestQuery.current) {
      pendingPush.current = false;
      return;
    }
    if (!pendingPush.current) latestQuery.current = current;
  }, [searchParams]);
  const update = useCallback(
    (patch: Partial<LeadsUrlState>, options: { replace?: boolean } = {}) => {
      const params = applyUrlStateUpdate(latestQuery.current, leadsUrlUpdate(patch));
      const query = params.toString();
      latestQuery.current = query;
      pendingPush.current = true;
      const href = query ? `${pathname}?${query}` : pathname;
      if (options.replace) router.replace(href);
      else router.push(href);
    },
    [pathname, router],
  );

  // ---- Catalog: source granularities (grouped by Source Company), roster -------------------------------------
  const catalog = facets.catalog;
  const companies = useMemo(() => (catalog?.source_companies ?? []).filter((row) => row.company_slug), [catalog]);
  const granularities = useMemo(() => catalog?.source_granularities ?? [], [catalog]);
  const companyLabelBySlug = useMemo(
    () => new Map(companies.map((row) => [row.company_slug.toLowerCase(), row.owner_label])),
    [companies],
  );
  // Every feed is selectable, even on All leads; a picked kind only hides the other channel's feeds.
  const feedRows = useMemo(
    () => granularities.filter((row) => !state.kind || !row.channel || row.channel === state.kind),
    [granularities, state.kind],
  );
  const feedChannel = state.feed ? (granularities.find((row) => row.granularity_key === state.feed)?.channel ?? null) : null;
  const rosterAll = facets.agentIdOptions;
  const rosterActive = useMemo(
    () => (catalog?.agents ?? []).filter((agent) => agent.active && agent.id).map((agent) => ({ value: agent.id, label: agent.name })),
    [catalog],
  );
  const agentLabelById = useMemo(() => new Map(rosterAll.map((option) => [option.value, option.label])), [rosterAll]);

  // ---- The two lists ----------------------------------------------------------------------------------------
  const kinds = effectiveLeadKinds(state, feedChannel);
  const formEnabled = kinds.includes("form");
  const callEnabled = kinds.includes("call");
  const formFilters = useMemo(() => leadListFilters(state, "form"), [state]);
  const callFilters = useMemo(() => leadListFilters(state, "call"), [state]);
  const formQuery = useLeadList("form", formEnabled, formFilters);
  const callQuery = useLeadList("call", callEnabled, callFilters);

  const formItems = useMemo(
    () => (formEnabled ? tagLeadItems(formQuery.data?.pages.flatMap((page) => page.items) ?? [], "form") : []),
    [formEnabled, formQuery.data],
  );
  const callItems = useMemo(
    () => (callEnabled ? tagLeadItems(callQuery.data?.pages.flatMap((page) => page.items) ?? [], "call") : []),
    [callEnabled, callQuery.data],
  );
  const formExhausted = !formEnabled || formQuery.isError || (formQuery.isSuccess && !formQuery.hasNextPage);
  const callExhausted = !callEnabled || callQuery.isError || (callQuery.isSuccess && !callQuery.hasNextPage);
  const merged = useMemo(
    () => mergeLeadPages(formItems, callItems, { sort: state.sort, formExhausted, callExhausted }),
    [formItems, callItems, state.sort, formExhausted, callExhausted],
  );
  const narrowing = leadClientNarrowing(state);
  const visibleItems = useMemo(
    () =>
      merged.items.filter((item) => (!narrowing.bad || isBadLead(item)) && (!narrowing.unassigned || isUnassigned(item))),
    [merged.items, narrowing.bad, narrowing.unassigned],
  );

  const frontierQuery = merged.frontier === "form" ? formQuery : merged.frontier === "call" ? callQuery : null;
  const canFetchMore = Boolean(frontierQuery?.hasNextPage && !frontierQuery.isFetchingNextPage);
  // The sentinel reads the latest frontier through refs (written in an effect, never during render).
  const fetchMoreRef = useRef<() => void>(() => undefined);
  const canFetchRef = useRef(false);
  useEffect(() => {
    fetchMoreRef.current = () => {
      void frontierQuery?.fetchNextPage();
    };
    canFetchRef.current = canFetchMore;
  });

  // Keep filling until the first screen has cards, then let the sentinel drive the rest.
  useEffect(() => {
    if (canFetchMore && visibleItems.length < MIN_VISIBLE_BEFORE_SCROLL) fetchMoreRef.current();
  }, [canFetchMore, visibleItems.length]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !canFetchMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && canFetchRef.current) fetchMoreRef.current();
      },
      { root: scrollRoot(), rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canFetchMore, visibleItems.length]);

  const isLoading = (formEnabled && formQuery.isLoading) || (callEnabled && callQuery.isLoading);
  const loadError = (formEnabled && formQuery.isError ? formQuery.error : null) ?? (callEnabled && callQuery.isError ? callQuery.error : null);

  const lastTotal = (query: typeof formQuery) => query.data?.pages[query.data.pages.length - 1]?.total;
  const formTotal = formEnabled ? lastTotal(formQuery) : 0;
  const callTotal = callEnabled ? lastTotal(callQuery) : 0;
  const totalsExact = !narrowing.bad && !narrowing.unassigned;
  const sumTotal = typeof formTotal === "number" && typeof callTotal === "number" ? formTotal + callTotal : null;

  // ---- Panel ------------------------------------------------------------------------------------------------
  const resolveQuery = useQuery({
    queryKey: ["leads", "resolve-kind", state.lead],
    enabled: Boolean(state.lead) && !state.lk,
    retry: false,
    queryFn: async (): Promise<LeadKind> => {
      try {
        await fetchAdminDetail("form-leads", state.lead!);
        return "form";
      } catch {
        await fetchAdminDetail("call-leads", state.lead!);
        return "call";
      }
    },
  });
  useEffect(() => {
    if (state.lead && !state.lk && resolveQuery.data) update({ lk: resolveQuery.data }, { replace: true });
  }, [resolveQuery.data, state.lead, state.lk, update]);

  const panelKind: LeadKind | null = state.lead ? state.lk : null;
  const panelRecord = useMemo<AdminRecord | null>(() => {
    if (!state.lead || !panelKind) return null;
    const pool = panelKind === "form" ? formItems : callItems;
    return pool.find((item) => getRecordId(item) === state.lead) ?? { _id: state.lead, __url_placeholder: true };
  }, [state.lead, panelKind, formItems, callItems]);
  const panelUiResource = panelKind === "call" ? (state.show === "duplicates" ? "duplicate-call-leads" : "call-leads") : state.show === "duplicates" ? "duplicate-form-leads" : "form-leads";
  const panelConfig = useMemo(() => withFacetOptions(operationalConfigs[panelUiResource], facets), [panelUiResource, facets]);
  const openLead = useCallback(
    (item: LeadItem) => update({ lead: getRecordId(item), lk: item.__kind, panel: "summary" }, { replace: false }),
    [update],
  );
  const closePanel = useCallback(() => update({ lead: null, lk: null, panel: null }), [update]);
  const onPanelChange = useCallback((panel: DetailTabKey) => update({ panel }), [update]);

  // ---- Card actions -----------------------------------------------------------------------------------------
  const [actionError, setActionError] = useState<string | null>(null);
  const assignMutation = useMutation({
    mutationFn: ({ item, agentId }: { item: LeadItem; agentId: string }) =>
      // The Desk `assign` command (source manual) is server work; this is the same write the panel's Edit tab makes.
      updateProductionRecord(item.__kind === "form" ? "form-leads" : "call-leads", getRecordId(item), {
        receiver_agent: agentId,
        receiver_agent_source: "manual",
      }),
    onSuccess: async () => {
      setActionError(null);
      await invalidateOperationalMutations(queryClient);
    },
    onError: (error) => setActionError(errorMessage(error, "Assign failed.")),
  });
  const hideMutation = useMutation({
    mutationFn: (item: LeadItem) =>
      updateLeadNoSync(item.__kind === "form" ? "form-leads" : "call-leads", getRecordId(item), item.no_sync !== true),
    onSuccess: async () => {
      setActionError(null);
      await invalidateOperationalMutations(queryClient);
    },
    onError: (error) => setActionError(errorMessage(error, "Update failed.")),
  });

  // ---- Verify in Master Sheet -------------------------------------------------------------------------------
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [verdicts, setVerdicts] = useState<ReadonlyMap<string, SheetContainsItem>>(() => new Map());
  const [verifyResult, setVerifyResult] = useState<SheetContainsResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const kindById = new Map<string, LeadKind>([...formItems, ...callItems].map((item) => [getRecordId(item), item.__kind]));
  // Plain function: the React Compiler memoizes it (a manual useCallback with [] mismatched its inferred deps).
  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        if (next.size >= SHEET_CONTAINS_MAX_IDS && !next.has(id)) return current;
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };
  const selectAllVisible = () =>
    setSelectedIds(new Set(visibleItems.slice(0, SHEET_CONTAINS_MAX_IDS).map((item) => getRecordId(item))));
  const verifyMutation = useMutation({
    mutationFn: async (): Promise<SheetContainsResult> => {
      const byModel = new Map<SheetContainsEntityModel, string[]>();
      for (const id of selectedIds) {
        const model: SheetContainsEntityModel = kindById.get(id) === "call" ? "CallLead" : "FormLead";
        byModel.set(model, [...(byModel.get(model) ?? []), id]);
      }
      const results = await Promise.all([...byModel].map(([entity_model, ids]) => checkSheetContains({ entity_model, ids })));
      return {
        entity_model: results[0]?.entity_model ?? "FormLead",
        checked_at: results[0]?.checked_at ?? new Date().toISOString(),
        items: results.flatMap((result) => result.items),
      };
    },
    onSuccess: (result) => {
      setVerifyError(null);
      setVerifyResult(result);
      setVerifyOpen(true);
      setVerdicts((current) => {
        const next = new Map(current);
        for (const item of result.items) next.set(item.id, item);
        return next;
      });
    },
    onError: (error) => {
      setVerifyResult(null);
      setVerifyError(errorMessage(error, "Google Sheet check failed."));
      setVerifyOpen(true);
    },
  });
  const exitSelect = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // ---- Filter row -------------------------------------------------------------------------------------------
  const [moreOpen, setMoreOpen] = useState(false);
  const chips = activeLeadFilters(state, {
    company: (slug) => companyLabelBySlug.get(slug.toLowerCase()),
    feed: (key) => facets.granularityLabelByKey.get(key.toLowerCase()),
    agent: (id) => agentLabelById.get(id),
    local: (value) => LOCAL_TYPE_OPTIONS.find((option) => option.value === value)?.label,
  });
  const hasFilters = chips.length > 0 || Boolean(state.q);
  const clearAll = () => update(CLEAR_ALL_FILTERS);
  const feedOptions = [
    { value: "", label: LEADS_COPY.sourceAll },
    ...feedRows.map((row) => ({
      value: row.granularity_key,
      label: row.owner_label,
      group: row.company_owner_label || companyLabelBySlug.get(row.company_slug.toLowerCase()) || row.company_slug,
    })),
  ];
  const agentOptions = [
    { value: "", label: LEADS_COPY.agentAll },
    { value: "unassigned", label: LEADS_COPY.agentUnassigned },
    ...rosterAll.map((option) => ({ value: option.value, label: option.label })),
  ];
  const clientNarrowed = narrowing.bad || narrowing.unassigned;
  const needsFeedNote = Boolean(state.company && !state.feed);

  return (
    <div className="crm-page" style={{ padding: 0 }} data-testid="leads-workspace">
      <PageHeader
        title={LEADS_COPY.title}
        subtitle={LEADS_COPY.subtitle}
        help={LEADS_COPY.help}
        right={
          <>
            {isOwner ? (
              <button
                type="button"
                className="crm-button crm-button--quiet"
                aria-pressed={selectMode}
                onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              >
                <ShieldCheck aria-hidden="true" width={16} height={16} />
                {selectMode ? LEADS_COPY.verifyDone : LEADS_COPY.verify}
              </button>
            ) : null}
            <button type="button" className="crm-button crm-button--primary" onClick={() => update({ isNew: true })}>
              <Plus aria-hidden="true" width={16} height={16} />
              {LEADS_COPY.newLead}
            </button>
          </>
        }
      />

      <div className="crm-toolbar">
        <div style={{ flex: 1, minWidth: 260 }}>
          <SearchBox value={state.q} onSearch={(q) => update({ q })} placeholder={LEADS_COPY.searchPlaceholder} />
        </div>
        <CrmSelect<LeadSort> label={LEADS_COPY.sortLabel} value={state.sort} options={LEADS_COPY.sortOptions} onChange={(sort) => update({ sort })} />
      </div>

      <div className="crm-toolbar">
        <Segmented<"all" | LeadKind>
          label={LEADS_COPY.kindLabel}
          value={state.kind ?? "all"}
          options={LEADS_COPY.kindOptions}
          onChange={(kind) => {
            // A feed of the other channel cannot survive the kind switch; any other feed stays picked.
            const keepFeed = !state.feed || kind === "all" || !feedChannel || feedChannel === kind;
            update({ kind: kind === "all" ? null : kind, ...(keepFeed ? {} : { feed: null }) });
          }}
        />
        <Segmented<LeadStatus>
          label={LEADS_COPY.statusLabel}
          value={state.status}
          options={LEADS_COPY.statusOptions}
          onChange={(status) => update({ status })}
        />
        <CrmSelect
          label={LEADS_COPY.sourceLabel}
          value={state.feed ?? ""}
          options={feedOptions}
          active={Boolean(state.feed)}
          onChange={(feed) => update({ feed: feed || null, company: null })}
        />
        <CrmSelect
          label={LEADS_COPY.agentLabel}
          value={state.agent ?? ""}
          options={agentOptions}
          active={Boolean(state.agent)}
          onChange={(agent) => update({ agent: agent || null })}
        />
        <CrmSelect<LeadShow>
          label={LEADS_COPY.showLabel}
          value={state.show}
          options={LEADS_COPY.showOptions}
          active={state.show !== "regular"}
          onChange={(show) => update({ show })}
        />
        <Chip icon={SlidersHorizontal} active={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
          {LEADS_COPY.moreFilters}
        </Chip>
        <span className="crm-toolbar__spacer" />
        <DensityToggle value={density} onChange={setDensity} />
      </div>

      {moreOpen ? (
        <CrmCard title={LEADS_COPY.moreFilters} testId="leads-more-filters">
          <div className="crm-toolbar">
            <CrmSelect
              label={LEADS_COPY.dateOn}
              value={state.dateField}
              options={LEADS_COPY.dateOptions as unknown as { value: "timestamp" | "move_date"; label: string }[]}
              onChange={(dateField) => update({ dateField })}
            />
            <label className="crm-toolbar">
              <span className="sr-only">{LEADS_COPY.dateFrom}</span>
              <input type="date" className="crm-input" aria-label={LEADS_COPY.dateFrom} value={state.from ?? ""} onChange={(event) => update({ from: event.target.value || null })} />
            </label>
            <label className="crm-toolbar">
              <span className="sr-only">{LEADS_COPY.dateTo}</span>
              <input type="date" className="crm-input" aria-label={LEADS_COPY.dateTo} value={state.to ?? ""} onChange={(event) => update({ to: event.target.value || null })} />
            </label>
            <CrmSelect
              label={LEADS_COPY.hiddenLabel}
              value={state.noSync}
              options={LEADS_COPY.hiddenOptions as unknown as { value: "any" | "yes" | "no"; label: string }[]}
              active={state.noSync !== "any"}
              onChange={(noSync) => update({ noSync })}
            />
            <CrmSelect
              label={LEADS_COPY.moveSizeLabel}
              value={state.moveSize ?? ""}
              options={[{ value: "", label: LEADS_COPY.moveSizeAny }, ...MOVE_SIZE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))]}
              active={Boolean(state.moveSize)}
              onChange={(moveSize) => update({ moveSize: moveSize || null })}
            />
            <CrmSelect
              label={LEADS_COPY.localLabel}
              value={state.local ?? ""}
              options={[{ value: "", label: LEADS_COPY.localAny }, ...LOCAL_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))]}
              active={Boolean(state.local)}
              onChange={(local) => update({ local: local || null })}
            />
          </div>
        </CrmCard>
      ) : null}

      {chips.length > 0 ? (
        <div className="crm-chips" data-testid="leads-active-filters">
          {chips.map((chip) => (
            <RemovableChip key={chip.key} label={chip.label} onRemove={() => update(chip.clear)} />
          ))}
          <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={clearAll}>
            {LEADS_COPY.clearAll}
          </button>
        </div>
      ) : null}

      {needsFeedNote ? <p className="crm-subtitle" style={{ margin: 0 }}>{LEADS_COPY.feedServerNote}</p> : null}
      {state.show === "both" ? <p className="crm-subtitle" style={{ margin: 0 }}>{LEADS_COPY.showBothNote}</p> : null}
      {clientNarrowed ? <p className="crm-subtitle" style={{ margin: 0 }}>{LEADS_COPY.clientNarrowNote}</p> : null}

      <div className="crm-summary-row">
        <SummaryCard
          icon={Users}
          tone="blue"
          title={LEADS_COPY.summaryLeads}
          value={totalsExact && sumTotal !== null ? formatCount(sumTotal) : "—"}
          caption={totalsExact ? undefined : LEADS_COPY.totalPending}
          testId="leads-summary-total"
        />
        <SummaryCard icon={FileText} tone="blue" title={LEADS_COPY.summaryForm} value={totalsExact && typeof formTotal === "number" ? formatCount(formTotal) : "—"} />
        <SummaryCard icon={Phone} tone="blue" title={LEADS_COPY.summaryCall} value={totalsExact && typeof callTotal === "number" ? formatCount(callTotal) : "—"} />
        <SummaryCard icon={ListChecks} tone="gray" title={LEADS_COPY.summaryShowing} value={LEADS_COPY.summaryLoaded(visibleItems.length)} />
      </div>

      {state.show === "duplicates" ? (
        <Notice icon={CircleAlert} title={LEADS_COPY.duplicatesNoticeTitle} tone="amber">
          {duplicateReadOnlyBannerCopy("duplicate-form-leads")}
        </Notice>
      ) : null}
      {actionError ? <ReadFailure what="Lead update failed." error={actionError} /> : null}

      {selectMode ? (
        <div className="crm-card" style={{ padding: "10px 14px" }} data-testid="leads-select-bar">
          <div className="crm-toolbar">
            <strong>{LEADS_COPY.selectedCount(selectedIds.size)}</strong>
            <button
              type="button"
              className="crm-button crm-button--primary crm-button--sm"
              disabled={selectedIds.size === 0 || verifyMutation.isPending}
              onClick={() => verifyMutation.mutate()}
            >
              {verifyMutation.isPending ? LEADS_COPY.verifying : LEADS_COPY.verify}
            </button>
            <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={() => setSelectedIds(new Set())}>
              {LEADS_COPY.clearSelection}
            </button>
            <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={selectAllVisible}>
              {LEADS_COPY.selectAll}
            </button>
            <span className="crm-subtitle" style={{ margin: 0 }}>{LEADS_COPY.verifyUpTo}</span>
            <button type="button" className="crm-button crm-button--quiet crm-button--sm" style={{ marginLeft: "auto" }} onClick={exitSelect} aria-label={LEADS_COPY.verifyDone}>
              <X aria-hidden="true" width={14} height={14} />
            </button>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <ReadFailure
          what={LEADS_COPY.loadFailed}
          error={loadError}
          onRetry={() => {
            void formQuery.refetch();
            void callQuery.refetch();
          }}
        />
      ) : null}

      {isLoading && visibleItems.length === 0 ? (
        <div className="crm-stack" data-density={density} aria-busy="true">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="crm-card" style={{ padding: 16, display: "grid", gap: 10 }}>
              <SkeletonLine width="40%" height={16} />
              <SkeletonLine width="70%" />
              <SkeletonLine width="55%" />
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && !loadError && visibleItems.length === 0 && !canFetchMore ? (
        <CrmCard testId="leads-empty">
          <h2 className="crm-card__title">{LEADS_COPY.empty}</h2>
          <p className="crm-subtitle">{LEADS_COPY.emptyHint}</p>
          {hasFilters ? (
            <button type="button" className="crm-button crm-button--quiet" onClick={clearAll}>
              {LEADS_COPY.clearAll}
            </button>
          ) : null}
        </CrmCard>
      ) : null}

      {visibleItems.length > 0 ? (
        <div className="crm-stack" data-density={density} data-testid="leads-stack">
          {visibleItems.map((item) => {
            const id = getRecordId(item);
            return (
              <LeadCard
                key={`${item.__kind}:${id}`}
                item={item}
                active={state.lead === id}
                granularityLabelByKey={facets.granularityLabelByKey}
                companyLabelBySlug={companyLabelBySlug}
                selectMode={selectMode}
                selected={selectedIds.has(id)}
                onToggleSelect={toggleSelected}
                verdict={verdicts.get(id) ?? null}
                roster={isOwner ? rosterActive : undefined}
                onAssign={(lead, agentId) => assignMutation.mutate({ item: lead, agentId })}
                onOpen={openLead}
                onToggleHidden={isOwner ? (lead) => hideMutation.mutate(lead) : undefined}
                onMarkBad={isOwner ? (lead) => update({ lead: getRecordId(lead), lk: lead.__kind, panel: "actions" }) : undefined}
              />
            );
          })}
        </div>
      ) : null}

      <div ref={sentinelRef} aria-hidden="true" />
      {canFetchMore || frontierQuery?.isFetchingNextPage ? (
        <p className="crm-subtitle" style={{ textAlign: "center" }}>{LEADS_COPY.loadMore}</p>
      ) : visibleItems.length > 0 ? (
        <p className="crm-subtitle" style={{ textAlign: "center" }}>{LEADS_COPY.allLoaded}</p>
      ) : null}

      {panelKind && panelRecord ? (
        <DetailPanel
          config={panelConfig}
          resource={panelKind === "form" ? "form-leads" : "call-leads"}
          uiResource={panelUiResource}
          selected={panelRecord}
          filters={{ ...leadListFilters(state, panelKind), page: 1 }}
          requestedPanel={state.panel ?? undefined}
          onPanelChange={onPanelChange}
          onClose={closePanel}
          readOnly={Boolean(panelConfig.readOnly)}
          canDelete={false}
          onRequestDelete={() => undefined}
        />
      ) : null}

      <SheetContainsPanel
        open={verifyOpen}
        result={verifyResult}
        error={verifyError}
        isChecking={verifyMutation.isPending}
        onClose={() => setVerifyOpen(false)}
      />

      {state.isNew ? (
        <div className="crm-drawer" role="dialog" aria-label={LEADS_COPY.newLeadTitle} data-testid="leads-new-sheet">
          <CrmCard
            title={LEADS_COPY.newLeadTitle}
            tools={
              <button type="button" className="crm-button crm-button--quiet crm-button--sm" aria-label="Close" onClick={() => update({ isNew: false })}>
                <X aria-hidden="true" width={16} height={16} />
              </button>
            }
          >
            <div className="crm-drawer__scroll">
              <CreateLeadForm />
            </div>
          </CrmCard>
        </div>
      ) : null}
    </div>
  );
}
