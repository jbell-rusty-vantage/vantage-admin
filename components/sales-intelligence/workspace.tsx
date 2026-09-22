"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { attentionSchema, numberSchema, outreachReadSchema, readSalesIntelligence, SalesIntelligenceError, type AttentionRow as AttentionItem } from "@/lib/api/salesIntelligence";
import { useSalesIntelligenceLive, salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { fetchCatalogItems } from "@/lib/api/catalog";
import { currentSalesIntelligenceHref } from "./lib/official-record";
import { parseSiPanel, parseSiView } from "./sales-intelligence-tabs";
import { NowStrip } from "./now-strip";
import { RunningSummaryPanel } from "./running-summary-panel";
import { BANDS, copy } from "./sales-intelligence-copy";
import { formatDateTime, label } from "./lib/format";
import { AttentionBands } from "./attention";
import { OutreachListSkeleton } from "./list-skeletons";
import { PageControls } from "./page-controls";
import { CommandDialog } from "./command-dialog";
import { DetailPanel } from "./detail-panel";
import { NumberBrowser } from "./number-browser";
import { NumberTimeline } from "./number-timeline";
import { OutreachDetail } from "./outreach-detail";
import { Attachments } from "./attachments";
import { ReviewItems } from "./review-items";
import { Reps } from "./reps";
import { Restrictions } from "./restrictions";
import { ManualAttachment } from "./manual-attachment";
import { MessageRepDialog } from "./message-rep-dialog";
import { AnalysisPanel } from "./analysis-panel";
import { CoverageView } from "./coverage-view";
import { EmptyState, Failure, FilterRail, FilterToolbar, LiveIndicator, LivePulseNotice, SearchField, Tabs } from "./chrome";
import { attentionChips, AttentionFilters } from "./filters";
import { attentionFiltersFromParams, attentionQueryString, readFiltersOpen, toggleValue, writeFiltersOpen, writeList } from "./lib/filter-state";
import { attentionPreviousCursor, decodeAttentionCursor, pageWindow } from "./lib/paging";
import { useSiLayout } from "./lib/layout";
import { GuideView } from "./guide-view";
import { Button } from "./atoms/button";
import { FilterSheet } from "./atoms/filter-sheet";
import { TooltipCard } from "./atoms/tooltip-card";
import "./styles/sales-intelligence.css";

function Selection({
  outreachId,
  numberId,
  leadId,
  leadModel,
  accountId,
  returnTo,
  update,
}: {
  outreachId: string | null;
  numberId: string | null;
  leadId: string | null;
  leadModel: string | null;
  accountId: string | null;
  returnTo: string;
  update: (values: Record<string, string | boolean | null | undefined | string[]>) => void;
}) {
  const selectionParams = useSearchParams();
  const byLead = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "outreach-by-lead", leadModel, leadId],
    enabled: !!leadId && !!leadModel && !outreachId,
    queryFn: ({ signal }) => readSalesIntelligence(`outreach/by-lead/${encodeURIComponent(leadModel!)}/${encodeURIComponent(leadId!)}`, outreachReadSchema, signal),
    retry: false,
  });
  const outreach = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "outreach", outreachId],
    enabled: !!outreachId,
    queryFn: ({ signal }) => readSalesIntelligence(`outreach/${encodeURIComponent(outreachId!)}`, outreachReadSchema, signal),
    retry: false,
  });
  const resolvedOutreach = outreach.data ?? byLead.data;
  const resolvedNumber = numberId ?? resolvedOutreach?.data.outreach.primary_number?.id;
  const number = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "number", resolvedNumber],
    enabled: !!resolvedNumber,
    queryFn: ({ signal }) => readSalesIntelligence(`numbers/${encodeURIComponent(resolvedNumber!)}`, numberSchema, signal),
    retry: false,
  });
  const panel = parseSiPanel(selectionParams.get("panel"));
  const record = resolvedOutreach?.data.outreach;
  const title = number.data?.data.e164 ?? record?.lead_display?.name ?? copy.page.detailTitle;
  const [command, setCommand] = useState<string | null>(null);
  const [messaging, setMessaging] = useState(false);
  const workRecords = [
    ...(record ? [record] : []),
    ...(number.data?.data.outreach_records.filter((item) => item.id !== record?.id) ?? []),
  ];
  const workId = selectionParams.get("outreach") ?? record?.id ?? workRecords[0]?.id;
  const workRecord = workRecords.find((item) => item.id === workId) ?? record ?? null;
  const ready = !outreach.isLoading && !byLead.isLoading && !number.isLoading;
  return (
    <DetailPanel
      title={title}
      panel={panel}
      onPanel={(next) => update({ panel: next })}
      onClose={() => update({ outreach: null, number: null, lead: null, lead_model: null, panel: null })}
      now={
        <NowStrip
          title={title}
          number={number.data?.data}
          outreach={record ?? null}
          returnTo={returnTo}
          ready={ready}
          onCommand={record ? (next) => { update({ outreach: record.id }); setCommand(next); } : undefined}
          onMessage={record ? () => { update({ outreach: record.id }); setMessaging(true); } : undefined}
          onOpenMatches={() => update({ panel: "matches" })}
        />
      }
    >
      <div className="si-local-stack">
        {outreach.error && <Failure error={outreach.error} retry={() => void outreach.refetch()} />}
        {!outreachId && byLead.error && (
          byLead.error instanceof SalesIntelligenceError && byLead.error.status === 404
            ? <p className="si-local-notice">{copy.coverage.noLeadOutreach}</p>
            : <Failure error={byLead.error} retry={() => void byLead.refetch()} />
        )}
        {number.error && <Failure error={number.error} retry={() => void number.refetch()} />}
        {/* Number Activity is the default tab; without a Contact Number it must say so, not go blank. */}
        {panel === "activity" && (resolvedNumber
          ? <NumberTimeline numberId={resolvedNumber} />
          : ready && <EmptyState title={copy.panel.noNumberActivity}>{copy.panel.noNumberActivityWhy}</EmptyState>)}
        {panel === "summary" && (
          <RunningSummaryPanel
            key={resolvedNumber ?? "no-number"}
            numberId={resolvedNumber ?? undefined}
            analysis={number.data?.data.running_analysis}
            onOpenRun={(runId) => update({ panel: "analysis", analysis_run: runId })}
          />
        )}
        {panel === "analysis" && resolvedNumber && (
          <AnalysisPanel
            key={resolvedNumber}
            numberId={resolvedNumber}
            selectedRun={selectionParams.get("analysis_run")}
            onSelect={(id) => update({ analysis_run: id })}
          />
        )}
        {panel === "matches" && (
          <>
            {number.data && <Attachments numberId={number.data.data.id} returnTo={returnTo} />}
            {number.data && <ManualAttachment number={number.data.data} />}
            {leadId && leadModel && <Attachments lead={{ id: leadId, model: leadModel }} returnTo={returnTo} onNumber={(id) => update({ number: id })} />}
          </>
        )}
        {panel === "work" && (
          <>
            {workRecords.length > 1 && (
              <div className="si-local-stack">
                <p className="si-text--subtle">{copy.panel.pickOutreach}</p>
                {workRecords.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === workRecord?.id ? "si-outreachitem__open is-selected" : "si-outreachitem__open"}
                    onClick={() => update({ outreach: item.id })}
                  >
                    {label(item.state)} · {item.lead_display?.name ?? copy.fields.unknown}
                  </button>
                ))}
              </div>
            )}
            {workRecord && <OutreachDetail record={workRecord} accountId={accountId} />}
            {number.data && <Restrictions rows={number.data.data.restrictions} />}
            {resolvedNumber && <ReviewItems subjectKey={`number:${resolvedNumber}`} />}
            {leadId && leadModel && <ReviewItems subjectKey={`lead:${leadModel}:${leadId}`} />}
          </>
        )}
        {command && record && <CommandDialog command={command} record={record} onClose={() => setCommand(null)} />}
        {messaging && record && <MessageRepDialog record={record} accountId={accountId} onClose={() => setMessaging(false)} />}
      </div>
    </DetailPanel>
  );
}

