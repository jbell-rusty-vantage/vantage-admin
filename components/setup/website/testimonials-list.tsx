"use client";
/**
 * The Testimonials page, re-homed under Setup → Website and restyled on the CRM primitives. Same reads
 * (`fetchAdminTestimonials`, `fetchAdminTestimonialReviewerNames`) and the same URL-held filters: `q`, `reviewer_name`,
 * `rating`, `from`, `to`, `direction`, `page`, `limit`. The detail is a `RecordDrawer` held in local state.
 */
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getCommittedSearchQuery } from "@/components/filters/debounced-search-input";
import { formatShortDate } from "@/components/ui/crm/format";
import { CrmCard, CrmSelect, Pill, ReadFailure, SearchBox, Segmented, SkeletonLine } from "@/components/ui/crm/primitives";
import { fetchAdminTestimonialReviewerNames, fetchAdminTestimonials, type AdminTestimonial } from "@/lib/api/admin";
import type { SerializableFilters } from "@/lib/api/filters";
import { useUrlTableState } from "@/lib/api/url-state";
import { queryKeys } from "@/lib/query/keys";
import { TestimonialDrawer } from "./testimonial-drawer";
import { WEBSITE_COPY } from "./website-copy";

const RATING_OPTIONS = [{ value: "", label: WEBSITE_COPY.stars.any }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: WEBSITE_COPY.rating(n) }))];

const TABLE_DEFAULTS = { page: 1, limit: 50, sort: "review_date", direction: "desc" } as const;

export function TestimonialsList() {
  const copy = WEBSITE_COPY;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { filters, update, setPage, reset } = useUrlTableState(TABLE_DEFAULTS);
  const committedSearch = typeof filters.q === "string" ? getCommittedSearchQuery(filters.q, 2) : "";
  const invalidSearch = committedSearch === null;
  const direction = filters.direction === "asc" ? "asc" : "desc";
  const listFilters: SerializableFilters = {
    ...filters,
    q: invalidSearch ? undefined : committedSearch || undefined,
    sort: "review_date",
    direction,
    page: filters.page ?? 1,
    limit: filters.limit ?? 50,
  };

  const testimonials = useQuery({
    queryKey: queryKeys.testimonials.list(listFilters),
    queryFn: () => fetchAdminTestimonials(listFilters),
    placeholderData: keepPreviousData,
  });
  const reviewerNames = useQuery({
    queryKey: queryKeys.testimonials.reviewerNames(),
    queryFn: fetchAdminTestimonialReviewerNames,
    staleTime: 5 * 60 * 1000,
  });

  const reviewer = typeof filters.reviewer_name === "string" ? filters.reviewer_name : "";
  const rating = typeof filters.rating === "string" ? filters.rating : "";
  const from = typeof filters.from === "string" ? filters.from : "";
  const to = typeof filters.to === "string" ? filters.to : "";
  const reviewerOptions = [{ value: "", label: reviewerNames.isLoading ? copy.reviewer.loading : copy.reviewer.any }, ...(reviewerNames.data ?? []).map((name) => ({ value: name, label: name }))];
  if (reviewer && !reviewerOptions.some((option) => option.value === reviewer)) reviewerOptions.push({ value: reviewer, label: reviewer });

  const items = testimonials.data?.items ?? [];
  const page = testimonials.data?.page ?? Number(filters.page ?? 1);
  const limit = testimonials.data?.limit ?? Number(filters.limit ?? 50);
  const total = testimonials.data?.total;
  const pages = total !== undefined ? Math.max(1, Math.ceil(total / limit)) : null;
  const hasNextPage = testimonials.data?.has_next_page === true;
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const narrowed = Boolean(filters.q || reviewer || rating || from || to);

  return (
    <CrmCard title={copy.listTitle} subtitle={copy.listSubtitle} testId="testimonials-card">
      <div className="crm-toolbar ws-toolbar">
        <SearchBox
          value={typeof filters.q === "string" ? filters.q : null}
          onSearch={(value) => update({ q: value }, { replace: true })}
          placeholder={copy.searchPlaceholder}
          hint={invalidSearch ? copy.searchMinimum : undefined}
        />
        <CrmSelect value={reviewer} onChange={(value) => update({ reviewer_name: value })} options={reviewerOptions} label={copy.reviewer.label} active={Boolean(reviewer)} />
        <CrmSelect value={rating} onChange={(value) => update({ rating: value })} options={RATING_OPTIONS} label={copy.stars.label} active={Boolean(rating)} />
        <label className="ws-date">
          <span className="ws-date__label">{copy.dates.from}</span>
          <input className="su-input" type="date" value={from} max={to || undefined} onChange={(event) => update({ from: event.target.value })} />
        </label>
        <label className="ws-date">
          <span className="ws-date__label">{copy.dates.to}</span>
          <input className="su-input" type="date" value={to} min={from || undefined} onChange={(event) => update({ to: event.target.value })} />
        </label>
        <Segmented
          label={copy.sort.label}
          size="sm"
          value={direction}
          onChange={(value) => update({ direction: value, sort: "review_date" })}
          options={[
            { value: "desc", label: copy.sort.newest },
            { value: "asc", label: copy.sort.oldest },
          ]}
        />
        {narrowed ? (
          <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={reset}>
            {copy.clear}
          </button>
        ) : null}
      </div>

      {testimonials.isPending ? (
        <div className="ws-skeleton" role="status" aria-label={copy.loading}>
          <SkeletonLine height={16} />
          <SkeletonLine height={16} width="85%" />
          <SkeletonLine height={16} width="70%" />
        </div>
      ) : testimonials.isError ? (
        <ReadFailure what={copy.readFailure} error={testimonials.error} onRetry={() => void testimonials.refetch()} inset />
      ) : items.length === 0 ? (
        <div className="crm-empty">
          <p>{copy.empty}</p>
        </div>
      ) : (
        <>
          <TestimonialsTable items={items} selectedId={selectedId} onOpen={setSelectedId} />
          <div className="ws-pager">
            <span className="su-quiet" aria-live="polite">
              {copy.page(page, pages, total)}
            </span>
            <span className="ws-pager__buttons">
              <button type="button" className="crm-button crm-button--sm" disabled={page <= 1 || testimonials.isFetching} onClick={() => setPage(page - 1)}>
                {copy.previous}
              </button>
              <button type="button" className="crm-button crm-button--sm" disabled={!hasNextPage || testimonials.isFetching} onClick={() => setPage(page + 1)}>
                {copy.next}
              </button>
            </span>
          </div>
        </>
      )}

      {selected ? <TestimonialDrawer testimonial={selected} onClose={() => setSelectedId(null)} /> : null}
    </CrmCard>
  );
}

