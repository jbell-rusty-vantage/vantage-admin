"use client";

import { PhoneCall, PhoneOff, PhoneOutgoing } from "lucide-react";
import type { Outreach } from "@/lib/api/salesIntelligence";
import { Badge, type Tone } from "./atoms/badge";
import { TooltipCard } from "./atoms/tooltip-card";
import { copy } from "./sales-intelligence-copy";
import { formatDateTime } from "./lib/format";
import { callProgressOf, callStateOf, type CallState } from "./lib/owner-now";

const icon = { not_started: PhoneOutgoing, in_progress: PhoneCall, ended: PhoneOff } as const;
const tone: Record<CallState, Tone> = { not_started: "neutral", in_progress: "green", ended: "blue" };

function headline(state: CallState, progress: ReturnType<typeof callProgressOf>) {
  if (state === "in_progress") {
    return progress ? copy.call.inProgressSince(formatDateTime(progress.started_at)) : copy.call.inProgress;
  }
  if (state === "ended") {
    return progress?.ended_at ? copy.call.endedAt(formatDateTime(progress.ended_at)) : copy.call.ended;
  }
  return copy.call.notStarted;
}

const soWhat: Record<CallState, string> = {
  not_started: copy.call.notStartedSoWhat,
  in_progress: copy.call.startExplain,
  ended: copy.call.endExplain,
};

/** The state the Owner reads first: is anyone on this call right now. */
export function CallStateBadge({ record }: { record?: Outreach | null }) {
  const state = callStateOf(record);
  const progress = callProgressOf(record);
  const Icon = icon[state];
  const short = state === "in_progress" ? copy.call.inProgress : state === "ended" ? copy.call.ended : copy.call.notStarted;
  return (
    <TooltipCard
      title={short}
      guideTopic="call"
      label={
        <Badge tone={tone[state]} icon={<Icon size={12} aria-hidden />}>
          {state === "in_progress" ? (
            <span className="si-callstate__live">
              <span className="si-dot si-dot--green si-dot--pulse" aria-hidden />
              {headline(state, progress)}
            </span>
          ) : (
            headline(state, progress)
          )}
        </Badge>
      }
    >
      {soWhat[state]} {copy.call.notRecording}
    </TooltipCard>
  );
}

/** Who started it, who ended it, and whether the observed call closed it out. */
export function CallStateLine({ record }: { record?: Outreach | null }) {
  const progress = callProgressOf(record);
  if (!progress) return null;
  const who = [
    progress.started_by ? copy.call.startedBy(progress.started_by) : null,
    progress.ended_by ? copy.call.endedBy(progress.ended_by) : null,
  ].filter(Boolean).join(" · ");
  return (
    <div className="si-callstate__meta">
      {who && <span className="si-text--sm si-text--subtle">{who}</span>}
      {progress.note && <span className="si-text--sm">{progress.note}</span>}
    </div>
  );
}