function FirstVisitHint({ onOpen }: { onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(window.localStorage.getItem("vantage-admin-si-guide-hint") !== "hidden");
  }, []);
  if (!open) return null;
  return (
    <p className="si-purpose">
      <button type="button" className="si-btn si-btn--link" onClick={onOpen}>{copy.page.firstVisitGuide}</button>
      <Button
        variant="link"
        size="sm"
        onClick={() => {
          window.localStorage.setItem("vantage-admin-si-guide-hint", "hidden");
          setOpen(false);
        }}
      >
        {copy.page.firstVisitDismiss}
      </Button>
    </p>
  );
}

function PurposeLine() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    setOpen(window.localStorage.getItem("vantage-admin-si-purpose") !== "hidden");
  }, []);
  if (!open) return null;
  return (
    <div className="si-purpose">
      <p>{copy.page.purpose}</p>
      <Button
        variant="link"
        size="sm"
        onClick={() => {
          window.localStorage.setItem("vantage-admin-si-purpose", "hidden");
          setOpen(false);
        }}
      >
        {copy.page.purposeDismiss}
      </Button>
    </div>
  );
}

function toParam(value: string | boolean | undefined | null) {
  if (value === true) return "true";
  if (!value || value === "any") return null;
  return String(value);
}

const REASON_BAND: Record<string, number> = {
  promised_callback_overdue: 1,
  no_call_yet: 2,
  missed_call_no_callback: 3,
  followups_due: 4,
  no_next_step: 5,
  missing_responsibility: 6,
  going_cold: 7,
};

