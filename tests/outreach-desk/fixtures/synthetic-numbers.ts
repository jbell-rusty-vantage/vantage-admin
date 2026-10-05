/**
 * Synthetic All Numbers and RingCentral Accounts for the desk's mock mode (all-numbers/CONTRACT.md §4). Synthetic
 * people, phones and job numbers only. The twelve desk leads reuse the desk fixtures' phones, names, reps and subject
 * ids, so a Lead's "Open in desk" link opens a real mock lead.
 *
 * The state is mutable on purpose (Link/Unlink, Connect/Change/Disconnect, Suggest matches change it), and every read
 * is recomputed from it with the contract's rules: the call summary from the calls (§3 "Call summary", "Waiting on
 * us") and the Lead link from exact-phone candidates, Owner pins and exclusions (§3 "Lead link").
 */
import type { Account, AccountRole, AgentRef, CallResult, LeadModel, LeadRef, NumberCall, NumberRow } from "@/lib/api/allNumbers";
import { SYNTHETIC_AGENTS, SYNTHETIC_AS_OF, syntheticSubjectId, type SyntheticAgentKey } from "./synthetic";

export const NUMBERS_AS_OF = SYNTHETIC_AS_OF;
export const SYNTHETIC_RC_ACCOUNT_ID = "62948571023";

/** Agents beyond the desk's five reps: a manager, a new hire with no link yet and a former rep. */
export const SYNTHETIC_EXTRA_AGENTS = {
  robin: { id: "6650a1b2c3d4e5f607180006", name: "Robin Hale" },
  morgan: { id: "6650a1b2c3d4e5f607180007", name: "Morgan Blake" },
  taylor: { id: "6650a1b2c3d4e5f607180008", name: "Taylor Quinn" },
} as const;
type AgentKey = SyntheticAgentKey | keyof typeof SYNTHETIC_EXTRA_AGENTS;
const AGENTS: Record<AgentKey, AgentRef> = { ...SYNTHETIC_AGENTS, ...SYNTHETIC_EXTRA_AGENTS };
/** Active Agents for the picker (the former rep is not active). */
const ACTIVE_AGENTS: AgentKey[] = ["alex", "jamie", "sam", "casey", "drew", "robin", "morgan"];

// ---------------------------------------------------------------------------------------------- leads

export type MockLead = {
  model: LeadModel;
  id: string;
  name: string | null;
  job_no: string | null;
  rep: AgentKey | null;
  received_at: string;
  state: LeadRef["state"];
  /** The desk subject (fixtures `syntheticSubjectId(n)`), when the Lead is on the Outreach Desk. */
  desk: number | null;
  e164: string;
  duplicate?: boolean;
};

const leadId = (n: number) => `6650a1b2c3d4e5f6072b${n.toString(16).padStart(4, "0")}`;

