/**
 * The permanent redirects `next.config.ts` installs for the Setup build (doc 19 "Routes"), most specific first (Next
 * takes the first match). `lib/setup/setup-links.ts` is the same mapping for a running page; `tests/setup-shell.test.ts`
 * keeps the two in step. Kept free of any import so the Next config loader can bundle it.
 */
const SETUP = {
  leadSources: "/setup/lead-sources",
  leadCosts: "/setup/lead-costs",
  people: "/setup/people",
  merchants: "/setup/merchants",
  carriers: "/setup/carriers",
  connections: "/setup/connections",
  website: "/setup/website",
  changes: "/setup/changes",
} as const;

type QueryMatch = { type: "query"; key: string; value?: string };

export type SetupRedirectRow = {
  source: string;
  has?: QueryMatch[];
  destination: string;
  permanent: true;
};

const tab = (value: string): QueryMatch => ({ type: "query", key: "tab", value });
const capture = (key: string): QueryMatch => ({ type: "query", key, value: "(?<id>.*)" });

export function setupRedirectRows(): SetupRedirectRow[] {
  const registry = "/operations-registry";
  return [
    { source: registry, has: [tab("(lead-sources|sources)"), capture("entity")], destination: `${SETUP.leadSources}?source=:id`, permanent: true },
    { source: registry, has: [tab("(lead-sources|sources)"), capture("feed")], destination: `${SETUP.leadSources}?feed=:id`, permanent: true },
    { source: registry, has: [tab("(granot-names|granot-sources)"), capture("entity")], destination: `${SETUP.leadSources}?view=granot&granot=:id`, permanent: true },
    { source: registry, has: [tab("(granot-names|granot-sources)")], destination: `${SETUP.leadSources}?view=granot`, permanent: true },
    { source: registry, has: [tab("(inbound-numbers|ringcentral)"), capture("entity")], destination: `${SETUP.leadSources}?view=numbers&number=:id`, permanent: true },
    { source: registry, has: [tab("(inbound-numbers|ringcentral)")], destination: `${SETUP.leadSources}?view=numbers`, permanent: true },
    { source: registry, has: [tab("(lead-costs|cpl)"), { type: "query", key: "cpl_mode", value: "corrections" }], destination: `${SETUP.leadCosts}?view=fix`, permanent: true },
    { source: registry, has: [tab("(lead-costs|cpl)")], destination: SETUP.leadCosts, permanent: true },
    { source: registry, has: [tab("legacy-cpl")], destination: `${SETUP.leadCosts}?view=old`, permanent: true },
    { source: registry, has: [tab("agents"), capture("entity")], destination: `${SETUP.people}?person=:id`, permanent: true },
    { source: registry, has: [tab("(agents|users)")], destination: SETUP.people, permanent: true },
    { source: registry, has: [tab("merchants")], destination: SETUP.merchants, permanent: true },
    { source: registry, has: [tab("moving-carriers")], destination: SETUP.carriers, permanent: true },
    { source: registry, has: [tab("changes")], destination: SETUP.changes, permanent: true },
    { source: registry, has: [tab("overview")], destination: SETUP.connections, permanent: true },
    { source: registry, destination: SETUP.leadSources, permanent: true },
    { source: "/settings", destination: SETUP.carriers, permanent: true },
    { source: "/extension", destination: SETUP.people, permanent: true },
    { source: "/testimonials", destination: SETUP.website, permanent: true },
  ];
}