function AttentionPages({
  cursor,
  count,
  total,
  nextCursor,
  onPage,
}: {
  cursor: string | null;
  count: number;
  total: number | null;
  nextCursor: string | null;
  onPage: (cursor: string | null) => void;
}) {
  const offset = decodeAttentionCursor(cursor)?.offset ?? 0;
  const window = pageWindow(offset, count);
  if (!window) return null;
  return (
    <PageControls
      label={copy.actions.pageRange(window.start, window.end, total)}
      canPrevious={offset > 0}
      canNext={Boolean(nextCursor)}
      onPrevious={() => onPage(attentionPreviousCursor(cursor))}
      onNext={() => onPage(nextCursor)}
    />
  );
}

export function SalesIntelligenceWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { compact, sheet } = useSiLayout();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => { setFiltersOpen(readFiltersOpen()); }, []);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const urlSearch = params.get("q") ?? "";
  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);
  const searchDigits = /^\d+$/.test(search.trim());
  const shortPhone = searchDigits && search.trim().length > 0 && search.trim().length < 4;
  const update = useCallback((values: Record<string, string | boolean | null | undefined | string[]>) => {
    const next = new URLSearchParams(params);
    if (["number", "outreach", "lead"].some((key) => key in values) && !("analysis_run" in values)) next.delete("analysis_run");
    Object.entries(values).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        writeList(next, key === "bands" ? "band" : key === "states" ? "state" : key === "agent_ids" ? "agent_id" : key === "classifications" ? "classification" : key, value);
        return;
      }
      const encoded = toParam(value as string | boolean | null | undefined);
      if (encoded === null) next.delete(key);
      else next.set(key, encoded);
    });
    if ("number_cursor" in values && values.number_cursor == null && !("number_before" in values)) next.delete("number_before");
    router.replace(`${pathname}?${next}`, { scroll: false });
  }, [params, pathname, router]);

  const live = useSalesIntelligenceLive();
  const agents = useQuery({ queryKey: ["catalog", "agents", "csi-current"], queryFn: () => fetchCatalogItems("agents", { includeInactive: true }) });
  const view = parseSiView(params.get("view"));
  const attentionFilters = attentionFiltersFromParams(params);
  const cursor = params.get("attention_cursor");
  const query = new URLSearchParams(attentionQueryString(attentionFilters, cursor));
  const list = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "attention", query.toString()],
    enabled: view === "attention",
    queryFn: ({ signal }) => readSalesIntelligence(`attention?${query}`, attentionSchema, signal),
    retry: false,
  });
  useEffect(() => {
    if (cursor && list.error instanceof SalesIntelligenceError && list.error.code === "ATTENTION_SNAPSHOT_EXPIRED") {
      update({ attention_cursor: null });
    }
  }, [cursor, list.error, update]);

  const outreachId = params.get("outreach");
  const numberId = params.get("number");
  const leadId = params.get("lead");
  const leadModel = params.get("lead_model");
  const openRow = (row: AttentionItem) =>
    update({
      outreach: row.outreach?.id ?? null,
      number: row.outreach?.primary_number?.id ?? (row.subject.kind === "number_review" ? row.subject.contact_number_id : null),
      lead: row.subject.kind === "lead" ? row.subject.id : null,
      lead_model: row.subject.kind === "lead" ? row.subject.model : null,
    });
  const selected = (row: AttentionItem) =>
    row.outreach?.id === outreachId
    || (row.subject.kind === "number_review" && row.subject.contact_number_id === numberId)
    || (row.subject.kind === "lead" && row.subject.id === leadId);
  const filterCount = attentionFilters.bands.length + attentionFilters.states.length + attentionFilters.agent_ids.length + (attentionFilters.needs_review ? 1 : 0);
  const closeFilters = () => { writeFiltersOpen(false); setFiltersOpen(false); };
  const toggleFilters = () => {
    setFiltersOpen((open) => {
      writeFiltersOpen(!open);
      return !open;
    });
  };
  const bandCounts = new Map<number, number>();
  let reviewCount = 0;
  for (const [reason, count] of Object.entries(list.data?.data.reason_counts ?? {})) {
    const band = REASON_BAND[reason];
    if (band) bandCounts.set(band, (bandCounts.get(band) ?? 0) + count);
  }
  for (const row of list.data?.data.items ?? []) {
    if (row.derived.attention_band == null) reviewCount += 1;
  }
  const knownThrough = list.data?.coverage.known_through;
  const hasGaps = !!list.data?.coverage.gaps.length;

  return (
    <div className={outreachId || numberId || leadId ? "si-root si-workspace has-panel" : "si-root si-workspace"}>
      <header className="si-workspace__header">
        <div className="si-workspace__titlebar">
          <div>
            <h1 className="si-workspace__title">{copy.page.title}</h1>
          </div>
          <div className="si-workspace__search">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={copy.page.searchPlaceholder}
              label={copy.page.searchPlaceholder}
              hint={shortPhone ? copy.page.searchHint : null}
              onSubmit={(value) => {
                setSearch(value);
                update({ view: "numbers", q: value.trim() || null, number_cursor: null });
              }}
            />
          </div>
          <div className="si-workspace__live">
            <LiveIndicator status={live} />
          </div>
        </div>
        <div className="si-workspace__nav">
          <Tabs
            idBase="si-view"
            label={copy.page.viewsLabel}
            value={view}
            onChange={(next) => update({ view: next })}
            items={[
              { key: "attention", label: copy.page.views.attention, count: view === "attention" ? list.data?.data.total_items : null },
              { key: "numbers", label: copy.page.views.numbers },
              { key: "reps", label: copy.page.views.reps },
              { key: "coverage", label: copy.page.views.coverage },
              { key: "guide", label: copy.page.views.guide },
            ]}
          />
          {view === "attention" && (
            <TooltipCard
              title={copy.coverage.unknown}
              guideTopic="coverage"
              label={
                <p className={hasGaps ? "si-coverage si-coverage--strip si-coverage--catching_up" : "si-coverage si-coverage--strip si-coverage--healthy"}>
                  {knownThrough ? copy.coverage.knownThrough(formatDateTime(knownThrough)) : copy.coverage.unknown}
                </p>
              }
            >
              {copy.live.historyThroughTip}
            </TooltipCard>
          )}
        </div>
      </header>
      <div className="si-workspace__content">
      <div className="si-workspace__intro">
        <PurposeLine />
        <p className="si-viewintro">{copy.page.viewIntro[view]}</p>
        <LivePulseNotice />
        <FirstVisitHint onOpen={() => update({ view: "guide" })} />
      </div>
      <main className="si-workspace__main si-local-stack" role="tabpanel" id={`si-view-panel-${view}`} aria-labelledby={`si-view-tab-${view}`}>
        {view === "guide" && <GuideView topic={params.get("topic")} />}
        {view === "coverage" && <CoverageView />}
        {view === "reps" && <Reps params={new URLSearchParams(params)} update={update} />}
        {view === "numbers" && <NumberBrowser params={new URLSearchParams(params)} update={update} />}
        {view === "attention" && (
          <div className={!compact && filtersOpen ? "si-listview rail-open" : "si-listview"}>
            {list.data?.data.stale && <p role="status" className="si-local-notice">Showing the last successful list from {formatDateTime(list.data.as_of)}. Refresh is delayed; open a record to check its current status before acting.</p>}
            {list.data?.data.status === "pending_projection" ? (
              <p className="si-bandcards">{copy.page.preparing}</p>
            ) : (
              <div className="si-bandcards">
                {([1, 2, 3, 4, 5, 6, 7] as const).filter((band) => (bandCounts.get(band) ?? 0) > 0).map((band) => (
                  <TooltipCard
                    key={band}
                    title={`${band} · ${BANDS[band]}`}
                    guideTopic="bands"
                    label={
                      <button
                        type="button"
                        className={attentionFilters.bands.includes(String(band)) ? "si-bandcard is-on" : "si-bandcard"}
                        onClick={() => update({ bands: toggleValue(attentionFilters.bands, String(band)), attention_cursor: null })}
                      >
                        <strong>{band} · {BANDS[band]}</strong>
                        <span>{bandCounts.get(band)}</span>
                      </button>
                    }
                  >
                    {copy.bandSoWhat[band]} {copy.bandSoWhat.once}
                  </TooltipCard>
                ))}
                {reviewCount > 0 && (
                  <button
                    type="button"
                    className={attentionFilters.needs_review ? "si-bandcard is-on" : "si-bandcard"}
                    onClick={() => update({ needs_review: !attentionFilters.needs_review, attention_cursor: null })}
                  >
                    <strong>{copy.needsReview.title}</strong>
                    <span>{reviewCount}</span>
                  </button>
                )}
              </div>
            )}
            <div className="si-filtertray">
            <FilterToolbar
              open={compact ? sheetOpen : filtersOpen}
              onToggle={() => {
                if (compact) {
                  setSheetOpen((open) => !open);
                  return;
                }
                toggleFilters();
              }}
              activeCount={filterCount}
              chips={attentionChips(attentionFilters, agents.data ?? [], update)}
            />
            {compact && !sheet && sheetOpen && (
              <div className="si-filterexpand">
                <AttentionFilters value={attentionFilters} onChange={update} agents={agents.data ?? []} />
              </div>
            )}
            </div>
            <div className="si-listview__grid">
              {!compact && filtersOpen && (
                <FilterRail title={copy.filters.attentionTitle} intro={copy.filters.attentionIntro} onClose={closeFilters}>
                  <AttentionFilters value={attentionFilters} onChange={update} agents={agents.data ?? []} />
                </FilterRail>
              )}
              {sheet && (
                <FilterSheet title={copy.filters.attentionTitle} open={sheetOpen} onClose={() => setSheetOpen(false)}>
                  <AttentionFilters value={attentionFilters} onChange={update} agents={agents.data ?? []} />
                </FilterSheet>
              )}
              <div className="si-listview__list">
                {list.error && <Failure error={list.error} retry={() => void list.refetch()} />}
                {list.isPending && <OutreachListSkeleton />}
                {list.data?.data.status === "pending_projection" && <p role="status" className="si-local-notice">{copy.page.pendingProjection}</p>}
                {list.data?.data.status === "ready" && (
                  <>
                    <p className="si-text--subtle">
                      {list.data.data.total_items} distinct {list.data.data.total_items === 1 ? "subject" : "subjects"} · {copy.coverage.asOf(formatDateTime(list.data.as_of))}
                      {list.isFetching ? " · Refreshing…" : ""}
                    </p>
                    <p className="si-field__hint">{copy.page.countsDistinct}</p>
                    {!list.data.data.items.length && (
                      <EmptyState title={hasGaps ? copy.empty.attentionGaps : copy.empty.attentionComplete}>
                        {hasGaps ? copy.empty.attentionGapsNext : knownThrough ? copy.coverage.knownThrough(formatDateTime(knownThrough)) : copy.coverage.unknown}
                      </EmptyState>
                    )}
                    <AttentionPages cursor={cursor} count={list.data.data.items.length} total={list.data.data.total_items} nextCursor={list.data.data.cursor} onPage={(next) => update({ attention_cursor: next })} />
                    <AttentionBands items={list.data.data.items} selected={selected} onOpen={openRow} />
                    <AttentionPages cursor={cursor} count={list.data.data.items.length} total={list.data.data.total_items} nextCursor={list.data.data.cursor} onPage={(next) => update({ attention_cursor: next })} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      </div>
      {(outreachId || numberId || leadId) && (
        <Selection
          outreachId={outreachId}
          numberId={numberId}
          leadId={leadId}
          leadModel={leadModel}
          accountId={params.get("rc_account_id")}
          returnTo={currentSalesIntelligenceHref(params)}
          update={update}
        />
      )}
    </div>
  );
}
