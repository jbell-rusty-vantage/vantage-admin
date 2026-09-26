"use client";
/**
 * Outreach card layout §5 (D3, D4, D7): the assigned rep as an initials avatar and a short name, top-right in row A.
 * Reads `o.assignment.agent` (the field `whoText` reads); the colour comes from the Agent id, never the list order.
 */
import { copy } from "../sales-intelligence-copy";
import { REP_INITIALS_COLOR, repColor, repInitials, repShortName } from "../lib/rep-color";
import { useIsRep } from "../rep/viewer";
import type { CardOutreach } from "./card-lines";

const c = copy.ui1.card;

/** `Assigned to Jake Bell (from Granot)`: the avatar's `title` and `aria-label`. */
export function repAvatarLabel(o: CardOutreach, { rep = false }: { rep?: boolean } = {}): string {
  const agent = o.assignment.agent;
  if (!agent) return c.unassigned;
  const origin = o.assignment.origin ? (rep ? c.originForRep : c.origin)[o.assignment.origin] : undefined;
  return origin ? `${c.avatarLabel(agent.name)} ${origin}` : c.avatarLabel(agent.name);
}

export function RepAvatar({ o }: { o: CardOutreach }) {
  const rep = useIsRep();
  const agent = o.assignment.agent;
  const label = repAvatarLabel(o, { rep });
  if (!agent) {
    return (
      <span className="si-repavatar is-unassigned" data-rep="none" title={label}>
        <span className="si-repavatar__dot" aria-hidden />
        <span className="si-repavatar__name">{label}</span>
      </span>
    );
  }
  return (
    <span className="si-repavatar" data-rep={agent.id} title={label} role="img" aria-label={label}>
      <span className="si-repavatar__dot" style={{ background: repColor(agent.id), color: REP_INITIALS_COLOR }} aria-hidden>
        {repInitials(agent.name)}
      </span>
      <span className="si-repavatar__name" aria-hidden>
        {repShortName(agent.name)}
      </span>
    </span>
  );
}
