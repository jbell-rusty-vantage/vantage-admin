"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/data-table/table-shell";
import { formatDateTime } from "@/components/data-table/formatters";
import { PaginationControls } from "@/components/data-table/pagination-controls";
import {
  TableEmptyState,
  TableErrorState,
  TableLoadingState,
} from "@/components/data-table/table-states";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { FilterBar } from "@/components/filters/filter-bar";
import { FilterField } from "@/components/filters/filter-field";
import { SelectFilter } from "@/components/filters/select-filter";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { exclusiveEndDate } from "@/components/observational/entity-link";
import { fetchRegistryChanges, type RegistryChangeItem } from "@/lib/api/operationsRegistry";
import {
  REGISTRY_CHANGE_ACTIONS,
  REGISTRY_CHANGE_ENTITY_TYPES,
  adminAuditRequestHref,
  humanizeRegistryKey,
  registryEntityHref,
} from "@/lib/api/registryEntityLinks";
import { formatRegistryError } from "@/lib/api/registryRequest";
import {
  diffRegistrySnapshots,
  formatSnapshotValue,
  type SnapshotDiffEntry,
} from "@/lib/api/registrySnapshotDiff";
import { useUrlTableState } from "@/lib/api/url-state";
import { queryKeys } from "@/lib/query/keys";

const ENTITY_OPTIONS = REGISTRY_CHANGE_ENTITY_TYPES.map((value) => ({
  value,
  label: humanizeRegistryKey(value),
}));

const ACTION_OPTIONS = REGISTRY_CHANGE_ACTIONS.map((value) => ({
  value,
  label: humanizeRegistryKey(value),
}));

const FILTER_KEYS = [
  "entity_type",
  "entity_id",
  "action",
  "actor_id",
  "request_id",
  "from",
  "to",
  "page",
  "limit",
] as const;

function pickChangeFilters(filters: Record<string, unknown>) {
  const out: Record<string, string | number> = {};
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (typeof value === "string" || typeof value === "number") {
      out[key] = value;
    }
  }
  // Server uses inclusive $lte. Date-only `to` is advanced one day so the selected
  // calendar day is fully included (instant timestamps, not NY business dates).
  if (typeof out.to === "string") {
    const adjusted = exclusiveEndDate(out.to);
    if (adjusted) {
      out.to = adjusted;
    }
  }
  if (!out.limit) {
    out.limit = 25;
  }
  if (!out.page) {
    out.page = 1;
  }
  return out;
}

function SnapshotDiffPanel({ item }: { item: RegistryChangeItem }) {
  const entries = useMemo(
    () => diffRegistrySnapshots(item.before, item.after),
    [item.before, item.after],
  );

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No before/after field differences recorded.</p>
    );
  }

  return (
    <div className="max-h-72 overflow-auto rounded-md border bg-muted/20">
      <table className="w-full min-w-[36rem] text-left text-xs">
        <caption className="sr-only">
          Before and after snapshot diff for {item.entity_type} {item.entity_id}
        </caption>
        <thead className="sticky top-0 bg-background">
          <tr className="border-b">
            <th scope="col" className="px-2 py-1.5 font-semibold">
              Field
            </th>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              Change
            </th>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              Before
            </th>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              After
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <DiffRow key={`${entry.path}-${entry.kind}`} entry={entry} />
          ))}
        </tbody>
      </table>
      {entries.length >= 200 ? (
        <p className="border-t px-2 py-1.5 text-muted-foreground">
          Diff truncated at 200 fields to keep the page responsive.
        </p>
      ) : null}
    </div>
  );
}

function DiffRow({ entry }: { entry: SnapshotDiffEntry }) {
  const tone =
    entry.kind === "added"
      ? "text-emerald-800"
      : entry.kind === "removed"
        ? "text-destructive"
        : "text-foreground";
  return (
    <tr className="border-b border-border/60 align-top">
      <td className="px-2 py-1.5 font-mono text-[11px]">{entry.path}</td>
      <td className={`px-2 py-1.5 font-medium capitalize ${tone}`}>{entry.kind}</td>
      <td className="px-2 py-1.5 font-mono text-[11px] break-all">
        {formatSnapshotValue(entry.before)}
      </td>
      <td className="px-2 py-1.5 font-mono text-[11px] break-all">
        {formatSnapshotValue(entry.after)}
      </td>
    </tr>
  );
}

function ChangeDetail({ item }: { item: RegistryChangeItem }) {
  const role = useDashboardRole();
  const entityLink = registryEntityHref(item.entity_type, item.entity_id);
  const auditHref = adminAuditRequestHref(item.request_id);

  return (
    <div className="space-y-3 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-navy">
            {humanizeRegistryKey(item.action)} · {humanizeRegistryKey(item.entity_type)}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateTime(item.created_at)} · {item.actor_label} ({item.actor_role}) · entity{" "}
            <span className="font-mono">{item.entity_id}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-medium">
          {entityLink ? (
            <Link href={entityLink.href} className="text-primary hover:underline">
              {entityLink.label}
            </Link>
          ) : null}
          {auditHref && role === "owner" ? (
            <Link href={auditHref} className="text-primary hover:underline">
              Open Admin Audit
            </Link>
          ) : null}
          {auditHref && role !== "owner" ? (
            <span className="text-muted-foreground" title="Admin Audit is Owner-only">
              Request {item.request_id}
            </span>
          ) : null}
        </div>
      </div>

      <FeedbackMessage tone="info">
        Registry Changes are domain mutation history committed with registry state. Admin Audit is
        the dashboard proxy request record. They correlate through <code>request_id</code>.
      </FeedbackMessage>

      {item.reason ? <p className="text-sm text-muted-foreground">Reason: {item.reason}</p> : null}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Before / after
        </h4>
        <SnapshotDiffPanel item={item} />
      </div>
    </div>
  );
}

