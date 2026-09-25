"use client";

import type { NudgeRecord } from "@/lib/api/salesIntelligence";
import { OwnerMessagesView } from "@/components/sales-intelligence/rep/owner-messages";
import { ViewerProvider, viewerFromSession } from "@/components/sales-intelligence/rep/viewer";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { GallerySection, Sample } from "./section";

const DANA = viewerFromSession({ role: "rep", agent_id: "6ab5ab0d72ee2eb383d940a7" });

/** Dana's nudge as the rep's detail read serves it (contracts/S12/rep-outreach-nudges__t3-promise-across-b.json, as_of 2026-09-25T23:09:09.742Z). */
const AS_OF = "2026-09-25T23:09:09.742Z";
const DANA_NUDGE: NudgeRecord = {
  id: "5eed12000000000000000001",
  revision: 2,
  outreach_record_id: "6ab5ab1972ee2eb383d948b1",
  rc_account_id: "synthetic-account",
  rc_extension_id: "101",
  rep_identity_link_id: "6ab5ab0d72ee2eb383d940aa",
  agent_id: "6ab5ab0d72ee2eb383d940a7",
  actor_id: "5eed00000000000000000001",
  channel: "team_messaging",
  purpose: "call_suggestion",
  template_key: "call_suggestion",
  template_version: 1,
  body_as_sent: "Dana, the customer on …1072 asked for a callback today. Can you call before 5?",
  status: "sent",
  fallback_channel: null,
  error_code: null,
  created_at: "2026-09-25T21:33:25.288Z",
  sent_at: "2026-09-25T21:33:27.288Z",
  delivery_note: "Provider accepted the message; this is not evidence of customer work.",
  automatic_resend: false,
} as NudgeRecord;

const at = (id: string, sentAt: string, body: string): NudgeRecord => ({ ...DANA_NUDGE, id, created_at: sentAt, sent_at: sentAt, body_as_sent: body });
const TWO_DAYS = [
  at("g1", "2026-09-24T14:05:00.000Z", "Morning Dana, the Nguyen Lead came in overnight. Please call before noon."),
  at("g2", "2026-09-24T19:40:00.000Z", "Thanks for the update on the Nguyen move."),
  DANA_NUDGE,
];
const LONG = [
  at(
    "g3",
    "2026-09-25T15:12:00.000Z",
    "Dana, two things on this one before you call back:\n\n1. The customer said the move date could slide to the 14th if the price works, so please confirm the date first.\n2. They mentioned a piano on the second floor. Ask about stairs and access at both ends; it changes the quote.\n\nhttps://example.com/links-are-shown-not-linked\n\nThanks!",
  ),
];

/** UI2-NUDGES (UI-2 §5; A10): the rep's read-only `Messages from the Owner`. Owner bubbles on the left, no composer or delivery state. */
export function RepMessagesSection() {
  return (
    <GallerySection id="rep-messages" title={copy.ui2.gallery.sections["rep-messages"]}>
      <ViewerProvider viewer={DANA}>
        <Sample label="One message (Dana's, from the CF12 capture)" copyKey="ui2.nudges.title · ui2.nudges.alsoSent · S12/rep-outreach-nudges__t3-promise-across-b.json" wide>
          <OwnerMessagesView nudges={[DANA_NUDGE]} asOf={AS_OF} />
        </Sample>
        <Sample label="Several messages across two days (day dividers, exact times)" copyKey="ui2.nudges · built from the capture" wide>
          <OwnerMessagesView nudges={TWO_DAYS} asOf={AS_OF} />
        </Sample>
        <Sample label="A long body (line breaks kept, links not auto-linked)" copyKey="ui2.nudges · built" wide>
          <OwnerMessagesView nudges={LONG} asOf={AS_OF} />
        </Sample>
        <Sample label="No messages: the block is omitted (nothing renders below)" copyKey="ui2.nudges">
          <OwnerMessagesView nudges={[]} asOf={AS_OF} />
        </Sample>
      </ViewerProvider>
    </GallerySection>
  );
}
