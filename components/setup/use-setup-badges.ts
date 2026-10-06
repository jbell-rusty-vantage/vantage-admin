"use client";
/**
 * Setup sub-navigation badges (doc 19): Lead sources = the "Things that need you" count, People = the "Not matched to a
 * person" count. Both come from reads the sections already make (the lead sources aggregate plus the Granot names and
 * inbound routes reads; the people join), so nothing new is polled: the queries share their keys with the sections and
 * TanStack dedupes them. A role that may not read a part gets no badge from it (a badge is a count, never a guess).
 */
import { useNeedsYou } from "./lead-sources/use-needs-you";
import { notMatchedCount } from "./people/people-model";
import { usePeople } from "./people/use-people";
import type { SetupBadgeCounts, SetupRole } from "./setup-sections";

export function useSetupBadges(role: SetupRole): SetupBadgeCounts {
  const needsYou = useNeedsYou(role !== null);
  const people = usePeople(role);
  return {
    needsYou: needsYou.count,
    notMatched: role === "owner" && !people.isPending ? notMatchedCount(people.model) : null,
  };
}
