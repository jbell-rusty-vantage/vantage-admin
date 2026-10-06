"use client";
/**
 * The shared Lead picker (doc 06): one search box (the Leads classifier), the scope chips, compact lead cards with
 * the confidence badge and the Form submitted ⇄ Granot chip, one Choose per card, and the reason box only when the
 * chosen lead is out of scope. UI only: the candidate endpoints are the existing ones (see `leadPickerEndpoint`).
 *
 * Entry points: the finish sheet's Change customer passes `caseId`; connecting an existing booking passes
 * `bookingId`. Its booking mode (the Record a cancellation sheet: same search box and classifier, active bookings
 * only) is `components/cancellations/booking-picker.tsx`.
 */
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { FileText, Phone } from "lucide-react";
import { candidateLeadName } from "@/components/granot-lifecycle/candidate-lead-facts";
import { formatPhone } from "@/components/ui/crm/format";
import { Chip, EvidenceChip, IconBadge, Pill, ReadFailure, SearchBox } from "@/components/ui/crm/primitives";
import {
  fetchConnectLeadCandidates,
  fetchGranotLifecycleCandidates,
  type GranotLifecycleCandidateItem,
  type GranotLifecycleCandidatePage,
} from "@/lib/api/granotLifecycle";
import { contactSyncChip } from "@/lib/api/bookingsToFinish";
import { queryKeys } from "@/lib/query/keys";
import {
  choiceProblem,
  LEAD_PICKER_COPY as COPY,
  LEAD_PICKER_DEFAULT_SCOPE,
  leadNeedsReason,
  leadPickerEndpoint,
  leadPickerQuery,
  leadPickerShowsScope,
  OVERRIDE_REASON_MAX,
  type LeadPickerScope,
} from "./lead-picker-copy";

export type LeadChoice = {
  candidate: GranotLifecycleCandidateItem;
  /** Present only when the lead is out of scope; 10 to 500 characters, trimmed. */
  overrideReason?: string;
};

export type LeadPickerProps = {
  /** An intake case: reads `fetchGranotLifecycleCandidates`, with the scope chips. */
  caseId?: string;
  /** An existing booking with no case: reads `fetchConnectLeadCandidates`. */
  bookingId?: string;
  jobNo?: string;
  sourceKey?: string;
  onChoose: (choice: LeadChoice) => void;
  /** Lead ids to leave out (the one already chosen). */
  excludeIds?: readonly string[];
  /** The lead already chosen, shown as "Chosen" instead of a Choose button. */
  chosenId?: string;
  onCancel?: () => void;
};

const PAGE_SIZE = 25;
const keyOf = (candidate: GranotLifecycleCandidateItem) => `${candidate.lead_ref.model}:${candidate.lead_ref.id}`;

function sourceText(candidate: GranotLifecycleCandidateItem): string {
  const company = candidate.source?.source_company_label ?? candidate.source?.lead_source_company;
  const feed = candidate.source?.source_granularity_label ?? candidate.source?.source_granularity_id;
  return [company, feed].filter(Boolean).join(" › ");
}

