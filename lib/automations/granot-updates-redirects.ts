/**
 * The permanent redirects `next.config.ts` installs for Granot updates (doc 17, moved under the Automations tab):
 * the old HTTP Automation page and its `?run=` deep link. `/ingestion/granot/lifecycle/**` is untouched (those are
 * the technical case pages). Most specific first; kept free of any import so the Next config loader can bundle it.
 */
export const AUTOMATIONS_HREF = "/automations";
export const GRANOT_UPDATES_HREF = "/automations/granot-updates";

export function granotCheckHref(checkId: string): string {
  return `${GRANOT_UPDATES_HREF}/${encodeURIComponent(checkId)}`;
}

type QueryMatch = { type: "query"; key: string; value?: string };

export type GranotUpdatesRedirectRow = {
  source: string;
  has?: QueryMatch[];
  destination: string;
  permanent: true;
};

export function granotUpdatesRedirectRows(): GranotUpdatesRedirectRow[] {
  return [
    { source: "/ingestion/granot", has: [{ type: "query", key: "run", value: "(?<id>.*)" }], destination: `${GRANOT_UPDATES_HREF}/:id`, permanent: true },
    { source: "/ingestion/granot", destination: GRANOT_UPDATES_HREF, permanent: true },
  ];
}
