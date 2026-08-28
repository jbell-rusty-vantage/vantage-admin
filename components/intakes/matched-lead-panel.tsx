"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/data-table/status-badge";
import {
  CandidateLeadFacts,
  candidateLeadName,
  candidateMatchLabel,
} from "@/components/granot-lifecycle/candidate-lead-facts";
import { LeadCandidateBrowser } from "@/components/granot-lifecycle/lead-candidate-browser";
import type { MatchedLead } from "@/components/granot-lifecycle/use-matched-lead";
import {
  IntakeContactCycleLine,
  IntakeKnownContactsCards,
  IntakeKnownContactsChip,
} from "./intake-known-contacts";
import {
  BOOKING_INTAKE_STORY,
  matchConfidenceHint,
  matchConfidenceLabel,
  matchedCustomerOriginLabel,
  INTAKE_LEAD_OPTIONAL,
  noMatchedCustomerMessage,
} from "./intake-copy";

function HowToReach({ phone, email }: { phone?: string; email?: string }) {
  const ways = [phone, email].filter(Boolean);
  if (ways.length === 0) {
    return <p className="mt-1 text-sm text-muted-foreground">No phone or email on this lead.</p>;
  }
  return <p className="mt-1 text-sm text-navy">{ways.join(" · ")}</p>;
}

/**
 * Act two of the intake: the customer this booking gets filed under, how sure
 * Vantage is, and — folded away until asked — everything else on their lead.
 */
export function MatchedLeadPanel({
  matched,
  onFindDifferentCustomer,
  searchIsOpen,
}: {
  matched: MatchedLead;
  onFindDifferentCustomer?: () => void;
  searchIsOpen?: boolean;
}) {
  const { lead } = matched;
  const findAnotherLabel = lead
    ? "This is the wrong customer — find another"
    : "Search for the customer";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{BOOKING_INTAKE_STORY.whoThisIsFor.title}</CardTitle>
        <CardDescription>{BOOKING_INTAKE_STORY.whoThisIsFor.hint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {matched.searchFailure ? (
          <FeedbackMessage tone="error">{matched.searchFailure}</FeedbackMessage>
        ) : null}

        {lead ? (
          <div className="rounded-lg border-2 border-trust-blue bg-trust-blue/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold text-navy">{candidateLeadName(lead)}</p>
                <HowToReach phone={lead.contact?.phone_number} email={lead.contact?.email} />
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <IntakeKnownContactsChip item={lead} />
                <StatusBadge tone={lead.confidence === "high" ? "success" : "warning"}>
                  {matchConfidenceLabel(lead.confidence)}
                </StatusBadge>
                <StatusBadge tone="muted">{matchedCustomerOriginLabel(matched.origin)}</StatusBadge>
              </div>
            </div>

            <div className="mt-3">
              <IntakeContactCycleLine item={lead} />
            </div>
            <div className="mt-3">
              <IntakeKnownContactsCards item={lead} />
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              {matchConfidenceHint(lead.confidence)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Why it matched: {candidateMatchLabel(lead.match_method)}.
            </p>

            {lead.requires_override_reason ? (
              <FeedbackMessage tone="warning" className="mt-3">
                This customer came in through a different lead source than the one this job belongs
                to. You will have to write down why before the booking can be filed.
              </FeedbackMessage>
            ) : null}

            <details className="mt-4 rounded-md border bg-background">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-navy">
                Everything on this customer&apos;s lead
              </summary>
              <div className="border-t px-3 py-3">
                <CandidateLeadFacts item={lead} />
              </div>
            </details>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4">
            <p className="font-semibold text-navy">{INTAKE_LEAD_OPTIONAL.noStoredLeadTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {noMatchedCustomerMessage(matched.stillSearching)}
            </p>
          </div>
        )}

        {onFindDifferentCustomer && !searchIsOpen ? (
          <Button type="button" variant="outline" onClick={onFindDifferentCustomer}>
            {findAnotherLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Act two in full: the customer on the booking, plus the search that replaces
 * them. The search stays out of the way until the Owner says the match is wrong.
 */
export function MatchedCustomerSection({
  caseId,
  matched,
}: {
  caseId: string;
  matched: MatchedLead;
}) {
  const [searchIsOpen, setSearchIsOpen] = useState(false);
  return (
    <div className="space-y-5">
      <MatchedLeadPanel
        matched={matched}
        searchIsOpen={searchIsOpen}
        onFindDifferentCustomer={() => setSearchIsOpen(true)}
      />
      {searchIsOpen ? (
        <Card>
          <CardHeader>
            <CardTitle>{BOOKING_INTAKE_STORY.findAnotherCustomer.title}</CardTitle>
            <CardDescription>{BOOKING_INTAKE_STORY.findAnotherCustomer.hint}</CardDescription>
          </CardHeader>
          <CardContent>
            <LeadCandidateBrowser
              caseId={caseId}
              selected={matched.lead}
              heading={BOOKING_INTAKE_STORY.findAnotherCustomer.title}
              description={BOOKING_INTAKE_STORY.findAnotherCustomer.hint}
              onSelect={(lead) => {
                matched.chooseLead(lead);
                setSearchIsOpen(false);
              }}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
