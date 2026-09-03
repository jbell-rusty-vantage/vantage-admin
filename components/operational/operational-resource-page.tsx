"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Download, PlusCircle } from "lucide-react";
import { DataTable } from "@/components/data-table/table-shell";
import { TableEmptyState, TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import { getCommittedSearchQuery } from "@/components/filters/debounced-search-input";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { DASHBOARD_MAIN_ID } from "@/components/layout/dashboard-ids";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { DeleteConfirmationDialog } from "@/components/operational/operational-actions";
import { buildColumns } from "@/components/operational/operational-columns";
import { operationalConfigs, withFacetOptions, type DeleteTarget } from "@/components/operational/operational-configs";
import { deleteSuccessCopy, duplicateReadOnlyBannerCopy, OPERATIONAL_COPY } from "@/components/operational/operational-copy";
import { SheetContainsPanel } from "@/components/operational/sheet-contains-panel";
import { DetailPanel } from "@/components/operational/operational-detail-panel";
import { ActiveFilterChips, OperationalFilterPanel } from "@/components/operational/operational-filter-panel";
import {
  apiFiltersFromUrlState,
  connectFromUrl,
  requestedPanelFromUrl,
} from "@/components/operational/operational-url-state";
import type { DetailTabKey } from "@/components/operational/visible-detail-tabs";
import {
  hasAttachedCancellation,
  invalidateOperationalMutations,
  isDeleteResource,
} from "@/components/operational/operational-helpers";
import {
  adminExportUrl,
  deleteBookedLead,
  deleteCancelledLead,
  checkSheetContains,
  fetchAdminList,
  getRecordId,
  resourceLabels,
  uiToAdminResource,
  type AdminRecord,
  type SheetContainsResult,
  type UiResource,
} from "@/lib/api/admin";
import {
  isSheetContainsResource,
  SHEET_CONTAINS_MAX_IDS,
  sheetContainsEntityModel,
} from "@/lib/sheet-contains";
import { downloadCsvFromProxy } from "@/lib/api/csv";
import { useFacetOptions } from "@/lib/api/facets";
import type { SerializableFilters } from "@/lib/api/filters";
import { useUrlTableState } from "@/lib/api/url-state";
import { useDatabaseScope } from "@/lib/state/database-scope";
import { setLocalStorageBoolean, useLocalStorageBoolean } from "@/lib/state/use-local-storage-boolean";
import type { DatabaseScope, TableQueryParams } from "@/lib/api/types";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";

const filtersSidebarStorageKey = "vantage-admin-operational-filters-collapsed";

function InfiniteTableFooter({
  shown,
  total,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  shown: number;
  total?: number;
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-muted-foreground">
        Showing {shown}
        {typeof total === "number" ? ` of ${total}` : null}
      </div>
      <Button variant="outline" disabled={!hasNextPage || isFetchingNextPage} onClick={onLoadMore}>
        {isFetchingNextPage ? "Loading..." : hasNextPage ? "Load more" : "All rows loaded"}
      </Button>
    </div>
  );
}

function scrollRoot(): HTMLElement | Window {
  return document.getElementById(DASHBOARD_MAIN_ID) ?? window;
}

function scrollTopOf(root: HTMLElement | Window): number {
  return root instanceof Window ? root.scrollY : root.scrollTop;
}

function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const root = scrollRoot();
    function onScroll() {
      setVisible(scrollTopOf(root) > 600);
    }

    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Button
      className="fixed bottom-5 right-5 z-40 gap-2 shadow-lg"
      onClick={() => scrollRoot().scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowUp className="h-4 w-4" aria-hidden="true" />
      Back to top
    </Button>
  );
}

