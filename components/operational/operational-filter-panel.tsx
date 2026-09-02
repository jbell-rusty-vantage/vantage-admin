"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Funnel, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { DebouncedSearchInput } from "@/components/filters/debounced-search-input";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { FilterField } from "@/components/filters/filter-field";
import { SelectFilter } from "@/components/filters/select-filter";
import { filterGroupTitle, OPERATIONAL_COPY } from "@/components/operational/operational-copy";
import {
  filterGroupHasActiveValue,
  filterGroupStartsOpen,
  filtersInGroup,
  visibleFilterGroups,
  type FilterGroupId,
} from "@/components/operational/operational-filter-groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DateSortConfig, FilterConfig, ResourceConfig } from "@/components/operational/operational-configs";
import { cn } from "@/lib/utils";
import type { SelectOption, SortDirection, TableQueryParams } from "@/lib/api/types";
import type { UrlStateUpdate } from "@/lib/api/url-state";

function FilterInput({
  filter,
  value,
  onChange,
}: {
  filter: FilterConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  if (filter.type === "select" && filter.options) {
    return <SelectFilter value={value} options={filter.options} onChange={onChange} />;
  }
  return <Input value={value} onChange={(event) => onChange(event.target.value)} />;
}

function getFilterDisplayValue(filter: FilterConfig, value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  const stringValue = String(value);
  return filter.options?.find((option) => option.value === stringValue)?.label ?? stringValue;
}

function getActiveFilterChips(config: ResourceConfig, filters: TableQueryParams) {
  const filterMap = new Map(config.filters.map((filter) => [filter.key, filter]));
  const chips: Array<{ key: string; label: string; value: string; clear: UrlStateUpdate }> = [];

  if (filters.q) {
    chips.push({ key: "q", label: OPERATIONAL_COPY.filters.search, value: String(filters.q), clear: { q: null } });
  }
  if (filters.from || filters.to) {
    chips.push({
      key: "date",
      label: "Date",
      value: `${filters.from ?? "Any"} to ${filters.to ?? "Any"}`,
      clear: { from: null, to: null },
    });
  }

  for (const filter of config.filters) {
    const value = filters[filter.key];
    const displayValue = getFilterDisplayValue(filter, value);
    if (displayValue) {
      chips.push({
        key: filter.key,
        label: filter.label,
        value: displayValue,
        clear: { [filter.key]: null },
      });
    }
  }

  return chips.filter((chip) => filterMap.has(chip.key) || chip.key === "q" || chip.key === "date");
}

function ConfigFilterFields({
  fields,
  filters,
  update,
}: {
  fields: FilterConfig[];
  filters: TableQueryParams;
  update: (next: UrlStateUpdate) => void;
}) {
  return (
    <>
      {fields.map((filter) => (
        <FilterField key={filter.key} label={filter.label}>
          <FilterInput
            filter={filter}
            value={String(filters[filter.key] ?? "")}
            onChange={(value) =>
              update(
                filter.key === "source_granularity_key"
                  ? { source_granularity_key: value, source_company: null }
                  : { [filter.key]: value },
              )
            }
          />
        </FilterField>
      ))}
    </>
  );
}

function FilterGroupSection({
  group,
  filters,
  urlFilters,
  children,
}: {
  group: FilterGroupId;
  filters: FilterConfig[];
  urlFilters: TableQueryParams;
  children: ReactNode;
}) {
  const alwaysOpen = group === "find" || group === "status";
  const hasActive = filterGroupHasActiveValue(group, filters, urlFilters);
  const [open, setOpen] = useState(() => filterGroupStartsOpen(group, hasActive));
  const title = filterGroupTitle(group);
  const compact = group === "status";
  const body = (
    <div className={compact ? "grid grid-cols-2 gap-2" : "space-y-4"}>
      {children}
    </div>
  );

  return (
    <section
      data-filter-group={group}
      data-filter-group-open={alwaysOpen || open ? "true" : "false"}
      className="space-y-3 border-b border-steel-200 pb-4 last:border-b-0 last:pb-0"
    >
      {alwaysOpen ? (
        <h3 className="text-sm font-semibold text-navy">{title}</h3>
      ) : (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <h3 className="text-sm font-semibold text-navy">{title}</h3>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      )}
      {alwaysOpen || open ? body : null}
    </section>
  );
}

export function GroupedFilterFields({
  config,
  filters,
  update,
  setSort,
}: {
  config: ResourceConfig;
  filters: TableQueryParams;
  update: (next: UrlStateUpdate) => void;
  setSort: (field: string, direction: SortDirection) => void;
}) {
  return (
    <div className="space-y-4">
      {visibleFilterGroups(config.filters).map((group) => {
        const fields = filtersInGroup(config.filters, group);
        const hasActive = filterGroupHasActiveValue(group, config.filters, filters);
        const sectionKey =
          group === "find" || group === "status" ? group : `${group}:${hasActive ? "active" : "idle"}`;
        return (
          <FilterGroupSection key={sectionKey} group={group} filters={config.filters} urlFilters={filters}>
            {group === "find" ? (
              <>
                <FilterField label={OPERATIONAL_COPY.filters.search}>
                  <DebouncedSearchInput
                    value={String(filters.q ?? "")}
                    onCommit={(next) => update({ q: next || null })}
                    placeholder={OPERATIONAL_COPY.filters.searchPlaceholder}
                  />
                </FilterField>
                {config.dateSort ? (
                  <FilterField label={OPERATIONAL_COPY.filters.dateSorting}>
                    <DateSortSelect config={config.dateSort} filters={filters} setSort={setSort} />
                  </FilterField>
                ) : null}
                <FilterField label={OPERATIONAL_COPY.filters.dateRange}>
                  <DateRangeFilter
                    from={typeof filters.from === "string" ? filters.from : undefined}
                    to={typeof filters.to === "string" ? filters.to : undefined}
                    onChange={(range) => update(range)}
                  />
                </FilterField>
              </>
            ) : (
              <ConfigFilterFields fields={fields} filters={filters} update={update} />
            )}
          </FilterGroupSection>
        );
      })}
    </div>
  );
}

function DateSortSelect({
  config,
  filters,
  setSort,
}: {
  config: DateSortConfig;
  filters: TableQueryParams;
  setSort: (field: string, direction: SortDirection) => void;
}) {
  const value = filters.sort === config.field && filters.direction === "asc" ? "asc" : "desc";
  const options: SelectOption<SortDirection>[] = [
    { value: "desc", label: `${config.label}: Newest first` },
    { value: "asc", label: `${config.label}: Oldest first` },
  ];

  return (
    <SelectFilter<SortDirection>
      value={value}
      options={options}
      placeholder="Choose date sorting"
      onChange={(direction) => setSort(config.field, direction || "desc")}
    />
  );
}

export function ActiveFilterChips({
  config,
  filters,
  update,
  reset,
}: {
  config: ResourceConfig;
  filters: TableQueryParams;
  update: (next: UrlStateUpdate) => void;
  reset: () => void;
}) {
  const chips = getActiveFilterChips(config, filters);
  if (chips.length === 0) {
    return <p className="text-sm text-muted-foreground">No filters applied.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-xs font-semibold text-navy shadow-sm hover:bg-steel-100"
          onClick={() => update(chip.clear)}
        >
          <span>{chip.label}: {chip.value}</span>
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      ))}
      <Button variant="ghost" className="h-8 px-2 text-xs" onClick={reset}>
        Reset all
      </Button>
    </div>
  );
}

