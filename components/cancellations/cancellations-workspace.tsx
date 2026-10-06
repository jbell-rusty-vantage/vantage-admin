"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Ban, CircleAlert, HandCoins, ListChecks, Plus } from "lucide-react";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { useRecordDelete } from "@/components/bookings/use-record-delete";
import { operationalConfigs, withFacetOptions } from "@/components/operational/operational-configs";
import { DeleteConfirmationDialog } from "@/components/operational/operational-actions";
import { DetailPanel } from "@/components/operational/operational-detail-panel";
import { SheetContainsPanel } from "@/components/operational/sheet-contains-panel";
import type { DetailTabKey } from "@/components/operational/visible-detail-tabs";
import { formatCount, formatMoney } from "@/components/ui/crm/format";
import {
  ActiveFilterChips,
  MoreFiltersCard,
  MoreFiltersChip,
  RecordList,
  SearchRow,
  SelectBar,
  useInfiniteScroll,
  useSheetVerify,
  useUrlState,
  VerifyToggleButton,
} from "@/components/records";
import { CrmSelect, DensityToggle, Notice, PageHeader, SummaryCard, useDensity } from "@/components/ui/crm/primitives";
import { fetchAdminList, getRecordId, type AdminRecord } from "@/lib/api/admin";
import {
  cancellationClientNarrowing,
  cancellationListFilters,
  matchesCancellationRefund,
  readListTotals,
  type CancellationRefund,
  type CancellationSort,
} from "@/lib/api/bookings";
import { useFacetOptions } from "@/lib/api/facets";
import { CANCELLATION_REASON_OPTIONS } from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";
import { CancellationCard } from "./cancellation-card";
import { isQuietSinceAugust, topReason } from "./cancellation-card-model";
import { CANCELLATIONS_COPY, reasonLabel } from "./cancellations-copy";
import { activeCancellationFilters, cancellationsUrlUpdate, CLEAR_ALL, parseCancellationsUrl, type CancellationsUrlState } from "./cancellations-url";

function useCancellationList(filters: ReturnType<typeof cancellationListFilters>) {
  return useInfiniteQuery({
    queryKey: queryKeys.lists.resource("cancellations-workspace", filters),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchAdminList<AdminRecord>("cancelled-leads", { ...filters, page: Number(pageParam) }),
    getNextPageParam: (lastPage) => (lastPage.has_next_page ? lastPage.page + 1 : undefined),
    // A filter or search change keeps the current cards on screen until the next list arrives (no skeleton flash).
    placeholderData: keepPreviousData,
  });
}

/** An option list that always contains the current value, so a URL-held value outside the roster still shows. */
function withCurrent(options: readonly { value: string; label: string }[], current: string | null, anyLabel: string) {
  const list = [{ value: "", label: anyLabel }, ...options.map((option) => ({ value: option.value, label: option.label }))];
  if (current && !list.some((option) => option.value === current)) list.push({ value: current, label: current });
  return list;
}

