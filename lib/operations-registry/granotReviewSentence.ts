export const BEST_RELOCATION_MOVE_TYPE_REVIEW =
  'Granot name "Best Relocation" will use Best Relocation → Web forms — local or long-distance based on the move, create a Lead only when no match exists, and send one confirmation text when a new Lead is created.';

export const TBM_PRIME_EXISTING_ONLY_REVIEW =
  'Granot name "TBM Forms Prime" connects to TBM Prime Leads → TBM Prime Forms. Vantage will use an existing Lead only. Customer text is off because this Granot name does not create Leads.';

export const TEXT_OFF_ON_POLICY_LEAVE =
  "Customer text will be turned off because this Granot name will no longer create Leads.";

export type GranotReviewInput = {
  granotName: string;
  leadSourceName: string;
  feedName?: string;
  routeKind: "one_feed" | "form_by_move_type";
  whenLeadArrives: "watch_only" | "existing_only" | "create_if_missing";
  textOn: boolean;
  leavingCreateIfMissing: boolean;
};

export function buildGranotReviewSentence(input: GranotReviewInput): {
  sentence: string;
  textOffWarning?: string;
} {
  if (
    input.granotName === "Best Relocation" &&
    input.leadSourceName === "Best Relocation" &&
    input.routeKind === "form_by_move_type" &&
    input.whenLeadArrives === "create_if_missing" &&
    input.textOn
  ) {
    return { sentence: BEST_RELOCATION_MOVE_TYPE_REVIEW };
  }
  if (
    input.granotName === "TBM Forms Prime" &&
    input.leadSourceName === "TBM Prime Leads" &&
    input.feedName === "TBM Prime Forms" &&
    input.routeKind === "one_feed" &&
    input.whenLeadArrives === "existing_only"
  ) {
    return { sentence: TBM_PRIME_EXISTING_ONLY_REVIEW };
  }

  const arrival =
    input.whenLeadArrives === "create_if_missing"
      ? "create a Lead only when no match exists"
      : input.whenLeadArrives === "existing_only"
        ? "Vantage will use an existing Lead only"
        : "Vantage will watch only";
  const text =
    input.whenLeadArrives === "create_if_missing" && input.textOn
      ? "and send one confirmation text when a new Lead is created"
      : "Customer text is off because this Granot name does not create Leads";
  const connection =
    input.routeKind === "form_by_move_type"
      ? `${input.leadSourceName} → Web forms — local or long-distance based on the move`
      : `${input.leadSourceName} → ${input.feedName ?? "the selected feed"}`;
  const sentence =
    input.routeKind === "form_by_move_type"
      ? `Granot name "${input.granotName}" will use ${connection}, ${arrival}, ${text}.`
      : `Granot name "${input.granotName}" connects to ${connection}. ${arrival}. ${text}.`;
  return {
    sentence,
    textOffWarning: input.leavingCreateIfMissing ? TEXT_OFF_ON_POLICY_LEAVE : undefined,
  };
}

export function normalizeNameReceivedFromGranot(raw: string): string {
  return raw.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
