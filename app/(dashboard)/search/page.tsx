"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/data-table/status-badge";
import { TableEmptyState, TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import { MIN_SEARCH_QUERY_LENGTH, getCommittedSearchQuery } from "@/components/filters/debounced-search-input";
import { Button } from "@/components/ui/button";
import { fetchGlobalSearch } from "@/lib/api/admin";
import type { GlobalSearchResultItem } from "@/lib/api/types";
import { queryKeys } from "@/lib/query/keys";

const routes: Record<string, { label: string; href: string }> = {
  "form-leads": { label: "Form Leads", href: "/form-leads" },
  form_lead: { label: "Form Leads", href: "/form-leads" },
  "call-leads": { label: "Call Leads", href: "/call-leads" },
  call_lead: { label: "Call Leads", href: "/call-leads" },
  "booked-leads": { label: "Bookings", href: "/bookings" },
  booked_lead: { label: "Bookings", href: "/bookings" },
  "cancelled-leads": { label: "Cancellations", href: "/cancellations" },
  cancelled_lead: { label: "Cancellations", href: "/cancellations" },
};

function resultHref(route: string, item: GlobalSearchResultItem) {
  const params = new URLSearchParams({ q: item.id });
  return `${route}?${params.toString()}`;
}

function workflowActions(recordType: string, item: GlobalSearchResultItem) {
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
  const query = useQuery({
    queryKey: queryKeys.search.global(committedQuery ?? ""),
    queryFn: () => fetchGlobalSearch({ q: committedQuery ?? "", limit: 10 }),
    enabled: canSearch,
  });
  // Only official Lead, Booking and Cancellation records have a dashboard destination.
  const groups = query.data?.groups.filter((group) => routes[group.record_type]) ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Search Results</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Searching for <span className="font-medium text-foreground">{committedQuery || q || "nothing yet"}</span>.
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
      {query.data && groups.length === 0 ? <TableEmptyState label="No records matched this search." /> : null}
      <div className="space-y-4">
        {groups.map((group) => {
          const route = routes[group.record_type];
          return (
            <section key={group.record_type} className="rounded-lg border bg-background p-4">
              <h2 className="text-sm font-semibold">{route.label}</h2>
              <div className="mt-3 divide-y">
                {group.items.map((item) => (
                  <div key={`${group.record_type}-${item.id}`} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link className="font-medium hover:underline" href={resultHref(route.href, item)}>
                          {item.primary_label}
                        </Link>
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
                      <Button variant="outline" onClick={() => window.location.assign(resultHref(route.href, item))}>
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
