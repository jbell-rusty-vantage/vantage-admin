"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { attentionSchema, numberSchema, outreachReadSchema, readSalesIntelligence, SalesIntelligenceError, type AttentionRow as AttentionItem } from "@/lib/api/salesIntelligence";
import { useSalesIntelligenceLive, salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { fetchCatalogItems } from "@/lib/api/catalog";
import { officialRecordHref } from "./lib/official-record";
import { copy, type SiView } from "./sales-intelligence-copy";
import { formatDateTime, label, reviewCauseLabel } from "./lib/format";
import { AttentionBands } from "./attention";
import { DetailPanel } from "./detail-panel";
import { NumberBrowser } from "./number-browser";
import { NumberTimeline } from "./number-timeline";
import { OutreachDetail } from "./outreach-detail";
import { Attachments } from "./attachments";
import { ReviewItems } from "./review-items";
import { Reps } from "./reps";
import { Restrictions } from "./restrictions";
import { ManualAttachment } from "./manual-attachment";
import { AnalysisPanel } from "./analysis-panel";
import { ClassificationBadge, EligibilityBadge, EmptyState, Failure, FilterRail, FilterToolbar, LiveIndicator, SearchField, Tabs } from "./chrome";
import { attentionChips, AttentionFilters } from "./filters";
import { Badge } from "./atoms/badge";
import { Button } from "./atoms/button";
import "./styles/sales-intelligence.css";

function Selection({
  outreachId,
  numberId,
  leadId,
  leadModel,
  update,
}: {
  outreachId: string | null;
  numberId: string | null;
  leadId: string | null;
  leadModel: string | null;
  update: (values: Record<string, string | null>) => void;
}) {
  const selectionParams = useSearchParams();
  const outreach = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "outreach", outreachId],
    enabled: !!outreachId,
    queryFn: ({ signal }) => readSalesIntelligence(`outreach/${encodeURIComponent(outreachId!)}`, outreachReadSchema, signal),
    retry: false,
  });
  const resolvedNumber = numberId ?? outreach.data?.data.outreach.primary_number?.id;
  const number = useQuery({
    queryKey: [...salesIntelligenceKeys.all, "number", resolvedNumber],
    enabled: !!resolvedNumber,
    queryFn: ({ signal }) => readSalesIntelligence(`numbers/${encodeURIComponent(resolvedNumber!)}`, numberSchema, signal),
    retry: false,
  });
  return (
    <div className="si-local-stack">
      {outreachId && outreach.isPending && <p role="status">Loading Outreach…</p>}
      {outreach.error && <Failure error={outreach.error} retry={() => void outreach.refetch()} />}
      {resolvedNumber && number.isPending && <p role="status">Loading Number…</p>}
      {number.error && <Failure error={number.error} retry={() => void number.refetch()} />}
      {number.data && (
        <>
          <h3>{number.data.data.e164}</h3>
          <div className="si-chiprow">
            <ClassificationBadge value={number.data.data.classification} />
            <EligibilityBadge value={number.data.data.eligibility} />
          </div>
          <p>
            {copy.coverage.asOf(formatDateTime(number.data.as_of))}
            {" · "}
            {number.data.coverage.known_through
              ? copy.coverage.knownThrough(formatDateTime(number.data.coverage.known_through))
              : copy.coverage.unknown}
          </p>
          <section>
            <h3>{copy.panel.runningSummary}</h3>
            <p>{number.data.data.running_analysis?.text ?? copy.panel.runningSummaryEmpty}</p>
          </section>
          <Attachments numberId={number.data.data.id} />
          <ManualAttachment number={number.data.data} />
          {number.data.data.review_items.filter((item) => item.state === "open").map((item) => (
            <Badge key={item.id} tone="amber">{reviewCauseLabel(item.cause_kind)}</Badge>
          ))}
          <Restrictions rows={number.data.data.restrictions} />
        </>
      )}
      {outreach.data && <OutreachDetail record={outreach.data.data.outreach} />}
      {number.data?.data.outreach_records.filter((record) => record.id !== outreachId).map((record) => (
        <OutreachDetail record={record} key={record.id} />
      ))}
      {resolvedNumber && <NumberTimeline numberId={resolvedNumber} />}
      {resolvedNumber && (
        <AnalysisPanel
          key={resolvedNumber}
          numberId={resolvedNumber}
          selectedRun={selectionParams.get("analysis_run")}
          onSelect={(id) => update({ analysis_run: id })}
        />
      )}
      {resolvedNumber && <ReviewItems subjectKey={`number:${resolvedNumber}`} />}
      {leadId && leadModel && (
        <>
          <Link href={officialRecordHref(leadModel === "FormLead" ? "FormLead" : "CallLead", leadId)}>
            Open official {leadModel === "FormLead" ? "Form Lead" : "Call Lead"}
          </Link>
          <Attachments lead={{ id: leadId, model: leadModel }} onNumber={(id) => update({ number: id })} />
          <ReviewItems subjectKey={`lead:${leadModel}:${leadId}`} />
        </>
      )}
      <p className="si-local-notice">{copy.page.messagingUnavailable}</p>
    </div>
  );
}

