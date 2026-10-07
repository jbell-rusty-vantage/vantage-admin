/**
 * The Overview scoreboard (doc 09 tab 1): which scorecards appear, in what order, their Owner words and the
 * definition shown under each ⓘ. Definitions come from the server report (`definitions`); a card without one there
 * uses the local fallback. Pure.
 */
import type { InsightsScorecardKey } from "@/lib/api/insights";

export type ScorecardSpec = { key: InsightsScorecardKey; label: string; definitionKey: string; fallback: string };

const spec = (key: InsightsScorecardKey, label: string, definitionKey: string, fallback: string): ScorecardSpec => ({ key, label, definitionKey, fallback });

/** Two rows of four: volume and money, then cost and quality. */
export const PRIMARY_SCORECARDS: readonly ScorecardSpec[] = [
  spec("leads", "Leads", "lead", "Form and call leads that arrived in the period, New York time. Duplicates are counted separately."),
  spec("bookings", "Bookings", "booking", "Bookings whose book date falls in the period."),
  spec("booking_rate", "Booking rate", "booking_rate", "Bookings in the period ÷ leads in the period."),
  spec("binder", "Binder", "binder", "Binder revenue of the bookings made in the period."),
  spec("deposits", "Deposits", "deposits", "Deposits taken on the bookings made in the period."),
  spec("lead_spend", "Lead spend", "lead_spend", "Each lead priced at its feed's lead cost for the day it arrived."),
  spec("cost_per_booking", "Cost per booking", "cost_per_booking", "Lead spend ÷ bookings."),
  spec("cancellation_rate", "Cancellation rate", "cancellation_rate", "Bookings in the period that are now cancelled ÷ bookings in the period."),
];

export const SECONDARY_SCORECARDS: readonly ScorecardSpec[] = [
  spec("cost_per_lead", "Cost per lead", "cost_per_lead", "Lead spend ÷ leads."),
  spec("return_on_spend", "Return on spend", "return_on_spend", "Binder of the bookings from the period's leads ÷ the spend on those leads."),
  spec("average_binder", "Average binder", "average_binder", "Binder ÷ bookings."),
  spec("duplicates", "Duplicates", "duplicates", "Leads that repeated an earlier lead. They cost $0 and are not counted as leads."),
];

export function definitionFor(spec: Pick<ScorecardSpec, "definitionKey" | "fallback">, definitions: Record<string, string> | undefined): string {
  const text = definitions?.[spec.definitionKey];
  return typeof text === "string" && text.trim() ? text : spec.fallback;
}
