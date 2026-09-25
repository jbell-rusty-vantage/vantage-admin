// UI1-GALLERY fixtures: a handful of values copied from the contract fixtures in
// sales-intelligence-ui-ux-workspace/contracts/ (the page can't read the workspace at runtime).
// Each constant names its source file and row. Keep this small.

/** S1/attention__all-outreach.json, top-level `as_of`. Every time sample formats against it. */
export const GALLERY_AS_OF = "2026-09-23T21:46:37.661Z";

/** S1/attention__all-outreach.json, row `lead:FormLead:6ab448760705ca95222b4c30` (Sam Lopez). */
export const timeSamples = {
  /** `outreach.facts.last_call_at` */
  lastCallAt: "2026-09-18T18:19:26.919Z",
  /** `outreach.followups[id=6ab448760705ca95222b4dad].due_at` (after as_of) */
  followupDueAt: "2026-09-25T01:45:26.772Z",
  /** `outreach.followups[id=6ab448760705ca95222b4dc2].due_at` (before as_of) */
  overdueDueAt: "2026-09-22T09:45:26.879Z",
  /** `outreach.facts.next_action_state`: the server's overdue state, which decides the amber. */
  nextActionState: "overdue",
} as const;

/** S5c/attention__all-outreach.json (`as_of` 2026-09-24T18:39:02.909Z), row `lead:FormLead:6ab56e423fac6b3b3415797a`, `outreach.live_call`. */
export const liveCallSample = {
  asOf: "2026-09-24T18:39:02.909Z",
  startedAt: "2026-09-24T18:03:32.469Z",
  repText: "Dana Reyes (ext 101, reviewed)",
} as const;

/** S5c/coverage__seed.json `data.coverage.capture_health` (status `attention`). */
export const healthAttention = {
  asOf: "2026-09-24T18:39:44.648Z",
  status: "attention",
  knownCompleteThrough: "2026-09-24T18:28:32.469Z",
} as const;

/** S5c/coverage__capture-health-broken__synthetic.json `data.coverage.capture_health` (status `broken`). */
export const healthBroken = {
  asOf: "2026-09-24T18:39:44.697Z",
  status: "broken",
  knownCompleteThrough: "2026-09-24T18:28:32.469Z",
} as const;

/** COPY-UI1 §4 `blocker.restrictionUntil` sample date (record header). Illustrative; no fixture row carries one. */
export const restrictionUntil = "2026-10-01";

/** Brief sample for the live chip wording (UI-0 §7.2): `On the call · Alex · 12m`. */
export const liveChipBriefSample = { rep: "Alex", durationMs: 12 * 60_000 } as const;

/**
 * S5c/attention__default.json (53 items): rows per `derived.attention_band`, counted once when this file was written
 * (1 row has `attention_band: null`). Header-badge counts only; on the desk the count is the server's.
 */
export const bandCounts = { 1: 5, 2: 21, 3: 0, 4: 9, 5: 11, 6: 6, 7: 0 } as const;
