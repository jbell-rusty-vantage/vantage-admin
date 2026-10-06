import type { OverviewLeadCost, OverviewReportResponse } from "@/lib/api/admin";
import type { MoneySpendRepRow, MoneySpendSourceRow } from "@/lib/api/money";

export type FallbackRange = "last_7_days" | "all_time";

export type FallbackRow = { key: string; label: string; leads: number; spend: number; unpriced: number };
export type FallbackTable = { rows: FallbackRow[]; total: { leads: number; spend: number; unpriced: number } };

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** The Overview report's lead cost for a range, as table rows plus a totals row (`lead_cost.total` is the spend). */
export function fallbackTable(overview: OverviewReportResponse | undefined, range: FallbackRange): FallbackTable | null {
  const cost: OverviewLeadCost | null | undefined = range === "last_7_days" ? overview?.last_7_days?.lead_cost : overview?.all_time?.lead_cost;
  if (!cost) return null;
  const rows = (cost.by_source_company ?? []).map((row, index) => ({
    key: `${String(row.source_company ?? row.source_company_label ?? index)}`,
    label: String(row.source_company_label ?? row.source_company ?? "Unknown"),
    leads: num(row.lead_count),
    spend: num(row.total_lead_cost),
    unpriced: num(row.unresolved_cpl_count),
  }));
  const summed = rows.reduce((sum, row) => sum + row.spend, 0);
  return {
    rows,
    total: {
      leads: rows.reduce((sum, row) => sum + row.leads, 0),
      spend: cost.total === undefined || cost.total === null ? summed : num(cost.total),
      unpriced: rows.reduce((sum, row) => sum + row.unpriced, 0),
    },
  };
}

/** Spend divided by a count; null when the count is zero (no division by zero, never a made-up 0). */
export function perUnit(spend: number | null | undefined, count: number | null | undefined): number | null {
  if (spend === null || spend === undefined || !count) return null;
  return spend / count;
}

export type SourceTotals = { leads: number; duplicates: number; spend: number; booked: number; unpriced: number; costPerBooked: number | null };

export function sourceTotals(rows: readonly MoneySpendSourceRow[]): SourceTotals {
  const totals = rows.reduce(
    (sum, row) => ({
      leads: sum.leads + num(row.leads),
      duplicates: sum.duplicates + num(row.duplicates),
      spend: sum.spend + num(row.spend),
      booked: sum.booked + num(row.booked),
      unpriced: sum.unpriced + num(row.unpriced),
    }),
    { leads: 0, duplicates: 0, spend: 0, booked: 0, unpriced: 0 },
  );
  return { ...totals, costPerBooked: perUnit(totals.spend, totals.booked) };
}

/** The rate cell: the server's label, or "missing" when the feed has no rate and leads are unpriced. */
export function rateText(row: Pick<MoneySpendSourceRow, "rate_label" | "unpriced">, missingWord: string): string {
  if (row.rate_label) return row.rate_label;
  return row.unpriced > 0 ? missingWord : "—";
}

/** A rep row's cost cells: a missing compensation reads as missing, never as $0. */
export function repCostCells(row: MoneySpendRepRow): { cost: number | null; perLead: number | null; perBooked: number | null; missing: boolean } {
  if (row.compensation_missing || row.rep_cost === null) {
    return { cost: null, perLead: null, perBooked: null, missing: true };
  }
  return {
    cost: row.rep_cost,
    perLead: row.cost_per_lead ?? perUnit(row.rep_cost, row.leads_received),
    perBooked: row.cost_per_booked ?? perUnit(row.rep_cost, row.booked),
    missing: false,
  };
}
