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
  /**
   * UI2-OVERVIEW (UI-2 §1, §6): a rep's links. The server forces the rep's scope, so no link carries `agent_id` or
   * `unassigned`, and none opens an Owner-only view (Coverage, RingCentral Accounts): those fall back to the rep's lists.
   */
  rep?: boolean;
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

export function overviewLinks(ctx: OverviewLinkContext): OverviewLinks {
  const preset = { priority: [...ctx.priority], attachment: ctx.attachment };
  if (ctx.rep) return repOverviewLinks(preset);
  const scoped = { ...preset, agent_id: ctx.agentId ? [ctx.agentId] : [] };
  return {
    /** Band tile → All Outreach filtered to that band (UX-C1: the Owner has no Needs Attention tab). */
    band: (band: number) => siHref({ view: "all_outreach", band: [String(band)], ...scoped }),
    /** Needs review → All Outreach with `needs_review=true`. */
    needsReview: () => siHref({ view: "all_outreach", needs_review: true, ...scoped }),
    /** Unassigned → All Outreach with `unassigned=true` (no rep: those records have none). */
    unassigned: () => siHref({ view: "all_outreach", unassigned: true, ...preset }),
    /** Live calls → All Outreach sorted by Last call (its default direction, newest first). */
    liveCalls: () => siHref({ view: "all_outreach", sort: "last_call", ...scoped }),
    /** `{n} overdue now` → Band 1 (Callbacks overdue). */
    overdueNow: () => siHref({ view: "all_outreach", band: ["1"], ...scoped }),
    /** The capture health line → Coverage. */
    coverage: () => siHref({ view: "coverage" }),
    /** A rep's name → All Outreach filtered to that rep. */
    rep: (agentId: string) => siHref({ view: "all_outreach", ...preset, agent_id: [agentId] }),
    /** The Unmapped rep row → RingCentral Accounts. */
    accounts: () => siHref({ view: "reps" }),
    /**
     * A Flow out segment → Closed with that outcome, closed within the activity period's ET days. FIX-UI1 (m5):
     * `Moved to Quoted` (not a closed outcome) → All Outreach at Granot Priority 1 received in the period.
     */
    closed: (segment: string, period: { from_day: string; to_day: string }) => {
      if (segment === "moved_to_quoted") {
        return siHref({ view: "all_outreach", ...scoped, priority: ["1"], received_from: period.from_day, received_to: period.to_day });
      }
      const outcome = FLOW_OUTCOMES[segment];
      return outcome ? siHref({ view: "closed", outcome, ...scoped, closed_from: period.from_day, closed_to: period.to_day }) : null;
    },
    /** FIX-UI1 (m5): Flow `In` → All Outreach received within the activity period's ET days. */
    flowIn: (period: { from_day: string; to_day: string }) =>
      siHref({ view: "all_outreach", ...scoped, received_from: period.from_day, received_to: period.to_day }),
    /** FIX-UI1 (m5): a rep's Overdue cell → All Outreach for that rep in Band 1 (Callbacks overdue). */
    repOverdue: (agentId: string) => siHref({ view: "all_outreach", ...preset, agent_id: [agentId], band: ["1"] }),
  };
}
export type OverviewLinks = {
  band: (band: number) => string;
  needsReview: () => string;
  unassigned: () => string;
  liveCalls: () => string;
  overdueNow: () => string;
  coverage: () => string;
  rep: (agentId: string) => string;
  accounts: () => string;
  closed: (segment: string, period: { from_day: string; to_day: string }) => string | null;
  flowIn: (period: { from_day: string; to_day: string }) => string;
  repOverdue: (agentId: string) => string;
};

/**
 * UI2-OVERVIEW: the rep's links, the same lists without a scope param (the rep's pages never send one). The rep's
 * blocks render no Unassigned, Coverage, rep-name or RingCentral Accounts link; those entries point at the rep's own
 * lists so a stray call still opens a rep page.
 */
function repOverviewLinks(preset: { priority: string[]; attachment: "lead" | "none" | null }): OverviewLinks {
  const all = (extra: Partial<DeskUrlState> = {}) => siHref({ view: "all_outreach", ...preset, ...extra });
  return {
    band: (band) => all({ band: [String(band)] }),
    needsReview: () => all({ needs_review: true }),
    unassigned: () => all(),
    liveCalls: () => all({ sort: "last_call" }),
    overdueNow: () => all({ band: ["1"] }),
    coverage: () => SI_PATH,
    rep: () => all(),
    accounts: () => SI_PATH,
    closed: (segment, period) => {
      if (segment === "moved_to_quoted") return all({ priority: ["1"], received_from: period.from_day, received_to: period.to_day });
      const outcome = FLOW_OUTCOMES[segment];
      return outcome ? siHref({ view: "closed", outcome, ...preset, closed_from: period.from_day, closed_to: period.to_day }) : null;
    },
    flowIn: (period) => all({ received_from: period.from_day, received_to: period.to_day }),
    repOverdue: () => all({ band: ["1"] }),
  };
}