export function OperationalFilterPanel({
  config,
  filters,
  update,
  setSort,
  reset,
  collapsed,
  onToggleCollapsed,
}: {
  config: ResourceConfig;
  filters: TableQueryParams;
  update: (next: UrlStateUpdate) => void;
  setSort: (field: string, direction: SortDirection) => void;
  reset: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeCount = getActiveFilterChips(config, filters).length;

  return (
    <>
      <div className="sticky top-20 z-20 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur xl:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" className="gap-2" onClick={() => setMobileOpen(true)}>
            <Funnel className="h-4 w-4" aria-hidden="true" />
            Filters{activeCount ? ` (${activeCount})` : ""}
          </Button>
          <Button variant="ghost" onClick={reset}>
            Reset
          </Button>
        </div>
        <div className="mt-3">
          <ActiveFilterChips config={config} filters={filters} update={update} reset={reset} />
        </div>
      </div>

      <aside className="hidden xl:block">
        {collapsed ? (
          <div className="sticky top-24 flex flex-col items-center gap-3 rounded-lg border bg-background p-2 shadow-sm">
            <Button
              variant="ghost"
              className="h-9 w-9 px-0"
              onClick={onToggleCollapsed}
              aria-label="Expand filters"
              title="Expand filters"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
            <div className="flex flex-col items-center gap-2 py-2 text-muted-foreground">
              <Funnel className="h-4 w-4" aria-hidden="true" />
              {activeCount ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">
                  {activeCount}
                </span>
              ) : null}
              <span className="sr-only">Filters collapsed</span>
            </div>
          </div>
        ) : (
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-lg border bg-background p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Filters</h2>
                <p className="text-xs text-muted-foreground">Always available while scrolling.</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={reset}>
                  Reset
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 w-8 px-0"
                  onClick={onToggleCollapsed}
                  aria-label="Collapse filters"
                  title="Collapse filters"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <GroupedFilterFields config={config} filters={filters} update={update} setSort={setSort} />
          </div>
        )}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l bg-background shadow-xl">
            <header className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2 className="text-lg font-semibold">Filters</h2>
                <p className="mt-1 text-sm text-muted-foreground">Refine this operational view.</p>
              </div>
              <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => setMobileOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </header>
            <div className="flex-1 overflow-y-auto p-5">
              <GroupedFilterFields config={config} filters={filters} update={update} setSort={setSort} />
            </div>
            <footer className="flex items-center justify-between gap-3 border-t p-5">
              <Button variant="outline" onClick={reset}>
                Reset filters
              </Button>
              <Button onClick={() => setMobileOpen(false)}>Show results</Button>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}
