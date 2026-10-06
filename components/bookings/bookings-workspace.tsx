"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Ban, CalendarCheck, HandCoins, Plus, Wallet } from "lucide-react";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
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
import { CrmSelect, DensityToggle, Notice, PageHeader, Segmented, SummaryCard, useDensity } from "@/components/ui/crm/primitives";
import { fetchAdminList, getRecordId, type AdminRecord } from "@/lib/api/admin";
import {
  bookingClientNarrowing,
  bookingListFilters,
  matchesBookingType,
  readListTotals,
  type BookingBinder,
  type BookingSort,
  type BookingStatus,
  type BookingType,
} from "@/lib/api/bookings";
import { useFacetOptions } from "@/lib/api/facets";
import { LOCAL_TYPE_OPTIONS } from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";
import { BookingCard } from "./booking-card";
import { BOOKINGS_COPY } from "./bookings-copy";
import { activeBookingFilters, bookingsUrlUpdate, CLEAR_ALL, parseBookingsUrl, type BookingsUrlState } from "./bookings-url";
import { useRecordDelete } from "./use-record-delete";

function useBookingList(filters: ReturnType<typeof bookingListFilters>) {
  return useInfiniteQuery({
    queryKey: queryKeys.lists.resource("bookings-workspace", filters),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchAdminList<AdminRecord>("booked-leads", { ...filters, page: Number(pageParam) }),
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

export function BookingsWorkspace() {
  const copy = BOOKINGS_COPY;
  const searchParams = useSearchParams();
  const facets = useFacetOptions();
  const role = useDashboardRole();
  const isOwner = role === "owner";
  const [density, setDensity] = useDensity(copy.density);

  const state = useMemo(() => parseBookingsUrl(searchParams), [searchParams]);
  const update = useUrlState<Partial<BookingsUrlState>>(bookingsUrlUpdate);

  // ---- The list ---------------------------------------------------------------------------------------------
  const filters = useMemo(() => bookingListFilters(state), [state]);
  const query = useBookingList(filters);
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const narrowed = bookingClientNarrowing(state);
  const visibleItems = useMemo(() => items.filter((item) => matchesBookingType(item, state.type)), [items, state.type]);
  const lastPage = query.data?.pages[query.data.pages.length - 1];
  const totals = readListTotals(lastPage);

  const canFetchMore = Boolean(query.hasNextPage && !query.isFetchingNextPage);
  const sentinelRef = useInfiniteScroll({
    canFetchMore,
    fetchMore: () => {
      void query.fetchNextPage();
    },
    visibleCount: visibleItems.length,
  });
  const isRefreshing = query.isPlaceholderData && query.isFetching;

  // ---- Panel ------------------------------------------------------------------------------------------------
  const panelConfig = useMemo(() => withFacetOptions(operationalConfigs.bookings, facets), [facets]);
  const panelRecord = useMemo<AdminRecord | null>(() => {
    if (!state.record) return null;
    return items.find((item) => getRecordId(item) === state.record) ?? { _id: state.record, __url_placeholder: true };
  }, [state.record, items]);
  const closePanel = () => update({ record: null, panel: null, connect: false });
  const onPanelChange = (panel: DetailTabKey) => update({ panel });
  const openBooking = (item: AdminRecord, panel?: string) => update({ record: getRecordId(item), panel: panel ?? "summary" });

  const remove = useRecordDelete({
    onDeleted: (id) => {
      if (state.record === id) closePanel();
    },
  });
  const canDelete = isOwner && !panelConfig.readOnly;

  // ---- Verify in Master Sheet -------------------------------------------------------------------------------
  const verify = useSheetVerify({ modelFor: () => "BookedLead" });
  const visibleIds = visibleItems.map((item) => getRecordId(item));

  // ---- Filter row -------------------------------------------------------------------------------------------
  const [moreOpen, setMoreOpen] = useState(false);
  const sourceLabelByValue = new Map(facets.bookingSourceOptions.map((option) => [option.value, option.label]));
  const chips = activeBookingFilters(state, {
    source: (value) => sourceLabelByValue.get(value),
    local: (value) => LOCAL_TYPE_OPTIONS.find((option) => option.value === value)?.label,
  });
  const hasFilters = chips.length > 0 || Boolean(state.q);
  const clearAll = () => update(CLEAR_ALL);

  const cancelledCount = state.status === "cancelled" ? totals.count : state.status === "active" ? 0 : totals.cancelled;
  const moneyValue = (value: number | null) => (value !== null && !narrowed ? formatMoney(value) : "—");

  return (
    <div className="crm-page" style={{ padding: 0 }} data-testid="bookings-workspace">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        help={copy.help}
        right={
          <>
            {isOwner ? <VerifyToggleButton verify={verify} /> : null}
            <Link href="/bookings/new" className="crm-button crm-button--primary">
              <Plus aria-hidden="true" width={16} height={16} />
              {copy.newBooking}
            </Link>
          </>
        }
      />

      <SearchRow<BookingSort>
        q={state.q}
        onSearch={(q) => update({ q }, { replace: true })}
        placeholder={copy.searchPlaceholder}
        refreshing={isRefreshing}
        sort={state.sort}
        sortOptions={copy.sortOptions}
        onSort={(sort) => update({ sort })}
      />

      <div className="crm-toolbar">
        <Segmented<BookingStatus> label={copy.statusLabel} value={state.status} options={copy.statusOptions} onChange={(status) => update({ status })} />
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
        <MoreFiltersCard testId="bookings-more-filters">
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
          <CrmSelect<BookingType>
            label={copy.typeLabel}
            value={state.type}
            options={copy.typeOptions}
            active={state.type !== "any"}
            onChange={(type) => update({ type })}
          />
          <CrmSelect
            label={copy.localLabel}
            value={state.local ?? ""}
            options={[{ value: "", label: copy.localAny }, ...LOCAL_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))]}
            active={Boolean(state.local)}
            onChange={(local) => update({ local: local || null })}
          />
          <CrmSelect<BookingBinder>
            label={copy.binderLabel}
            value={state.binder}
            options={copy.binderOptions}
            active={state.binder !== "any"}
            onChange={(binder) => update({ binder })}
          />
        </MoreFiltersCard>
      ) : null}

      <ActiveFilterChips chips={chips} onRemove={(patch) => update(patch)} onClearAll={clearAll} testId="bookings-active-filters" />

      {narrowed ? <p className="crm-subtitle" style={{ margin: 0 }}>{copy.typeNarrowNote}</p> : null}

      <div className="crm-summary-row">
        <SummaryCard
          icon={CalendarCheck}
          tone="green"
          title={copy.summaryBookings}
          value={narrowed ? formatCount(visibleItems.length) : formatCount(totals.count)}
          caption={narrowed ? copy.ofLoaded : undefined}
          testId="bookings-summary-total"
        />
        <SummaryCard
          icon={Wallet}
          tone="blue"
          title={copy.summaryBinder}
          value={moneyValue(totals.binder)}
          caption={totals.binder === null || narrowed ? copy.totalsPending : undefined}
          testId="bookings-summary-binder"
        />
        <SummaryCard
          icon={HandCoins}
          tone="blue"
          title={copy.summaryDeposits}
          value={moneyValue(totals.deposit)}
          caption={totals.deposit === null || narrowed ? copy.totalsPending : undefined}
          testId="bookings-summary-deposits"
        />
        <SummaryCard
          icon={Ban}
          tone="red"
          title={copy.summaryCancelled}
          value={narrowed || cancelledCount === null ? "—" : formatCount(cancelledCount)}
          caption={cancelledCount === null || narrowed ? copy.totalsPending : undefined}
          testId="bookings-summary-cancelled"
        />
      </div>

      {remove.message ? <Notice icon={Ban} title={remove.message} tone="green" /> : null}

      <SelectBar verify={verify} visibleIds={visibleIds} testId="bookings-select-bar" />

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
        copy={copy}
        emptyTestId="bookings-empty"
        stackTestId="bookings-stack"
        emptyActions={
          hasFilters ? (
            <button type="button" className="crm-button crm-button--quiet" onClick={clearAll}>
              {copy.clearAll}
            </button>
          ) : null
        }
        renderItem={(item) => {
          const id = getRecordId(item);
          return (
            <BookingCard
              item={item}
              active={state.record === id}
              selectMode={verify.selectMode}
              selected={verify.selectedIds.has(id)}
              onToggleSelect={verify.toggleSelected}
              verdict={verify.verdicts.get(id) ?? null}
              onOpen={openBooking}
            />
          );
        }}
      />

      {panelRecord ? (
        <DetailPanel
          config={panelConfig}
          resource="booked-leads"
          uiResource="bookings"
          selected={panelRecord}
          filters={{ ...filters, page: 1 }}
          startConnect={state.connect}
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
