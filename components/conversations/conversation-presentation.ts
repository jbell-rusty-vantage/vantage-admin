import type { ConversationDetail, ConversationSummarySections } from "@/lib/api/conversations";

export const CONVERSATION_BODY_SECTIONS = [
  { key: "overview", label: "Overview" },
  { key: "customer_wanted", label: "What they wanted" },
  { key: "money_dates", label: "Money / dates" },
  { key: "outcome", label: "Outcome" },
  { key: "promised", label: "Promised" },
] as const satisfies ReadonlyArray<{
  key: Exclude<keyof ConversationSummarySections, "mismatch">;
  label: string;
}>;

const MATCH_METHOD_LABELS: Record<string, string> = {
  call_lead_telephony_session: "telephony session",
  call_log_id: "call log",
  form_lead_phone_window: "phone and time window",
  owner_attach: "owner attach",
};

export function formatConversationDuration(seconds: number | null): string {
  if (seconds === null) return "Duration unknown";
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function formatFloridaDate(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

export function formatConversationMatchLine(
  matchMethod: string,
  matchConfidence: string,
): string {
  const methodLabel = MATCH_METHOD_LABELS[matchMethod] ?? matchMethod.replaceAll("_", " ");
  return `Matched by ${methodLabel} · ${matchConfidence.toUpperCase()} confidence`;
}

export function formatConversationCost(cost: ConversationDetail["cost_cents"]): string {
  if (!cost) {
    return "Cost not recorded";
  }
  const total = cost.stt + cost.summary;
  return `${total}¢ (${cost.stt}¢ STT · ${cost.summary}¢ summary)`;
}

const CONVERSATION_STATE_LABELS: Record<string, string> = {
  discovered: "Discovered",
  media_stored: "Media stored",
  transcribed: "Transcribed",
  complete: "Complete",
  no_recording: "No recording",
  unavailable: "Unavailable",
  failed: "Failed",
  dead_letter: "Dead letter",
};

export function conversationStateLabel(state: string): string {
  return CONVERSATION_STATE_LABELS[state] ?? state.replaceAll("_", " ");
}

export function conversationStatusLabel(conversation: Pick<ConversationDetail, "booking_ref">): string | null {
  return conversation.booking_ref ? "BOOKED" : null;
}

/** Honest provenance from stored run fields. Never claims a paid replay unless the record shows stored artifacts. */
export function conversationProvenance(conversation: ConversationDetail): string {
  const hasTranscript = Boolean(conversation.transcript);
  const hasSummary = Boolean(conversation.summary);
  if (!hasTranscript && !hasSummary) {
    return "No stored transcript or summary. This page does not start a new AI Gateway call.";
  }
  const parts: string[] = [];
  if (hasTranscript) {
    parts.push(`Stored transcript from ${conversation.transcript!.model}`);
  }
  if (hasSummary) {
    parts.push(`stored summary from ${conversation.summary!.model}`);
  }
  const sentence = parts.join("; ").replace(/^stored /, "Stored ");
  return `${sentence}. Opening this page does not start a new AI Gateway call.`;
}