const LEADS: MockLead[] = [
  // The twelve Outreach Desk leads (same phone, name, job and rep as the desk fixtures).
  { model: "FormLead", id: leadId(1), name: "Taylor Brooks", job_no: "P5561042", rep: "alex", received_at: "2026-09-29T13:20:00.000Z", state: "open", desk: 1, e164: "+15125550142" },
  { model: "CallLead", id: leadId(2), name: "Avery Stone", job_no: "P5562081", rep: "alex", received_at: "2026-09-18T15:00:00.000Z", state: "open", desk: 2, e164: "+13035550181" },
  { model: "FormLead", id: leadId(3), name: "Quinn Harper", job_no: "P5563091", rep: "casey", received_at: "2026-09-28T16:30:00.000Z", state: "open", desk: 3, e164: "+14155550191" },
  { model: "FormLead", id: leadId(4), name: "Casey Wong", job_no: "P5563155", rep: "jamie", received_at: "2026-09-30T14:10:00.000Z", state: "open", desk: 4, e164: "+17205550155" },
  { model: "CallLead", id: leadId(5), name: "Morgan Diaz", job_no: "P5561043", rep: "alex", received_at: "2026-10-01T13:05:00.000Z", state: "open", desk: 5, e164: "+17135550143" },
  { model: "FormLead", id: leadId(6), name: "Drew Patel", job_no: "P5563120", rep: "sam", received_at: "2026-09-20T14:00:00.000Z", state: "open", desk: 6, e164: "+16175550120" },
  { model: "CallLead", id: leadId(7), name: "Jesse Kim", job_no: "P5563200", rep: null, received_at: "2026-10-01T14:40:00.000Z", state: "open", desk: 7, e164: "+14045550200" },
  { model: "FormLead", id: leadId(8), name: "Sam Rivera", job_no: null, rep: "casey", received_at: "2026-10-01T15:10:00.000Z", state: "open", desk: 8, e164: "+13055550210" },
  { model: "FormLead", id: leadId(9), name: "Jordan Lee", job_no: "P5561044", rep: "alex", received_at: "2026-09-28T14:00:00.000Z", state: "open", desk: 9, e164: "+16025550144" },
  { model: "FormLead", id: leadId(10), name: "Riley Chen", job_no: "P5561045", rep: "alex", received_at: "2026-09-24T15:00:00.000Z", state: "open", desk: 10, e164: "+12065550145" },
  { model: "CallLead", id: leadId(11), name: "Harper Cole", job_no: "P5563310", rep: null, received_at: "2026-09-22T14:00:00.000Z", state: "open", desk: 11, e164: "+15125550310" },
  { model: "FormLead", id: leadId(12), name: "Parker Gray", job_no: "P5561050", rep: "alex", received_at: "2026-09-21T14:00:00.000Z", state: "open", desk: 12, e164: "+15125550150" },
  // Leads that are not on the desk: booked, cancelled, older quotes, form leads with no calls.
  { model: "FormLead", id: leadId(13), name: "Taylor Brooks", job_no: "P5550991", rep: "jamie", received_at: "2026-08-12T15:00:00.000Z", state: "booked", desk: null, e164: "+15125550142" },
  { model: "FormLead", id: leadId(14), name: "Robin Ellis", job_no: "P5549920", rep: "sam", received_at: "2026-09-10T16:00:00.000Z", state: "booked", desk: null, e164: "+14695550177" },
  { model: "CallLead", id: leadId(15), name: "Kai Morales", job_no: "P5551200", rep: "jamie", received_at: "2026-09-05T18:00:00.000Z", state: "cancelled", desk: null, e164: "+12815550133" },
  { model: "FormLead", id: leadId(16), name: "Dana Whitfield", job_no: "P5557712", rep: "casey", received_at: "2026-09-30T22:15:00.000Z", state: "open", desk: null, e164: "+19195550166" },
  { model: "CallLead", id: leadId(17), name: "Avery Stone", job_no: "P5540013", rep: "sam", received_at: "2026-07-02T14:00:00.000Z", state: "cancelled", desk: null, e164: "+13035550181" },
  { model: "CallLead", id: leadId(18), name: "Jules Banner", job_no: "P5562555", rep: "jamie", received_at: "2026-09-26T17:30:00.000Z", state: "open", desk: null, e164: "+17025550123" },
  { model: "FormLead", id: leadId(19), name: "Jules Banner", job_no: "P5560871", rep: "sam", received_at: "2026-09-12T13:00:00.000Z", state: "cancelled", desk: null, e164: "+17025550123" },
  { model: "FormLead", id: leadId(20), name: "Mia Ortega", job_no: "P5560450", rep: "casey", received_at: "2026-09-15T15:30:00.000Z", state: "booked", desk: null, e164: "+16465550100" },
  { model: "FormLead", id: leadId(21), name: "Noah Fischer", job_no: "P5563377", rep: "drew", received_at: "2026-09-29T19:00:00.000Z", state: "open", desk: null, e164: "+18015550112" },
  { model: "FormLead", id: leadId(22), name: "Hana Sato", job_no: "P5563402", rep: "jamie", received_at: "2026-10-01T11:45:00.000Z", state: "open", desk: null, e164: "+14805550171" },
  { model: "FormLead", id: leadId(23), name: "Leo Grant", job_no: null, rep: null, received_at: "2026-10-01T15:30:00.000Z", state: "open", desk: null, e164: "+16145550135" },
  { model: "FormLead", id: leadId(24), name: "Priya Nair", job_no: "P5558830", rep: "sam", received_at: "2026-09-16T14:20:00.000Z", state: "booked", desk: null, e164: "+18455550156" },
  { model: "CallLead", id: leadId(25), name: "Omar Haddad", job_no: "P5562990", rep: "casey", received_at: "2026-09-27T16:05:00.000Z", state: "open", desk: null, e164: "+15105550119" },
  { model: "FormLead", id: leadId(26), name: "Elena Ruiz", job_no: "P5563015", rep: "drew", received_at: "2026-09-25T14:45:00.000Z", state: "open", desk: null, e164: "+13125550190" },
  // A duplicate Lead: never a candidate, never in the picker.
  { model: "FormLead", id: leadId(27), name: "Taylor Brooks", job_no: null, rep: null, received_at: "2026-09-29T13:21:00.000Z", state: "open", desk: null, e164: "+15125550142", duplicate: true },
];

