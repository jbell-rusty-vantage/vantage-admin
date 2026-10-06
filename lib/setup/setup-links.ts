/**
 * Setup routes (dashboard-redesign-proposal/19-setup-recommendation.md "Routes"). Pure: no React, so node:test covers
 * every mapping. The Operations Registry's `?tab=` model and the `/extension`, `/testimonials` and `/settings` pages
 * became the eight Setup sections; `rewriteRegistryHref` translates any old deep link the server or an older
 * component still produces, and `setupRedirectRows` is the same table as `next.config.ts` permanent redirects.
 */

export const SETUP_ROUTES = {
  leadSources: "/setup/lead-sources",
  leadCosts: "/setup/lead-costs",
  people: "/setup/people",
  merchants: "/setup/merchants",
  carriers: "/setup/carriers",
  connections: "/setup/connections",
  sheetIngestion: "/setup/sheet-ingestion",
  website: "/setup/website",
  changes: "/setup/changes",
} as const;

export type SetupRoute = (typeof SETUP_ROUTES)[keyof typeof SETUP_ROUTES];

/** Every `?tab=` value the Registry shell ever honoured, including the legacy ones kept as redirects. */
export const REGISTRY_TAB_TO_SETUP: Readonly<Record<string, SetupRoute>> = {
  overview: SETUP_ROUTES.connections,
  agents: SETUP_ROUTES.people,
  users: SETUP_ROUTES.people,
  merchants: SETUP_ROUTES.merchants,
  "lead-sources": SETUP_ROUTES.leadSources,
  sources: SETUP_ROUTES.leadSources,
  "granot-names": SETUP_ROUTES.leadSources,
  "granot-sources": SETUP_ROUTES.leadSources,
  "inbound-numbers": SETUP_ROUTES.leadSources,
  ringcentral: SETUP_ROUTES.leadSources,
  "moving-carriers": SETUP_ROUTES.carriers,
  "lead-costs": SETUP_ROUTES.leadCosts,
  cpl: SETUP_ROUTES.leadCosts,
  "legacy-cpl": SETUP_ROUTES.leadCosts,
  changes: SETUP_ROUTES.changes,
};

function withQuery(path: string, params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * The Setup href for an old Registry `?tab=` plus its `entity` / `feed` / `cpl_mode` keys:
 * a lead source opens as `?source=`, a feed as `?feed=`, a Granot name as the Granot names view with `?granot=`,
 * an inbound number as the Inbound numbers view with `?number=`, an Agent as `?person=`, corrections as `?view=fix`,
 * the legacy CPL table as `?view=old`.
 */
export function setupHrefForRegistryTab(
  tab: string | null | undefined,
  params: { entity?: string | null; feed?: string | null; cpl_mode?: string | null } = {},
): string {
  const key = tab ?? "";
  const route = REGISTRY_TAB_TO_SETUP[key] ?? SETUP_ROUTES.leadSources;
  const entity = params.entity ?? null;
  switch (key) {
    case "lead-sources":
    case "sources":
      return withQuery(route, { source: entity, feed: params.feed });
    case "granot-names":
    case "granot-sources":
      return withQuery(route, { view: "granot", granot: entity });
    case "inbound-numbers":
    case "ringcentral":
      return withQuery(route, { view: "numbers", number: entity });
    case "lead-costs":
    case "cpl":
      return withQuery(route, { view: params.cpl_mode === "corrections" ? "fix" : null });
    case "legacy-cpl":
      return withQuery(route, { view: "old" });
    case "agents":
      return withQuery(route, { person: entity });
    default:
      return route;
  }
}

/**
 * Rewrites an old dashboard href (`/operations-registry?tab=…`, `/extension`, `/testimonials`, `/settings`) to its
 * Setup route. Anything else, including hrefs that already point into `/setup`, is returned unchanged.
 */
export function rewriteRegistryHref(href: string): string {
  if (!href) return href;
  const [pathAndQuery, hash] = href.split("#", 2);
  const [path, query = ""] = pathAndQuery!.split("?", 2);
  const search = new URLSearchParams(query);
  let next: string | null = null;
  if (path === "/operations-registry" || path!.startsWith("/operations-registry/")) {
    next = setupHrefForRegistryTab(search.get("tab"), {
      entity: search.get("entity"),
      feed: search.get("feed"),
      cpl_mode: search.get("cpl_mode"),
    });
  } else if (path === "/extension" || path!.startsWith("/extension/")) {
    next = SETUP_ROUTES.people;
  } else if (path === "/testimonials" || path!.startsWith("/testimonials/")) {
    next = SETUP_ROUTES.website;
  } else if (path === "/settings" || path!.startsWith("/settings/")) {
    next = SETUP_ROUTES.carriers;
  }
  if (next === null) return href;
  return hash ? `${next}#${hash}` : next;
}
