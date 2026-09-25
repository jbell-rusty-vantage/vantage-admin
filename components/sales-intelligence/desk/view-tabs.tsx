/**
 * UI1-DESK (UI-1 §1.1, UX3): the view bar. Link-based (`RouteTabs`), `?view=`, no counts. Overview is the default
 * and is written as no `view` at all. A view link keeps the shared selection (Priority preset, Lead toggle, rail
 * filters, search) and drops the side dialog and the list cursor. No Numbers or Messages tab until UI-3 / UI-4.
 * UX-C1: the Owner's bar has no Needs Attention tab (`OWNER_TABS`); All Outreach is the one Outreach list.
 * UI2-SHELL (UI-2 §2): a rep's bar is `REP_TABS` (My work · All my Outreach · Closed · Overview · Guide) with the rep labels.
 */
import { RouteTabs, type RouteTab } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { deskUrlUpdate, tabsFor, type PageView, type UrlRole } from "../data/url-state";

export const DESK_PATH = "/sales-intelligence";

/** The desk URL for `patch` applied to the current query (keys the desk doesn't own are kept). */
export function deskHref(query: string | URLSearchParams, patch: Parameters<typeof deskUrlUpdate>[1], role: UrlRole = "owner"): string {
  const next = deskUrlUpdate(query, patch, role).toString();
  return next ? `${DESK_PATH}?${next}` : DESK_PATH;
}

export function viewHref(query: string | URLSearchParams, view: PageView, role: UrlRole = "owner"): string {
  return deskHref(query, { view, outreach: null, lead: null, lead_model: null }, role);
}

export const viewLabel = (view: PageView, role: UrlRole = "owner"): string => (role === "rep" ? copy.ui2.shell.views[view] ?? copy.ui1.desk.views[view] : copy.ui1.desk.views[view]);

export function viewTabs(query: string | URLSearchParams, role: UrlRole = "owner"): RouteTab<PageView>[] {
  return tabsFor(role).map((view) => ({ key: view, label: viewLabel(view, role), href: viewHref(query, view, role) }));
}

export function ViewTabs({ active, query, role = "owner" }: { active: PageView; query: string; role?: UrlRole }) {
  return <RouteTabs items={viewTabs(query, role)} active={active} label={role === "rep" ? copy.ui2.shell.viewsLabel : copy.ui1.desk.viewsLabel} className="si-desk__views" />;
}
