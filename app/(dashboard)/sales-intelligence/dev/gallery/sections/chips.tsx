"use client";

import { Bot, CircleHelp, MessageSquareReply, Mic, Phone, PhoneIncoming, PhoneOff, Sparkles, TriangleAlert, UserRound, Voicemail } from "lucide-react";
import type { ReactNode } from "react";
import { Chip, type ChipTone } from "@/components/sales-intelligence/primitives";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { formatDate, formatDuration } from "@/components/sales-intelligence/lib/time";
import { GALLERY_AS_OF, liveCallSample, liveChipBriefSample, restrictionUntil } from "../fixtures";
import { GallerySection, Sample } from "./section";

type ChipSample = { id: string; tone: ChipTone; icon?: ReactNode; label: string; copyKey: string };

const c = copy.ui1.gallery.chips;
/** An empty icon slot: the `live` chip adds `radio` only when no icon is passed, and In progress has none (UI-0 §7.2). */
const NO_ICON = <></>;

/** Live chip duration: the fixture's `as_of − live_call.started_at` (the signal COPY-UI1 §4 names). */
const liveDuration = formatDuration(Date.parse(liveCallSample.asOf) - Date.parse(liveCallSample.startedAt));

export const CHIP_SAMPLES: ChipSample[] = [
  { id: "live-brief", tone: "live", label: c.liveCall(liveChipBriefSample.rep, formatDuration(liveChipBriefSample.durationMs)), copyKey: "copy.ui1.chip.liveCall (brief sample)" },
  { id: "live-fixture", tone: "live", label: c.liveCall(liveCallSample.repText, liveDuration), copyKey: "copy.ui1.chip.liveCall · S5c live_call" },
  { id: "owner-calling", tone: "neutral", icon: <Phone size={12} aria-hidden />, label: c.ownerCalling, copyKey: "copy.ui1.chip.ownerCalling" },
  { id: "needs-review", tone: "neutral", icon: <CircleHelp size={12} aria-hidden />, label: copy.ui1.prim.needsReview, copyKey: "copy.ui1.prim.needsReview" },
  { id: "details-disagree", tone: "amber", icon: <TriangleAlert size={12} aria-hidden />, label: c.detailsDisagree, copyKey: "copy.ui1.chip.detailsDisagree" },
  { id: "blocker-restriction", tone: "amber", icon: <PhoneOff size={12} aria-hidden />, label: c.blockerRestriction, copyKey: "copy.ui1.chip.blocker.restriction" },
  {
    id: "blocker-restriction-until",
    tone: "amber",
    icon: <PhoneOff size={12} aria-hidden />,
    label: c.blockerRestrictionUntil(formatDate(restrictionUntil, GALLERY_AS_OF)),
    copyKey: "copy.ui1.chip.blocker.restrictionUntil",
  },
  { id: "blocker-suppressed", tone: "amber", icon: <PhoneOff size={12} aria-hidden />, label: c.blockerSuppressed, copyKey: "copy.ui1.chip.blocker.suppressed" },
  { id: "blocker-identity", tone: "amber", icon: <PhoneOff size={12} aria-hidden />, label: c.blockerIdentity, copyKey: "copy.ui1.chip.blocker.identity" },
  { id: "blocker-disposition", tone: "amber", icon: <PhoneOff size={12} aria-hidden />, label: c.blockerDispositionReview, copyKey: "copy.ui1.chip.blocker.disposition_review" },
  { id: "newer-call", tone: "amber", icon: <PhoneIncoming size={12} aria-hidden />, label: c.newerCall, copyKey: "copy.ui1.chip.newerCall" },
  { id: "default", tone: "neutral", icon: <Bot size={12} aria-hidden />, label: c.default, copyKey: "copy.ui1.chip.default" },
  { id: "uncertain", tone: "neutral", icon: <CircleHelp size={12} aria-hidden />, label: c.uncertain, copyKey: "copy.ui1.gallery.chips.uncertain (no COPY-UI1 row)" },
  { id: "in-progress", tone: "live", icon: NO_ICON, label: c.inProgress, copyKey: "copy.ui1.chip.inProgress" },
  { id: "recording", tone: "neutral", icon: <Mic size={12} aria-hidden />, label: c.recording, copyKey: "copy.ui1.gallery.chips.recording (no COPY-UI1 row)" },
  { id: "analyzed", tone: "neutral", icon: <Sparkles size={12} aria-hidden />, label: c.analyzed, copyKey: "copy.ui1.gallery.chips.analyzed (no COPY-UI1 row)" },
  { id: "human-conversation", tone: "neutral", icon: <UserRound size={12} aria-hidden />, label: c.humanConversation, copyKey: "copy.ui1.gallery.chips.humanConversation (no COPY-UI1 row)" },
  { id: "voicemail", tone: "neutral", icon: <Voicemail size={12} aria-hidden />, label: c.voicemail, copyKey: "copy.ui1.gallery.chips.voicemail (no COPY-UI1 row)" },
  { id: "rep-replied", tone: "blue", icon: <MessageSquareReply size={12} aria-hidden />, label: c.repReplied, copyKey: "copy.ui1.gallery.chips.repReplied (UI-4 preview)" },
];

export function ChipsSection() {
  return (
    <GallerySection id="chips" title={copy.ui1.gallery.sections.chips}>
      <p className="si-gallery__note">{c.draftNote}</p>
      <div className="si-gallery__grid">
        {CHIP_SAMPLES.map((sample) => (
          <Sample key={sample.id} copyKey={`${sample.copyKey} · ${c.tone} ${sample.tone}`}>
            <span data-chip={sample.id}>
              <Chip tone={sample.tone} icon={sample.icon}>
                {sample.label}
              </Chip>
            </span>
          </Sample>
        ))}
      </div>
    </GallerySection>
  );
}
