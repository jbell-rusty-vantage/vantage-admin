/**
 * The Money tab's client (dashboard-redesign-proposal/02-today-command-center.md, "Money tab").
 *
 * The server endpoint does not exist yet: this client is written against the spec's DTO so the tab lights up when it
 * ships. Until then a 404 is expected and the tab falls back to the Overview report (`isMoneyEndpointMissing`).
 */
import type { ApiResponse } from "./types";

export type MoneySpendRange = "today" | "yesterday" | "this_week" | "this_month";

export type MoneySpendSourceRow = {
  source_company: string;
  source_company_label: string;
  leads: number;
  duplicates: number;
  rate_label: string | null;
  spend: number;
  booked: number;
  cost_per_booked: number | null;
  unpriced: number;
};

export type MoneySpendRepRow = {
  agent_id: string;
  agent_name: string;
  leads_received: number;
  calls: number | null;
  booked: number;
  rep_cost: number | null;
  cost_per_lead: number | null;
  cost_per_booked: number | null;
  compensation_missing: boolean;
};

export type MoneySpendResponse = {
  range: MoneySpendRange;
  generated_at: string;
  totals: {
    lead_spend: number;
    cost_per_lead: number | null;
    cost_per_booked_lead: number | null;
    rep_cost_per_lead: number | null;
    unpriced: number;
  };
  by_source_company: MoneySpendSourceRow[];
  by_rep: MoneySpendRepRow[];
};

export const MONEY_SPEND_PATH = "api/v1/admin/money/spend";

export const MONEY_SPEND_RANGES: readonly MoneySpendRange[] = ["today", "yesterday", "this_week", "this_month"];

export function moneySpendUrl(range: MoneySpendRange): string {
  return `/api/proxy/${MONEY_SPEND_PATH}?range=${encodeURIComponent(range)}`;
}

/** An error carrying the HTTP status, so callers can tell "not shipped yet" (404) from a real failure. */
export class MoneyRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "MoneyRequestError";
    this.status = status;
  }
}

export async function fetchMoneySpend(range: MoneySpendRange): Promise<MoneySpendResponse> {
  const response = await fetch(moneySpendUrl(range), { credentials: "include" });
  let payload: ApiResponse<MoneySpendResponse> | undefined;
  try {
    payload = (await response.json()) as ApiResponse<MoneySpendResponse>;
  } catch {
    payload = undefined;
  }
  if (!response.ok || !payload || !payload.ok) {
    const raw = payload && !payload.ok ? payload.error?.trim() : "";
    const message = !raw || raw.startsWith("<!DOCTYPE") || raw.startsWith("<html") ? `Request failed (${response.status}).` : raw;
    throw new MoneyRequestError(message, response.status);
  }
  return payload.data;
}

/** The endpoint has not shipped: a 404, or a message that says so. */
export function isMoneyEndpointMissing(error: unknown): boolean {
  if (error instanceof MoneyRequestError) return error.status === 404;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /Request failed \(404/.test(message);
}
