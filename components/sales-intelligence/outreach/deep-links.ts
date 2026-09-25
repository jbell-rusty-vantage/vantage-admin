/**
 * UI1-SHELL: the Outreach route's URLs and the old deep-link rule (final spec §4, UI-1 §5, ADMIN-REBUILD trap 5).
 * Pure, so the server `page.tsx` (`permanentRedirect`) and the browser (`router.replace`) share one table.
 *
 * | Old link (on `/sales-intelligence`)                         | Goes to                                                         |
 * | `?outreach={id}&panel=assessment`                           | `/sales-intelligence/outreach/{id}?tab=analysis#scores`         |
 * | `?outreach={id}&panel=analysis&analysis_run={run}`          | `/sales-intelligence/outreach/{id}?tab=analysis&run={run}#full-output` |
 * | `?outreach={id}&panel=analysis` (no run)                    | `/sales-intelligence/outreach/{id}?tab=analysis#full-output`    |
 * | the same two with `lead={id}&lead_model={model}`, no `outreach` | resolved in the browser: `GET /outreach/by-lead/{model}/{id}`, then `router.replace` to the row above |
 * | anything else (`view=attention&lead=&lead_model=`, `si_return=`, other panels) | no redirect: the desk handles it (trap 4) |
 *
 * `si_return` is carried to the route so the back link still returns where the Owner came from.
 */
export type OutreachTab = "analysis" | "timeline" | "work";
export const OUTREACH_TABS: readonly OutreachTab[] = ["analysis", "timeline", "work"];
export const DEFAULT_OUTREACH_TAB: OutreachTab = "analysis";

/** Final spec §11 anchors (the analysis kit's section ids; `#full-output` is Full output). */
export const ANALYSIS_ANCHORS = ["situation", "scores", "move-details", "findings", "conversations", "full-output"] as const;
export type AnalysisAnchor = (typeof ANALYSIS_ANCHORS)[number];

export function parseOutreachTab(value: string | string[] | null | undefined): OutreachTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return (OUTREACH_TABS as readonly string[]).includes(raw ?? "") ? (raw as OutreachTab) : DEFAULT_OUTREACH_TAB;
}

/** Only a `/sales-intelligence…` path is a valid return (same rule as `salesIntelligenceReturnHref`). */
export function validReturn(value: string | null | undefined): string | null {
  return value && value.startsWith("/sales-intelligence") && !value.startsWith("//") ? value : null;
}

export function outreachRouteHref(
  id: string,
  { tab, run, anchor, siReturn }: { tab?: OutreachTab; run?: string | null; anchor?: AnalysisAnchor | null; siReturn?: string | null } = {},
): string {
  const params = new URLSearchParams();
  if (tab && tab !== DEFAULT_OUTREACH_TAB) params.set("tab", tab);
  else if (tab === DEFAULT_OUTREACH_TAB && (anchor || run)) params.set("tab", tab);
  if (run) params.set("run", run);
  const back = validReturn(siReturn);
  if (back) params.set("si_return", back);
  const query = params.toString();
  return `/sales-intelligence/outreach/${encodeURIComponent(id)}${query ? `?${query}` : ""}${anchor ? `#${anchor}` : ""}`;
}

type Params = URLSearchParams | Record<string, string | string[] | undefined>;
const get = (params: Params, key: string): string | null => {
  if (params instanceof URLSearchParams) return params.get(key);
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? null;
};

export type DeepLinkTarget =
  | { kind: "redirect"; href: string }
  | { kind: "resolve-lead"; model: string; leadId: string; tab: OutreachTab; run: string | null; anchor: AnalysisAnchor; siReturn: string | null };

/** The redirect rule table above. `null` means the old link isn't an analysis deep link; render the desk. */
export function deepLinkTarget(params: Params): DeepLinkTarget | null {
  const panel = get(params, "panel");
  if (panel !== "assessment" && panel !== "analysis") return null;
  const run = panel === "analysis" ? get(params, "analysis_run") || null : null;
  const anchor: AnalysisAnchor = panel === "assessment" ? "scores" : "full-output";
  const siReturn = validReturn(get(params, "si_return"));
  const outreach = get(params, "outreach");
  if (outreach) return { kind: "redirect", href: outreachRouteHref(outreach, { tab: "analysis", run, anchor, siReturn }) };
  const leadId = get(params, "lead");
  const model = get(params, "lead_model");
  if (leadId && (model === "FormLead" || model === "CallLead")) return { kind: "resolve-lead", model, leadId, tab: "analysis", run, anchor, siReturn };
  return null;
}

/** The desk the back link returns to: `si_return` when it's a Sales Intelligence path, else the desk's default view. */
const LAST_DESK_KEY = "si:last-desk-href";

/** The desk remembers its URL (view, filters, sort; not the open side dialog) so a record's Back returns to it. */
export function rememberDeskHref(href: string): void {
  try {
    window.sessionStorage.setItem(LAST_DESK_KEY, href);
  } catch {
    // Storage blocked: Back falls back to the desk's default view.
  }
}

function lastDeskHref(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return validReturn(window.sessionStorage.getItem(LAST_DESK_KEY));
  } catch {
    return null;
  }
}

export function backHref(siReturn: string | null | undefined): string {
  return validReturn(siReturn) ?? lastDeskHref() ?? "/sales-intelligence";
}
