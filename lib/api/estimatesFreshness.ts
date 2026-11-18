import { z } from "zod";

export const estimatesLaneFreshnessSchema = z.object({
  observed_at: z.string().datetime(),
  last_complete_coverage_at: z.string().datetime().nullable(),
  latest_slot: z.object({
    _id: z.string(),
    expected_windows: z.number().int().nonnegative(),
    discovered_windows: z.number().int().nonnegative(),
    collected_windows: z.number().int().nonnegative(),
    completed_windows: z.number().int().nonnegative(),
    failed_windows: z.number().int().nonnegative(),
    held_rows: z.number().int().nonnegative().optional(),
    latest_collection_at: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
  }).nullable(),
  warnings: z.array(z.string()),
  older_scope: z.string(),
  coverage_limit: z.string(),
  latest_expected_slot: z.string().nullable().optional(),
  oldest_uncovered_range: z.object({ from: z.string(), to: z.string() }).nullable().optional(),
  held_rows: z.number().int().nonnegative().optional(),
  lag_ms: z.number().nonnegative().nullable().optional(),
});
export const estimatesFreshnessSchema = estimatesLaneFreshnessSchema.extend({
  pool_lanes: z.object({
    refresh: estimatesLaneFreshnessSchema,
    discovery: estimatesLaneFreshnessSchema,
  }).optional(),
});
export type EstimatesFreshness = z.infer<typeof estimatesFreshnessSchema>;

export async function fetchEstimatesFreshness(): Promise<EstimatesFreshness> {
  const response = await fetch("/api/proxy/api/v1/admin/granot-automation/runs/freshness", { credentials: "include" });
  const envelope = await response.json();
  if (!response.ok || !envelope.ok) throw new Error("Scheduled Granot updates could not be loaded.");
  return estimatesFreshnessSchema.parse(envelope.data);
}
