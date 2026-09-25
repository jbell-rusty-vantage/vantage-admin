"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { outreachReadSchema, type OutreachRead } from "@/lib/api/salesIntelligence";
import { RepFollowupSheet, RepFollowups, type RepFollowupAction, type RepSend } from "@/components/sales-intelligence/rep/followup-actions";
import { ViewerProvider, viewerFromSession } from "@/components/sales-intelligence/rep/viewer";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { REP_FIXTURES } from "./rep-fixtures";
import { GallerySection, Sample, Subhead } from "./section";

const DANA = viewerFromSession({ role: "rep", agent_id: "6ab5ab0d72ee2eb383d940a7" });
const detail = (key: string): OutreachRead => outreachReadSchema.parse(REP_FIXTURES.details[key]!.read);
/** The gallery never reaches the API: Send waits a moment and succeeds, so the sheet closes and `Saved.` shows. */
const fakeSend: RepSend = () => new Promise((resolve) => window.setTimeout(resolve, 600));
const ACTIONS: RepFollowupAction[] = ["complete_followup", "snooze_followup", "patch_followup"];

/** UI2-FOLLOWUP (UI-2 §4; A06, A07): the rep's own follow-up with its three actions, the read-only reasons, and each sheet. */
export function RepFollowupSection() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } }));
  const own = detail("own");
  const ownFollowup = own.data.outreach.followups.find((f) => f.status === "open")!;
  return (
    <GallerySection id="rep-followup" title={copy.ui2.gallery.sections["rep-followup"]}>
      <QueryClientProvider client={client}>
        <ViewerProvider viewer={DANA}>
          <Subhead>Work tab follow-ups (Dana Reyes)</Subhead>
          <Sample label="Own follow-up: Complete · Snooze · Change date (buttons open the real sheet; Send is a stand-in here)" copyKey={`ui2.followup.actions · ${REP_FIXTURES.details.own!.source}`} wide>
            <RepFollowups record={own.data.outreach} asOf={own.as_of} send={fakeSend} />
          </Sample>
          <Sample label="Promised by the rep, responsible someone else: read-only" copyKey={`ui2.followup.readOnly.promisedOnly · ${REP_FIXTURES.details.promisedOnly!.source}`} wide>
            <RepFollowups record={detail("promisedOnly").data.outreach} asOf={detail("promisedOnly").as_of} send={fakeSend} />
          </Sample>
          <Sample label="Another rep's promise: read-only" copyKey={`ui2.followup.readOnly.otherRep · ${REP_FIXTURES.details.otherRep!.source}`} wide>
            <RepFollowups record={detail("otherRep").data.outreach} asOf={detail("otherRep").as_of} send={fakeSend} />
          </Sample>
          <Sample label="Another rep's promise and an Owner follow-up (S-findings)" copyKey={`ui2.followup.readOnly.owner · ${REP_FIXTURES.details.sFindings!.source}`} wide>
            <RepFollowups record={detail("sFindings").data.outreach} asOf={detail("sFindings").as_of} send={fakeSend} />
          </Sample>
          <Subhead>The sheets (full screen at 390 px; shown in place here)</Subhead>
          {ACTIONS.map((action) => (
            <Sample key={action} label={`${copy.ui2.followup.titles[action]} · Send disabled until the note has a character`} copyKey={`ui2.followup.titles.${action}`} wide>
              <RepFollowupSheet action={action} followup={ownFollowup} outreachId={own.data.outreach.id} asOf={own.as_of} open onClose={() => {}} onDone={() => {}} send={fakeSend} inline />
            </Sample>
          ))}
        </ViewerProvider>
      </QueryClientProvider>
    </GallerySection>
  );
}
