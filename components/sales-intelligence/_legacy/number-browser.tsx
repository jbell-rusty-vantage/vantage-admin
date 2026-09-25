"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { numberSearchSchema, readSalesIntelligence, SalesIntelligenceError } from "@/lib/api/salesIntelligence";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { cx, formatDateTime, leadMatchSummary } from "../lib/format";
import { Button } from "../atoms/button";
import { NumbersListSkeleton } from "./list-skeletons";
import { PageControls } from "../page-controls";
import { FilterSheet } from "../atoms/filter-sheet";
import { ClassificationBadge, EligibilityBadge, EmptyState, Failure, FilterRail, FilterToolbar } from "../chrome";
import { numberChips, NumbersFilters } from "./filters";
import { readFiltersOpen, readList, writeFiltersOpen, writeList } from "../lib/filter-state";
import { LIST_PAGE_SIZE, numberNextPage, numberPageOffset, numberPreviousPage, pageWindow } from "../lib/paging";
import { useSiLayout } from "../lib/layout";
import { currentSalesIntelligenceHref } from "../lib/official-record";
import { NUMBER_SORT_OPTIONS, applyNumberSort, isDefaultNumberSort, numberSortFromParams, sortOption } from "../lib/sort";
import { SortControl } from "../sort-control";
import { AttachedLeadLine } from "../lead-progress";

function NumberPages({
  params,
  count,
  nextCursor,
  update,
}: {
  params: URLSearchParams;
  count: number;
  nextCursor: string | null;
  update: (values: Record<string, string | boolean | null | undefined | string[]>) => void;
}) {
  const cursor = params.get("number_cursor");
  const before = readList(params, "number_before");
  const window = pageWindow(numberPageOffset(before.length, Boolean(cursor)), count);
  if (!window) return null;
  return (
    <PageControls
      label={copy.actions.pageRange(window.start, window.end)}
      canPrevious={Boolean(cursor)}
      canNext={Boolean(nextCursor)}
      onPrevious={() => {
        const previous = numberPreviousPage(before);
        update({ number_cursor: previous.cursor, number_before: previous.before });
      }}
      onNext={() => {
        if (!nextCursor) return;
        const next = numberNextPage(before, cursor, nextCursor);
        update({ number_cursor: next.cursor, number_before: next.before });
      }}
    />
  );
}