export function LeadPicker({ caseId, bookingId, onChoose, excludeIds, chosenId, onCancel }: LeadPickerProps) {
  const endpoint = leadPickerEndpoint({ caseId, bookingId });
  const showScope = leadPickerShowsScope(endpoint);
  const [q, setQ] = useState<string | null>(null);
  const [scope, setScope] = useState<LeadPickerScope>(LEAD_PICKER_DEFAULT_SCOPE);
  const [pending, setPending] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const query = leadPickerQuery(q);
  const filters = { ...(showScope ? { scope } : {}), q: query, limit: PAGE_SIZE };
  const results = useInfiniteQuery<GranotLifecycleCandidatePage>({
    queryKey: [
      ...(endpoint === "case-candidates"
        ? queryKeys.granotLifecycle.candidates(caseId ?? "", filters)
        : queryKeys.granotLifecycle.connectCandidates(bookingId ?? "", filters)),
      "picker",
    ],
    enabled: endpoint !== "none",
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const base = { q: query, limit: PAGE_SIZE, cursor: pageParam as string | undefined };
      return endpoint === "case-candidates"
        ? fetchGranotLifecycleCandidates(caseId ?? "", { ...base, scope })
        : fetchConnectLeadCandidates(bookingId ?? "", base);
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const excluded = new Set(excludeIds ?? []);
  const items = (results.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => !excluded.has(item.lead_ref.id));

  const choose = (candidate: GranotLifecycleCandidateItem) => {
    if (leadNeedsReason(candidate)) {
      setPending(keyOf(candidate));
      setReason("");
      return;
    }
    onChoose({ candidate });
  };

  const confirmWithReason = (candidate: GranotLifecycleCandidateItem) => {
    if (choiceProblem(candidate, reason)) return;
    onChoose({ candidate, overrideReason: reason.trim() });
    setPending(null);
    setReason("");
  };

  return (
    <section className="crm-stack" aria-label={COPY.title} data-testid="lead-picker">
      <div className="crm-toolbar">
        <div style={{ flex: 1, minWidth: 220 }}>
          <SearchBox value={q} onSearch={setQ} placeholder={COPY.searchPlaceholder} hint={results.isFetching ? COPY.searching : undefined} />
        </div>
        {onCancel ? (
          <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={onCancel}>
            {COPY.cancel}
          </button>
        ) : null}
      </div>

      {showScope ? (
        <div className="crm-chips" role="group" aria-label={COPY.scopeLabel}>
          <Chip active={scope === "source"} onClick={() => setScope("source")}>
            {COPY.scopeSource}
          </Chip>
          <Chip active={scope === "all"} onClick={() => setScope("all")}>
            {COPY.scopeAll}
          </Chip>
        </div>
      ) : null}
      {showScope && scope === "all" ? (
        <p className="crm-subtitle" role="note">
          {COPY.outsideSourceWarning}
        </p>
      ) : null}

      {results.isError ? <ReadFailure what={COPY.loadFailed} error={results.error} onRetry={() => void results.refetch()} /> : null}
      {results.isPending && endpoint !== "none" ? <p className="crm-subtitle" role="status">{COPY.searching}</p> : null}
      {results.isSuccess && items.length === 0 ? <p className="crm-subtitle">{COPY.empty}</p> : null}

      {items.map((candidate) => {
        const key = keyOf(candidate);
        const chip = contactSyncChip(candidate);
        const phone = formatPhone(candidate.contact?.phone_number);
        const email = candidate.contact?.email?.trim();
        const source = sourceText(candidate);
        const asking = pending === key;
        const reasonProblem = asking ? choiceProblem(candidate, reason) : undefined;
        return (
          <article key={key} className="crm-card crm-record" data-testid="lead-picker-card" data-lead-id={candidate.lead_ref.id}>
            <IconBadge icon={candidate.lead_ref.model === "CallLead" ? Phone : FileText} size="sm" />
            <div className="crm-record__body">
              <div className="crm-record__line crm-record__line--top">
                <span className="crm-record__name">{candidateLeadName(candidate)}</span>
                <Pill variant={candidate.confidence === "high" ? "green" : "amber"}>
                  {candidate.confidence === "high" ? COPY.strong : COPY.possible}
                </Pill>
                {source ? <span className="crm-record__source">{source}</span> : null}
              </div>
              <div className="crm-record__line">
                {phone || email ? (
                  <span>{[phone, email].filter(Boolean).join(" · ")}</span>
                ) : (
                  <span className="crm-subtitle" style={{ margin: 0 }}>{COPY.noPhoneOrEmail}</span>
                )}
                <span className="crm-record__right">{candidate.lead_ref.model === "CallLead" ? COPY.phoneCall : COPY.webForm}</span>
              </div>
              <div className="crm-record__line crm-record__line--evidence">
                <EvidenceChip state={candidate.in_source_scope ? "ok" : "warn"}>
                  {candidate.in_source_scope ? COPY.sameSource : COPY.otherSource}
                </EvidenceChip>
                {chip ? <EvidenceChip state={chip.state}>{chip.text}</EvidenceChip> : null}
              </div>

              {asking ? (
                <div className="crm-stack">
                  <label className="crm-subtitle" htmlFor={`lead-picker-reason-${key}`} style={{ margin: 0, fontWeight: 700 }}>
                    {COPY.reasonLabel}
                  </label>
                  <p className="crm-subtitle" style={{ margin: 0 }}>{COPY.reasonHint}</p>
                  <textarea
                    id={`lead-picker-reason-${key}`}
                    className="crm-input"
                    rows={3}
                    maxLength={OVERRIDE_REASON_MAX}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <div className="crm-record__actions" style={{ justifyContent: "flex-start" }}>
                    <button
                      type="button"
                      className="crm-button crm-button--primary crm-button--sm"
                      disabled={reasonProblem !== undefined}
                      title={reasonProblem}
                      onClick={() => confirmWithReason(candidate)}
                    >
                      {COPY.reasonChoose}
                    </button>
                    <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={() => setPending(null)}>
                      {COPY.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="crm-record__actions">
                  {chosenId === candidate.lead_ref.id ? (
                    <Pill variant="blue">{COPY.chosen}</Pill>
                  ) : (
                    <button type="button" className="crm-button crm-button--primary crm-button--sm" onClick={() => choose(candidate)}>
                      {COPY.choose}
                    </button>
                  )}
                </div>
              )}
            </div>
          </article>
        );
      })}

      {results.hasNextPage ? (
        <button type="button" className="crm-button crm-button--quiet" disabled={results.isFetchingNextPage} onClick={() => void results.fetchNextPage()}>
          {COPY.showMore}
        </button>
      ) : null}
    </section>
  );
}
