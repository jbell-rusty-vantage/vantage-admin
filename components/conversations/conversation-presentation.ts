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

export function formatConversationDuration(seconds: number): string {
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

export function conversationStatusLabel(conversation: Pick<ConversationDetail, "booking_ref">): string | null {
  return conversation.booking_ref ? "BOOKED" : null;
}