// ---------------------------------------------------------------------------------------------- numbers

/** [at, direction, result, duration seconds, rep (our side), recordings] */
type CallSpec = [string, "inbound" | "outbound", CallResult, number | null, AgentKey | null, number?];
type NumberSpec = {
  n: number;
  e164: string;
  names?: string[];
  form?: boolean;
  first?: string;
  calls: CallSpec[];
  /** An Owner pin made at `at` (it may name a Lead with another phone). */
  pin?: { lead: number; at: string };
  /** Leads the Owner unlinked. */
  excluded?: number[];
};

const NUMBER_SPECS: NumberSpec[] = [
  // Waiting on us.
  { n: 1, e164: "+15125550142", names: ["BROOKS TAYLOR"], calls: [["2026-09-29T18:40:00.000Z", "outbound", "answered", 312, "alex", 1], ["2026-10-01T14:05:00.000Z", "inbound", "missed", null, null], ["2026-10-01T14:20:00.000Z", "inbound", "voicemail", 41, null, 1]] },
  { n: 2, e164: "+14045550200", names: ["KIM JESSE"], calls: [["2026-10-01T14:38:00.000Z", "inbound", "answered", 188, "jamie", 1], ["2026-10-01T15:30:00.000Z", "inbound", "missed", null, null]] },
  { n: 3, e164: "+17865550148", names: ["WIRELESS CALLER"], calls: [["2026-09-30T21:00:00.000Z", "inbound", "missed", null, null], ["2026-10-01T12:30:00.000Z", "inbound", "missed", null, null]] },
  { n: 4, e164: "+12815550133", names: ["MORALES K"], calls: [["2026-09-05T18:00:00.000Z", "inbound", "answered", 640, "jamie", 1], ["2026-09-28T15:00:00.000Z", "inbound", "voicemail", 22, null, 1]] },
  { n: 5, e164: "+13055550210", names: [], calls: [["2026-10-01T15:45:00.000Z", "inbound", "missed", null, null]] },
  { n: 6, e164: "+19105550161", names: ["SMITH J"], calls: [["2026-09-29T17:10:00.000Z", "outbound", "missed", null, "sam"], ["2026-09-30T13:00:00.000Z", "inbound", "missed", null, null]] },
  { n: 7, e164: "+16175550120", names: ["PATEL DREW"], calls: [["2026-09-30T15:20:00.000Z", "inbound", "answered", 254, "sam", 1], ["2026-10-01T13:40:00.000Z", "inbound", "missed", null, null]] },
  // Linked, handled.
  { n: 8, e164: "+13035550181", names: ["STONE AVERY"], calls: [["2026-09-25T16:40:00.000Z", "inbound", "missed", null, null], ["2026-09-25T17:00:00.000Z", "outbound", "answered", 420, "alex", 1]] },
  { n: 9, e164: "+14155550191", names: ["HARPER Q"], calls: [["2026-09-28T19:05:00.000Z", "outbound", "answered", 95, "casey", 1]] },
  { n: 10, e164: "+17205550155", names: ["WONG CASEY"], calls: [["2026-09-30T20:30:00.000Z", "inbound", "answered", 361, "jamie", 1]] },
  { n: 11, e164: "+17135550143", names: ["DIAZ MORGAN"], calls: [["2026-10-01T13:10:00.000Z", "outbound", "answered", 205, "alex", 1]] },
  { n: 12, e164: "+16025550144", names: ["LEE JORDAN"], calls: [["2026-09-29T15:00:00.000Z", "outbound", "answered", 180, "alex", 1], ["2026-09-30T19:00:00.000Z", "outbound", "missed", null, "alex"]] },
  { n: 13, e164: "+12065550145", names: ["CHEN RILEY"], calls: [["2026-09-30T20:00:00.000Z", "outbound", "answered", 133, "alex", 1]] },
  { n: 14, e164: "+15125550310", names: ["COLE HARPER"], calls: [["2026-09-29T16:00:00.000Z", "inbound", "answered", 512, "sam", 1]] },
  { n: 15, e164: "+15125550150", names: ["GRAY PARKER"], calls: [["2026-09-30T18:00:00.000Z", "outbound", "answered", 76, "alex", 1]] },
  { n: 16, e164: "+14695550177", names: ["ELLIS ROBIN"], calls: [["2026-09-10T16:20:00.000Z", "inbound", "answered", 845, "sam", 1], ["2026-09-30T14:00:00.000Z", "inbound", "answered", 96, "sam", 1]] },
  { n: 17, e164: "+17025550123", names: ["BANNER J", "JULES BANNER"], calls: [["2026-09-26T17:40:00.000Z", "outbound", "answered", 264, "jamie", 1], ["2026-09-27T15:00:00.000Z", "inbound", "answered", 58, "jamie"]] },
  // Owner-pinned to a Lead whose phone differs (the caller used a spouse's cell).
  { n: 18, e164: "+16465550199", names: ["M ORTEGA"], calls: [["2026-09-16T14:00:00.000Z", "inbound", "answered", 300, "casey", 1]], pin: { lead: 20, at: "2026-09-16T15:00:00.000Z" } },
  { n: 19, e164: "+18455550156", names: ["NAIR PRIYA"], calls: [["2026-09-16T15:00:00.000Z", "outbound", "answered", 410, "sam", 1]] },
  { n: 20, e164: "+15105550119", names: ["HADDAD OMAR"], calls: [["2026-09-27T16:30:00.000Z", "outbound", "answered", 287, "casey", 1]] },
  { n: 21, e164: "+13125550190", names: ["CHICAGO IL"], calls: [["2026-09-25T15:00:00.000Z", "inbound", "answered", 150, "drew", 1], ["2026-09-26T14:00:00.000Z", "outbound", "missed", null, "drew"]] },
  // Form lead numbers with no calls yet.
  { n: 22, e164: "+19195550166", form: true, first: "2026-09-30T22:15:00.000Z", calls: [] },
  { n: 23, e164: "+14805550171", form: true, first: "2026-10-01T11:45:00.000Z", calls: [] },
  { n: 24, e164: "+16145550135", form: true, first: "2026-10-01T15:30:00.000Z", calls: [] },
  // Unknown numbers (no Lead has the phone).
  { n: 25, e164: "+18885550102", names: ["VANTAGE SUPPLY CO"], calls: [["2026-09-30T13:30:00.000Z", "outbound", "answered", 122, "morgan"]] },
  { n: 26, e164: "+12135550187", names: ["LOS ANGELES CA"], calls: [["2026-09-29T20:15:00.000Z", "inbound", "answered", 47, "alex"]] },
  { n: 27, e164: "+13475550129", names: [], calls: [["2026-09-27T14:10:00.000Z", "inbound", "missed", null, null], ["2026-09-27T14:40:00.000Z", "outbound", "answered", 66, "jamie"]] },
  { n: 28, e164: "+19725550114", names: ["ROBERTS D"], calls: [["2026-09-28T18:20:00.000Z", "outbound", "missed", null, "casey"]] },
  { n: 29, e164: "+15035550140", names: ["PORTLAND OR"], calls: [["2026-09-24T17:00:00.000Z", "inbound", "voicemail", 31, null, 1], ["2026-09-24T18:00:00.000Z", "outbound", "answered", 210, "sam", 1]] },
  { n: 30, e164: "+12145550161", names: ["DALLAS TX"], calls: [["2026-09-21T16:00:00.000Z", "inbound", "answered", 90, "jamie"]] },
  { n: 31, e164: "+16175550177", names: ["BROOKLINE STORAGE"], calls: [["2026-09-23T15:20:00.000Z", "outbound", "answered", 340, "morgan", 1]] },
  // An Owner-unlinked Lead: the old quote is excluded; nothing else matches, so the number is Unknown.
  { n: 32, e164: "+18015550112", names: ["FISCHER N"], calls: [["2026-09-29T19:30:00.000Z", "inbound", "answered", 402, "drew", 1]], excluded: [21] },
];

