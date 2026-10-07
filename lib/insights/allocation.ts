/**
 * Shaping for the Outreach Desk's "Lead cost by rep" card (Owner view). Pure: colours per source company, stacked-bar
 * segments, sorting and labels. The server prices each lead at its feed's live lead cost; duplicates are free.
 */
import type { InsightsAllocationFeedCell, InsightsAllocationRep, InsightsAllocationReport, InsightsPeriodPreset } from "@/lib/api/insights";

export const ALLOCATION_PERIODS: ReadonlyArray<{ value: InsightsPeriodPreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "last_30", label: "Last 30 days" },
];

export const DEFAULT_ALLOCATION_PERIOD: InsightsPeriodPreset = "this_month";

/** Distinct hues for source companies; every colour is paired with the company name in a legend or title. */
export const ALLOCATION_PALETTE = ["#2f6fed", "#14a39a", "#e08a1e", "#7c5cd6", "#d6477f", "#3f9d4e", "#a0673c", "#6b7a90"] as const;

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Whole dollars; cents only when the amount is not whole. */
export function allocationMoney(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? usd0.format(value) : usd2.format(value);
}

/** An average (cost per booked lead, average lead cost): whole dollars, so "$1,233" rather than "$1,233.33". */
export function allocationAverage(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return usd0.format(Math.round(value));
}

export function allocationShare(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const percent = value * 100;
  return `${percent > 0 && percent < 1 ? "<1" : Math.round(percent)}%`;
}

/** One colour per source company, by its place in the report's company list (so a company keeps its colour across rows). */
export function assignCompanyColors(companies: ReadonlyArray<{ key: string }>): Record<string, string> {
  const colors: Record<string, string> = {};
  companies.forEach((company, index) => {
    colors[company.key] = ALLOCATION_PALETTE[index % ALLOCATION_PALETTE.length] as string;
  });
  return colors;
}

/** Colour for a company missing from the list (defensive); neutral gray. */
export function companyColor(colors: Record<string, string>, key: string): string {
  return colors[key] ?? "#9aa6b8";
}

export function isUnassignedRep(rep: Pick<InsightsAllocationRep, "agent_id">): boolean {
  return rep.agent_id === null;
}

/** Highest spend first, ties by name; the Unassigned row always last. A rep with no spend still shows. */
export function sortAllocationReps(reps: readonly InsightsAllocationRep[]): InsightsAllocationRep[] {
  return [...reps].sort((a, b) => {
    const ua = isUnassignedRep(a) ? 1 : 0;
    const ub = isUnassignedRep(b) ? 1 : 0;
    if (ua !== ub) return ua - ub;
    if (b.spend !== a.spend) return b.spend - a.spend;
    return a.agent_name.localeCompare(b.agent_name);
  });
}

export type AllocationBarSegment = {
  key: string;
  label: string;
  color: string;
  spend: number;
  leads: number;
  /** Width as a percent of the widest rep's total, so bar lengths compare across rows. */
  widthPercent: number;
  title: string;
};

export function maxRepSpend(reps: readonly InsightsAllocationRep[]): number {
  return reps.reduce((max, rep) => (rep.spend > max ? rep.spend : max), 0);
}

/** Stacked-bar segments for one rep: priced companies only (free leads have no width), biggest first. */
export function repBarSegments(rep: InsightsAllocationRep, colors: Record<string, string>, maxSpend: number): AllocationBarSegment[] {
  if (!(maxSpend > 0)) return [];
  return (rep.by_company ?? [])
    .filter((cell) => cell.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .map((cell) => ({
      key: cell.source_company,
      label: cell.source_company_label,
      color: companyColor(colors, cell.source_company),
      spend: cell.spend,
      leads: cell.leads,
      widthPercent: (cell.spend / maxSpend) * 100,
      title: `${cell.source_company_label}: ${allocationMoney(cell.spend)} for ${cell.leads} ${cell.leads === 1 ? "lead" : "leads"}`,
    }));
}

export type AllocationChange = { kind: "none" | "new" | "same" | "up" | "down"; text: string; title: string };

/** Allocated spend against the previous period. Neutral wording: more spend is neither good nor bad. */
export function allocationChange(rep: Pick<InsightsAllocationRep, "spend" | "comparison_spend">, hasComparison: boolean): AllocationChange {
  const before = rep.comparison_spend;
  if (!hasComparison || before === null || before === undefined) return { kind: "none", text: "—", title: "No earlier period to compare" };
  const title = `Previous period: ${allocationMoney(before)}`;
  const diff = rep.spend - before;
  if (diff === 0) return { kind: "same", text: "No change", title };
  if (before === 0) return { kind: "new", text: `Up ${allocationMoney(diff)} (was $0)`, title };
  const pct = Math.round((Math.abs(diff) / before) * 100);
  const words = `${allocationMoney(Math.abs(diff))} (${pct}%)`;
  return diff > 0 ? { kind: "up", text: `Up ${words}`, title } : { kind: "down", text: `Down ${words}`, title };
}

export type AllocationFeedLine = { key: string; label: string; rate: string; leads: number; spend: number; spendText: string };

/** Per-feed lines for an expanded row: "Source › Feed", lead cost per lead, leads, spend. Biggest spend first. */
export function repFeedLines(rep: InsightsAllocationRep): AllocationFeedLine[] {
  return [...(rep.by_feed ?? [])]
    .sort((a, b) => b.spend - a.spend || b.leads - a.leads || a.feed_label.localeCompare(b.feed_label))
    .map((feed: InsightsAllocationFeedCell) => ({
      key: `${feed.source_company}:${feed.feed_key}`,
      label: `${feed.source_company_label} › ${feed.feed_label}`,
      rate: feed.cpl === null ? "—" : feed.cpl === 0 ? "Free" : allocationMoney(feed.cpl),
      leads: feed.leads,
      spend: feed.spend,
      spendText: allocationMoney(feed.spend),
    }));
}

export type AllocationHeader = {
  total: string;
  unassigned: string;
  /** Share of all spend with no rep yet, e.g. "15%"; null when nothing was spent. */
  unassignedShare: string | null;
  leads: number;
  unpricedLeads: number;
  unpricedNote: string | null;
};

export function allocationHeader(report: Pick<InsightsAllocationReport, "totals">): AllocationHeader {
  const { totals } = report;
  const unpriced = totals.unpriced_leads;
  return {
    total: allocationMoney(totals.spend),
    unassigned: allocationMoney(totals.unassigned_spend),
    unassignedShare: totals.spend > 0 ? allocationShare(totals.unassigned_spend / totals.spend) : null,
    leads: totals.leads,
    unpricedLeads: unpriced,
    unpricedNote:
      unpriced > 0
        ? `${unpriced} ${unpriced === 1 ? "lead has" : "leads have"} no lead cost set for its feed yet, so it is counted as $0. Set it in Setup › Lead sources.`
        : null,
  };
}

/** Booked and cost per booked lead, in words. */
export function bookedText(rep: Pick<InsightsAllocationRep, "booked" | "cost_per_booked">): { booked: string; perBooked: string } {
  return { booked: String(rep.booked), perBooked: rep.booked > 0 && rep.cost_per_booked !== null ? allocationAverage(rep.cost_per_booked) : "—" };
}