export function NumberBrowser({
  params,
  update,
}: {
  params: URLSearchParams;
  update: (values: Record<string, string | boolean | null | undefined | string[]>) => void;
}) {
  const { compact, sheet } = useSiLayout();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => { setFiltersOpen(readFiltersOpen()); }, []);
  const query = new URLSearchParams({ limit: String(LIST_PAGE_SIZE) });
  writeList(query, "classification", readList(params, "classification"));
  for (const key of ["q", "attachment", "hygiene", "active_from", "active_to"]) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  const cursor = params.get("number_cursor");
  if (cursor) query.set("cursor", cursor);
  const sortState = numberSortFromParams(params);
  applyNumberSort(query, sortState);
  const list = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "numbers", query.toString()],
    queryFn: ({ signal }) => readSalesIntelligence(`numbers?${query}`, numberSearchSchema, signal),
    retry: false,
  });
  // §14.4: a cursor from another sort is rejected, so restart at page one; a sort this server
  // rejects falls back to the default order and says so. The loaded page is never re-sorted here.
  const sortRequested = !isDefaultNumberSort(sortState);
  useEffect(() => {
    if (!(list.error instanceof SalesIntelligenceError) || list.error.code !== "INVALID_INPUT") return;
    if (cursor) update({ number_cursor: null });
    else if (sortRequested) update({ number_sort: null, number_direction: null, number_cursor: null, number_sort_unavailable: true });
  }, [cursor, list.error, sortRequested, update]);
  const servedSort = list.data?.data.sort;
  const sortUnavailable = params.get("number_sort_unavailable") === "true" || (sortRequested && !!list.data && !servedSort);
  const shownSort = sortUnavailable || !servedSort || servedSort.sort === "last_activity" ? null : sortOption(NUMBER_SORT_OPTIONS, servedSort.sort);
  const returnTo = currentSalesIntelligenceHref(params);
  const filters = {
    classifications: readList(params, "classification"),
    attachment: params.get("attachment") ?? "any",
    hygiene: params.get("hygiene") === "true",
    active_from: params.get("active_from") ?? "",
    active_to: params.get("active_to") ?? "",
  };
  const q = params.get("q") ?? "";
  const digits = /^\d+$/.test(q.trim());
  const shortPhone = digits && q.trim().length > 0 && q.trim().length < 4;
  const filterCount = [q, filters.classifications.length, filters.attachment !== "any" && filters.attachment, filters.hygiene, filters.active_from, filters.active_to].filter(Boolean).length;

  return (
    <section className={!compact && filtersOpen ? "si-listview rail-open" : "si-listview"} aria-label={copy.page.views.numbers}>
      <div className="si-filtertray">
      <FilterToolbar
        open={compact ? sheetOpen : filtersOpen}
        onToggle={() => {
          if (compact) {
            setSheetOpen((open) => !open);
            return;
          }
          setFiltersOpen((open) => {
            writeFiltersOpen(!open);
            return !open;
          });
        }}
        activeCount={filterCount}
        chips={numberChips(filters, q, update)}
        note={
          <>
            {shortPhone && <span className="si-text--sm si-text--amber" role="note">{copy.page.searchHint}</span>}
            <SortControl
              options={NUMBER_SORT_OPTIONS}
              value={sortState.sort}
              direction={sortState.direction}
              onChange={(next) => update({
                number_sort: next.sort === "last_activity" && next.direction === "desc" ? null : next.sort,
                number_direction: next.sort === "last_activity" && next.direction === "desc" ? null : next.direction,
                number_cursor: null,
                number_sort_unavailable: null,
              })}
            />
          </>
        }
      />
      </div>
      {sortUnavailable && (
        <p role="status" className="si-local-notice">
          {copy.sort.unavailable}{" "}
          {params.get("number_sort_unavailable") === "true" && (
            <button type="button" className="si-btn si-btn--link" onClick={() => update({ number_sort_unavailable: null })}>{copy.sort.dismiss}</button>
          )}
        </p>
      )}
      {compact && !sheet && sheetOpen && (
        <div className="si-filterexpand">
          <NumbersFilters value={filters} onChange={update} />
        </div>
      )}
      <div className="si-listview__grid">
        {!compact && filtersOpen && (
          <FilterRail title={copy.filters.numbersTitle} intro={copy.filters.numbersIntro} onClose={() => { writeFiltersOpen(false); setFiltersOpen(false); }}>
            <NumbersFilters value={filters} onChange={update} />
          </FilterRail>
        )}
        {sheet && (
          <FilterSheet title={copy.filters.numbersTitle} open={sheetOpen} onClose={() => setSheetOpen(false)}>
            <NumbersFilters value={filters} onChange={update} />
          </FilterSheet>
        )}
        <div className="si-listview__list">
          {list.isPending && <NumbersListSkeleton />}
          {list.error && <Failure message={copy.errors.numbersFailed} error={list.error} retry={() => void list.refetch()} />}
          {list.data && (
            <>
              <p className="si-text--subtle">
                {copy.coverage.asOf(formatDateTime(list.data.as_of))}
                {" · "}
                {list.data.coverage.known_through
                  ? copy.coverage.knownThrough(formatDateTime(list.data.coverage.known_through))
                  : copy.coverage.unknown}
              </p>
              {!list.data.data.items.length && (
                <>
                  <EmptyState title={copy.empty.numbersNone} />
                  <Button variant="link" onClick={() => update({ classifications: [], attachment: "any", hygiene: false, active_from: null, active_to: null, q: null, number_cursor: null })}>
                    {copy.empty.numbersClear}
                  </Button>
                </>
              )}
              <NumberPages params={params} count={list.data.data.items.length} nextCursor={list.data.data.cursor} update={update} />
              <div className="si-nhead" aria-hidden>
                <span>{copy.columns.number}</span>
                <span>{copy.columns.lead}</span>
                <span>{copy.columns.latestActivity}</span>
                <span />
              </div>
              <ul className="si-rows">
                {list.data.data.items.map((number) => {
                  const selected = params.get("number") === number.id;
                  return (
                    <li className={cx("si-nrow", selected && "is-selected")} key={number.id} aria-current={selected || undefined}>
                      <button
                        type="button"
                        className="si-row__hit"
                        onClick={() => update({ number: number.id, outreach: null, lead: null, lead_model: null })}
                        aria-label={`${copy.actions.open} ${number.e164}`}
                      />
                      <div className="si-nrow__number">
                        <strong className="si-phone">{number.e164}</strong>
                        <span className="si-text--subtle">{number.provider_names.join(", ") || copy.fields.unknown}</span>
                      </div>
                      <div className="si-nrow__lead">
                        <div className="si-chiprow">
                          <ClassificationBadge value={number.classification} />
                          <EligibilityBadge value={number.eligibility} />
                        </div>
                        {!(number.attached_lead_progress?.status === "none" && !number.rollups.candidate_lead_count) && (
                          <span className="si-text--sm si-text--subtle">
                            {leadMatchSummary(number.rollups.attached_lead_count, number.rollups.candidate_lead_count)}
                          </span>
                        )}
                        <AttachedLeadLine
                          value={number.attached_lead_progress}
                          returnTo={returnTo}
                          onReviewMatches={() => update({ number: number.id, outreach: null, lead: null, lead_model: null, panel: "matches" })}
                        />
                      </div>
                      <div className="si-nrow__activity">
                        <span className="si-ownership__label">{copy.fields.lastActivity}</span>
                        <span>{formatDateTime(number.last_activity_at)}</span>
                        <span className="si-text--sm si-text--subtle">
                          {copy.lead.conversations(number.rollups.human_conversations_total)}
                          {" · "}
                          {copy.lead.interactions(number.rollups.interactions_total)}
                        </span>
                        {shownSort?.value === "first_observed" && (
                          <span className="si-text--sm">
                            {copy.sort.firstObserved}: {number.first_observed_at ? formatDateTime(number.first_observed_at) : copy.fields.unknown}
                          </span>
                        )}
                        {shownSort?.value === "last_human_conversation" && (
                          <span className="si-text--sm">
                            {copy.sort.lastHumanConversation}:{" "}
                            {number.rollups.last_human_conversation_at === undefined
                              ? copy.fields.unknown
                              : number.rollups.last_human_conversation_at === null
                                ? copy.sort.noConversation
                                : formatDateTime(number.rollups.last_human_conversation_at)}
                          </span>
                        )}
                      </div>
                      <div className="si-nrow__actions">
                        <Button variant="ghost" size="sm" onClick={() => update({ number: number.id, outreach: null, lead: null, lead_model: null })} aria-label={`${copy.actions.open} ${number.e164}`}>
                          {copy.actions.open}
                        </Button>
                      </div>
                      <ChevronRight size={16} aria-hidden className="si-nrow__chev" />
                    </li>
                  );
                })}
              </ul>
              <NumberPages params={params} count={list.data.data.items.length} nextCursor={list.data.data.cursor} update={update} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
