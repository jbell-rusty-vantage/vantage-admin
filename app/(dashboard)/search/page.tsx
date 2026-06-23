"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/data-table/status-badge";
import { TableEmptyState, TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import { MIN_SEARCH_QUERY_LENGTH, getCommittedSearchQuery } from "@/components/filters/debounced-search-input";
import { Button } from "@/components/ui/button";
import { fetchGlobalSearch } from "@/lib/api/admin";
import { parseDatabaseScope } from "@/lib/api/filters";
import type { GlobalSearchResultItem } from "@/lib/api/types";
import { queryKeys } from "@/lib/query/keys";

const labels: Record<string, string> = {
  "form-leads": "Form Leads",
  form_lead: "Form Leads",
  "call-leads": "Call Leads",
  call_lead: "Call Leads",
  "booked-leads": "Bookings",
  booked_lead: "Bookings",
  "cancelled-leads": "Cancellations",
  cancelled_lead: "Cancellations",
  customers: "Customers",
  customer: "Customers",
  agents: "Agents",
  agent: "Agents",
};

function normalizeHref(recordType: string, item: GlobalSearchResultItem) {
  const route =
    recordType === "form-leads" || recordType === "form_lead"
      ? "/form-leads"
      : recordType === "call-leads" || recordType === "call_lead"
        ? "/call-leads"
        : recordType === "booked-leads" || recordType === "booked_lead"
          ? "/bookings"
          : recordType === "cancelled-leads" || recordType === "cancelled_lead"
            ? "/cancellations"
            : recordType === "customers" || recordType === "customer"
              ? "/customers"
              : recordType === "agents" || recordType === "agent"
                ? "/agents"
                : "/";
  const params = new URLSearchParams({ q: item.id, database_scope: item.database_scope });
  return `${route}?${params.toString()}`;
}

function workflowActions(recordType: string, item: GlobalSearchResultItem) {
  if (item.database_scope !== "production") {
    return null;
  }
  if (recordType === "form-leads" || recordType === "form_lead") {
    return (
      <Link className="text-sm font-medium text-primary" href={`/bookings/new?lead_type=FormLead&lead_id=${item.id}`}>
        Start booking
      </Link>
    );
  }
  if (recordType === "call-leads" || recordType === "call_lead") {
    return (
      <Link className="text-sm font-medium text-primary" href={`/bookings/new?lead_type=CallLead`}>
        Start booking
      </Link>
    );
  }
  if (recordType === "booked-leads" || recordType === "booked_lead") {
    return (
      <Link className="text-sm font-medium text-primary" href={`/cancellations/new?booked_lead=${item.id}`}>
        Start cancellation
      </Link>
    );
  }
  return null;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const committedQuery = getCommittedSearchQuery(q);
  const canSearch = committedQuery !== null && committedQuery !== "";
  const scope = parseDatabaseScope(searchParams.get("database_scope"));
  const query = useQuery({
    queryKey: queryKeys.search.global(committedQuery ?? "", scope),
    queryFn: () => fetchGlobalSearch({ q: committedQuery ?? "", database_scope: scope, limit: 10 }),
    enabled: canSearch,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Search Results</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Searching for <span className="font-medium text-foreground">{committedQuery || q || "nothing yet"}</span> in {scope}.
        </p>
      </div>

      {!q ? <TableEmptyState label="Enter a search query in the top bar." /> : null}
      {committedQuery === null ? (
        <TableEmptyState label={`Enter at least ${MIN_SEARCH_QUERY_LENGTH} characters to search.`} />
      ) : null}
      {canSearch && query.isLoading ? <TableLoadingState label="Searching..." /> : null}
      {query.isError ? (
        <TableErrorState error={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />
      ) : null}
      {query.data && query.data.groups.length === 0 ? <TableEmptyState label="No records matched this search." /> : null}
      <div className="space-y-4">
        {query.data?.groups.map((group) => (
          <section key={group.record_type} className="rounded-lg border bg-background p-4">
            <h2 className="text-sm font-semibold">{labels[group.record_type] ?? group.record_type}</h2>
            <div className="mt-3 divide-y">
              {group.items.map((item) => (
                <div key={`${group.record_type}-${item.id}`} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link className="font-medium hover:underline" href={normalizeHref(group.record_type, item)}>
                        {item.primary_label}
                      </Link>
                      <StatusBadge tone={item.database_scope === "historical" ? "warning" : "success"}>
                        {item.database_scope}
                      </StatusBadge>
                      {item.badges?.map((badge) => (
                        <StatusBadge key={badge} tone="muted">
                          {badge}
                        </StatusBadge>
                      ))}
                    </div>
                    {item.secondary_label ? <p className="mt-1 text-sm text-muted-foreground">{item.secondary_label}</p> : null}
                    <p className="mt-1 text-xs text-muted-foreground">{item.id}</p>
                  </div>
                  <div className="flex gap-3">
                    {workflowActions(group.record_type, item)}
                    <Button variant="outline" onClick={() => window.location.assign(normalizeHref(group.record_type, item))}>
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
