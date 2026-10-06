"use client";
/**
 * The reads and the one write Granot updates share (doc 17). Polling is exactly what the retired HTTP Automation page
 * did: 2.5 s on an open check while a run is neither waiting for approval nor finished, 5 s on the list while any run
 * is still moving, nothing otherwise. Today and the Automations badge reuse the list query by key, so nothing new is
 * polled for them.
 */
import { useQuery } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { newYorkDayKey } from "@/components/ui/crm/format";
import {
  createGranotRunGroup,
  fetchGranotAutomationSources,
  fetchGranotRun,
  fetchGranotRuns,
  GRANOT_RUNS_MAX_LIMIT,
  type GranotAutomationSource,
  type GranotRunGroup,
} from "@/lib/api/granotAutomation";
import { fetchGranotCrmSources } from "@/lib/api/registryGranotCrmSources";
import { detailNeedsPolling, listNeedsPolling, type CheckChoices } from "@/lib/automations/granot-updates-model";
import { isGranotSourceAvailableForApply } from "@/lib/granotAutomationSelection";
import { queryKeys } from "@/lib/query/keys";

const LIST_POLL_MS = 5_000;
const DETAIL_POLL_MS = 2_500;
const IDLE_RESYNC_MS = 5 * 60_000;

/** The newest-first page every Granot updates surface reads (the server caps it at 100). */
export const GRANOT_RUNS_LIMIT = GRANOT_RUNS_MAX_LIMIT;

export function useGranotRuns(enabled = true) {
  return useQuery({
    queryKey: queryKeys.granotAutomation.runsPage(GRANOT_RUNS_LIMIT),
    queryFn: () => fetchGranotRuns({ limit: GRANOT_RUNS_LIMIT }),
    enabled,
    staleTime: 15_000,
    refetchInterval: (query) => (listNeedsPolling(query.state.data) ? LIST_POLL_MS : IDLE_RESYNC_MS),
    refetchIntervalInBackground: false,
    retry: false,
  });
}

export function useGranotRunDetail(runId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.granotAutomation.run(runId ?? "none"),
    queryFn: () => fetchGranotRun(runId!),
    enabled: enabled && Boolean(runId),
    refetchInterval: (query) => (detailNeedsPolling(query.state.data?.status) ? DETAIL_POLL_MS : false),
    retry: false,
  });
}

export function useGranotSources(enabled = true) {
  return useQuery({
    queryKey: queryKeys.granotAutomation.sources(),
    queryFn: () => fetchGranotAutomationSources(),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

/** The Registry's Granot names, joined to the automation sources to group the chips by Source Company. */
export function useGranotNames(enabled = true) {
  return useQuery({
    queryKey: queryKeys.operationsRegistry.granotCrmSources(),
    queryFn: fetchGranotCrmSources,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

/** Today's New York day key; re-derived on the shared 15 s clock so a page left open crosses midnight correctly. */
export function useTodayKey(): string {
  const subscribe = useCallback((onChange: () => void) => {
    const timer = setInterval(onChange, 60_000);
    return () => clearInterval(timer);
  }, []);
  return useSyncExternalStore(subscribe, () => newYorkDayKey(Date.now()), () => newYorkDayKey(Date.now()));
}

// ---- Starting a check ---------------------------------------------------------------------------------------------------

/**
 * The choices a check was started with, kept in memory for this tab so Try again / Check again can re-create it with
 * the same `date_factor` (the server does not echo it back, doc 17 G6).
 */
const rememberedChoices = new Map<string, CheckChoices>();

export function rememberCheckChoices(checkId: string, choices: CheckChoices): void {
  rememberedChoices.set(checkId, choices);
}

export function recallCheckChoices(checkId: string): CheckChoices | null {
  return rememberedChoices.get(checkId) ?? null;
}

/** Granot name labels to the automation source ids the create route wants; names that are not ready are dropped. */
export function sourceIdsForLabels(sources: readonly GranotAutomationSource[], labels: readonly string[]): string[] {
  const wanted = new Set(labels);
  return sources.filter((source) => wanted.has(source.label) && isGranotSourceAvailableForApply(source)).map((source) => source.id);
}

/**
 * Starts a check: one `POST /run-groups` with `workflow: "apply"` (approval is the safety; Preview only left the UI).
 * Returns the group so the caller can remember the choices and open the check page.
 */
export async function startGranotCheck(choices: CheckChoices, sources: readonly GranotAutomationSource[]): Promise<GranotRunGroup> {
  const group = await createGranotRunGroup({
    from: choices.from,
    to: choices.to,
    operations: choices.operations,
    workflow: "apply",
    source_ids: sourceIdsForLabels(sources, choices.source_labels),
    filters: { date_factor: choices.date_factor },
  });
  if (group.run_group_id) rememberCheckChoices(group.run_group_id, choices);
  return group;
}