const numberId = (n: number) => `6650a1b2c3d4e5f6073c${n.toString(16).padStart(4, "0")}`;
const callId = (n: number, i: number) => `6650a1b2c3d4e5f6074d${(n * 16 + i).toString(16).padStart(4, "0")}`;
/** Our side of each call: a rep's DID, or the main line for inbound calls nobody answered. */
const DIDS: Partial<Record<AgentKey, string>> = { alex: "(512) 555-0101", jamie: "(512) 555-0102", sam: "(512) 555-0103", casey: "(512) 555-0104", drew: "(512) 555-0105", morgan: "(512) 555-0107" };
const MAIN_LINE = "(512) 555-0100";

// ---------------------------------------------------------------------------------------------- state

type LeadKey = { model: LeadModel; id: string };
export type MockNumber = {
  id: string;
  revision: number;
  e164: string;
  provider_names: string[];
  created_via: "form_lead" | "call";
  first_observed_at: string;
  calls: NumberCall[];
  link: { source: "automatic" | "owner"; set_at: string; set_by: string | null; excluded: LeadKey[]; pinned: LeadKey | null };
};
export type MockAccount = Omit<Account, "suggestion"> & { suggestion: Account["suggestion"]; agent_key: AgentKey | null };
export type NumbersMockState = { numbers: MockNumber[]; leads: MockLead[]; accounts: MockAccount[]; directory_at: string; sequence: number };

