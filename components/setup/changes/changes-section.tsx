"use client";
/**
 * Setup → Change history (doc 19): the registry change log (`fetchRegistryChanges`) with the filters reduced to
 * Entity, Who and When, the before / after diff kept, and deep links into the Setup sections through
 * `registryEntityLinks.ts`. URL keys: `?entity=&who=&from=&to=&page=&limit=` and `?change=<id>` for the open change.
 */
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useUrlState } from "@/components/records";
import { SetupSectionHead } from "@/components/setup/setup-shell";
import { CrmCard, CrmSelect, ReadFailure, SkeletonLine } from "@/components/ui/crm/primitives";
import { fetchRegistryChanges } from "@/lib/api/operationsRegistry";
import { REGISTRY_CHANGE_ENTITY_TYPES } from "@/lib/api/registryEntityLinks";
import { queryKeys } from "@/lib/query/keys";
import { ChangeDrawer } from "./change-drawer";
import { ChangesTable } from "./changes-table";
import { CHANGES_COPY } from "./changes-copy";
import { actorOptions, changesApiFilters, entityLabel, parseChangesFilters } from "./changes-model";

type ChangesUrlPatch = Partial<Record<"entity" | "who" | "from" | "to" | "page" | "limit" | "change", string | number | null>>;
const changesUrlUpdate = (patch: ChangesUrlPatch) => patch;

const ENTITY_OPTIONS = [
  { value: "", label: CHANGES_COPY.filters.anyEntity },
  ...REGISTRY_CHANGE_ENTITY_TYPES.map((value) => ({ value: value as string, label: entityLabel(value) })),
];

export function ChangesSection() {
  const copy = CHANGES_COPY;
  const searchParams = useSearchParams();
  const update = useUrlState<ChangesUrlPatch>(changesUrlUpdate);
  const filters = parseChangesFilters(searchParams);
  const openId = searchParams.get("change");
  const apiFilters = changesApiFilters(filters);

  const query = useQuery({
    queryKey: queryKeys.operationsRegistry.changes(apiFilters),
    queryFn: () => fetchRegistryChanges(apiFilters),
    placeholderData: keepPreviousData,
  });
  // The people in the most recent changes fill the Who list, so it stays full while a filter narrows the table.
  const recent = useQuery({
    queryKey: [...queryKeys.operationsRegistry.all, "setup", "changes", "actors"] as const,
    queryFn: () => fetchRegistryChanges({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const whoOptions = [{ value: "", label: copy.filters.anyone }, ...actorOptions([...(recent.data?.items ?? []), ...(query.data?.items ?? [])], filters.who)];
  const items = query.data?.items ?? [];
  const open = items.find((item) => item.id === openId) ?? null;
  const narrowed = Boolean(filters.entity || filters.who || filters.from || filters.to);
  const filterPatch = (patch: ChangesUrlPatch) => update({ ...patch, page: null, change: null });

  return (
    <>
      <SetupSectionHead section="changes" />
      <CrmCard title={copy.listTitle} subtitle={copy.listSubtitle} testId="changes-card">
        <div className="crm-toolbar ch-toolbar">
          <CrmSelect value={filters.entity} onChange={(value) => filterPatch({ entity: value })} options={ENTITY_OPTIONS} label={copy.filters.entity} active={Boolean(filters.entity)} />
          <CrmSelect value={filters.who} onChange={(value) => filterPatch({ who: value })} options={whoOptions} label={copy.filters.who} active={Boolean(filters.who)} />
          <label className="ch-date">
            <span className="ch-date__label">{copy.filters.from}</span>
            <input className="su-input" type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => filterPatch({ from: event.target.value })} />
          </label>
          <label className="ch-date">
            <span className="ch-date__label">{copy.filters.to}</span>
            <input className="su-input" type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => filterPatch({ to: event.target.value })} />
          </label>
          {narrowed ? (
            <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={() => update({ entity: null, who: null, from: null, to: null, page: null, change: null })}>
              {copy.filters.clear}
            </button>
          ) : null}
        </div>

        {query.isPending ? (
          <div className="ch-skeleton" role="status" aria-label={copy.loading}>
            <SkeletonLine height={16} />
            <SkeletonLine height={16} width="85%" />
            <SkeletonLine height={16} width="70%" />
          </div>
        ) : query.isError ? (
          <ReadFailure what={copy.readFailure} error={query.error} onRetry={() => void query.refetch()} inset />
        ) : items.length === 0 ? (
          <div className="crm-empty">
            <p>{copy.empty}</p>
          </div>
        ) : (
          <>
            <ChangesTable items={items} openId={openId} onOpen={(id) => update({ change: id })} />
            <div className="ch-pager">
              <span className="su-quiet" aria-live="polite">
                {copy.total(query.data?.total ?? items.length, query.data?.page ?? filters.page)}
              </span>
              <span className="ch-pager__buttons">
                <button type="button" className="crm-button crm-button--sm" disabled={filters.page <= 1 || query.isFetching} onClick={() => update({ page: filters.page - 1, change: null })}>
                  {copy.previous}
                </button>
                <button type="button" className="crm-button crm-button--sm" disabled={!query.data?.has_next_page || query.isFetching} onClick={() => update({ page: filters.page + 1, change: null })}>
                  {copy.next}
                </button>
              </span>
            </div>
          </>
        )}
      </CrmCard>
      {open ? <ChangeDrawer item={open} onClose={() => update({ change: null })} /> : null}
    </>
  );
}
