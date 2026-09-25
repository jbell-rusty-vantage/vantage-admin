/**
 * UI1-DESK (UI-1 §1.1, UX3): the view bar. Link-based (`RouteTabs`), `?view=`, no counts. Overview is the default
 * and is written as no `view` at all. A view link keeps the shared selection (Priority preset, Lead toggle, rail
 * filters, search) and drops the side dialog and the list cursor. No Numbers or Messages tab until UI-3 / UI-4.
 */
import { RouteTabs, type RouteTab } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { PAGE_VIEWS, deskUrlUpdate, type PageView } from "../data/url-state";

export const DESK_PATH = "/sales-intelligence";

/** The desk URL for `patch` applied to the current query (keys the desk doesn't own are kept). */
export function deskHref(query: string | URLSearchParams, patch: Parameters<typeof deskUrlUpdate>[1]): string {
  const next = deskUrlUpdate(query, patch).toString();
  return next ? `${DESK_PATH}?${next}` : DESK_PATH;
}

export function viewHref(query: string | URLSearchParams, view: PageView): string {
  return deskHref(query, { view, outreach: null, lead: null, lead_model: null });
}

export function viewTabs(query: string | URLSearchParams): RouteTab<PageView>[] {
  return PAGE_VIEWS.map((view) => ({ key: view, label: copy.ui1.desk.views[view], href: viewHref(query, view) }));
}

export function ViewTabs({ active, query }: { active: PageView; query: string }) {
  return <RouteTabs items={viewTabs(query)} active={active} label={copy.ui1.desk.viewsLabel} className="si-desk__views" />;
}
