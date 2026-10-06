/**
 * Server codes the desk has no copy for (review reasons, explanation codes and their values, freshness reasons,
 * "Other outbound" association reasons). Server text is never rendered raw: the caller shows a safe fallback
 * ("Needs review", "another reason", or drops the line) and reports the code here. In
 * development each unknown code is logged once so the copy map in `outreach-desk-copy.ts` can be extended; in
 * production nothing is logged. Tests observe reports through `onUnknownDeskCode`.
 */

export type UnknownDeskCodeKind =
  | "review_reason"
  | "explanation_code"
  | "explanation_value"
  | "freshness_reason"
  | "association_reason"
  | "configuration_issue"
  | "admission_reason"
  | "enrollment_reason";

export type UnknownDeskCode = {
  kind: UnknownDeskCodeKind;
  /** The explanation code a value belongs to (`explanation_value` only). */
  code: string | null;
  value: unknown;
};

type Listener = (event: UnknownDeskCode) => void;
let listener: Listener | null = null;
const warned = new Set<string>();

/** Observes unknown codes (tests). Returns an unsubscribe that restores the previous listener. */
export function onUnknownDeskCode(next: Listener): () => void {
  const previous = listener;
  listener = next;
  return () => {
    listener = previous;
  };
}

export function reportUnknownDeskCode(event: UnknownDeskCode): void {
  if (listener) {
    listener(event);
    return;
  }
  if (process.env.NODE_ENV !== "development") return;
  const key = `${event.kind}\u0000${event.code ?? ""}\u0000${String(event.value)}`;
  if (warned.has(key)) return;
  warned.add(key);
  const what = event.kind === "explanation_value" ? `${event.code} value` : event.kind.replace("_", " ");
  console.warn(`[outreach-desk] no copy for ${what} ${JSON.stringify(event.value)}; showing a safe fallback. Add it to outreach-desk-copy.ts.`);
}
