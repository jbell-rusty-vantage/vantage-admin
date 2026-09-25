/**
 * UI1-OVERVIEW (UI-1 §4.2, A16–A17): the filtered-list URL behind every Overview number. Each link carries the
 * current preset (Priority + Lead toggle) and, on a one-rep scope, the rep, so the list opened shows the same
 * records the number counted (the Overview's `now` is the Needs Attention index at the same `as_of`, C8).
 */
import { serializeDeskUrl, type DeskUrlState } from "../data/url-state";

export const SI_PATH = "/sales-intelligence";

export type OverviewLinkContext = {
  priority: readonly string[];
  attachment: "lead" | "none" | null;
  /** `data.scope.agent_id` on a one-rep scope; null for the whole desk. */
  agentId?: string | null;
};

/** The closed outcomes behind each Flow out segment that has a list (Closed view `outcome=`). */
export const FLOW_OUTCOMES: Record<string, string[]> = {
  booked_in_granot: ["granot_booked"],
  booked: ["booked"],
  crm_bad_dead: ["crm_dead", "crm_bad_unusable"],
  owner_closed: ["owner"],
};

export function siHref(state: Partial<DeskUrlState>): string {
  const query = serializeDeskUrl(state).toString();
  return query ? `${SI_PATH}?${query}` : SI_PATH;
}

export function overviewLinks(ctx: OverviewLinkContext) {
  const preset = { priority: [...ctx.priority], attachment: ctx.attachment };
  const scoped = { ...preset, agent_id: ctx.agentId ? [ctx.agentId] : [] };
  return {
    /** Band tile → Needs Attention filtered to that band. */
    band: (band: number) => siHref({ view: "attention", band: [String(band)], ...scoped }),
    /** Needs review → Needs Attention with `needs_review=true`. */
    needsReview: () => siHref({ view: "attention", needs_review: true, ...scoped }),
    /** Unassigned → All Outreach with `unassigned=true` (no rep: those records have none). */
    unassigned: () => siHref({ view: "all_outreach", unassigned: true, ...preset }),
    /** Live calls → All Outreach sorted by Last call (its default direction, newest first). */
    liveCalls: () => siHref({ view: "all_outreach", sort: "last_call", ...scoped }),
    /** `{n} overdue now` → Band 1 (Callbacks overdue). */
    overdueNow: () => siHref({ view: "attention", band: ["1"], ...scoped }),
    /** The capture health line → Coverage. */
    coverage: () => siHref({ view: "coverage" }),
    /** A rep's name → All Outreach filtered to that rep. */
    rep: (agentId: string) => siHref({ view: "all_outreach", ...preset, agent_id: [agentId] }),
    /** The Unmapped rep row → RingCentral Accounts. */
    accounts: () => siHref({ view: "reps" }),
    /** A Flow out segment → Closed with that outcome, closed within the activity period's ET days. */
    closed: (segment: string, period: { from_day: string; to_day: string }) => {
      const outcome = FLOW_OUTCOMES[segment];
      return outcome ? siHref({ view: "closed", outcome, ...scoped, closed_from: period.from_day, closed_to: period.to_day }) : null;
    },
  };
}
export type OverviewLinks = ReturnType<typeof overviewLinks>;