export function createNumbersMockState(): NumbersMockState {
  const numbers = NUMBER_SPECS.map<MockNumber>((spec) => {
    const calls = spec.calls
      .map<NumberCall>(([at, direction, result, duration, rep, recordings], index) => ({
        id: callId(spec.n, index),
        at,
        direction,
        result,
        duration_seconds: duration,
        agent_name: rep ? AGENTS[rep].name : null,
        our_number: rep ? (DIDS[rep] ?? MAIN_LINE) : MAIN_LINE,
        recordings: recordings ?? 0,
      }))
      .sort((a, b) => b.at.localeCompare(a.at));
    const first = spec.first ?? calls[calls.length - 1]?.at ?? NUMBERS_AS_OF;
    const pinned = spec.pin ? LEADS.find((lead) => lead.id === leadId(spec.pin!.lead))! : null;
    return {
      id: numberId(spec.n),
      revision: 3,
      e164: spec.e164,
      provider_names: spec.names ?? [],
      created_via: spec.form ? "form_lead" : "call",
      first_observed_at: first,
      calls,
      link: {
        source: spec.pin ? "owner" : "automatic",
        set_at: spec.pin?.at ?? first,
        set_by: spec.pin ? "owner.e2e@example.test" : null,
        excluded: (spec.excluded ?? []).map((n) => {
          const lead = LEADS.find((row) => row.id === leadId(n))!;
          return { model: lead.model, id: lead.id };
        }),
        pinned: pinned ? { model: pinned.model, id: pinned.id } : null,
      },
    };
  });
  return { numbers, leads: LEADS.map((lead) => ({ ...lead })), accounts: initialAccounts(), directory_at: "2026-10-01T15:00:00.000Z", sequence: 100 };
}

