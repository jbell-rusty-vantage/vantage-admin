/**
 * One key builder per Sales Intelligence read. Every key is `[...salesIntelligenceKeys.all, <segment>, …]` and its
 * segment is reached by at least one live topic in `lib/query/salesIntelligence.ts`
 * (`tests/sales-intelligence/numbers.test.ts` enforces it).
 */
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";

const all = salesIntelligenceKeys.all;

export const siKeys = {
  /** One Numbers page per request string (the keyset cursor is part of it). */
  numbers: (query: string) => [...all, "numbers", query] as const,
  number: (id: string) => [...all, "number", id] as const,
  timeline: (id: string) => [...all, "timeline", id] as const,
  /** `contact_number_id=…` or `lead_model=…&lead_id=…`. */
  attachments: (filter: string) => [...all, "attachments", filter] as const,
  attachmentPair: (numberId: string, model: string, leadId: string) => [...all, "attachment-pair", numberId, model, leadId] as const,
  reps: (query = "") => [...all, "reps", query] as const,
  coverage: () => [...all, "coverage"] as const,
} as const;
