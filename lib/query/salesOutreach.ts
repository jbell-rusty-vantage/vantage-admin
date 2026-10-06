import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { SalesOutreachLiveFrame, SalesOutreachQueueRequest } from "@/lib/api/salesOutreach";

/**
 * Sales Outreach Desk query keys and the live-frame → key routing table. Pure: no React, no fetch.
 *
 * The SSE stream carries ids and revisions only (never customer records), so a frame never mutates cached
 * data; it only says which reads to refetch. Anything that can't be narrowed honestly refetches the whole
 * desk: connect, reconnect, the 30-second clock frame, `refetch: "all"`, a configuration change.
 */

const ROOT = "sales-outreach" as const;

/** Drops empty values and sorts keys so equal requests share one cache entry. */
function stable(filters: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!filters) return {};
  return Object.fromEntries(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined && value !== null && value !== "" && value !== false)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export const outreachKeys = {
  all: [ROOT] as const,
  capabilities: () => [ROOT, "capabilities"] as const,
  repDaysAll: () => [ROOT, "rep-days"] as const,
  repDays: (businessDay?: string | null, agentId?: string | null) => [ROOT, "rep-days", stable({ business_day: businessDay, agent_id: agentId })] as const,
  teamAll: () => [ROOT, "team"] as const,
  team: (businessDay?: string | null) => [ROOT, "team", stable({ business_day: businessDay })] as const,
  queueAll: () => [ROOT, "queue"] as const,
  queue: (request: SalesOutreachQueueRequest = {}) => [ROOT, "queue", stable(request as Record<string, unknown>)] as const,
  detailAll: () => [ROOT, "detail"] as const,
  detail: (subjectId: string) => [ROOT, "detail", subjectId] as const,
  configuration: () => [ROOT, "configuration"] as const,
  restrictionsAll: () => [ROOT, "restrictions"] as const,
  restrictions: (state?: string | null, cursor?: string | null) => [ROOT, "restrictions", stable({ state, cursor })] as const,
  enrollmentAll: () => [ROOT, "enrollment"] as const,
  enrollmentCandidates: (partition: string, cursor?: string | null) => [ROOT, "enrollment", "candidates", stable({ partition, cursor })] as const,
  /** Every page of one partition (the Settings list pages over `next_cursor` with an infinite query). */
  enrollmentCandidatePages: (partition: string) => [ROOT, "enrollment", "candidates", "pages", partition] as const,
  enrollmentAdmissions: (businessDay?: string | null) => [ROOT, "enrollment", "admissions", stable({ business_day: businessDay })] as const,
} as const;

export type OutreachKeyPrefix = readonly unknown[];

/** The frame fields routing reads (anything else in the frame is ignored). */
export type OutreachInvalidationFrame = Pick<SalesOutreachLiveFrame, "reason" | "refetch" | "topics"> & {
  changes: ReadonlyArray<Pick<SalesOutreachLiveFrame["changes"][number], "topic" | "subject_ids">>;
};

/**
 * The key prefixes one live frame invalidates (deduplicated).
 * - `outreach_desk` → the queue, the team (its attention rows and cadence cards), and the detail of each
 *   listed subject (every detail when a change lists none);
 * - `outreach_goal` → rep-days and the team (goal cards, Daily call goals);
 * - `outreach_configuration`, connect, reconnect, clock or `refetch: "all"` → the whole desk.
 */
export function outreachInvalidationKeys(frame: OutreachInvalidationFrame): OutreachKeyPrefix[] {
  if (frame.reason !== "change" || frame.refetch === "all") return [outreachKeys.all];
  const topics = new Set<string>([...frame.topics, ...frame.changes.map((change) => change.topic)]);
  if (topics.size === 0 || topics.has("outreach_configuration")) return [outreachKeys.all];
  const keys = new Map<string, OutreachKeyPrefix>();
  const add = (key: OutreachKeyPrefix) => keys.set(JSON.stringify(key), key);
  for (const topic of topics) {
    if (topic === "outreach_desk") {
      add(outreachKeys.queueAll());
      add(outreachKeys.teamAll());
      const subjects = frame.changes.filter((change) => change.topic === "outreach_desk").flatMap((change) => change.subject_ids);
      if (subjects.length === 0) add(outreachKeys.detailAll());
      for (const subject of subjects) add(outreachKeys.detail(subject));
    } else if (topic === "outreach_goal") {
      add(outreachKeys.repDaysAll());
      add(outreachKeys.teamAll());
    } else {
      // A topic this client doesn't know: refetch everything rather than guess.
      return [outreachKeys.all];
    }
  }
  return [...keys.values()];
}

/** Invalidates (refetches) what a frame names. */
export async function applyOutreachFrame(queryClient: Pick<QueryClient, "invalidateQueries">, frame: OutreachInvalidationFrame): Promise<void> {
  await Promise.all(outreachInvalidationKeys(frame).map((queryKey) => queryClient.invalidateQueries({ queryKey: queryKey as QueryKey })));
}

type RowsCarrier = { rows?: unknown; leads_needing_attention?: { rows?: unknown }; pages?: unknown };

/** Handles a plain read (`rows`, `leads_needing_attention.rows`) and an infinite query (`pages[].rows`). */
function withoutSubject<T>(data: T, subjectId: string): T {
  if (!data || typeof data !== "object") return data;
  const carrier = data as RowsCarrier;
  if (Array.isArray(carrier.pages)) {
    return { ...carrier, pages: carrier.pages.map((page) => withoutSubject(page, subjectId)) } as T;
  }
  const keep = (rows: unknown) =>
    Array.isArray(rows) ? rows.filter((row) => !(row && typeof row === "object" && (row as { subject_id?: unknown }).subject_id === subjectId)) : rows;
  let next: RowsCarrier = carrier;
  if (Array.isArray(carrier.rows)) next = { ...next, rows: keep(carrier.rows) };
  if (carrier.leads_needing_attention && Array.isArray(carrier.leads_needing_attention.rows)) {
    next = { ...next, leads_needing_attention: { ...carrier.leads_needing_attention, rows: keep(carrier.leads_needing_attention.rows) } };
  }
  return next as T;
}

/**
 * After a 403/404 on a Lead (reassignment, foreign id): forget its detail and drop its row from every cached
 * queue page and the team attention rows, so no revoked data stays on screen. The caller then refetches.
 */
export function clearSubject(
  queryClient: Pick<QueryClient, "removeQueries" | "setQueriesData">,
  subjectId: string,
): void {
  queryClient.removeQueries({ queryKey: outreachKeys.detail(subjectId) as QueryKey, exact: true });
  queryClient.setQueriesData({ queryKey: outreachKeys.queueAll() as QueryKey }, (data: unknown) => withoutSubject(data, subjectId));
  queryClient.setQueriesData({ queryKey: outreachKeys.teamAll() as QueryKey }, (data: unknown) => withoutSubject(data, subjectId));
}

/** A 403 on the desk scope itself (role changed, Rep link lost, desk muted): drop every cached desk read. */
export function clearOutreachDesk(queryClient: Pick<QueryClient, "removeQueries">): void {
  queryClient.removeQueries({ queryKey: outreachKeys.all as QueryKey });
}