// ---------------------------------------------------------------------------------------------- rules

/** "(512) 555-0142" for a US number, else the E.164. */
export function displayPhone(e164: string): string {
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164;
}

const sameLead = (a: LeadKey, b: LeadKey) => a.model === b.model && a.id === b.id;

export function leadRef(lead: MockLead): LeadRef {
  return {
    model: lead.model,
    id: lead.id,
    name: lead.name,
    job_no: lead.job_no,
    rep_name: lead.rep ? AGENTS[lead.rep].name : null,
    received_at: lead.received_at,
    state: lead.state,
    desk_subject_id: lead.desk ? syntheticSubjectId(lead.desk) : null,
  };
}

/** §3 "Call summary" and "Waiting on us", recomputed from the calls (newest first in `calls`). */
export function callSummary(calls: readonly NumberCall[]) {
  const oldestFirst = [...calls].sort((a, b) => a.at.localeCompare(b.at));
  const handled = (call: NumberCall) => call.direction === "outbound" || call.result === "answered";
  const latestHandled = [...oldestFirst].reverse().find(handled);
  const waiting = oldestFirst.find((call) => call.direction === "inbound" && call.result !== "answered" && (!latestHandled || call.at > latestHandled.at));
  const inbound = oldestFirst.filter((call) => call.direction === "inbound");
  const outbound = oldestFirst.filter((call) => call.direction === "outbound");
  return {
    last_call: calls[0] ?? null,
    calls: { inbound: inbound.length, outbound: outbound.length, missed: inbound.filter((call) => call.result !== "answered").length },
    waiting_since: waiting?.at ?? null,
  };
}

/** §3 "Lead link": exact-phone candidates (no duplicates, nothing excluded), the Owner pin until a newer candidate. */
export function leadLink(state: NumbersMockState, number: MockNumber): { lead: MockLead | null; others: MockLead[]; source: "automatic" | "owner" } {
  const candidates = state.leads
    .filter((lead) => lead.e164 === number.e164 && !lead.duplicate && !number.link.excluded.some((key) => sameLead(key, lead)))
    .sort((a, b) => b.received_at.localeCompare(a.received_at));
  const pinned = number.link.source === "owner" && number.link.pinned ? state.leads.find((lead) => sameLead(lead, number.link.pinned!)) ?? null : null;
  const newerCandidate = candidates.some((lead) => lead.received_at > number.link.set_at);
  if (pinned && !newerCandidate) {
    return { lead: pinned, others: candidates.filter((lead) => !sameLead(lead, pinned)).slice(0, 10), source: "owner" };
  }
  return { lead: candidates[0] ?? null, others: candidates.slice(1, 11), source: "automatic" };
}

export function numberRow(state: NumbersMockState, number: MockNumber): NumberRow {
  const summary = callSummary(number.calls);
  const link = leadLink(state, number);
  const last = summary.last_call;
  return {
    id: number.id,
    revision: number.revision,
    e164: number.e164,
    display: displayPhone(number.e164),
    caller_name: number.provider_names[number.provider_names.length - 1] ?? null,
    source: number.created_via,
    lead: link.lead ? leadRef(link.lead) : null,
    lead_link: link.source,
    last_call: last ? { at: last.at, direction: last.direction, result: last.result, duration_seconds: last.duration_seconds, agent_name: last.agent_name } : null,
    calls: summary.calls,
    waiting_since: summary.waiting_since,
    first_seen_at: number.first_observed_at,
    last_activity_at: last?.at ?? number.first_observed_at,
  };
}

export function numberDetail(state: NumbersMockState, number: MockNumber) {
  const link = leadLink(state, number);
  return {
    number: numberRow(state, number),
    other_leads: link.others.map(leadRef),
    excluded_leads: number.link.excluded.map((key) => state.leads.find((lead) => sameLead(lead, key))).filter((lead): lead is MockLead => Boolean(lead)).map(leadRef),
    calls: number.calls.slice(0, 100),
    more_calls: number.calls.length > 100,
  };
}

