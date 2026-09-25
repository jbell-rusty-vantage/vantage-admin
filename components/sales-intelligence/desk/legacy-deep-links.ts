/**
 * UI1-DESK (ADMIN-REBUILD trap 5): the old panel deep links of the retired workspace, redirected server-side by the
 * route's `page.tsx` (with `permanentRedirect`) to the Outreach route. Pure, so the page and the tests share it.
 *
 * - Only a link with `outreach=` **and** `panel=` moves. `outreach=` alone keeps opening the desk's side dialog,
 *   and a Lead-only link (`lead=&lead_model=`) resolves in the browser through `outreach/by-lead` (trap 4).
 * - `panel=assessment` → `#scores`; `panel=analysis` → `#full-output`, with `run=` from `analysis_run=`;
 *   `panel=activity` → the Timeline tab; `panel=work` / `panel=matches` → the Work tab; `panel=summary` and any
 *   other value → the route's default tab (Analysis).
 * - `si_return=` rides along, so the route's back link still returns where the Owner came from.
 */
export type SearchParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

function first(params: SearchParamsInput, key: string): string | null {
  const value = params instanceof URLSearchParams ? params.get(key) : params[key];
  const one = Array.isArray(value) ? value[0] : value;
  return typeof one === "string" && one.trim() ? one.trim() : null;
}

const TAB_FOR_PANEL: Record<string, string> = { activity: "timeline", work: "work", matches: "work" };

export function legacyDeepLinkRedirect(searchParams: SearchParamsInput): string | null {
  const outreach = first(searchParams, "outreach");
  const panel = first(searchParams, "panel");
  if (!outreach || !panel) return null;
  const query = new URLSearchParams();
  const tab = TAB_FOR_PANEL[panel];
  if (tab) query.set("tab", tab);
  const run = panel === "analysis" ? first(searchParams, "analysis_run") : null;
  if (run) query.set("run", run);
  const back = first(searchParams, "si_return");
  if (back && back.startsWith("/sales-intelligence")) query.set("si_return", back);
  const hash = panel === "assessment" ? "#scores" : panel === "analysis" ? "#full-output" : "";
  const text = query.toString();
  return `/sales-intelligence/outreach/${encodeURIComponent(outreach)}${text ? `?${text}` : ""}${hash}`;
}
