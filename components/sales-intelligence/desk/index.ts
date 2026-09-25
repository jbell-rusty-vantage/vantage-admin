/**
 * UI1-DESK + UI1-CLOSED: the Sales Intelligence page (`/sales-intelligence`). The route mounts `<Desk/>` after
 * the Owner check and the old-panel redirect (`legacyDeepLinkRedirect`); `loading.tsx` renders `DeskRouteSkeleton`.
 */
export { Desk, DeskRouteSkeleton, type DeskProps } from "./desk";
export { legacyDeepLinkRedirect, deskRouteDecision, type DeskRouteDecision, type LeadDeepLinkTarget } from "./legacy-deep-links";
export { ViewTabs, viewTabs, viewHref, deskHref, DESK_PATH } from "./view-tabs";
export { PageHeader, PageHeaderView, isShortPhone, searchAction } from "./page-header";
export { MetricsStrip, MetricsStripView, metricTiles, type MetricTile, type MetricTileId } from "./metrics-strip";
export { OutreachList, OutreachListView, sortLineFor, groupByBand, emptyText, resultsText, LIST_HEADING_ID } from "./outreach-list";
export { ClosedList, ClosedHistoryView, ClosedCard, HistoryRow, historyEndText, closedListEnd, historyClosedBefore, historyParams } from "./closed-list";
export { ListControls, sortOptions, sortPatch, defaultSortOf } from "./list-controls";
export { ActiveChips } from "./active-chips";
export { StaleBanner } from "./stale-banner";
export { applyDegrade, nextDegrade, degradeNotices, NO_DEGRADE, type Degrade } from "./degrade";
export { PresetBar, usePresetSelection } from "./preset-bar";
