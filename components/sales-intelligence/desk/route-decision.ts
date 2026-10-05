/**
 * The route's decision for an incoming `/sales-intelligence` query (pure; the server page calls it). The canonical
 * query keeps only the current view's own keys with valid values (`canonicalSiQuery`), so an old Outreach, Attention,
 * Closed, Overview, Coverage or Guide link, an `outreach=`/`lead=`/`panel=` deep link or a `database_scope` parameter
 * redirects to Numbers. Old OutreachRecord ids are never mapped to a Number.
 */
import { canonicalSiQuery, parseSiUrl, serializeSiUrl } from "../data/url-state";
import { DESK_PATH } from "./view-tabs";

export type SiRouteDecision = { kind: "render" } | { kind: "redirect"; href: string };

export function searchParamsToQuery(searchParams: Record<string, string | string[] | undefined>): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  return query;
}

/** The canonical page URL for any incoming query. */
export function canonicalSiHref(searchParams: Record<string, string | string[] | undefined>): string {
  const canonical = canonicalSiQuery(searchParamsToQuery(searchParams)).toString();
  return canonical ? `${DESK_PATH}?${canonical}` : DESK_PATH;
}

export function siRouteDecision(searchParams: Record<string, string | string[] | undefined>): SiRouteDecision {
  const incoming = searchParamsToQuery(searchParams).toString();
  const href = canonicalSiHref(searchParams);
  if (href === (incoming ? `${DESK_PATH}?${incoming}` : DESK_PATH)) return { kind: "render" };
  return { kind: "redirect", href };
}

/**
 * Where an old `/sales-intelligence` (or `/sales-intelligence/legacy`) link goes now (IMPL-02, permanent): Accounts
 * (`view=reps`) opens `?view=accounts`; a link that carries Numbers state (`number=`, a search, a filter, a page) opens
 * `?view=numbers` with that state; anything else (the bare page, an old Outreach, Attention, Closed, Overview,
 * Coverage or Guide link) opens the desk's default view for the viewer. Old OutreachRecord ids are never mapped.
 */
export function legacySalesIntelligenceHref(searchParams: Record<string, string | string[] | undefined>): string {
  const state = parseSiUrl(searchParamsToQuery(searchParams));
  const canonical = serializeSiUrl(state);
  if (state.view === "reps") return `${DESK_PATH}?${canonical.toString()}`;
  return [...canonical.keys()].some((key) => key !== "view") ? `${DESK_PATH}?${canonical.toString()}` : DESK_PATH;
}