export function RegistryChanges() {
  const { filters, update } = useUrlTableState({
    page: 1,
    limit: 25,
    tab: "changes",
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const apiFilters = useMemo(() => pickChangeFilters(filters), [filters]);

  const query = useQuery({
    queryKey: queryKeys.operationsRegistry.changes(apiFilters),
    queryFn: () => fetchRegistryChanges(apiFilters),
  });

  function resetFilters() {
    update(
      {
        tab: "changes",
        entity_type: "",
        entity_id: "",
        action: "",
        actor_id: "",
        request_id: "",
        from: "",
        to: "",
        page: 1,
        limit: Number(filters.limit) || 25,
      },
      { resetPage: false },
    );
    setExpandedId(null);
  }

  if (query.isPending) {
    return <TableLoadingState label="Loading registry changes..." />;
  }

  if (query.isError) {
    return (
      <TableErrorState
        title="Unable to load registry changes."
        error={formatRegistryError(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }

  const data = query.data;
  const items = data.items;
  const expanded = items.find((item) => item.id === expandedId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-navy">Registry Change history</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Authoritative domain mutations from <code>operations_registry_changes</code>. Timestamps
          are instants (not New York CPL business dates). End date includes the selected calendar
          day.
        </p>
      </div>

      <FilterBar onReset={resetFilters}>
        <FilterField label="Entity type">
          <SelectFilter
            value={String(filters.entity_type ?? "") as typeof REGISTRY_CHANGE_ENTITY_TYPES[number] | ""}
            options={ENTITY_OPTIONS}
            onChange={(value) => update({ entity_type: value, tab: "changes" })}
          />
        </FilterField>
        <FilterField label="Entity ID">
          <Input
            value={String(filters.entity_id ?? "")}
            onChange={(event) => update({ entity_id: event.target.value, tab: "changes" })}
            placeholder="Exact entity id"
            aria-label="Entity ID"
          />
        </FilterField>
        <FilterField label="Action">
          <SelectFilter
            value={String(filters.action ?? "") as typeof REGISTRY_CHANGE_ACTIONS[number] | ""}
            options={ACTION_OPTIONS}
            onChange={(value) => update({ action: value, tab: "changes" })}
          />
        </FilterField>
        <FilterField label="Actor ID">
          <Input
            value={String(filters.actor_id ?? "")}
            onChange={(event) => update({ actor_id: event.target.value, tab: "changes" })}
            placeholder="Actor id"
            aria-label="Actor ID"
          />
        </FilterField>
        <FilterField label="Request ID">
          <Input
            value={String(filters.request_id ?? "")}
            onChange={(event) => update({ request_id: event.target.value, tab: "changes" })}
            placeholder="Correlate with Admin Audit"
            aria-label="Request ID"
          />
        </FilterField>
        <FilterField label="Date range (instant)">
          <DateRangeFilter
            from={typeof filters.from === "string" ? filters.from : undefined}
            to={typeof filters.to === "string" ? filters.to : undefined}
            onChange={(range) => update({ ...range, tab: "changes" })}
          />
        </FilterField>
      </FilterBar>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        Page {data.page} · {data.total} total changes
      </p>

      {items.length === 0 ? (
        <TableEmptyState label="No registry changes match these filters." />
      ) : (
        <DataTable
          items={items}
          getRowKey={(item) => item.id}
          compact
          columns={[
            {
              key: "created_at",
              header: "When",
              cell: (item) => formatDateTime(item.created_at),
            },
            {
              key: "actor",
              header: "Actor",
              cell: (item) => (
                <span>
                  {item.actor_label}
                  <span className="block text-xs text-muted-foreground">{item.actor_role}</span>
                </span>
              ),
            },
            {
              key: "action",
              header: "Action",
              cell: (item) => humanizeRegistryKey(item.action),
            },
            {
              key: "entity",
              header: "Entity",
              cell: (item) => (
                <span>
                  {humanizeRegistryKey(item.entity_type)}
                  <span className="block font-mono text-xs text-muted-foreground">
                    {item.entity_id}
                  </span>
                </span>
              ),
            },
            {
              key: "request_id",
              header: "Request",
              truncate: true,
              cell: (item) => item.request_id || "—",
            },
            {
              key: "reason",
              header: "Reason",
              truncate: true,
              cell: (item) => item.reason ?? "—",
            },
            {
              key: "diff",
              header: "Diff",
              cell: (item) => (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  aria-expanded={expandedId === item.id}
                  onClick={() => setExpandedId((current) => (current === item.id ? null : item.id))}
                >
                  {expandedId === item.id ? "Hide" : "View"}
                </Button>
              ),
            },
          ]}
        />
      )}

      {expanded ? <ChangeDetail item={expanded} /> : null}

      <PaginationControls
        page={Number(filters.page) || 1}
        limit={Number(filters.limit) || 25}
        total={data.total}
        hasNextPage={data.has_next_page}
        onPageChange={(page) => update({ tab: "changes", page }, { resetPage: false })}
        onLimitChange={(limit) => update({ tab: "changes", limit, page: 1 }, { resetPage: false })}
      />
    </div>
  );
}
