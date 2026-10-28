export const MILEAGE = ["MI_0_100", "MI_101_300", "MI_301_750", "MI_751_1250", "MI_1251_1800", "MI_1801_2500", "MI_2501_3000", "MI_3000_PLUS"] as const;
export const VOLUME = ["MIN_300", "CF_301_500", "CF_501_1000", "CF_1001_1500", "CF_1501_2000", "CF_2001_3000", "CF_3001_PLUS"] as const;
/** Owner-facing names. Each range includes its top number (">100–300" reads "100–300 mi"). */
export const MILEAGE_LABELS = ["Up to 100", "100 – 300", "300 – 750", "750 – 1,250", "1,250 – 1,800", "1,800 – 2,500", "2,500 – 3,000", "Over 3,000"];
export const VOLUME_LABELS = ["Up to 300", "300 – 500", "500 – 1,000", "1,000 – 1,500", "1,500 – 2,000", "2,000 – 3,000", "Over 3,000"];
export const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
export type Rates = Record<string, string | null>;
export type Group = { group_id: string | null; name: string; active: boolean; states: string[]; rates: Rates };
export type Configuration = { currency: "USD"; base_rates: Record<string, Rates>; surcharge_groups: Group[] };
export type Draft = { _id: string; draft_version: number; configuration: Configuration; status: string };
export type Revision = { _id: string; configuration: Configuration; created_at: string; change_note: string };
export type Control = { activation_version: number; active_revision_id: string | null; calculation_enabled: boolean; updated_at?: string };
export type Production = { control: Control; revision: Revision | null };
export type Sample = { volume_cf: string; mileage: string; pickup_state: string; pickup_zip: string; delivery_state: string; delivery_zip: string };
export type Preview = { draft_id: string; draft_version: number; activation_version: number; complete: boolean; warning_hash: string; configuration_hash: string; findings: { code: string; path: string; message: string }[]; warnings: { code: string; mileage_band: string; volume_boundary: string; old_price: string | null; new_price: string; message: string }[]; results: { input_index: number; ok: boolean; data?: Record<string, unknown>; error?: { message: string } }[] };

export function emptyRates(): Rates { return Object.fromEntries(VOLUME.map(tier => [tier, null])); }
export function emptyConfiguration(): Configuration {
  return { currency: "USD", base_rates: Object.fromEntries(MILEAGE.map(band => [band, emptyRates()])), surcharge_groups: [] };
}
/** A new surcharge group starts active: adding one means the Owner wants it applied. */
export function newGroup(): Group { return { group_id: null, name: "", active: true, states: [], rates: emptyRates() }; }

/** Stored rates carry four decimals ("3.2700"); show them as money with 2–4 decimals. */
export function rateText(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4, useGrouping: false }) : value;
}
/** Parse what the Owner typed into the wire decimal the service accepts: "" → null, "$3.5" → "3.5", junk → undefined. */
export function parseRate(raw: string): string | null | undefined {
  const text = raw.trim().replace(/^\$/, "").replace(/,/g, "").replace(/\.$/, "");
  if (text === "") return null;
  if (!/^\d+(\.\d{1,4})?$/.test(text)) return undefined;
  const value = text.replace(/^0+(?=\d)/, "");
  return Number(value) <= 1000 ? value : undefined;
}
/** Each rate input either parsed or left as the bad text so the editor can point at it. */
export function parseRates(texts: Record<string, string>): { rates: Rates; empty: number; invalid: number } {
  const rates: Rates = {};
  let empty = 0, invalid = 0;
  for (const tier of VOLUME) {
    const value = parseRate(texts[tier] ?? "");
    if (value === undefined) invalid++;
    else if (value === null) empty++;
    rates[tier] = value ?? null;
  }
  return { rates, empty, invalid };
}

