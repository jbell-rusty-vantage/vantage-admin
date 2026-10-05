import type { NumberView } from "@/lib/api/allNumbers";
import { outreachKeys } from "./salesOutreach";

/**
 * Query keys for All Numbers and Accounts. They sit under the desk's root key, so the desk's live connect, clock and
 * `refetch: "all"` frames refresh them, and a desk scope loss (`clearOutreachDesk`) drops them with everything else.
 */
const ROOT = outreachKeys.all[0];

export const numbersKeys = {
  all: [ROOT, "numbers"] as const,
  list: (view: NumberView, q: string | null) => [ROOT, "numbers", "list", { view, q: q ?? "" }] as const,
  listAll: () => [ROOT, "numbers", "list"] as const,
  detail: (id: string) => [ROOT, "numbers", "detail", id] as const,
  detailAll: () => [ROOT, "numbers", "detail"] as const,
  leadSearch: (q: string) => [ROOT, "numbers", "lead-search", q] as const,
  accounts: () => [ROOT, "accounts"] as const,
} as const;
