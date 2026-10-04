"use client";
/**
 * Numbers, the default Sales Intelligence view (`GET /numbers`). One keyset page at a time in the server's order
 * (never re-sorted here), the filter rail, the capture-health block, and the open Number's dialog (`number=`).
 * Each row: E.164, provider names, classification and contact status, the attached Lead with its official status
 * (or `multiple` / `none`), call counts and the latest activity.
 */
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { NumberSearchItem } from "@/lib/api/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { Button } from "../atoms/button";
import { FilterSheet } from "../atoms/filter-sheet";
import { ClassificationBadge, EligibilityBadge, EmptyState, FilterRail, FilterToolbar } from "../chrome";
import { CaptureHealthRegion } from "../capture-health";
import { PageControls } from "../page-controls";
import { SortControl } from "../sort-control";
import { cx, formatDateTime, leadMatchSummary } from "../lib/format";
import { readFiltersOpen, writeFiltersOpen } from "../lib/filter-state";
import { useSiLayout } from "../lib/layout";
import { currentSalesIntelligenceHref } from "../lib/official-record";
import { numberNextPage, numberPageOffset, numberPreviousPage, pageWindow } from "../lib/paging";
import { NUMBER_SORT_OPTIONS } from "../lib/sort";
import { Region, RegionProgress, SkeletonLines, regionErrorCode } from "../primitives";
import { clearNumberFilters, numbersQuery, serializeSiUrl, type SiUrlState } from "../data/url-state";
import { siKeys } from "../data/query-keys";
import type { SiUrlUpdate } from "../data/use-url-state";
import { NUMBERS_PAGE_SIZE, useNumbersPage } from "../data/use-numbers";
import { AttachedLeadLine } from "./attached-lead";
import { NumberDetail } from "./number-detail";
import { numberChips, numberFilterCount, NumbersFilters } from "./numbers-filters";

const n = copy.numbers;

/**
 * The server rejects a cursor from another request (an old desk link, a changed sort digest) with INVALID_INPUT;
 * restart at page one instead of leaving an error that Retry would only repeat. The restart replaces the rejected
 * URL rather than pushing past it: a pushed restart left the stale URL in history, and Back to it failed and pushed
 * page one again, so Back could never leave the page. Returns whether it recovered.
 */
export function recoverStaleNumbersCursor(error: unknown, cursor: string | null, dropFailedPage: () => void, update: SiUrlUpdate): boolean {
  if (!cursor || regionErrorCode(error) !== "INVALID_INPUT") return false;
  dropFailedPage();
  update({ cursor: null, before: [] }, { replace: true });
  return true;
}

export function NumberRow({ number, selected, returnTo, onOpen }: { number: NumberSearchItem; selected: boolean; returnTo: string; onOpen: () => void }) {
  const r = number.rollups;
  return (
    <li className={cx("si-nrow", selected && "is-selected")} aria-current={selected || undefined} data-number-id={number.id}>
      <button type="button" className="si-row__hit" onClick={onOpen} aria-label={`${copy.actions.open} ${number.e164}`} />
      <div className="si-nrow__number">
        <strong className="si-phone">{number.e164}</strong>
        <span className="si-text--subtle">{number.provider_names.join(", ") || copy.fields.unknown}</span>
        {!number.has_calls && number.created_via === "form_lead" && <span className="si-text--sm si-text--subtle">{n.formOnly}</span>}
      </div>
      <div className="si-nrow__lead">
        <div className="si-chiprow">
          <ClassificationBadge value={number.classification} />
          <EligibilityBadge value={number.eligibility} />
        </div>
        <AttachedLeadLine value={number.attached_lead} returnTo={returnTo} />
        {(r.attached_lead_count > 1 || r.candidate_lead_count > 0) && <span className="si-text--sm si-text--subtle">{leadMatchSummary(r.attached_lead_count, r.candidate_lead_count)}</span>}
      </div>
      <div className="si-nrow__activity">
        <span className="si-ownership__label">{copy.fields.lastActivity}</span>
        <span>{formatDateTime(number.last_activity_at)}</span>
        <span className="si-text--sm si-text--subtle">
          {copy.lead.calls(r.interactions_total)} · {copy.lead.inboundOutbound(r.inbound_total, r.outbound_total)} · {copy.lead.conversations(r.human_conversations_total)}
        </span>
      </div>
      <div className="si-nrow__actions">
        <Button variant="ghost" size="sm" onClick={onOpen} aria-label={`${copy.actions.open} ${number.e164}`}>{copy.actions.open}</Button>
      </div>
      <ChevronRight size={16} aria-hidden className="si-nrow__chev" />
    </li>
  );
}

