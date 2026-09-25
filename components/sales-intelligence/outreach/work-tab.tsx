"use client";
/**
 * UI1-SHELL: the Work tab (UI-1 §5.4), built from the kept pieces. Each part is its own region (UI-0 §2.4):
 * 1. Follow-ups from `outreach.followups[]` (`FollowupsSection` in the adapted `outreach-detail.tsx`): status, origin,
 *    due, `Try again ({attempt} of 2)`, `Replaced by a specific plan`, disposition, and each follow-up's own commands.
 * 2. Owner corrections (`owner_instructions[]`).
 * 3. Open review items (the kept `review-items.tsx`).
 * 4. Contact restrictions (the kept `restrictions.tsx`, from the Number read).
 * 5. Attachments, read-only; the connected Number links out to the legacy Numbers view (`legacyNumberHref`).
 * 6. Messages to the rep: the history plus the inline composer (`MessageRepPanel` mode `inline`, UI1-CHAT).
 * Every read refetches in place from its live topic (`outreach`, `number`, `review`, `nudge`, `attachment`).
 *
 * UI2-SCOPE + UI2-FOLLOWUP (UI-2 §3–§4, A04): a rep's Work tab is the follow-ups with the rep's own actions
 * (`RepFollowups`) and nothing else. Owner corrections, review items, restrictions (`GET /numbers/:id`), attachments and
 * the Message rep history and composer (`GET /nudges`, `GET /reps`) are Owner-only and never mount for a rep.
 * (`Messages from the Owner`, UI2-NUDGES, joins after CF12.)
 */
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { numberSchema, readSalesIntelligence, type OwnerInstruction } from "@/lib/api/salesIntelligence";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { Attachments } from "../attachments";
import { MessageRepPanel } from "../composer";
import { siKeys } from "../data/query-keys";
import { useOutreach } from "../data/use-outreach";
import { legacyNumberHref } from "../lib/legacy-links";
import { label } from "../lib/format";
import { FollowupsSection } from "../outreach-detail";
import { Region, RegionProgress, SkeletonBlock, SkeletonLines, TimeText } from "../primitives";
import { Restrictions } from "../restrictions";
import { ReviewItems } from "../review-items";
import { copy } from "../sales-intelligence-copy";
import { RepFollowups } from "../rep/followup-actions";
import { useIsRep } from "../rep/viewer";
import { numberIdOf, subjectKeyOf } from "./record-header";

const w = copy.ui1.outreach.work;

