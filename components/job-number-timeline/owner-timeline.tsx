import type { ReactNode } from "react";
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
  Radio,
  Scale,
  UserPlus,
} from "lucide-react";
import {
  DEFAULT_TIMELINE_VIEW,
  isEnhancedJobTimelineEvent,
  type EnhancedJobTimelineEvent,
  type JobTimelineEvent,
  type JobTimelineEventKind,
  type StageAssessment,
  type TimelineActivity,
  type TimelineAttention,
  type TimelineDensityView,
} from "@/lib/api/jobNumberTimeline";
import { formatDateTime } from "@/components/data-table/formatters";
import { cn } from "@/lib/utils";
import { EvidenceDetails } from "./evidence-details";
import { CYCLE_STAGE, KIND_VISUAL } from "./kind-visual";
import {
  Timeline,
  TimelineContent,
  TimelineDot,
  TimelineHeading,
  TimelineItem,
  TimelineLine,
} from "./timeline";
import { buildSpineItems, eventVisibleInDensity, STAGE_COPY } from "./v2";

/**
 * v2 Owner story — 21st.dev clustered spine (not nyxbui Timeline 1074).
 * Generation: https://21st.dev/ai/6e776855-13dc-4091-bdd5-dc4562e66466
 * Prior: https://21st.dev/ai/dba79914-d479-4a56-9612-f47dea6cfda5
 *
 * v1 fixtures keep the existing flat cards. Headlines stay locked.
 */