const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

/** §4.1 `q`: any part of the number's digits, the caller name, the Lead name or job #. */
export function numberMatches(state: NumbersMockState, number: MockNumber, q: string): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const termDigits = digits(term);
  if (termDigits.length >= 3 && termDigits === term.replace(/[\s()+\-.]/g, "") && digits(number.e164).includes(termDigits)) return true;
  if (number.provider_names.some((name) => name.toLowerCase().includes(term))) return true;
  const lead = leadLink(state, number).lead;
  return Boolean(lead && ((lead.name ?? "").toLowerCase().includes(term) || (lead.job_no ?? "").toLowerCase().startsWith(term)));
}

/** §4.4: Lead name, job # or phone; no duplicates; newest first; max 20. */
export function leadSearch(state: NumbersMockState, q: string) {
  const term = q.trim().toLowerCase();
  const termDigits = digits(term);
  return state.leads
    .filter((lead) => !lead.duplicate)
    .filter(
      (lead) =>
        (lead.name ?? "").toLowerCase().includes(term) ||
        (lead.job_no ?? "").toLowerCase().startsWith(term) ||
        (termDigits.length >= 3 && digits(lead.e164).includes(termDigits)),
    )
    .sort((a, b) => b.received_at.localeCompare(a.received_at))
    .slice(0, 20)
    .map((lead) => ({ ...leadRef(lead), phone: displayPhone(lead.e164) }));
}

/** §4.3: pin a Lead (any non-duplicate Lead; a pin un-excludes it) or Unlink one (exclude it, back to automatic). */
export function applyLeadCommand(
  state: NumbersMockState,
  number: MockNumber,
  body: { lead: LeadKey | null; unlink?: LeadKey },
  actor: string,
): "ok" | "lead_not_found" {
  if (body.lead) {
    const lead = state.leads.find((row) => sameLead(row, body.lead!) && !row.duplicate);
    if (!lead) return "lead_not_found";
    number.link = {
      source: "owner",
      set_at: NUMBERS_AS_OF,
      set_by: actor,
      pinned: { model: lead.model, id: lead.id },
      excluded: number.link.excluded.filter((key) => !sameLead(key, lead)),
    };
  } else if (body.unlink) {
    const unlink = body.unlink;
    const excluded = number.link.excluded.some((key) => sameLead(key, unlink)) ? number.link.excluded : [...number.link.excluded, { model: unlink.model, id: unlink.id }];
    number.link = { source: "automatic", set_at: NUMBERS_AS_OF, set_by: actor, pinned: null, excluded };
  }
  number.revision += 1;
  return "ok";
}

// ---------------------------------------------------------------------------------------------- accounts

type AccountSpec = {
  ext: string;
  number: string | null;
  name: string;
  dids: string[];
  status: string | null;
  agent?: AgentKey;
  role?: AccountRole;
  in_directory?: boolean;
  suggestion?: AgentKey;
};

const ACCOUNT_SPECS: AccountSpec[] = [
  { ext: "63010101", number: "101", name: "Alex Morgan", dids: ["(512) 555-0101"], status: "Enabled", agent: "alex", role: "sales_rep" },
  { ext: "63010102", number: "102", name: "Jamie Park", dids: ["(512) 555-0102"], status: "Enabled", agent: "jamie", role: "sales_rep" },
  { ext: "63010103", number: "103", name: "Sam Taylor", dids: ["(512) 555-0103"], status: "Enabled", agent: "sam", role: "sales_rep" },
  { ext: "63010104", number: "104", name: "Casey Reed", dids: ["(512) 555-0104"], status: "Enabled", agent: "casey", role: "sales_rep" },
  { ext: "63010105", number: "105", name: "Drew Lane", dids: ["(512) 555-0105"], status: "Enabled", suggestion: "drew" },
  { ext: "63010106", number: "106", name: "Robin Hale", dids: ["(512) 555-0106"], status: "Enabled" },
  { ext: "63010107", number: "107", name: "Morgan Blake", dids: ["(512) 555-0107"], status: "Enabled", agent: "morgan", role: "manager" },
  { ext: "63010110", number: "110", name: "Front Desk", dids: ["(512) 555-0100", "(800) 555-0199"], status: "Enabled" },
  { ext: "63010120", number: "120", name: "Sales Dialer", dids: [], status: "Disabled" },
  { ext: "63010109", number: "109", name: "Taylor Quinn", dids: [], status: null, agent: "taylor", role: "sales_rep", in_directory: false },
];

