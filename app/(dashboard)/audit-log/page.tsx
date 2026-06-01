"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/data-table/table-shell";
import { PaginationControls } from "@/components/data-table/pagination-controls";
import { StatusBadge } from "@/components/data-table/status-badge";
import { TableEmptyState, TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { FilterBar } from "@/components/filters/filter-bar";
import { FilterField } from "@/components/filters/filter-field";
import { SelectFilter } from "@/components/filters/select-filter";
import { Input } from "@/components/ui/input";
import { fetchAuditLog, type AuditLogRecord } from "@/lib/api/audit";
import { useUrlTableState } from "@/lib/api/url-state";
import { queryKeys } from "@/lib/query/keys";

const okOptions = [
  { value: "true", label: "Success" },
  { value: "false", label: "Failure" },
];

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function friendlyAction(record: AuditLogRecord) {
  if (record.action === "proxy_mutation") {
    const method = (record.request_payload as { method?: string } | undefined)?.method;
    return `${method ?? "write"} ${record.entity_type ?? ""}`;
  }
  if (record.action === "proxy_export_request") {
    return `export ${record.entity_type ?? ""}`;
  }
  return record.action.replaceAll("_", " ");
}

export default function AuditLogPage() {
  const { filters, update, setPage, setLimit, reset } = useUrlTableState({ page: 1, limit: 50 });
  const query = useQuery({
    queryKey: queryKeys.auditLog.list(filters),
    queryFn: () => fetchAuditLog(filters),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">Admin auth, mutation, and export activity recorded by the admin app.</p>
      </div>
      <FilterBar onReset={reset}>
        <FilterField label="Action">
          <Input value={String(filters.action ?? "")} onChange={(event) => update({ action: event.target.value })} />
        </FilterField>
        <FilterField label="Entity">
          <Input value={String(filters.entity_type ?? "")} onChange={(event) => update({ entity_type: event.target.value })} />
        </FilterField>
        <FilterField label="Admin email">
          <Input value={String(filters.admin_email ?? "")} onChange={(event) => update({ admin_email: event.target.value })} />
        </FilterField>
        <FilterField label="Status">
          <SelectFilter value={String(filters.ok ?? "")} options={okOptions} onChange={(value) => update({ ok: value })} />
        </FilterField>
        <FilterField label="Date range">
          <DateRangeFilter
            from={typeof filters.from === "string" ? filters.from : undefined}
            to={typeof filters.to === "string" ? filters.to : undefined}
            onChange={(range) => update(range)}
          />
        </FilterField>
      </FilterBar>
      {query.isLoading ? <TableLoadingState label="Loading audit log..." /> : null}
      {query.isError ? (
        <TableErrorState error={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />
      ) : null}
      {query.data && query.data.items.length === 0 ? <TableEmptyState label="No audit events match these filters." /> : null}
      {query.data && query.data.items.length > 0 ? (
        <>
          <DataTable
            items={query.data.items}
            getRowKey={(item) => item._id}
            columns={[
              { key: "time", header: "Time", cell: (item) => formatTime(item.timestamp) },
              { key: "admin", header: "Admin", cell: (item) => item.admin_email ?? "-" },
              { key: "action", header: "Action", cell: friendlyAction },
              { key: "entity", header: "Entity", cell: (item) => item.entity_type ?? "-" },
              { key: "scope", header: "Scope", cell: (item) => item.database_scope ?? "-" },
              {
                key: "ok",
                header: "Result",
                cell: (item) => <StatusBadge tone={item.ok ? "success" : "destructive"}>{item.ok ? "OK" : "Failed"}</StatusBadge>,
              },
              { key: "status", header: "HTTP", cell: (item) => item.response_status ?? "-" },
              { key: "error", header: "Error", cell: (item) => item.error_message ?? "-" },
            ]}
          />
          <PaginationControls
            page={filters.page}
            limit={filters.limit}
            total={query.data.total}
            hasNextPage={query.data.has_next_page}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </>
      ) : null}
    </div>
  );
}