const KIND_ICON: Record<JobTimelineEventKind, typeof UserPlus> = {
  source_received: Radio,
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
  source_received: ["ingress", "qualification_outcome", "status"],
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

const STATUS_CHIP = {
  completed: "bg-navy text-white",
  active: "bg-gold text-navy",
  pending: "bg-steel-100 text-navy",
  failed: "bg-steel text-white",
  informational: "bg-trust-blue/10 text-navy",
} as const;

const EVIDENCE_CHIP = {
  verified_change: "bg-navy text-white",
  official_record: "bg-gold text-navy",
  recorded_evidence: "bg-trust-blue text-white",
  external_acknowledgement: "bg-steel-100 text-navy",
  limitation: "bg-pale-gold text-navy",
} as const;

function asDetail(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  return null;
}

function supportingDetails(event: JobTimelineEvent): string[] {
  const details: string[] = [];
  for (const key of ALLOWED_DETAIL_KEYS[event.kind] ?? []) {
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

function EventCard({
  event,
  events,
  nested = false,
}: {
  event: EnhancedJobTimelineEvent;
  events: EnhancedJobTimelineEvent[];
  nested?: boolean;
}) {
  const visual = KIND_VISUAL[event.kind];
  const Icon = KIND_ICON[event.kind];

  return (
    <article
      className={cn(
        "rounded-xl border border-steel-200 bg-white shadow-sm border-l-[3px]",
        nested ? "p-3 shadow-none" : "p-4",
        visual.rail,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("flex size-6 items-center justify-center rounded-full", visual.icon)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h4 className="text-sm font-semibold text-navy">{event.headline}</h4>
        </div>
        <div className="flex flex-wrap gap-1">
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              STATUS_CHIP[event.status],
            )}
          >
            {event.status}
          </span>
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              EVIDENCE_CHIP[event.evidence_level],
            )}
          >
            {event.evidence_level.replaceAll("_", " ")}
          </span>
        </div>
      </div>
      {event.summary ? <p className="mt-2 text-sm text-steel">{event.summary}</p> : null}
      <p className="mt-1 text-xs text-steel">
        <time dateTime={event.time.occurred_at}>{formatDateTime(event.time.occurred_at)}</time>
      </p>
      <EvidenceDetails event={event} events={events} />
    </article>
  );
}

function SpineRail({
  isLast,
  iconClass,
  children,
}: {
  isLast: boolean;
  iconClass: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex justify-center" aria-hidden="true">
      {isLast ? null : <span className="absolute top-3 bottom-[-1.5rem] w-px bg-steel-200" />}
      <span className={cn("relative z-10 mt-1 flex size-5 items-center justify-center rounded-full", iconClass)}>
        {children}
      </span>
    </div>
  );
}

function EnhancedOwnerTimeline({
  events,
  activities,
  view,
  attention,
  stages,
}: {
  events: EnhancedJobTimelineEvent[];
  activities: TimelineActivity[];
  view: TimelineDensityView;
  attention: TimelineAttention[];
  stages: StageAssessment[];
}) {
  const visible = events.filter((event) => eventVisibleInDensity(event, view, attention, stages));
  const items = buildSpineItems(visible, activities, { cluster: view === "lifecycle" });

  return (
    <ol className="relative m-0 list-none p-0" aria-label="Job Number lifecycle story">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        if (item.type === "cluster") {
          const Icon = GitBranch;
          const firstStage = item.children[0]?.stage;
          return (
            <li
              key={item.activity.activity_id}
              className="relative grid grid-cols-[5.5rem_1.25rem_1fr] gap-x-3 pb-6"
            >
              <time
                dateTime={item.activity.started_at}
                className="pt-1 text-right font-mono text-[11px] tabular-nums text-steel"
              >
                {formatDateTime(item.activity.started_at)}
              </time>
              <SpineRail isLast={isLast} iconClass="bg-navy text-white">
                <Icon className="h-3 w-3" />
              </SpineRail>
              <div>
                {firstStage ? (
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-steel">
                    {STAGE_COPY[firstStage]}
                  </p>
                ) : null}
                <h3 className="text-sm font-semibold text-navy">{item.activity.heading}</h3>
                <p className="mt-0.5 text-xs text-steel">{item.children.length} steps</p>
                <ol className="relative mt-3 ml-0 list-none border-l border-steel-200 pl-4">
                  {item.children.map((child) => (
                    <li key={child.id} className="relative pb-3 last:pb-0">
                      <span
                        className="absolute -left-[calc(1rem+1px)] top-3 size-2 rounded-full bg-steel-200"
                        aria-hidden="true"
                      />
                      <EventCard event={child} events={events} nested />
                    </li>
                  ))}
                </ol>
              </div>
            </li>
          );
        }

        const visual = KIND_VISUAL[item.event.kind];
        const Icon = KIND_ICON[item.event.kind];
        const previous = items[index - 1];
        const previousStage = previous?.type === "event"
          ? previous.event.stage
          : previous?.children[0]?.stage;
        const showStage = item.event.stage !== previousStage;

        return (
          <li
            key={item.event.id}
            className="relative grid grid-cols-[5.5rem_1.25rem_1fr] gap-x-3 pb-6"
          >
            <time
              dateTime={item.event.time.occurred_at}
              className="pt-1 text-right font-mono text-[11px] tabular-nums text-steel"
            >
              {formatDateTime(item.event.time.occurred_at)}
            </time>
            <SpineRail isLast={isLast} iconClass={visual.icon}>
              <Icon className="h-3 w-3" />
            </SpineRail>
            <div>
              {showStage ? (
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-steel">
                  {STAGE_COPY[item.event.stage]}
                </p>
              ) : null}
              <EventCard event={item.event} events={events} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function V1OwnerTimeline({ events }: { events: JobTimelineEvent[] }) {
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

export function OwnerTimeline({
  events,
  activities = [],
  view = DEFAULT_TIMELINE_VIEW,
  attention = [],
  stages = [],
}: {
  events: JobTimelineEvent[];
  activities?: TimelineActivity[];
  view?: TimelineDensityView;
  attention?: TimelineAttention[];
  stages?: StageAssessment[];
}) {
  if (events.length > 0 && events.every(isEnhancedJobTimelineEvent)) {
    return (
      <EnhancedOwnerTimeline
        events={events}
        activities={activities}
        view={view}
        attention={attention}
        stages={stages}
      />
    );
  }

  return <V1OwnerTimeline events={events} />;
}