function selectedRecordFromUrl(filters: TableQueryParams): string {
  const value = filters.record;
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function OperationalResourcePage({ resource }: { resource: UiResource }) {
  const baseConfig = operationalConfigs[resource];
  const adminResource = uiToAdminResource[resource];
  const dashboardRole = useDashboardRole();
  const queryClient = useQueryClient();
  const { scope } = useDatabaseScope();
  const facetOptions = useFacetOptions(scope);
  const config = useMemo(
    () => withFacetOptions(baseConfig, { ...facetOptions, scope }),
    [baseConfig, facetOptions, scope],
  );
  const urlDefaults = useMemo(
    () => ({
      database_scope: scope,
      sort: config.defaultSort,
      direction: config.defaultDirection,
      date_field: config.dateField,
    }),
    [config.dateField, config.defaultDirection, config.defaultSort, scope],
  );
  const [selected, setSelected] = useState<AdminRecord | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [sheetContainsOpen, setSheetContainsOpen] = useState(false);
  const [sheetContainsResult, setSheetContainsResult] = useState<SheetContainsResult | null>(null);
  const [sheetContainsError, setSheetContainsError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const filtersCollapsed = useLocalStorageBoolean(filtersSidebarStorageKey);
  const { filters, update, setSort, reset: resetUrl } = useUrlTableState(urlDefaults);
  const requestedRecordId = selectedRecordFromUrl(filters);
  const committedSearchQuery =
    typeof filters.q === "string" ? getCommittedSearchQuery(filters.q) : "";
  const hasInvalidSearchQuery = committedSearchQuery === null;

  useEffect(() => {
    if (hasInvalidSearchQuery) {
      update({ q: null });
    }
  }, [hasInvalidSearchQuery, update]);

  useEffect(() => {
    if (scope === "historical" && filters.receiver_agent) {
      update({ receiver_agent: null });
    }
  }, [filters.receiver_agent, scope, update]);

  const effectiveFilters: SerializableFilters = {
    ...apiFiltersFromUrlState(filters),
    ...config.fixedListFilters,
    q: hasInvalidSearchQuery ? undefined : committedSearchQuery || undefined,
    database_scope: filters.database_scope === "combined" ? "production" : filters.database_scope,
    sort: filters.sort ?? config.defaultSort,
    direction: filters.direction ?? config.defaultDirection,
    date_field: filters.date_field ?? config.dateField,
  };
  const listFilters: SerializableFilters = {
    ...effectiveFilters,
    page: 1,
  };
  const readOnly = Boolean(config.readOnly) || effectiveFilters.database_scope === "historical";
  const query = useInfiniteQuery({
    queryKey: queryKeys.lists.resource(adminResource, listFilters),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchAdminList<AdminRecord>(adminResource, {
        ...listFilters,
        page: Number(pageParam),
      }),
    getNextPageParam: (lastPage) => (
      lastPage.has_next_page ? lastPage.page + 1 : undefined
    ),
    placeholderData: keepPreviousData,
  });
  const pages = query.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const lastPage = pages[pages.length - 1];
  const selectedRecord = useMemo<AdminRecord | null>(() => {
    if (!requestedRecordId) {
      return selected;
    }
    if (selected && getRecordId(selected) === requestedRecordId) {
      return selected;
    }
    return (
      items.find((item) => getRecordId(item) === requestedRecordId) ?? {
        _id: requestedRecordId,
        database_scope: effectiveFilters.database_scope as DatabaseScope,
        __url_placeholder: true,
      }
    );
  }, [effectiveFilters.database_scope, items, requestedRecordId, selected]);
  const isProduction = effectiveFilters.database_scope === "production";
  const canDelete = dashboardRole === "owner" && isProduction && !readOnly && isDeleteResource(resource);
  const canCheckSheets =
    dashboardRole === "owner" && isProduction && isSheetContainsResource(resource);
  const loadedIds = useMemo(() => items.map(getRecordId).filter(Boolean), [items]);
  const selectedCount = selectedIds.size;
  const allLoadedSelected =
    loadedIds.length > 0 && loadedIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    setSelectedIds(new Set());
    setSheetContainsOpen(false);
    setSheetContainsResult(null);
    setSheetContainsError(null);
  }, [resource, scope]);
  const requestDelete = useCallback((target: DeleteTarget) => {
    setDeleteError(null);
    setDeleteTarget(target);
  }, []);
  const selectRecord = useCallback(
    (record: AdminRecord) => {
      const id = getRecordId(record);
      setSelected(record);
      if (id) {
        update(
          { record: id, panel: requestedPanelFromUrl(filters) ?? "summary" },
          { resetPage: false },
        );
      }
    },
    [filters, update],
  );
  const closeSelectedRecord = useCallback(() => {
    setSelected(null);
    update({ record: null, panel: null, connect: null }, { resetPage: false });
  }, [update]);
  const reset = useCallback(() => {
    setSelected(null);
    resetUrl();
  }, [resetUrl]);
  const onPanelChange = useCallback(
    (panel: DetailTabKey) => {
      update({ panel }, { resetPage: false });
    },
    [update],
  );
  const deleteMutation = useMutation({
    mutationFn: async (target: DeleteTarget) => {
      const id = getRecordId(target.record);
      if (target.resource === "bookings") {
        await deleteBookedLead(id, { cascade: hasAttachedCancellation(target.record) });
        return target;
      }
      await deleteCancelledLead(id);
      return target;
    },
    onSuccess: async (target) => {
      await invalidateOperationalMutations(queryClient);
      const deletedId = getRecordId(target.record);
      setSelected((current) => (current && getRecordId(current) === deletedId ? null : current));
      if (requestedRecordId === deletedId) {
        update({ record: null, panel: null, connect: null }, { resetPage: false });
      }
      setDeleteTarget(null);
      setDeleteError(null);
      setDeleteMessage(deleteSuccessCopy(target.resource, hasAttachedCancellation(target.record)));
    },
    onError: (error) => {
      setDeleteError(error instanceof Error ? error.message : "Delete failed.");
    },
  });
  const toggleSelected = useCallback((id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        if (next.size >= SHEET_CONTAINS_MAX_IDS && !next.has(id)) {
          return current;
        }
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const toggleAllLoaded = useCallback(
    (checked: boolean) => {
      setSelectedIds((current) => {
        if (!checked) {
          const next = new Set(current);
          for (const id of loadedIds) {
            next.delete(id);
          }
          return next;
        }
        const next = new Set(current);
        for (const id of loadedIds) {
          if (next.size >= SHEET_CONTAINS_MAX_IDS) {
            break;
          }
          next.add(id);
        }
        return next;
      });
    },
    [loadedIds],
  );

  const sheetContainsMutation = useMutation({
    mutationFn: async () => {
      if (!isSheetContainsResource(resource)) {
        throw new Error("This page cannot check Google Sheets.");
      }
      return checkSheetContains({
        entity_model: sheetContainsEntityModel(resource),
        ids: [...selectedIds],
      });
    },
    onSuccess: (result) => {
      setSheetContainsError(null);
      setSheetContainsResult(result);
      setSheetContainsOpen(true);
    },
    onError: (error) => {
      setSheetContainsResult(null);
      setSheetContainsError(error instanceof Error ? error.message : "Google Sheet check failed.");
      setSheetContainsOpen(true);
    },
  });

  const columns = useMemo(
    () =>
      buildColumns(config, filters, setSort, resource, isProduction, {
        canDelete,
        onRequestDelete: requestDelete,
        granularityLabelByKey: facetOptions.granularityLabelByKey,
        selection: canCheckSheets
          ? {
              selectedIds,
              allLoadedSelected,
              onToggle: toggleSelected,
              onToggleAllLoaded: toggleAllLoaded,
            }
          : undefined,
      }),
    [
      config,
      filters,
      setSort,
      resource,
      isProduction,
      canDelete,
      requestDelete,
      canCheckSheets,
      selectedIds,
      allLoadedSelected,
      toggleSelected,
      toggleAllLoaded,
      facetOptions.granularityLabelByKey,
    ],
  );

  function toggleFiltersCollapsed() {
    setLocalStorageBoolean(filtersSidebarStorageKey, !filtersCollapsed);
  }

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !query.hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [query]);

  async function onExport() {
    setExportMessage(null);
    try {
      await downloadCsvFromProxy(adminExportUrl(adminResource, effectiveFilters), `${adminResource}.csv`);
      setExportMessage("CSV export downloaded and audit logged.");
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "CSV export failed.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{config.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {resource === "bookings" ? (
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-navy hover:text-white"
              href="/bookings/new"
            >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                New booking
            </Link>
          ) : null}
          {resource === "cancellations" ? (
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-navy hover:text-white"
              href="/cancellations/new"
            >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                New cancellation
            </Link>
          ) : null}
          <Button variant="outline" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      {exportMessage ? <FeedbackMessage>{exportMessage}</FeedbackMessage> : null}
      {deleteMessage ? <FeedbackMessage tone="success">{deleteMessage}</FeedbackMessage> : null}
      {effectiveFilters.database_scope === "historical" ? (
        <FeedbackMessage tone="warning">Historical mode is read-only. Edit and workflow actions are hidden.</FeedbackMessage>
      ) : null}
      {config.readOnly ? (
        <FeedbackMessage tone="warning">
          {duplicateReadOnlyBannerCopy(resource)}
        </FeedbackMessage>
      ) : null}

      <div
        className={cn(
          "grid gap-5 transition-[grid-template-columns] duration-200",
          filtersCollapsed ? "xl:grid-cols-[4rem_minmax(0,1fr)]" : "xl:grid-cols-[18rem_minmax(0,1fr)]",
        )}
      >
        <OperationalFilterPanel
          config={config}
          filters={filters}
          update={update}
          setSort={setSort}
          reset={reset}
          collapsed={filtersCollapsed}
          onToggleCollapsed={toggleFiltersCollapsed}
        />

        <div className="min-w-0 space-y-4">
          <div className="hidden rounded-lg border bg-background p-3 xl:block">
            <ActiveFilterChips config={config} filters={filters} update={update} reset={reset} />
          </div>

          {isProduction && !readOnly && (resource === "form-leads" || resource === "call-leads" || resource === "bookings") ? (
            <div className="rounded-lg border bg-background p-3 text-sm">
              {resource === "bookings"
                ? "Select a booking row to inspect it, or use the row detail to start a cancellation."
                : "Select a lead row to inspect it, then start a booking with identifiers prefilled."}
            </div>
          ) : null}

          {canCheckSheets && selectedCount > 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                {selectedCount} {OPERATIONAL_COPY.sheetContains.selected}
                {selectedCount >= SHEET_CONTAINS_MAX_IDS
                  ? ` · ${OPERATIONAL_COPY.sheetContains.maxSelected}`
                  : null}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => sheetContainsMutation.mutate()}
                  disabled={sheetContainsMutation.isPending}
                >
                  {OPERATIONAL_COPY.sheetContains.action}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedIds(new Set())}
                >
                  {OPERATIONAL_COPY.sheetContains.clear}
                </Button>
              </div>
            </div>
          ) : null}

          {query.isLoading ? <TableLoadingState /> : null}
          {query.isError ? (
            <TableErrorState error={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />
          ) : null}
          {query.data && items.length === 0 ? <TableEmptyState /> : null}
          {items.length > 0 ? (
            <>
              <DataTable
                items={items}
                columns={columns}
                getRowKey={getRecordId}
                onRowClick={selectRecord}
                isRowSelected={(item) =>
                  Boolean(requestedRecordId) && getRecordId(item) === requestedRecordId
                }
                stickyHeader
                compact
                horizontalControls
              />
              <div ref={loadMoreRef} aria-hidden="true" />
              <InfiniteTableFooter
                shown={items.length}
                total={lastPage?.total}
                hasNextPage={query.hasNextPage}
                isFetchingNextPage={query.isFetchingNextPage}
                onLoadMore={() => query.fetchNextPage()}
              />
            </>
          ) : null}
        </div>
      </div>

      <DetailPanel
        config={config}
        resource={adminResource}
        uiResource={resource}
        selected={selectedRecord}
        scope={effectiveFilters.database_scope as DatabaseScope}
        filters={effectiveFilters}
        startConnect={connectFromUrl(filters)}
        requestedPanel={requestedPanelFromUrl(filters)}
        onPanelChange={onPanelChange}
        onClose={closeSelectedRecord}
        readOnly={readOnly}
        canDelete={canDelete}
        onRequestDelete={requestDelete}
      />
      <DeleteConfirmationDialog
        target={deleteTarget}
        pending={deleteMutation.isPending}
        error={deleteError}
        onCancel={() => {
          if (!deleteMutation.isPending) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget);
          }
        }}
      />
      <SheetContainsPanel
        open={sheetContainsOpen}
        result={sheetContainsResult}
        error={sheetContainsError}
        isChecking={sheetContainsMutation.isPending}
        onClose={() => setSheetContainsOpen(false)}
      />
      <BackToTopButton />
    </div>
  );
}

export { resourceLabels };
