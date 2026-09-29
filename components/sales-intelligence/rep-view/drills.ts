import type { WorkloadCount } from "@/lib/api/salesIntelligenceOverview";
import { clearDeskFilters, type DeskUrlPatch, type DeskUrlState } from "../data/url-state";

/** Preserve the server's filter set and snapshot; the extra keys describe the Owner's local rep view. */
export function repViewHref(metric: WorkloadCount, agentId: string, relationship: "assigned" | "followup" | "involved", work?: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(metric.drill.params)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else params.append(key, value);
  }
  params.set("view", "rep");
  params.set("agent", agentId);
  params.set("relationship", relationship);
  if (work) { params.delete("work"); params.append("work", work); }
  return `/sales-intelligence?${params.toString()}`;
}

export function repFilterHref(agentId: string, relationship: "assigned" | "followup" | "involved"): string {
  const params = new URLSearchParams({ view: "rep", agent: agentId, relationship });
  return `/sales-intelligence?${params.toString()}`;
}

/** A bare Owner rep bookmark needs the server's open-state and snapshot drill before loading any list. */
export function repCanonicalHref(state: DeskUrlState, query: string, base: WorkloadCount): string | null {
  const id = state.agent;
  if (!id) return null;
  const relation = state.relationship ?? "assigned";
  const scoped = state.state.length > 0 && !!state.snapshot_id && (relation === "assigned" ? state.assigned_agent_id.includes(id) : relation === "followup" ? state.followup_agent_id.includes(id) : state.agent_id.includes(id));
  if (scoped) return null;
  const params = new URL(repViewHref(base, id, relation), "http://local").searchParams;
  const baseKeys = new Set(params.keys());
  const raw = new URLSearchParams(query);
  for (const [key, value] of raw) if (!["view", "agent", "relationship", "state", "assigned_agent_id", "followup_agent_id", "agent_id", "snapshot_id"].includes(key) && !baseKeys.has(key)) params.append(key, value);
  if (state.snapshot_id) params.set("snapshot_id", state.snapshot_id);
  return `/sales-intelligence?${params.toString()}`;
}

export function clearRepViewFilters(state: DeskUrlState): DeskUrlPatch {
  return { ...clearDeskFilters(), agent: state.agent, relationship: state.relationship ?? "assigned" };
}
