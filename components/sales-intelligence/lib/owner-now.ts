import type { Outreach } from "@/lib/api/salesIntelligence";

/**
 * Owner-facing derivations for the Now strip: the call the Owner is on, and how
 * this Number got its Lead.
 *
 * `call_progress`, `lead_attachment`, `derived.call_state` and
 * `derived.provenance_state` are optional on the server read. Admin is a
 * consumer: a server that does not send them must still render, so every field
 * here is read through a runtime guard rather than assumed.
 */

export type CallState = "not_started" | "in_progress" | "ended";
export type CallProgress = {
  state: "in_progress" | "ended";
  started_at: string;
  started_by: string | null;
  ended_at: string | null;
  ended_by: string | null;
  note: string | null;
};

export type ProvenanceState =
  | "attached_by_you"
  | "attached_automatically"
  | "attached_from_evidence"
  | "needs_a_lead"
  | "ambiguous";

export type LeadAttachment = {
  attachment_id: string | null;
  lead_ref: { model: string; id: string } | null;
  state: string | null;
  certainty: string | null;
  certainty_label: string | null;
  decided_by: "owner" | "automatic" | "evidence" | null;
  decided_at: string | null;
  confidence: number | null;
  observed_at: string | null;
  lead_display: { name: string | null; job_no: string | null } | null;
};

type Availability = Outreach["allowed_actions"][number];
type Subject = Outreach | null | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const text = (value: unknown) => (typeof value === "string" && value.length ? value : null);
/** Reads an optional server field without asserting the read schema already models it. */
const branch = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : null);

export function callProgressOf(record: Subject): CallProgress | null {
  const raw = branch(record, "call_progress");
  if (!isRecord(raw)) return null;
  const state = raw.state === "in_progress" || raw.state === "ended" ? raw.state : null;
  const started = text(raw.started_at);
  if (!state || !started) return null;
  return {
    state,
    started_at: started,
    started_by: text(raw.started_by),
    ended_at: text(raw.ended_at),
    ended_by: text(raw.ended_by),
    note: text(raw.note),
  };
}

/** The server's derived value wins; the stored progress is the fallback, absence is honest. */
export function callStateOf(record: Subject): CallState {
  const derived = branch(branch(record, "derived"), "call_state");
  if (derived === "not_started" || derived === "in_progress" || derived === "ended") return derived;
  return callProgressOf(record)?.state ?? "not_started";
}

export function leadAttachmentOf(record: Subject): LeadAttachment | null {
  const raw = branch(record, "lead_attachment");
  if (!isRecord(raw)) return null;
  const ref = isRecord(raw.lead_ref) ? raw.lead_ref : null;
  const display = isRecord(raw.lead_display) ? raw.lead_display : null;
  const decided = raw.decided_by;
  const confidence = typeof raw.confidence === "number" && Number.isFinite(raw.confidence) ? raw.confidence : null;
  return {
    attachment_id: text(raw.attachment_id),
    lead_ref: ref && text(ref.model) && text(ref.id) ? { model: String(ref.model), id: String(ref.id) } : null,
    state: text(raw.state),
    certainty: text(raw.certainty),
    certainty_label: text(raw.certainty_label),
    decided_by: decided === "owner" || decided === "automatic" || decided === "evidence" ? decided : null,
    decided_at: text(raw.decided_at),
    confidence,
    observed_at: text(raw.observed_at),
    lead_display: display ? { name: text(display.name), job_no: text(display.job_no) } : null,
  };
}

/**
 * The server's derived value wins. The fallback never claims more than the read
 * supports: an unknown certainty is evidence, not an Owner decision.
 */
export function provenanceStateOf(record: Subject): ProvenanceState {
  const derived = branch(branch(record, "derived"), "provenance_state");
  if (
    derived === "attached_by_you"
    || derived === "attached_automatically"
    || derived === "attached_from_evidence"
    || derived === "needs_a_lead"
    || derived === "ambiguous"
  ) return derived;
  const attachment = leadAttachmentOf(record);
  if (attachment?.state === "ambiguous" || attachment?.certainty === "unsure") return "ambiguous";
  if (attachment?.state === "attached") {
    if (attachment.decided_by === "owner" || attachment.certainty === "owner_confirmed") return "attached_by_you";
    if (attachment.decided_by === "automatic") return "attached_automatically";
    return "attached_from_evidence";
  }
  if (record?.subject.kind === "lead") return "attached_from_evidence";
  if (record?.related_record_links?.some((item) => item.model === "FormLead" || item.model === "CallLead")) {
    return "attached_from_evidence";
  }
  return "needs_a_lead";
}

export function leadNameOf(record: Subject): string | null {
  const attachment = leadAttachmentOf(record);
  const name = attachment?.lead_display?.name ?? record?.lead_display?.name ?? null;
  const job = attachment?.lead_display?.job_no ?? record?.lead_display?.job_no ?? null;
  if (!name && !job) return null;
  return [name, job ? `Job ${job}` : null].filter(Boolean).join(" · ");
}

/**
 * Orders the buttons, not the work: the server owns bands, clocks and ranking.
 * One call decision comes first, the two everyday commands next, the long tail
 * behind a disclosure. Commands with no Owner label are never rendered blind.
 */
const EVERYDAY = ["mark_worked", "create_followup", "assign"] as const;
const CALL = ["start_call", "end_call"] as const;

export function splitCommands(actions: readonly Availability[], known: Record<string, string>) {
  const named = actions.filter((item) => known[item.action]);
  const calls = named.filter((item) => (CALL as readonly string[]).includes(item.action));
  // An offered-but-blocked End the call must not outrank a usable Start the call.
  const call = calls.find((item) => item.enabled && item.action === "end_call")
    ?? calls.find((item) => item.enabled)
    ?? calls.find((item) => item.action === "start_call")
    ?? calls[0]
    ?? null;
  const rest = named.filter((item) => !(CALL as readonly string[]).includes(item.action));
  const rank = (item: Availability) => {
    const index = EVERYDAY.indexOf(item.action as (typeof EVERYDAY)[number]);
    return index === -1 ? EVERYDAY.length : index;
  };
  const secondary = rest.filter((item) => rank(item) < EVERYDAY.length).sort((a, b) => rank(a) - rank(b)).slice(0, 2);
  return { call, secondary, more: rest.filter((item) => !secondary.includes(item)) };
}

export const callBlockerText = (codes: readonly string[], blockers: Record<string, string>) =>
  codes.map((code) => blockers[code]).filter(Boolean).join(" ");

/**
 * The server reports `ILLEGAL_TRANSITION` for both a closed record and a call
 * already running, so the sentence comes from the record the Owner is looking
 * at. Unrecognised codes still read out loud rather than leaking an enum.
 */
export function callBlockerSentence(
  action: string,
  record: Subject,
  codes: readonly string[],
  sentences: { record_closed: string; call_already_in_progress: string; no_call_in_progress: string; contact_restricted: string },
  fallbacks: Record<string, string>,
): string {
  const state = callStateOf(record);
  const restricted = record?.derived.call_blockers.includes("restriction") ?? false;
  if (record?.state === "closed") return sentences.record_closed;
  if (action === "start_call") {
    if (state === "in_progress") return sentences.call_already_in_progress;
    if (restricted) return sentences.contact_restricted;
  }
  if (action === "end_call" && state !== "in_progress") return sentences.no_call_in_progress;
  return callBlockerText(codes, fallbacks);
}