function initialAccounts(): MockAccount[] {
  return ACCOUNT_SPECS.map((spec, index) => {
    const inDirectory = spec.in_directory ?? true;
    const agent = spec.agent ? AGENTS[spec.agent] : null;
    return {
      extension_id: spec.ext,
      extension_number: spec.number,
      name: spec.name,
      direct_numbers: spec.dids,
      status: spec.status,
      in_directory: inDirectory,
      agent: agent ? { id: agent.id, name: agent.name } : null,
      agent_key: spec.agent ?? null,
      role: spec.role ?? null,
      link_id: agent ? `6650a1b2c3d4e5f6075e${index.toString(16).padStart(4, "0")}` : null,
      link_revision: agent ? 2 : null,
      suggestion: spec.suggestion ? { agent_id: AGENTS[spec.suggestion].id, agent_name: AGENTS[spec.suggestion].name } : null,
      can_message: inDirectory && spec.status === "Enabled" && spec.number !== null,
      rc_account_id: inDirectory ? SYNTHETIC_RC_ACCOUNT_ID : null,
    };
  });
}

export function activeAgents(): AgentRef[] {
  return ACTIVE_AGENTS.map((key) => ({ id: AGENTS[key].id, name: AGENTS[key].name })).sort((a, b) => a.name.localeCompare(b.name));
}

export function agentById(id: string): (AgentRef & { key: AgentKey }) | null {
  const key = (Object.keys(AGENTS) as AgentKey[]).find((candidate) => AGENTS[candidate].id === id);
  return key ? { ...AGENTS[key], key } : null;
}

export function accountDto(account: MockAccount): Account {
  const { agent_key: _agentKey, ...dto } = account;
  void _agentKey;
  // The mock's Message rule (see the nudges route): Team Messaging needs a connected Agent, pager only an extension.
  return { ...dto, message_channels: dto.can_message ? (dto.agent ? ["team_messaging", "pager"] : ["pager"]) : [] };
}

/** The strongest name candidate for one unconnected directory User: an Agent of the same name no User is connected to. */
function suggestFor(state: NumbersMockState, account: MockAccount): void {
  if (account.agent || !account.in_directory || account.suggestion) return;
  const match = activeAgents().find((agent) => agent.name === account.name && !state.accounts.some((row) => row.agent?.id === agent.id));
  if (match) account.suggestion = { agent_id: match.id, agent_name: match.name };
}

/** "Suggest matches": proposes a name match for every unconnected directory User. */
export function suggestMatches(state: NumbersMockState): void {
  for (const account of state.accounts) suggestFor(state, account);
}

/** §4.6: connect/change (a new reviewed link) or disconnect (`agent_id: null`). */
export function applyAgentCommand(state: NumbersMockState, account: MockAccount, agentId: string | null, role: AccountRole | undefined): "ok" | "agent_not_found" {
  if (agentId === null) {
    account.agent = null;
    account.agent_key = null;
    account.role = null;
    account.link_id = null;
    account.link_revision = null;
    account.suggestion = null;
    suggestFor(state, account);
    return "ok";
  }
  const agent = agentById(agentId);
  if (!agent) return "agent_not_found";
  state.sequence += 1;
  account.agent = { id: agent.id, name: agent.name };
  account.agent_key = agent.key;
  account.role = role ?? account.role ?? "sales_rep";
  account.link_id = `6650a1b2c3d4e5f6075f${state.sequence.toString(16).padStart(4, "0")}`;
  account.link_revision = 1;
  account.suggestion = null;
  return "ok";
}
