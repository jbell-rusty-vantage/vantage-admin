"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchGranotLifecycleCandidates,
  type GranotLifecycleCandidateItem,
} from "@/lib/api/granotLifecycle";
import { queryKeys } from "@/lib/query/keys";
import { pickBestCandidate } from "./lead-candidate-browser";

/** Where the answer to "who is this booking for?" came from. */
export type MatchedLeadOrigin = "vantage_matched" | "owner_chose" | "none";

/** The one page of candidates the server already ranks; the search panel reuses this cache entry. */
export const RANKED_LEAD_FILTERS = { scope: "source" as const };
const RANKED_LEAD_PAGE_SIZE = 25;

export type MatchedLead = {
  /** The lead this booking will be filed under, or undefined while nothing matches. */
  lead?: GranotLifecycleCandidateItem;
  /** Whether Vantage found this lead or the Owner picked it. */
  origin: MatchedLeadOrigin;
  stillSearching: boolean;
  searchFailure?: string;
  chooseLead: (lead: GranotLifecycleCandidateItem) => void;
};

/**
 * Answers "who is this booking for?".
 *
 * The strongest lead the server ranked stands in as the answer until the Owner
 * picks someone else. The choice is derived while rendering, never assigned from
 * an effect, so a refreshed ranking can never quietly overwrite the Owner.
 */
export function useMatchedLead(
  caseId: string,
  /** A referral booking attaches no customer, so it never asks the question. */
  { askable = true }: { askable?: boolean } = {},
): MatchedLead {
  const [leadChosenByOwner, setLeadChosenByOwner] = useState<GranotLifecycleCandidateItem>();

  const rankedLeads = useQuery({
    queryKey: queryKeys.granotLifecycle.candidates(caseId, RANKED_LEAD_FILTERS),
    queryFn: () =>
      fetchGranotLifecycleCandidates(caseId, { ...RANKED_LEAD_FILTERS, limit: RANKED_LEAD_PAGE_SIZE }),
    enabled: Boolean(caseId) && askable,
  });

  const leadVantageMatched = pickBestCandidate(rankedLeads.data?.items);
  const lead = leadChosenByOwner ?? leadVantageMatched;

  return {
    lead,
    origin: !lead ? "none" : leadChosenByOwner ? "owner_chose" : "vantage_matched",
    stillSearching: askable && rankedLeads.isPending,
    searchFailure: rankedLeads.isError
      ? rankedLeads.error instanceof Error
        ? rankedLeads.error.message
        : "Unable to look for the matching customer."
      : undefined,
    chooseLead: setLeadChosenByOwner,
  };
}
