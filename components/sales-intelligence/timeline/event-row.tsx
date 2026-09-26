/**
 * UI1-TL: one timeline row (UI-0 §7.4): a 28 px icon circle, the title (14/600), the description (13), the exact time
 * right-aligned, then the detail line, the actor word, `Recorded {t}` / `Recovered {date}`, the action, and the chips.
 * Every word about the event is the server's; the row formats and never derives a state (UI-0 §2.1).
 */
import { Mic, Sparkles, UserRound, Voicemail, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { createElement } from "react";
import type { TimelineEvent } from "@/lib/api/salesIntelligence";
import { Chip, SkeletonLines, TimeText } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { useIsRep } from "../rep/viewer";
import { cx } from "../lib/format";
import { etDateKey, formatDate, formatExactFull } from "../lib/time";
import { eventAction, eventDetail, eventIcon, hasKindEntry, kindEntry } from "./event-kinds";

const t = copy.ui1.timeline;

/** UI-0 §7.2 icons for the server's chip words; any other chip is shown as sent with no icon. */
const CHIP_ICONS: Record<string, LucideIcon> = {
  Recording: Mic,
  Analyzed: Sparkles,
  "Human conversation": UserRound,
  Voicemail: Voicemail,
};

/** `actor.name`, else the actor kind's word (SERVER-STATE "Timeline": null name → the kind's word). */
export function actorText(item: TimelineEvent, rep = false): string | null {
  const actor = item.actor;
  if (!actor) return null;
  // V-UI2: the Owner's actor word is `You`; a rep reads it as the Owner.
  if (rep && actor.kind === "owner" && !actor.name?.trim()) return copy.ui2.nudges.from;
  return actor.name?.trim() || t.actor[actor.kind] || null;
}

/** `Recovered {date}` for a recovered call (G4), else `Recorded {t}` only when the server says `recorded_late`. */
export function observedNote(item: TimelineEvent): { kind: "recovered" | "recorded"; at: string } | null {
  const recovery = (item.detail as Record<string, unknown> | undefined)?.capture_recovery;
  const recoveredAt = recovery && typeof recovery === "object" ? (recovery as Record<string, unknown>).at : null;
  if (item.call?.observed_reason === "recovered" && typeof recoveredAt === "string" && recoveredAt) return { kind: "recovered", at: recoveredAt };
  if (item.recorded_late) return { kind: "recorded", at: item.observed_at };
  return null;
}

function ObservedNote({ item, asOf }: { item: TimelineEvent; asOf: string }) {
  const note = observedNote(item);
  if (!note) return null;
  if (note.kind === "recorded") return <TimeText t={note.at} asOf={asOf} mode="exact" prefix={t.recorded} className="si-timeline__observed" />;
  const exact = formatExactFull(note.at);
  return (
    <time dateTime={note.at} title={exact} aria-label={`${t.recovered} ${exact}`} className="si-time si-timeline__observed">
      {t.recoveredAt(formatDate(etDateKey(note.at), asOf))}
    </time>
  );
}

export type EventRowProps = { item: TimelineEvent; asOf: string; compact?: boolean };

export function EventRow({ item, asOf, compact = false }: EventRowProps) {
  const icon = createElement(eventIcon(item), { size: 14 });
  const known = hasKindEntry(item.kind);
  const title = item.title?.trim() || item.description;
  const description = item.title?.trim() ? item.description : null;
  const detail = compact ? null : eventDetail(item);
  const action = eventAction(item);
  const actor = actorText(item, useIsRep());
  const inProgress = item.kind === "call" && item.call?.in_progress === true;
  const chips = item.chips ?? [];
  const pending = kindEntry(item.kind).pending;
  return (
    <li className={cx("si-timeline__row", compact && "is-compact", item.routine && "is-routine")} data-kind={item.kind} data-known={known ? "1" : "0"} data-event-id={item.id} data-pending={pending ? "1" : undefined}>
      <span className="si-timeline__icon" aria-hidden>
        {icon}
      </span>
      <div className="si-timeline__body">
        <p className="si-timeline__title">
          {item.job_no ? <span className="si-timeline__job">{t.jobPrefix(item.job_no)}</span> : null}
          {title}
        </p>
        {description && <p className="si-timeline__desc">{description}</p>}
        {detail ? <p className="si-timeline__detail">{detail}</p> : null}
        {(actor || observedNote(item) || action) && (
          <p className="si-timeline__meta">
            {actor && (
              <span className="si-timeline__actor">
                <span className="si-sr">{t.actorLabel} </span>
                {actor}
              </span>
            )}
            <ObservedNote item={item} asOf={asOf} />
            {action && (
              <Link className="si-timeline__action" href={action.href} data-action={action.kind}>
                {action.label}
              </Link>
            )}
          </p>
        )}
        {(inProgress || chips.length > 0) && (
          <span className="si-timeline__chips">
            {inProgress && (
              <Chip tone="live" icon={null}>
                {t.inProgress}
              </Chip>
            )}
            {chips.map((chip) => {
              const ChipIcon = CHIP_ICONS[chip];
              return (
                <Chip key={chip} icon={ChipIcon ? <ChipIcon size={12} aria-hidden /> : null}>
                  {chip}
                </Chip>
              );
            })}
          </span>
        )}
      </div>
      <TimeText t={item.happened_at} asOf={asOf} mode="exact" className="si-timeline__time" />
    </li>
  );
}

/** A skeleton row: the icon circle and two text lines. */
export function EventRowSkeleton({ widths = ["62%", "84%"] }: { widths?: string[] }) {
  return (
    <li className="si-timeline__row is-skeleton" aria-hidden>
      <span className="si-timeline__icon si-skeleton" />
      <div className="si-timeline__body">
        <SkeletonLines lines={2} widths={widths} />
      </div>
      <span className="si-timeline__time">
        <SkeletonLines lines={1} widths={[72]} />
      </span>
    </li>
  );
}