function toParam(value: string | boolean | undefined | null) {
  if (value === true) return "true";
  if (!value || value === "any") return null;
  return String(value);
}

export function SalesIntelligenceWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filtersOpen, setFiltersOpen] = useState(() =>
    Boolean(params.get("band") || params.get("needs_review") || params.get("state") || params.get("agent_id")),
  );
  const [search, setSearch] = useState(params.get("q") ?? "");
  const urlSearch = params.get("q") ?? "";
  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);
  const searchDigits = /^\d+$/.test(search.trim());
  const shortPhone = searchDigits && search.trim().length > 0 && search.trim().length < 4;
  const update = useCallback((values: Record<string, string | boolean | null | undefined>) => {
    const next = new URLSearchParams(params);
    if (["number", "outreach", "lead"].some((key) => key in values) && !("analysis_run" in values)) next.delete("analysis_run");
    Object.entries(values).forEach(([key, value]) => {
      const encoded = toParam(value as string | boolean | null | undefined);
      if (encoded === null) next.delete(key);
      else next.set(key, encoded);
    });
    router.replace(`${pathname}?${next}`, { scroll: false });
  }, [params, pathname, router]);

  const live = useSalesIntelligenceLive();
  const agents = useQuery({ queryKey: ["catalog", "agents", "csi-current"], queryFn: () => fetchCatalogItems("agents", { includeInactive: true }) });
  const view: SiView = params.get("view") === "numbers" ? "numbers" : params.get("view") === "reps" ? "reps" : "attention";
  const attentionFilters = {
    band: params.get("band") ?? "",
    needs_review: params.get("needs_review") === "true",
    state: params.get("state") ?? "",
    agent_id: params.get("agent_id") ?? "",
  };
  const query = new URLSearchParams({ limit: "50" });
  if (attentionFilters.band) query.set("band", attentionFilters.band);
  if (attentionFilters.needs_review) query.set("needs_review", "true");
  for (const key of ["state", "agent_id"] as const) {
    if (attentionFilters[key]) query.set(key, attentionFilters[key]);
  }
  const cursor = params.get("attention_cursor");
  if (cursor) query.set("cursor", cursor);
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
  const close = () => update({ outreach: null, number: null, lead: null, lead_model: null });
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
  const filterCount = [attentionFilters.band, attentionFilters.needs_review, attentionFilters.state, attentionFilters.agent_id].filter(Boolean).length;
  const knownThrough = list.data?.coverage.known_through;
  const hasGaps = !!list.data?.coverage.gaps.length;

  return (
    <div className="si-root si-workspace">
      <header className="si-workspace__header">
        <div className="si-workspace__titlebar">
          <h1 className="si-workspace__title">{copy.page.title}</h1>
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
            ]}
          />
          {view === "attention" && (
            <p className={hasGaps ? "si-coverage si-coverage--strip si-coverage--catching_up" : "si-coverage si-coverage--strip si-coverage--healthy"}>
              {knownThrough ? copy.coverage.knownThrough(formatDateTime(knownThrough)) : copy.coverage.unknown}
            </p>
          )}
        </div>
      </header>
      <main className="si-workspace__main si-local-stack" role="tabpanel" id={`si-view-panel-${view}`} aria-labelledby={`si-view-tab-${view}`}>
        {view === "reps" && <Reps params={new URLSearchParams(params)} update={update} />}
        {view === "numbers" && <NumberBrowser params={new URLSearchParams(params)} update={update} />}
        {view === "attention" && (
          <div className={filtersOpen ? "si-listview rail-open" : "si-listview"}>
            <FilterToolbar
              open={filtersOpen}
              onToggle={() => setFiltersOpen((open) => !open)}
              activeCount={filterCount}
              chips={attentionChips(attentionFilters, agents.data ?? [], update)}
            />
            <div className="si-listview__grid">
              {filtersOpen && (
                <FilterRail title={copy.filters.attentionTitle} intro={copy.filters.attentionIntro} onClose={() => setFiltersOpen(false)}>
                  <AttentionFilters value={attentionFilters} onChange={update} agents={agents.data ?? []} />
                </FilterRail>
              )}
              <div className="si-listview__list">
                {list.error && <Failure error={list.error} retry={() => void list.refetch()} />}
                {list.isPending && <p role="status">Loading {copy.page.views.attention}…</p>}
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
                        {knownThrough ? copy.coverage.knownThrough(formatDateTime(knownThrough)) : copy.coverage.unknown}
                      </EmptyState>
                    )}
                    <AttentionBands items={list.data.data.items} selected={selected} onOpen={openRow} />
                    <div className="si-loadmore">
                      {cursor && <Button variant="ghost" onClick={() => update({ attention_cursor: null })}>{copy.actions.firstPage}</Button>}
                      {list.data.data.cursor && (
                        <Button disabled={list.isFetching} onClick={() => update({ attention_cursor: list.data!.data.cursor })}>
                          {copy.actions.loadMore}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      {(outreachId || numberId || leadId) && (
        <DetailPanel onClose={close}>
          <Selection outreachId={outreachId} numberId={numberId} leadId={leadId} leadModel={leadModel} update={update} />
        </DetailPanel>
      )}
    </div>
  );
}
