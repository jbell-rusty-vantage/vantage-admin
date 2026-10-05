"use client";
/**
 * Desk commands (SRV-7 through the BFF). Each user intent gets one Idempotency-Key (a retry of the same intent reuses
 * it); each sends the server's revision (`plan.plan_revision`, `assignment.assignment_revision`, the configuration
 * revision) as `expected_revision`, so a stale screen gets 409 `REVISION_CONFLICT` instead of overwriting newer work.
 * Success invalidates exactly the reads the command changes; the server's live hints refresh everyone else.
 */
import { useRef } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  newIdempotencyKey,
  salesOutreachAssignmentResponseSchema,
  salesOutreachCommand,
  salesOutreachDayOverrideResponseSchema,
  salesOutreachPaths,
  salesOutreachPlanCommandResponseSchema,
  type SalesOutreachAssignmentRequest,
  type SalesOutreachCallbackRequest,
  type SalesOutreachDayOverrideRequest,
  type SalesOutreachQuotedFollowupRequest,
} from "@/lib/api/salesOutreach";
import { outreachKeys } from "@/lib/query/salesOutreach";

/** One key per intent: kept while the same payload is retried, replaced when the payload changes. */
function useIntentKey(prefix: string) {
  const last = useRef<{ payload: string; key: string } | null>(null);
  return (payload: unknown) => {
    const text = JSON.stringify(payload);
    if (last.current?.payload !== text) last.current = { payload: text, key: newIdempotencyKey(prefix) };
    return last.current.key;
  };
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return (keys: readonly (readonly unknown[])[]) =>
    Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey: queryKey as QueryKey })));
}

export function useQuotedFollowupCommand(subjectId: string) {
  const keyFor = useIntentKey("quoted");
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: SalesOutreachQuotedFollowupRequest) =>
      salesOutreachCommand("PATCH", salesOutreachPaths.quotedFollowup(subjectId), body, keyFor(body), salesOutreachPlanCommandResponseSchema),
    onSettled: () => invalidate([outreachKeys.detail(subjectId), outreachKeys.queueAll(), outreachKeys.teamAll()]),
  });
}

export function useCallbackCommand(subjectId: string) {
  const keyFor = useIntentKey("callback");
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: SalesOutreachCallbackRequest) =>
      salesOutreachCommand("PATCH", salesOutreachPaths.callback(subjectId), body, keyFor(body), salesOutreachPlanCommandResponseSchema),
    onSettled: () => invalidate([outreachKeys.detail(subjectId), outreachKeys.queueAll(), outreachKeys.teamAll()]),
  });
}

export function useAssignmentCommand(subjectId: string) {
  const keyFor = useIntentKey("assign");
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: SalesOutreachAssignmentRequest) =>
      salesOutreachCommand("PATCH", salesOutreachPaths.assignment(subjectId), body, keyFor(body), salesOutreachAssignmentResponseSchema),
    onSettled: () => invalidate([outreachKeys.detail(subjectId), outreachKeys.queueAll(), outreachKeys.teamAll(), outreachKeys.repDaysAll()]),
  });
}

export function useDayOverrideCommand() {
  const keyFor = useIntentKey("day-override");
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ agentId, body }: { agentId: string; body: SalesOutreachDayOverrideRequest }) =>
      salesOutreachCommand("PATCH", salesOutreachPaths.dayOverride(agentId), body, keyFor({ agentId, body }), salesOutreachDayOverrideResponseSchema),
    onSettled: () => invalidate([outreachKeys.repDaysAll(), outreachKeys.teamAll(), outreachKeys.capabilities(), outreachKeys.configuration()]),
  });
}

/** `2026-10-01T15:30` in New York wall time → an ISO instant with offset (DST-correct for that date). */
export function newYorkLocalToIso(local: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as number[];
  const wallAsUtc = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  // Guess with the offset at that instant, then correct once (handles the DST boundary days).
  let instant = wallAsUtc - offsetMinutes(new Date(wallAsUtc)) * 60_000;
  instant = wallAsUtc - offsetMinutes(new Date(instant)) * 60_000;
  return new Date(instant).toISOString();
}

/** New York's offset from UTC in minutes at an instant (−240 in summer, −300 in winter). */
function offsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/** An ISO instant → the `datetime-local` value in New York wall time. */
export function isoToNewYorkLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