function TestimonialRow({ item, selected, onOpen }: { item: AdminTestimonial; selected: boolean; onOpen: () => void }) {
  const copy = WEBSITE_COPY;
  return (
    <tr data-selectable="true" aria-selected={selected} onClick={onOpen}>
      <th scope="row">
        <button
          type="button"
          className="crm-linkbutton ws-open"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {item.reviewer_name || copy.drawer.none}
        </button>
        <span className="crm-cell__sub">{item.source_company || item.source}</span>
      </th>
      <td>{formatShortDate(item.review_date)}</td>
      <td>{copy.rating(item.rating)}</td>
      <td className="ws-review">{item.review_text || copy.drawer.none}</td>
      <td>{item.customer?.id ? <span className="crm-strong">{item.customer.full_name || copy.linkedCustomer}</span> : <Pill variant="gray">{copy.notLinked}</Pill>}</td>
      <td>
        <Pill variant={item.published ? "green" : "gray"}>{item.published ? copy.yes : copy.no}</Pill>
      </td>
      <td>
        <Pill variant={item.featured ? "gold" : "gray"}>{item.featured ? copy.yes : copy.no}</Pill>
      </td>
    </tr>
  );
}

/** The testimonials as a `.crm-table`; a row (or its reviewer name) opens the full review. */
export function TestimonialsTable({ items, selectedId, onOpen }: { items: readonly AdminTestimonial[]; selectedId: string | null; onOpen: (id: string) => void }) {
  const copy = WEBSITE_COPY;
  return (
    <div className="crm-table-wrap">
      <table className="crm-table" data-testid="testimonials-table">
        <thead>
          <tr>
            <th scope="col">{copy.columns.reviewer}</th>
            <th scope="col">{copy.columns.date}</th>
            <th scope="col">{copy.columns.stars}</th>
            <th scope="col">{copy.columns.review}</th>
            <th scope="col">{copy.columns.customer}</th>
            <th scope="col">{copy.columns.published}</th>
            <th scope="col">{copy.columns.featured}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <TestimonialRow key={item.id} item={item} selected={item.id === selectedId} onOpen={() => onOpen(item.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
