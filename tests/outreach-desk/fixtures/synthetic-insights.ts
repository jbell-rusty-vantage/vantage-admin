/**
 * Synthetic Owner money reads for desk mock mode (`OUTREACH_DESK_MOCK`): the Team view's "Lead cost by rep" card and
 * the Operations board's live lead spend. Invented names and amounts only.
 */
import type { InsightsAllocationReport, InsightsLeadSpendDay, InsightsPeriod } from "@/lib/api/insights";

const PERIOD: InsightsPeriod = {
  preset: "this_month",
  start: "2026-10-01",
  end_exclusive: "2026-10-07",
  end: "2026-10-06",
  days: 6,
  label: "Oct 1 – Oct 6, 2026",
  bucket: "day",
  includes_today: true,
};

export function syntheticAllocationReport(): InsightsAllocationReport {
  const rep = (agent_id: string | null, agent_name: string, rows: Array<[string, string, string, string, number, number]>, booked: number, comparison: number) => {
    const leads = rows.reduce((sum, row) => sum + row[4], 0);
    const spend = rows.reduce((sum, row) => sum + row[4] * row[5], 0);
    const companies = new Map<string, { source_company: string; source_company_label: string; leads: number; spend: number }>();
    for (const [slug, label, , , count, cpl] of rows) {
      const entry = companies.get(slug) ?? { source_company: slug, source_company_label: label, leads: 0, spend: 0 };
      entry.leads += count;
      entry.spend += count * cpl;
      companies.set(slug, entry);
    }
    return {
      agent_id,
      agent_name,
      active: agent_id ? true : null,
      leads,
      duplicates: 1,
      spend,
      share_of_spend: null as number | null,
      booked,
      cost_per_booked: booked ? spend / booked : null,
      average_cpl: leads ? spend / leads : null,
      comparison_spend: comparison,
      by_company: [...companies.values()].sort((a, b) => b.spend - a.spend),
      by_feed: rows.map(([slug, label, feedKey, feedLabel, count, cpl]) => ({
        source_company: slug,
        source_company_label: label,
        feed_key: feedKey,
        feed_label: feedLabel,
        leads: count,
        spend: count * cpl,
        cpl,
      })),
    };
  };
  const reps = [
    rep("aaaaaaaaaaaaaaaaaaaaaaa1", "Avery Rep", [["harbor_leads", "Harbor Leads", "harbor_form", "Harbor Forms", 14, 200], ["bay_leads", "Bay Leads", "bay_call", "Bay Calls", 6, 150]], 3, 3_400),
    rep("aaaaaaaaaaaaaaaaaaaaaaa2", "Blake Rep", [["harbor_leads", "Harbor Leads", "harbor_form", "Harbor Forms", 9, 200], ["free_site", "Website", "free_site_form", "Website Forms", 5, 0]], 2, 2_000),
    rep("aaaaaaaaaaaaaaaaaaaaaaa3", "Casey Rep", [], 0, 600),
    rep(null, "Unassigned", [["bay_leads", "Bay Leads", "bay_call", "Bay Calls", 2, 150]], 0, 0),
  ];
  const total = reps.reduce((sum, row) => sum + row.spend, 0);
  for (const row of reps) row.share_of_spend = total ? row.spend / total : null;
  const unassigned = reps[reps.length - 1]!.spend;
  return {
    generated_at: "2026-10-06T22:00:00.000Z",
    period: PERIOD,
    comparison: { mode: "previous", start: "2026-09-01", end_exclusive: "2026-09-07", end: "2026-09-06", days: 6, label: "Sep 1 – Sep 6, 2026", coverage: "full" },
    totals: { leads: reps.reduce((sum, row) => sum + row.leads, 0), spend: total, assigned_spend: total - unassigned, unassigned_spend: unassigned, unpriced_leads: 0 },
    companies: [
      { key: "harbor_leads", label: "Harbor Leads", spend: 23 * 200 },
      { key: "bay_leads", label: "Bay Leads", spend: 8 * 150 },
      { key: "free_site", label: "Website", spend: 0 },
    ],
    reps,
  };
}

export function syntheticLeadSpendDay(): InsightsLeadSpendDay {
  const today = Array.from({ length: 24 }, (_, hour) => (hour >= 8 && hour <= 17 ? (hour % 3 === 0 ? 400 : 200) : 0));
  const yesterday = Array.from({ length: 24 }, (_, hour) => (hour >= 8 && hour <= 20 ? (hour % 2 === 0 ? 350 : 200) : 0));
  const sum = (values: number[], through = 23) => values.slice(0, through + 1).reduce((total, value) => total + value, 0);
  return {
    generated_at: "2026-10-06T22:00:00.000Z",
    today: "2026-10-06",
    now_hour: 17,
    spend: { today: sum(today), yesterday: sum(yesterday), yesterday_by_now: sum(yesterday, 17), day_before: 3_800, day_before_by_now: 2_900 },
    leads: { today: 14, yesterday_by_now: 15, duplicates_today: 2, unpriced_today: 0 },
    hourly: { today, yesterday },
    by_company: [
      { key: "harbor_leads", label: "Harbor Leads", leads: 9, spend: 1_800, cpl_label: "$200" },
      { key: "bay_leads", label: "Bay Leads", leads: 4, spend: 600, cpl_label: "$150" },
      { key: "free_site", label: "Website", leads: 1, spend: 0, cpl_label: "$0" },
    ],
  };
}