export function CancellationsWorkspace() {
  const copy = CANCELLATIONS_COPY;
  const router = useRouter();
  const searchParams = useSearchParams();
  const facets = useFacetOptions();
  const role = useDashboardRole();
  const isOwner = role === "owner";
  const [density, setDensity] = useDensity(copy.density);

  const state = useMemo(() => parseCancellationsUrl(searchParams), [searchParams]);
  const update = useUrlState<Partial<CancellationsUrlState>>(cancellationsUrlUpdate);

  // ---- The list ---------------------------------------------------------------------------------------------
  const filters = useMemo(() => cancellationListFilters(state), [state]);
  const query = useCancellationList(filters);
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const narrowed = cancellationClientNarrowing(state);
  const visibleItems = useMemo(() => items.filter((item) => matchesCancellationRefund(item, state.refund)), [items, state.refund]);
  const lastPage = query.data?.pages[query.data.pages.length - 1];
  const totals = readListTotals(lastPage);
  const top = useMemo(() => topReason(visibleItems), [visibleItems]);

  const canFetchMore = Boolean(query.hasNextPage && !query.isFetchingNextPage);
  const sentinelRef = useInfiniteScroll({
    canFetchMore,
    fetchMore: () => {
      void query.fetchNextPage();
    },
    visibleCount: visibleItems.length,
  });
  const isRefreshing = query.isPlaceholderData && query.isFetching;

  // ---- Panel (the fallback for a cancellation without a populated booking) ----------------------------------
  const panelConfig = useMemo(() => withFacetOptions(operationalConfigs.cancellations, facets), [facets]);
  const panelRecord = useMemo<AdminRecord | null>(() => {
    if (!state.record) return null;
    return items.find((item) => getRecordId(item) === state.record) ?? { _id: state.record, __url_placeholder: true };
  }, [state.record, items]);
  const closePanel = () => update({ record: null, panel: null });
  const onPanelChange = (panel: DetailTabKey) => update({ panel });
  const openFallback = (item: AdminRecord) => update({ record: getRecordId(item), panel: "summary" });

  const remove = useRecordDelete({
    onDeleted: (id) => {
      if (state.record === id) closePanel();
    },
  });
  const canDelete = isOwner && !panelConfig.readOnly;

  // ---- Verify in Master Sheet -------------------------------------------------------------------------------
  const verify = useSheetVerify({ modelFor: () => "CancelledLead" });
  const visibleIds = visibleItems.map((item) => getRecordId(item));

  // ---- Filter row -------------------------------------------------------------------------------------------
  const [moreOpen, setMoreOpen] = useState(false);
  const sourceLabelByValue = new Map(facets.bookingSourceOptions.map((option) => [option.value, option.label]));
  const chips = activeCancellationFilters(state, {
    reason: (value) => reasonLabel(value) ?? undefined,
    source: (value) => sourceLabelByValue.get(value),
  });
  const filtered = chips.length > 0 || Boolean(state.q);
  const clearAll = () => update(CLEAR_ALL);
  const reasonOptions = CANCELLATION_REASON_OPTIONS.map((option) => ({ value: option.value as string, label: reasonLabel(option.value) ?? option.value }));

  const settled = !query.isLoading && !query.isError;
  const quiet = settled && isQuietSinceAugust(visibleItems, { filtered, newestFirst: state.sort === "cancel_desc" });
  const recordButton = (
    <Link href="/cancellations/new" className="crm-button crm-button--primary">
      <Plus aria-hidden="true" width={16} height={16} />
      {copy.recordButton}
    </Link>
  );

  return (
    <div className="crm-page" style={{ padding: 0 }} data-testid="cancellations-workspace">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        help={copy.help}
        right={
          <>
            {isOwner ? <VerifyToggleButton verify={verify} /> : null}
            {recordButton}
          </>
        }
      />

      <SearchRow<CancellationSort>
        q={state.q}
        onSearch={(q) => update({ q }, { replace: true })}
        placeholder={copy.searchPlaceholder}
        refreshing={isRefreshing}
        sort={state.sort}
        sortOptions={copy.sortOptions}
        onSort={(sort) => update({ sort })}
      />

      <div className="crm-toolbar">
        <CrmSelect
          label={copy.reasonLabel}
          value={state.reason ?? ""}
          options={withCurrent(reasonOptions, state.reason, copy.reasonAll)}
          active={Boolean(state.reason)}
          onChange={(reason) => update({ reason: reason || null })}
        />
        <CrmSelect
          label={copy.sourceLabel}
          value={state.source ?? ""}
          options={withCurrent(facets.bookingSourceOptions, state.source, copy.sourceAll)}
          active={Boolean(state.source)}
          onChange={(source) => update({ source: source || null })}
        />
        <CrmSelect
          label={copy.agentLabel}
          value={state.agent ?? ""}
          options={withCurrent(facets.agentOptions, state.agent, copy.agentAll)}
          active={Boolean(state.agent)}
          onChange={(agent) => update({ agent: agent || null })}
        />
        <MoreFiltersChip open={moreOpen} onToggle={() => setMoreOpen((open) => !open)} />
        <span className="crm-toolbar__spacer" />
        <DensityToggle value={density} onChange={setDensity} />
      </div>

      {moreOpen ? (
        <MoreFiltersCard testId="cancellations-more-filters">
          <label className="crm-toolbar">
            <span className="sr-only">{copy.dateFrom}</span>
            <input type="date" className="crm-input" aria-label={copy.dateFrom} value={state.from ?? ""} onChange={(event) => update({ from: event.target.value || null })} />
          </label>
          <label className="crm-toolbar">
            <span className="sr-only">{copy.dateTo}</span>
            <input type="date" className="crm-input" aria-label={copy.dateTo} value={state.to ?? ""} onChange={(event) => update({ to: event.target.value || null })} />
          </label>
          <CrmSelect
            label={copy.merchantLabel}
            value={state.merchant ?? ""}
            options={withCurrent(facets.merchantOptions, state.merchant, copy.merchantAll)}
            active={Boolean(state.merchant)}
            onChange={(merchant) => update({ merchant: merchant || null })}
          />
          <CrmSelect<CancellationRefund>
            label={copy.refundLabel}
            value={state.refund}
            options={copy.refundOptions}
            active={state.refund !== "any"}
            onChange={(refund) => update({ refund })}
          />
          <CrmSelect
            label={copy.byLabel}
            value={state.by ?? ""}
            options={withCurrent(facets.agentOptions, state.by, copy.byAll)}
            active={Boolean(state.by)}
            onChange={(by) => update({ by: by || null })}
          />
        </MoreFiltersCard>
      ) : null}

      <ActiveFilterChips chips={chips} onRemove={(patch) => update(patch)} onClearAll={clearAll} testId="cancellations-active-filters" />

      {narrowed ? <p className="crm-subtitle" style={{ margin: 0 }}>{copy.refundNarrowNote}</p> : null}

      <div className="crm-summary-row">
        <SummaryCard
          icon={Ban}
          tone="red"
          title={copy.summaryCancellations}
          value={narrowed ? formatCount(visibleItems.length) : formatCount(totals.count)}
          caption={narrowed ? copy.ofLoaded : undefined}
          testId="cancellations-summary-total"
        />
        <SummaryCard
          icon={HandCoins}
          tone="blue"
          title={copy.summaryRefunded}
          value={totals.refund !== null && !narrowed ? formatMoney(totals.refund) : "—"}
          caption={totals.refund === null || narrowed ? copy.totalsPending : undefined}
          testId="cancellations-summary-refunded"
        />
        <SummaryCard
          icon={ListChecks}
          tone="gray"
          title={copy.summaryTopReason}
          value={top ? (reasonLabel(top.reason) ?? top.reason) : copy.none}
          caption={top ? `${top.count} ${copy.topReasonCaption}` : copy.topReasonCaption}
          testId="cancellations-summary-reason"
        />
      </div>

      {quiet && visibleItems.length > 0 ? (
        <Notice icon={CircleAlert} title={copy.emptyQuiet} tone="amber" testId="cancellations-quiet-notice">
          <p className="crm-subtitle">{copy.emptyQuietHint}</p>
        </Notice>
      ) : null}
      {remove.message ? <Notice icon={Ban} title={remove.message} tone="green" /> : null}

      <SelectBar verify={verify} visibleIds={visibleIds} testId="cancellations-select-bar" />

      <RecordList<AdminRecord>
        items={visibleItems}
        keyOf={(item) => getRecordId(item)}
        loading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => {
          void query.refetch();
        }}
        canFetchMore={canFetchMore}
        fetchingMore={query.isFetchingNextPage}
        sentinelRef={sentinelRef}
        density={density}
        copy={{
          loadFailed: copy.loadFailed,
          loadMore: copy.loadMore,
          allLoaded: copy.allLoaded,
          empty: quiet ? copy.emptyQuiet : copy.empty,
          emptyHint: quiet ? copy.emptyQuietHint : copy.emptyHint,
        }}
        emptyTestId="cancellations-empty"
        stackTestId="cancellations-stack"
        emptyActions={
          <>
            {recordButton}
            {filtered ? (
              <button type="button" className="crm-button crm-button--quiet" onClick={clearAll}>
                {copy.clearAll}
              </button>
            ) : null}
          </>
        }
        renderItem={(item) => {
          const id = getRecordId(item);
          return (
            <CancellationCard
              item={item}
              active={state.record === id}
              selectMode={verify.selectMode}
              selected={verify.selectedIds.has(id)}
              onToggleSelect={verify.toggleSelected}
              verdict={verify.verdicts.get(id) ?? null}
              onOpenBooking={(href) => router.push(href)}
              onOpenFallback={openFallback}
            />
          );
        }}
      />

      {panelRecord ? (
        <DetailPanel
          config={panelConfig}
          resource="cancelled-leads"
          uiResource="cancellations"
          selected={panelRecord}
          filters={{ ...filters, page: 1 }}
          requestedPanel={state.panel ?? undefined}
          onPanelChange={onPanelChange}
          onClose={closePanel}
          readOnly={Boolean(panelConfig.readOnly)}
          canDelete={canDelete}
          onRequestDelete={remove.request}
        />
      ) : null}

      <DeleteConfirmationDialog target={remove.target} pending={remove.pending} error={remove.error} onCancel={remove.cancel} onConfirm={remove.confirm} />

      <SheetContainsPanel open={verify.open} result={verify.result} error={verify.error} isChecking={verify.isVerifying} onClose={() => verify.setOpen(false)} />
    </div>
  );
}