export function collisions(configuration: Configuration): string[] {
  const memberships = new Map<string, string[]>();
  configuration.surcharge_groups.filter(g => g.active).forEach(g => g.states.forEach(state => memberships.set(state, [...(memberships.get(state) ?? []), g.name || "Unnamed group"])));
  return [...memberships].filter(([, names]) => names.length > 1).map(([state, names]) => `${state}: ${names.join(" / ")}`);
}

export class PricingError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
export async function pricingRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/operations-pricing/${path}`, { method, credentials: "same-origin", cache: "no-store", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new PricingError(0, "UNKNOWN_OUTCOME", "Connection lost. Reload a draft save before trying again. Control commands can be retried unchanged."); }
  let value;
  try { value = await response.json(); if (!value || typeof value.ok !== "boolean") throw new Error(); }
  catch { throw new PricingError(0, "UNKNOWN_OUTCOME", "The response could not be verified. Reload a draft save before trying again; retry control commands unchanged."); }
  if (!response.ok || value.ok !== true) throw new PricingError(response.status, value.error?.code ?? "UNAVAILABLE", value.error?.message ?? "Pricing is unavailable.");
  return value.data as T;
}

/** One plain sentence for a failed save, telling the Owner what to do next. */
export function pricingErrorText(error: unknown): string {
  if (!(error instanceof PricingError)) return "Pricing is unavailable. Try again in a moment.";
  if (error.status === 0) return "We couldn't confirm the save. Your rates were reloaded — check whether the change is there.";
  if (error.status === 409) return "Pricing was changed somewhere else. The latest rates were reloaded — make your change again.";
  if (error.status === 401) return "Your session ended. Sign in again.";
  if (error.status === 422) return "Some rates are empty. Fill every rate, then save.";
  return error.message;
}

export type SaveOutcome = { calculationEnabled: boolean; warnings: Preview["warnings"] };
/**
 * Save = publish. The operations service keeps its draft → preview → publish protocol (and its audit trail); the
 * Owner never sees it. Creates a draft from the live revision, writes the full configuration, previews it with no
 * sample moves, then publishes with an automatic change note and the preview's warning acknowledgement.
 */
export async function saveConfiguration(activeRevisionId: string | null, configuration: Configuration, changeNote: string): Promise<SaveOutcome> {
  const created = await pricingRequest<Draft>("drafts", "POST", { base_revision_id: activeRevisionId, operation_id: crypto.randomUUID() });
  const saved = await pricingRequest<Draft>(`drafts/${created._id}`, "PUT", { expected_draft_version: created.draft_version, configuration });
  const report = await pricingRequest<Preview>(`drafts/${saved._id}/preview`, "POST", { expected_draft_version: saved.draft_version, inputs: [] });
  if (report.findings.length) throw new PricingError(422, "CONFIGURATION_INVALID", report.findings[0].message);
  const result = await pricingRequest<{ calculation_enabled: boolean }>(`drafts/${saved._id}/publish`, "POST", {
    expected_draft_version: saved.draft_version,
    expected_activation_version: report.activation_version,
    operation_id: crypto.randomUUID(),
    change_note: changeNote.slice(0, 500),
    ...(report.warnings.length ? { acknowledged_warning_hash: report.warning_hash } : {}),
  });
  return { calculationEnabled: result.calculation_enabled, warnings: report.warnings };
}
export async function setCalculationEnabled(control: Control, enabled: boolean): Promise<void> {
  await pricingRequest("enabled", "POST", { calculation_enabled: enabled, expected_activation_version: control.activation_version, operation_id: crypto.randomUUID(), change_note: enabled ? "Agent pricing turned on" : "Agent pricing turned off" });
}
export async function restoreRevision(control: Control, revision: Revision): Promise<void> {
  await pricingRequest("activate", "POST", { revision_id: revision._id, expected_activation_version: control.activation_version, operation_id: crypto.randomUUID(), change_note: `Restored rates saved ${new Date(revision.created_at).toLocaleString("en-US")}` });
}
