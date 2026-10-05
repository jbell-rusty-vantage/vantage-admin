/**
 * Display helpers for All Numbers and Accounts. Pure: times interpolate from the read's `as_of`, never the browser
 * clock, and nothing here decides who is waiting or which Lead a number belongs to (the server does).
 */
import type { CallResult, LeadRef } from "@/lib/api/allNumbers";
import { deskCopy } from "../outreach-desk-copy";
import { durationWords } from "./format";

const n = deskCopy.numbers;
const p = deskCopy.numberPanel;

export type PillVariant = "green" | "red" | "amber" | "neutral";

/**
 * A call's result pill. Only an incoming call can be missed or go to voicemail; an outgoing call that did not
 * connect reads "No answer" (it never makes anyone wait on us).
 */
export function callResultPill(direction: "inbound" | "outbound", result: CallResult): { text: string; variant: PillVariant } {
  if (result === "answered") return { text: n.results.answered, variant: "green" };
  if (direction === "outbound") return { text: n.results.noAnswer, variant: "neutral" };
  if (result === "voicemail") return { text: n.results.voicemail, variant: "amber" };
  return { text: n.results.missed, variant: "red" };
}

/** "45 s", "3 min", "3 min 12 s"; null for an unknown or zero duration. */
export function callDuration(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  if (seconds < 60) return p.seconds(Math.round(seconds));
  return p.minutes(Math.floor(seconds / 60), Math.round(seconds % 60));
}

/** How long someone has waited on us: "3 hours", red from one hour on. Null when nobody is waiting. */
export function waitingText(waitingSince: string | null, asOf: string): { text: string; tone: "red" | "amber" } | null {
  if (!waitingSince) return null;
  const ms = Math.max(0, Date.parse(asOf) - Date.parse(waitingSince));
  return { text: durationWords(ms), tone: ms >= 3_600_000 ? "red" : "amber" };
}

/** The Lead's name, else its job #, else a neutral label (never blank). */
export function leadName(lead: Pick<LeadRef, "name" | "job_no">): string {
  return lead.name?.trim() || (lead.job_no ? n.job(lead.job_no) : p.unnamedLead);
}

/** A booked or cancelled Lead gets a state pill; an open one does not. */
export function leadStatePill(state: LeadRef["state"]): { text: string; variant: PillVariant } | null {
  if (state === "booked") return { text: n.leadStates.booked, variant: "green" };
  if (state === "cancelled") return { text: n.leadStates.cancelled, variant: "neutral" };
  return null;
}
