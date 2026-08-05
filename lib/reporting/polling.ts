const TERMINAL_RUN_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
]);

/** Bounded backoff for in-flight reporting runs: 2s → 4s → 8s → 15s cap. */
export function reportingRunPollIntervalMs(
  status: string | undefined,
  pollCount: number,
): number | false {
  if (!status || TERMINAL_RUN_STATUSES.has(status)) {
    return false;
  }
  const steps = [2_000, 4_000, 8_000, 15_000];
  return steps[Math.min(pollCount, steps.length - 1)]!;
}

export function isTerminalReportingRunStatus(status: string | undefined): boolean {
  return Boolean(status && TERMINAL_RUN_STATUSES.has(status));
}
