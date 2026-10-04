/** The view bar: Numbers (the default, written as no `view`) and RingCentral Accounts. Link-based, no counts. */
import { RouteTabs, type RouteTab } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { SI_VIEWS, siUrlUpdate, type SiView } from "../data/url-state";

export const DESK_PATH = "/sales-intelligence";

/** The page URL for a view, keeping the current view's own state only when it doesn't change. */
export function viewHref(query: string | URLSearchParams, view: SiView): string {
  const next = siUrlUpdate(query, { view }).toString();
  return next ? `${DESK_PATH}?${next}` : DESK_PATH;
}

export function viewTabs(query: string | URLSearchParams): RouteTab<SiView>[] {
  return SI_VIEWS.map((view) => ({ key: view, label: copy.page.views[view], href: viewHref(query, view) }));
}

export function ViewTabs({ active, query }: { active: SiView; query: string }) {
  return <RouteTabs items={viewTabs(query)} active={active} label={copy.page.viewsLabel} className="si-desk__views" />;
}
