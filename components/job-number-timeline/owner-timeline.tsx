import {
  BookOpenCheck,
  ClipboardX,
  FileSpreadsheet,
  GitBranch,
  Inbox,
  KeyRound,
  MessageSquare,
  Pencil,
  Radar,
  Scale,
  UserPlus,
} from "lucide-react";
import type { JobTimelineEvent, JobTimelineEventKind } from "@/lib/api/jobNumberTimeline";
import { formatDateTime } from "@/components/data-table/formatters";
import { cn } from "@/lib/utils";
import { CYCLE_STAGE, KIND_VISUAL } from "./kind-visual";
import {
  Timeline,
  TimelineContent,
  TimelineDot,
  TimelineHeading,
  TimelineItem,
  TimelineLine,
} from "./timeline";

/**
 * Owner chain. Installed from 21st.dev Timeline (nyxbui / demo 1074) and
 * adapted with Chrono Board (demo 9216) card chrome + Vantage tokens.
 * Generation: https://21st.dev/ai/b92494f4-46ff-425c-b97a-d042290ce762
 *
 * Headlines stay locked. No customer contact on the row.
 */
const KIND_ICON: Record<JobTimelineEventKind, typeof UserPlus> = {
  lead_created: UserPlus,
  lead_message: MessageSquare,
  job_number_acquired: KeyRound,
  lead_updated: Pencil,
  granot_observation: Radar,
  synchronization_decision: Scale,
  booking_intake: Inbox,
  cancellation_intake: GitBranch,
  official_booking: BookOpenCheck,
  official_cancellation: ClipboardX,
  sheet_sync: FileSpreadsheet,
};

const ALLOWED_DETAIL_KEYS: Record<JobTimelineEventKind, string[]> = {
  lead_created: ["ingestion_origin", "command_name", "lead_model"],
  lead_message: ["origin", "purpose", "status", "skip_reason", "consent_basis"],
  job_number_acquired: ["acquired_at_create"],
  lead_updated: ["command_name"],
  granot_observation: ["route_event_class", "normalization_result"],
  synchronization_decision: ["outcome", "reason_code", "execution_mode", "attempt"],
  booking_intake: ["event", "state", "mode"],
  cancellation_intake: ["event", "state", "mode"],
  official_booking: [],
  official_cancellation: [],
  sheet_sync: ["status", "resource", "operation", "entity_model"],
};

function asDetail(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  return null;
}

function supportingDetails(event: JobTimelineEvent): string[] {
  const details: string[] = [];
  for (const key of ALLOWED_DETAIL_KEYS[event.kind]) {
    const text = asDetail(event.data?.[key]);
    if (!text) continue;
    if (key === "acquired_at_create") {
      details.push(event.data?.acquired_at_create ? "Present at create" : "Arrived after create");
      continue;
    }
    details.push(text);
  }
  return details;
}

export function OwnerTimeline({ events }: { events: JobTimelineEvent[] }) {
  return (
    <Timeline className="gap-y-1" aria-label="Job Number timeline">
      {events.map((event, index) => {
        const visual = KIND_VISUAL[event.kind];
        const Icon = KIND_ICON[event.kind];
        const stage = CYCLE_STAGE[event.kind];
        const previousStage = index > 0 ? CYCLE_STAGE[events[index - 1].kind].id : null;
        const showStage = stage.id !== previousStage;
        const details = supportingDetails(event);
        const isLast = index === events.length - 1;

        return (
          <TimelineItem key={event.id} status="done" className="pb-1">
            <TimelineHeading>{event.headline}</TimelineHeading>
            <TimelineDot
              status="custom"
              className={visual.icon}
              customIcon={<Icon className="h-3.5 w-3.5" />}
            />
            {isLast ? null : <TimelineLine done={false} />}
            <TimelineContent className="pb-4">
              {showStage ? (
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-steel">
                  {stage.label}
                </p>
              ) : null}
              <article
                className={cn(
                  "rounded-xl border border-steel-200 bg-white p-4 shadow-sm",
                  "border-l-[3px]",
                  visual.rail,
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      visual.chip,
                    )}
                  >
                    {visual.label}
                  </span>
                  <time className="text-xs text-steel" dateTime={event.event_at}>
                    {formatDateTime(event.event_at)}
                  </time>
                </div>
                {details.length > 0 ? (
                  <p className="mt-2 text-sm text-steel">{details.join(" · ")}</p>
                ) : null}
              </article>
            </TimelineContent>
          </TimelineItem>
        );
      })}
    </Timeline>
  );
}
