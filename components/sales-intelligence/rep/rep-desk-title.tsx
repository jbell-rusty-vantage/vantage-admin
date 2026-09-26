"use client";
/**
 * The rep header's identity (2026-09-26): the rep's initials avatar (the same colour as on its cards, from the Agent id)
 * and `{Name}'s Desk`. The Agent's name lives on the main server; a rep can't read the Agent catalog, so it comes from
 * the rep's own Overview read (`reps[]`, scoped to the rep), which the Overview tab uses too. Until it arrives, or if it
 * can't be read, the title is `Your Desk` and the avatar shows the email's first letter.
 */
import { useQuery } from "@tanstack/react-query";
import { copy } from "../sales-intelligence-copy";
import { siKeys } from "../data/query-keys";
import { readOverview } from "../data/use-overview";
import { REP_INITIALS_COLOR, repColor, repInitials } from "../lib/rep-color";

const HEADER_PARAMS = {};

export function repDeskName(reps: readonly { agent: { id: string; name: string } }[] | undefined, agentId: string | null): string | null {
  if (!reps?.length) return null;
  const own = agentId ? reps.find((r) => r.agent.id === agentId) : undefined;
  return (own ?? (reps.length === 1 ? reps[0] : undefined))?.agent.name?.trim() || null;
}

export function RepDeskTitleView({ name, agentId, email }: { name: string | null; agentId: string | null; email: string }) {
  const s = copy.ui2.shell;
  const initials = name ? repInitials(name) : email.charAt(0).toUpperCase();
  return (
    <div className="si-root si-repdesk" data-rep-desk>
      <span
        className="si-repdesk__avatar"
        style={{ background: agentId ? repColor(agentId) : "#475569", color: REP_INITIALS_COLOR }}
        aria-hidden
      >
        {initials}
      </span>
      <span className="si-repdesk__text">
        <span className="si-repdesk__title">{name ? s.deskTitle(name) : s.deskTitleNoName}</span>
        <span className="si-repdesk__sub" data-rep-email>
          {s.subtitle(email)}
        </span>
      </span>
    </div>
  );
}

export function RepDeskTitle({ agentId, email }: { agentId: string | null; email: string }) {
  const { data } = useQuery({
    queryKey: siKeys.overview(HEADER_PARAMS),
    queryFn: ({ signal }) => readOverview(HEADER_PARAMS, signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
  return <RepDeskTitleView name={repDeskName(data?.data.reps, agentId)} agentId={agentId} email={email} />;
}