function NumbersPage({ state, update, pending }: { state: SiUrlState; update: SiUrlUpdate; pending: boolean }) {
  const query = numbersQuery(state, NUMBERS_PAGE_SIZE);
  const { data, isFetching } = useNumbersPage(query);
  // An official record's "Return to Sales Intelligence" comes back to this page, filters and open Number included.
  const returnTo = currentSalesIntelligenceHref(serializeSiUrl(state));
  const items = data.data.items;
  const window = pageWindow(numberPageOffset(state.before.length, Boolean(state.cursor), NUMBERS_PAGE_SIZE), items.length);
  const pages = window && (
    <PageControls
      label={copy.actions.pageRange(window.start, window.end)}
      canPrevious={Boolean(state.cursor)}
      canNext={Boolean(data.data.cursor)}
      onPrevious={() => update(numberPreviousPage(state.before))}
      onNext={() => { if (data.data.cursor) update(numberNextPage(state.before, state.cursor, data.data.cursor)); }}
    />
  );
  const through = data.coverage.known_through;
  const opened = state.number ? items.find((item) => item.id === state.number) : undefined;
  return (
    <>
      <RegionProgress active={isFetching || pending} />
      <p className="si-text--subtle si-text--sm">
        {n.coverageLine(formatDateTime(data.as_of), through ? formatDateTime(through) : null)}
        {data.coverage.gaps.length > 0 && <> · <span className="si-text--amber">{n.gaps(data.coverage.gaps.length)}</span></>}
      </p>
      {!items.length && (
        <>
          <EmptyState title={copy.empty.numbersNone} />
          {state.cursor ? null : <Button variant="link" onClick={() => update({ ...clearNumberFilters(), q: null })}>{copy.actions.clearFilters}</Button>}
        </>
      )}
      {pages}
      {items.length > 0 && (
        <>
          <div className="si-nhead" aria-hidden>
            <span>{copy.columns.number}</span>
            <span>{copy.columns.lead}</span>
            <span>{copy.columns.latestActivity}</span>
            <span />
          </div>
          <ul className="si-rows">
            {items.map((number) => (
              <NumberRow key={number.id} number={number} selected={state.number === number.id} returnTo={returnTo} onOpen={() => update({ number: number.id })} />
            ))}
          </ul>
        </>
      )}
      {items.length > 0 && pages}
      {state.number && <NumberDetail key={state.number} id={state.number} e164={opened?.e164} returnTo={returnTo} onClose={() => update({ number: null })} />}
    </>
  );
}

export function NumbersView({ state, update, pending }: { state: SiUrlState; update: SiUrlUpdate; pending: boolean }) {
  const client = useQueryClient();
  const { compact, sheet } = useSiLayout();
  // The desk mounts client-only (`desk-client.tsx`), so the remembered rail state is read on the first render.
  const [filtersOpen, setFiltersOpen] = useState(readFiltersOpen);
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterCount = numberFilterCount(state);
  const filters = <NumbersFilters value={state} onChange={update} />;
  const requestKey = numbersQuery(state, NUMBERS_PAGE_SIZE).toString();
  const recoverStaleCursor = (error: unknown) => {
    recoverStaleNumbersCursor(error, state.cursor, () => client.removeQueries({ queryKey: siKeys.numbers(requestKey) }), update);
  };
  return (
    <section className={!compact && filtersOpen ? "si-listview rail-open" : "si-listview"} aria-label={copy.page.views.numbers}>
      <CaptureHealthRegion />
      <div className="si-filtertray">
        <FilterToolbar
          open={compact ? sheetOpen : filtersOpen}
          onToggle={() => {
            if (compact) { setSheetOpen((open) => !open); return; }
            setFiltersOpen((open) => { writeFiltersOpen(!open); return !open; });
          }}
          activeCount={filterCount}
          chips={numberChips(state, update)}
          note={<SortControl options={NUMBER_SORT_OPTIONS} value={state.sort} direction={state.direction} onChange={(next) => update({ sort: next.sort, direction: next.direction })} />}
        />
      </div>
      {compact && !sheet && sheetOpen && <div className="si-filterexpand">{filters}</div>}
      <div className="si-listview__grid">
        {!compact && filtersOpen && (
          <FilterRail title={copy.filters.numbersTitle} intro={copy.filters.numbersIntro} onClose={() => { writeFiltersOpen(false); setFiltersOpen(false); }}>
            {filters}
          </FilterRail>
        )}
        {sheet && <FilterSheet title={copy.filters.numbersTitle} open={sheetOpen} onClose={() => setSheetOpen(false)}>{filters}</FilterSheet>}
        <div className="si-listview__list">
          <Region name="numbers" skeleton={<SkeletonLines lines={8} />} resetKey={requestKey} onError={recoverStaleCursor}
            onRetry={() => void client.resetQueries({ queryKey: siKeys.numbers(requestKey) })}>
            <NumbersPage state={state} update={update} pending={pending} />
          </Region>
        </div>
      </div>
    </section>
  );
}
