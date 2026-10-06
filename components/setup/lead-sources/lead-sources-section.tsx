"use client";
/**
 * Setup → Lead sources (`/setup/lead-sources`, doc 19): who sends me leads and how they arrive, as one tree per
 * Source Company. The heading with "Add a lead source", the "Things that need you" strip, the view switch
 * (`?view=sources|granot|numbers`) and the view; every edit is a right sheet keyed by the URL
 * (`?edit=feed|granot|number|cost|source&…`, `?new=1` for Add a lead source).
 *
 * Reads (all existing; no new server reads): the aggregate list, one detail read per source (leaf lines, findings and
 * the readiness plan), the source companies (channel defaults), the feeds (sheet tab names, sheet fields), the Granot
 * names, the inbound routes, and a per-feed periods read for the lead cost amount on expanded sources.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Plus, TriangleAlert } from "lucide-react";
import { SetupSectionHead, useSetupReadOnly } from "@/components/setup/setup-shell";
import { IconBadge, ReadFailure, Segmented, SkeletonLine } from "@/components/ui/crm/primitives";
import { LeadCostSheet } from "@/components/setup/lead-costs/lead-cost-sheet";
import { fetchLeadSource, fetchLeadSources, type LeadSourceDetailResult, type LeadSourceListItem } from "@/lib/api/leadSources";
import { fetchCplPeriods } from "@/lib/api/registryCpl";
import { fetchGranotCrmSources } from "@/lib/api/registryGranotCrmSources";
import { fetchRingCentralRoutes } from "@/lib/api/registryRingCentral";
import { fetchSourceCompanies, fetchSourceGranularities } from "@/lib/api/registrySources";
import { floridaCalendarDateInputValue } from "@/lib/floridaTime";
import { queryKeys } from "@/lib/query/keys";
import type { ReadinessNumber } from "@/lib/setup/readiness";
import { AddSourceSheet } from "./add-source-sheet";
import { FeedSheet } from "./feed-sheet";
import { GranotNamesView, InboundNumbersView } from "./flat-views";
import { GranotNameSheet } from "./granot-name-sheet";
import { InboundNumberSheet } from "./inbound-number-sheet";
import { LS_COPY } from "./lead-sources-copy";
import { channelDefaultsOf, costLeaf, granotRows, numberRows, type CostLeafModel } from "./lead-sources-model";
import {
  closeSheetUrl,
  leadSourcesHref,
  openSheetOf,
  parseLeadSourcesUrl,
  patchLeadSourcesUrl,
  type LeadSourcesUrl,
  type LeadSourcesView,
} from "./lead-sources-url";
import { needsYou, type NeedsYouItem } from "./needs-you";
import { ReadinessBlock } from "./readiness-panel";
import { SourceSheet } from "./source-sheet";
import { SourceCardView, type TreeData } from "./source-tree";

const DETAIL_STALE_MS = 30_000;

export function NeedsYouStrip({ items }: { items: readonly NeedsYouItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="crm-card ls-needs" aria-label={LS_COPY.needsYouLabel} data-testid="needs-you">
      <IconBadge icon={TriangleAlert} tone="amber" />
      <div>
        <h3 className="ls-needs__title">{LS_COPY.needsYouTitle(items.length)}</h3>
        <ul className="ls-needs__list">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={item.href} scroll={false} className="crm-link">
                {item.text}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function LeadSourcesSection() {
  const readOnly = useSetupReadOnly();
  const router = useRouter();
  const searchParams = useSearchParams();
  const url = parseLeadSourcesUrl(searchParams);
  const hrefFor = (patch: Partial<LeadSourcesUrl>) => patchLeadSourcesUrl(url, patch);
  const [clock] = useState(() => ({ now: Date.now(), today: floridaCalendarDateInputValue() }));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const listQuery = useQuery({ queryKey: queryKeys.operationsRegistry.leadSources(), queryFn: fetchLeadSources });
  const companiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceCompanies(true),
    queryFn: () => fetchSourceCompanies({ includeInactive: true }),
  });
  const feedsQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceGranularities({ includeInactive: true }),
    queryFn: () => fetchSourceGranularities({ includeInactive: true }),
  });
  const granotsQuery = useQuery({ queryKey: queryKeys.operationsRegistry.granotCrmSources(), queryFn: fetchGranotCrmSources });
  const routesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.ringCentralRoutes({ includeInactive: true, includeHistory: false }),
    queryFn: () => fetchRingCentralRoutes({ includeInactive: true }),
  });

  const items = listQuery.data?.items ?? [];
  const companies = companiesQuery.data ?? [];
  const feedRecords = feedsQuery.data ?? [];
  const granots = granotsQuery.data ?? [];
  const routes = routesQuery.data ?? [];

  const detailQueries = useQueries({
    queries: items.map((item) => ({
      queryKey: queryKeys.operationsRegistry.leadSourceDetail(item.id),
      queryFn: () => fetchLeadSource(item.id),
      staleTime: DETAIL_STALE_MS,
    })),
  });
  const detailById = new Map<string, LeadSourceDetailResult>();
  items.forEach((item, index) => {
    const data = detailQueries[index]?.data;
    if (data) detailById.set(item.id, data);
  });

  const isOpen = (id: string) => expanded[id] ?? (items.length <= 3 || id === url.source);

  // The lead cost amount comes from the feed's periods; read it only for feeds that are shown and priced.
  const pricedFeedIds = items.flatMap((item) =>
    isOpen(item.id) ? (detailById.get(item.id)?.feeds.items ?? item.feeds.items).filter((feed) => feed.readiness.lead_cost === "ready").map((feed) => feed.id) : [],
  );
  const periodQueries = useQueries({
    queries: pricedFeedIds.map((feedId) => ({
      queryKey: queryKeys.operationsRegistry.cplPeriods(feedId),
      queryFn: () => fetchCplPeriods(feedId),
      staleTime: DETAIL_STALE_MS,
    })),
  });
  const costByFeed = new Map<string, CostLeafModel>();
  pricedFeedIds.forEach((feedId, index) => {
    const query = periodQueries[index];
    if (query?.data) costByFeed.set(feedId, costLeaf("ready", query.data.periods, clock.today));
    // The periods read failed: the feed is priced (the list says so), only the amount is unknown.
    else if (query?.isError) costByFeed.set(feedId, { state: "ready" });
  });

  const tree: TreeData = {
    granotById: new Map(granots.map((granot) => [granot.id, granot])),
    routeById: new Map(routes.map((route) => [route.id, route])),
    feedRecordById: new Map(feedRecords.map((feed) => [feed.id, feed])),
    defaults: channelDefaultsOf(companies),
    costByFeed,
    now: clock.now,
  };

  const needs = needsYou(items, { granotNames: granots, routes, now: clock.now });
  const openSheet = openSheetOf(url);

  const goView = (view: LeadSourcesView) => router.push(leadSourcesHref({ view, source: url.source }));
  const closeSheet = () => router.push(closeSheetUrl(url));

  const viewOptions = [
    { value: "sources" as const, label: LS_COPY.views.sources, count: items.length },
    { value: "granot" as const, label: LS_COPY.views.granot, count: granotsQuery.isSuccess ? granots.length : null },
    { value: "numbers" as const, label: LS_COPY.views.numbers, count: routesQuery.isSuccess ? routes.length : null },
  ];

  return (
    <>
      <SetupSectionHead
        section="lead-sources"
        right={
          readOnly ? null : (
            <Link href={leadSourcesHref({ view: url.view, source: url.source, isNew: true })} scroll={false} className="crm-button crm-button--primary" data-testid="add-lead-source">
              <Plus aria-hidden="true" width={16} height={16} /> {LS_COPY.addButton}
            </Link>
          )
        }
      />

      <NeedsYouStrip items={needs} />

      <div className="ls-switch">
        <Segmented<LeadSourcesView> label={LS_COPY.viewLabel} options={viewOptions} value={url.view} onChange={goView} />
      </div>

      {url.view === "sources" ? (
        <div className="crm-stack" data-testid="lead-sources-tree">
          {listQuery.isPending ? (
            <section className="crm-card ls-pad" aria-busy="true">
              <SkeletonLine width="40%" height={16} />
              <SkeletonLine width="80%" />
              <SkeletonLine width="70%" />
            </section>
          ) : null}
          {listQuery.isError ? <ReadFailure what={LS_COPY.loadFailed} error={listQuery.error} onRetry={() => void listQuery.refetch()} /> : null}
          {listQuery.isSuccess && items.length === 0 ? <section className="crm-card crm-empty">{LS_COPY.empty}</section> : null}
          {items.map((item) => {
            const detail = detailById.get(item.id);
            const open = isOpen(item.id);
            const sourceRoutes: ReadinessNumber[] = detail
              ? routes
                  .filter((route) => !route.active && route.current_assignment && detail.feeds.items.some((feed) => feed.id === route.current_assignment?.source_granularity_id))
                  .map((route) => ({
                    route_id: route.id,
                    feed_id: route.current_assignment!.source_granularity_id,
                    phone_number: route.phone_number,
                    validated: route.validation_status === "valid",
                    active: route.active,
                  }))
              : [];
            const needsTurnOn =
              detail !== undefined &&
              (!detail.active || detail.feeds.items.some((feed) => !feed.readiness.live) || detail.readiness_plan.some((row) => row.status === "ready" || row.status === "blocked"));
            return (
              <SourceCardView
                key={item.id}
                source={item}
                detail={detail}
                tree={tree}
                open={open}
                onToggle={() => setExpanded((current) => ({ ...current, [item.id]: !open }))}
                readOnly={readOnly}
                hrefFor={hrefFor}
              >
                {detail && needsTurnOn ? (
                  <ReadinessBlock
                    detail={detail}
                    numbers={sourceRoutes}
                    readOnly={readOnly}
                    hrefFor={hrefFor}
                    onSettled={async () => {
                      await detailQueries[items.indexOf(item)]?.refetch();
                    }}
                  />
                ) : null}
              </SourceCardView>
            );
          })}
        </div>
      ) : null}

      {url.view === "granot" ? (
        granotsQuery.isError ? (
          <ReadFailure what={LS_COPY.loadFailed} error={granotsQuery.error} onRetry={() => void granotsQuery.refetch()} />
        ) : granotsQuery.isPending ? (
          <section className="crm-card ls-pad" aria-busy="true">
            <SkeletonLine width="60%" height={16} />
            <SkeletonLine width="80%" />
          </section>
        ) : (
          <GranotNamesView rows={granotRows(granots, companies, feedRecords)} readOnly={readOnly} hrefFor={hrefFor} />
        )
      ) : null}

      {url.view === "numbers" ? (
        routesQuery.isError ? (
          <ReadFailure what={LS_COPY.loadFailed} error={routesQuery.error} onRetry={() => void routesQuery.refetch()} />
        ) : routesQuery.isPending ? (
          <section className="crm-card ls-pad" aria-busy="true">
            <SkeletonLine width="60%" height={16} />
            <SkeletonLine width="80%" />
          </section>
        ) : (
          <InboundNumbersView rows={numberRows(routes, companies, feedRecords, clock.now)} readOnly={readOnly} hrefFor={hrefFor} />
        )
      ) : null}

      {openSheet === "add" && !readOnly ? (
        <AddSourceSheet onClose={closeSheet} onFinish={(id) => router.push(leadSourcesHref({ source: id }))} />
      ) : null}
      {openSheet === "feed" && url.feed ? (
        <FeedSheet
          key={url.feed}
          feedId={url.feed}
          sourceId={url.source}
          readOnly={readOnly}
          onClose={closeSheet}
          costHrefFor={(feedId) => hrefFor({ edit: "cost", feed: feedId })}
        />
      ) : null}
      {openSheet === "source" && url.source ? <SourceSheet key={url.source} sourceId={url.source} readOnly={readOnly} onClose={closeSheet} /> : null}
      {openSheet === "granot" && url.granot ? (
        <GranotNameSheet key={url.granot} granotId={url.granot} sourceId={url.source} feedId={url.feed} readOnly={readOnly} onClose={closeSheet} />
      ) : null}
      {openSheet === "number" && url.number ? (
        <InboundNumberSheet
          key={url.number}
          numberId={url.number}
          sourceId={url.source}
          feedId={url.feed}
          readOnly={readOnly}
          onClose={closeSheet}
          onOpenNumber={(routeId) => router.push(leadSourcesHref({ view: url.view, source: url.source, feed: url.feed, edit: "number", number: routeId }))}
        />
      ) : null}
      {openSheet === "cost" && url.feed ? <CostSheetMount feedId={url.feed} items={items} readOnly={readOnly} onClose={closeSheet} /> : null}
    </>
  );
}

function CostSheetMount({
  feedId,
  items,
  readOnly,
  onClose,
}: {
  feedId: string;
  items: LeadSourceListItem[];
  readOnly: boolean;
  onClose: () => void;
}) {
  const source = items.find((item) => item.feeds.items.some((feed) => feed.id === feedId));
  const feed = source?.feeds.items.find((candidate) => candidate.id === feedId);
  if (!source || !feed) return null;
  return <LeadCostSheet feedId={feedId} leadSourceName={source.owner_label || source.name} feedName={feed.display_name} readOnly={readOnly} onClose={onClose} />;
}