/** The short text of a correction's `current` value, when it carries one (`note`, `reason`, `text`, `value`, `description`). */
export function instructionText(current: unknown): string | null {
  if (!current || typeof current !== "object") return typeof current === "string" && current ? current : null;
  for (const key of ["note", "reason", "text", "description", "value"]) {
    const value = (current as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

/** Owner corrections on this record, newest first as the server sends them. */
export function CorrectionsView({ items, asOf }: { items: readonly OwnerInstruction[]; asOf: string }) {
  return (
    <section className="si-local-stack" aria-label={w.correctionsTitle}>
      <h3 className="si-heading si-heading--3">{w.correctionsTitle}</h3>
      {!items.length && <p className="si-time is-null">{w.noCorrections}</p>}
      {!!items.length && (
        <ul className="si-work__list">
          {items.map((item) => {
            const text = instructionText(item.current);
            return (
              <li key={item.instruction_id} className="si-work__item" data-instruction-field={item.field}>
                <span>{w.instructionLine(w.instructionField[item.field] ?? label(item.field), label(item.state))}</span>
                {" · "}
                <TimeText t={item.happened_at} asOf={asOf} mode="exact" />
                {text && <p className="si-text--sm">{text}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FollowupsLive({ id }: { id: string }) {
  const { outreach, asOf, isRefetching } = useOutreach(id);
  return (
    <>
      <RegionProgress active={isRefetching} />
      <FollowupsSection record={outreach} asOf={asOf} />
    </>
  );
}

function CorrectionsLive({ id }: { id: string }) {
  const { ownerInstructions, asOf } = useOutreach(id);
  return <CorrectionsView items={ownerInstructions} asOf={asOf} />;
}

function ReviewLive({ id }: { id: string }) {
  const { outreach } = useOutreach(id);
  return <ReviewItems subjectKey={subjectKeyOf(outreach)} />;
}

function RestrictionsForNumber({ numberId }: { numberId: string }) {
  const { data, isRefetching } = useSuspenseQuery({
    queryKey: [...salesIntelligenceKeys.all, "number", numberId],
    queryFn: ({ signal }) => readSalesIntelligence(`numbers/${encodeURIComponent(numberId)}`, numberSchema, signal),
    retry: false,
  });
  return (
    <>
      <RegionProgress active={isRefetching} />
      <Restrictions rows={data.data.restrictions} />
    </>
  );
}

function RestrictionsLive({ id }: { id: string }) {
  const { outreach } = useOutreach(id);
  const numberId = numberIdOf(outreach);
  if (!numberId) return <p className="si-time is-null">{w.restrictionsNoNumber}</p>;
  return <RestrictionsForNumber numberId={numberId} />;
}

function AttachmentsLive({ id, returnTo }: { id: string; returnTo: string }) {
  const { outreach } = useOutreach(id);
  const lead = outreach.subject.kind === "lead" ? { model: outreach.subject.model, id: outreach.subject.id } : undefined;
  const numberId = lead ? undefined : numberIdOf(outreach) ?? undefined;
  if (!lead && !numberId) return null;
  return (
    <>
      <Attachments lead={lead} numberId={numberId} returnTo={returnTo} readOnly numberHref={legacyNumberHref} />
      <p className="si-text--sm si-text--subtle">{w.attachmentsReadOnly}</p>
    </>
  );
}

function MessagesLive({ id }: { id: string }) {
  const { outreach, asOf } = useOutreach(id);
  return <MessageRepPanel outreach={outreach} asOf={asOf} mode="inline" />;
}

const lines = (n: number) => <SkeletonLines lines={n} widths={["70%", "56%", "64%", "48%"].slice(0, n)} />;

export function WorkTabSkeleton() {
  return (
    <div className="si-work" aria-hidden>
      <SkeletonBlock height={120} />
      {lines(3)}
      {lines(2)}
    </div>
  );
}

function RepFollowupsLive({ id }: { id: string }) {
  const { outreach, asOf, isRefetching } = useOutreach(id);
  return (
    <>
      <RegionProgress active={isRefetching} />
      <RepFollowups record={outreach} asOf={asOf} />
    </>
  );
}

/** The rep's Work tab: the follow-ups region only (every other region reads an Owner-only route). */
function RepWorkTab({ id }: { id: string }) {
  const client = useQueryClient();
  return (
    <div className="si-work" data-tab="work" data-viewer="rep">
      <Region name="work-followups" skeleton={<SkeletonBlock height={120} />} onRetry={() => void client.resetQueries({ queryKey: siKeys.outreach(id) })}>
        <RepFollowupsLive id={id} />
      </Region>
    </div>
  );
}

export function WorkTab({ id, returnTo }: { id: string; returnTo: string }) {
  return useIsRep() ? <RepWorkTab id={id} /> : <OwnerWorkTab id={id} returnTo={returnTo} />;
}

function OwnerWorkTab({ id, returnTo }: { id: string; returnTo: string }) {
  const client = useQueryClient();
  const retryOutreach = () => void client.resetQueries({ queryKey: siKeys.outreach(id) });
  const retryNumber = () => void client.resetQueries({ queryKey: [...salesIntelligenceKeys.all, "number"] });
  return (
    <div className="si-work" data-tab="work">
      <Region name="work-followups" skeleton={<SkeletonBlock height={120} />} onRetry={retryOutreach}>
        <FollowupsLive id={id} />
      </Region>
      <Region name="work-corrections" skeleton={lines(2)} onRetry={retryOutreach}>
        <CorrectionsLive id={id} />
      </Region>
      <Region name="work-review" skeleton={lines(2)} onRetry={retryOutreach}>
        <ReviewLive id={id} />
      </Region>
      <Region name="work-restrictions" skeleton={lines(2)} onRetry={retryNumber}>
        <RestrictionsLive id={id} />
      </Region>
      <Region name="work-attachments" skeleton={lines(3)} onRetry={retryOutreach}>
        <AttachmentsLive id={id} returnTo={returnTo} />
      </Region>
      <section className="si-work__messages" aria-labelledby="si-work-messages">
        <h3 id="si-work-messages" className="si-heading si-heading--3">{w.messagesTitle}</h3>
        <Region name="work-messages" skeleton={lines(4)} onRetry={retryOutreach}>
          <MessagesLive id={id} />
        </Region>
      </section>
    </div>
  );
}

WorkTab.Skeleton = WorkTabSkeleton;
