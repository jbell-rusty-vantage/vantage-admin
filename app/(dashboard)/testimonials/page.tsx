"use client";

import Link from "next/link";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { formatDate } from "@/components/data-table/formatters";
import { DataTable, type DataTableColumn } from "@/components/data-table/table-shell";
import { TableEmptyState, TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import { DebouncedSearchInput, getCommittedSearchQuery } from "@/components/filters/debounced-search-input";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { SelectFilter } from "@/components/filters/select-filter";
import { StatusBadge } from "@/components/data-table/status-badge";
import { TestimonialDetailPanel } from "@/components/testimonials/testimonial-detail-panel";
import { Button } from "@/components/ui/button";
import {
  fetchAdminTestimonialReviewerNames,
  fetchAdminTestimonials,
  type AdminTestimonial,
} from "@/lib/api/admin";
import type { SerializableFilters } from "@/lib/api/filters";
import type { SelectOption } from "@/lib/api/types";
import { useUrlTableState } from "@/lib/api/url-state";
import { queryKeys } from "@/lib/query/keys";

const ratingOptions: SelectOption[] = [
  { value: "5", label: "5 stars" },
  { value: "4", label: "4 stars" },
  { value: "3", label: "3 stars" },
  { value: "2", label: "2 stars" },
  { value: "1", label: "1 star" },
];

export default function TestimonialsPage() {
  const [selectedTestimonial, setSelectedTestimonial] = useState<AdminTestimonial | null>(null);
  const { filters, update, setPage, reset } = useUrlTableState({
    page: 1,
    limit: 50,
    sort: "review_date",
    direction: "desc",
  });
  const committedSearchQuery =
    typeof filters.q === "string" ? getCommittedSearchQuery(filters.q, 2) : "";
  const hasInvalidSearchQuery = committedSearchQuery === null;
  const listFilters: SerializableFilters = {
    ...filters,
    q: hasInvalidSearchQuery ? undefined : committedSearchQuery || undefined,
    sort: "review_date",
    direction: filters.direction === "asc" ? "asc" : "desc",
    page: filters.page ?? 1,
    limit: filters.limit ?? 50,
  };

  const testimonialsQuery = useQuery({
    queryKey: queryKeys.testimonials.list(listFilters),
    queryFn: () => fetchAdminTestimonials(listFilters),
    placeholderData: keepPreviousData,
  });
  const reviewerNamesQuery = useQuery({
    queryKey: queryKeys.testimonials.reviewerNames(),
    queryFn: fetchAdminTestimonialReviewerNames,
    staleTime: 5 * 60 * 1000,
  });

  const reviewerOptions = (reviewerNamesQuery.data ?? []).map((name) => ({
    value: name,
    label: name,
  }));
  const items = testimonialsQuery.data?.items ?? [];
  const page = testimonialsQuery.data?.page ?? Number(filters.page ?? 1);
  const limit = testimonialsQuery.data?.limit ?? Number(filters.limit ?? 50);
  const total = testimonialsQuery.data?.total;
  const hasNextPage = testimonialsQuery.data?.has_next_page === true;
  const direction = filters.direction === "asc" ? "asc" : "desc";

  function setDirection(nextDirection: "asc" | "desc") {
    update({ direction: nextDirection, sort: "review_date" });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Testimonials</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search BBB testimonials by reviewer, stars, and review date without changing the public main-site feed. Click a row to read the full review.
        </p>
      </div>

      <div className="rounded-lg border bg-background p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1.5fr)_minmax(12rem,1fr)_10rem_minmax(14rem,1fr)_auto] lg:items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Reviewer search
            </label>
            <DebouncedSearchInput
              value={typeof filters.q === "string" ? filters.q : ""}
              onCommit={(value) => update({ q: value })}
              minLength={2}
              placeholder="Search reviewer name..."
              aria-label="Search testimonials by reviewer name"
            />
            {hasInvalidSearchQuery ? (
              <p className="text-xs text-muted-foreground">Enter at least 2 characters to search.</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Reviewer dropdown
            </label>
            <SelectFilter
              value={typeof filters.reviewer_name === "string" ? filters.reviewer_name : ""}
              options={reviewerOptions}
              placeholder={reviewerNamesQuery.isLoading ? "Loading reviewers..." : "Any reviewer"}
              onChange={(value) => update({ reviewer_name: value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stars</label>
            <SelectFilter
              value={typeof filters.rating === "string" ? filters.rating : ""}
              options={ratingOptions}
              placeholder="Any stars"
              onChange={(value) => update({ rating: value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Review date
            </label>
            <DateRangeFilter
              from={typeof filters.from === "string" ? filters.from : undefined}
              to={typeof filters.to === "string" ? filters.to : undefined}
              onChange={(range) => update(range)}
            />
          </div>

          <Button variant="outline" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reset
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Sort by review date:</span>
          <Button
            variant={direction === "desc" ? "default" : "outline"}
            className="h-8 px-3 text-xs"
            onClick={() => setDirection("desc")}
          >
            <ArrowDown className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Newest
          </Button>
          <Button
            variant={direction === "asc" ? "default" : "outline"}
            className="h-8 px-3 text-xs"
            onClick={() => setDirection("asc")}
          >
            <ArrowUp className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Oldest
          </Button>
        </div>
      </div>

      {testimonialsQuery.isLoading ? <TableLoadingState label="Loading testimonials..." /> : null}
      {testimonialsQuery.isError ? (
        <TableErrorState
          error={testimonialsQuery.error instanceof Error ? testimonialsQuery.error.message : undefined}
          onRetry={() => testimonialsQuery.refetch()}
        />
      ) : null}
      {testimonialsQuery.data && items.length === 0 ? (
        <TableEmptyState label="No testimonials match these filters." />
      ) : null}
      {items.length > 0 ? (
        <>
          <DataTable
            items={items}
            columns={columns}
            getRowKey={(item) => item.id}
            onRowClick={setSelectedTestimonial}
            stickyHeader
            compact
            horizontalControls
          />
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Showing page {page}
              {total !== undefined ? ` of ${Math.max(1, Math.ceil(total / limit))}` : ""}
              {total !== undefined ? ` (${total} testimonials)` : ""}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || testimonialsQuery.isFetching}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!hasNextPage || testimonialsQuery.isFetching}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <TestimonialDetailPanel
        testimonial={selectedTestimonial}
        onClose={() => setSelectedTestimonial(null)}
      />
    </div>
  );
}

const columns: DataTableColumn<AdminTestimonial>[] = [
  {
    key: "reviewer",
    header: "Reviewer",
    cell: (item) => (
      <div>
        <div className="font-medium text-foreground">{item.reviewer_name || "-"}</div>
        <div className="text-xs text-muted-foreground">{item.source_company || item.source}</div>
      </div>
    ),
    sticky: "left",
  },
  {
    key: "date",
    header: "Review Date",
    cell: (item) => formatDate(item.review_date),
  },
  {
    key: "rating",
    header: "Stars",
    cell: (item) => `${item.rating} star${item.rating === 1 ? "" : "s"}`,
  },
  {
    key: "review",
    header: "Review",
    cell: (item) => item.review_text || "-",
    truncate: true,
    cellClassName: "max-w-lg",
  },
  {
    key: "customer",
    header: "Customer",
    cell: (item) =>
      item.customer?.id ? (
        <Link
          className="font-medium text-navy underline-offset-4 hover:underline"
          href={`/customers?record=${item.customer.id}`}
          onClick={(event) => event.stopPropagation()}
        >
          {item.customer.full_name || "Linked customer"}
        </Link>
      ) : (
        <StatusBadge tone="muted">Not linked</StatusBadge>
      ),
  },
  {
    key: "published",
    header: "Published",
    cell: (item) => <StatusBadge tone={item.published ? "success" : "muted"}>{item.published ? "Yes" : "No"}</StatusBadge>,
  },
  {
    key: "featured",
    header: "Featured",
    cell: (item) => <StatusBadge tone={item.featured ? "success" : "muted"}>{item.featured ? "Yes" : "No"}</StatusBadge>,
  },
];
