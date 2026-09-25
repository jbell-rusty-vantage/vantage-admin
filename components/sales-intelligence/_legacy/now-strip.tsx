"use client";

import type { NumberRead, Outreach } from "@/lib/api/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { bandLabel, cx, formatDateTime, label } from "../lib/format";
import { ClassificationBadge, EligibilityBadge, JustUpdated } from "../chrome";
import { OwnershipSplit } from "../ownership";
import { RelatedRecordChips } from "../related-record-chips";
import { CallStateBadge, CallStateLine } from "../call-state";
import { LeadProvenance } from "../lead-provenance";
import { LeadProgressLine } from "../lead-progress";
import { Button } from "../atoms/button";
import { TooltipCard } from "../atoms/tooltip-card";
import { commandLabels } from "../lib/commands";
import { callBlockerSentence, callBlockerText, callStateOf, offeredActions, splitCommands } from "../lib/owner-now";

type Availability = Outreach["allowed_actions"][number];

/** Orders the buttons the Owner sees. It does not rank the work — the server owns bands and clocks. */
function Command({
  item,
  record,
  variant,
  size,
  explain,
  onCommand,
}: {
  item: Availability;
  record?: Outreach | null;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  explain?: string;
  onCommand: (command: string) => void;
}) {
  const text = commandLabels[item.action];
  const blocked = !item.enabled;
  const why = blocked
    ? callBlockerSentence(item.action, record, item.blocker_codes, copy.call.blockers, copy.call.blockerCodes)
      || callBlockerText(item.blocker_codes, copy.call.blockerCodes)
      || copy.errors.loadFailed
    : explain;
  const button = (
    <Button variant={variant} size={size} disabled={blocked} onClick={() => onCommand(item.action)}>
      {text}
    </Button>
  );
  if (!why) return button;
  return <TooltipCard title={text} label={button}>{why}</TooltipCard>;
}

export function NowStrip({
  number,
  outreach,
  returnTo,
  title,
  ready = true,
  onCommand,
  onMessage,
  onOpenMatches,
}: {
  number?: NumberRead["data"];
  outreach?: Outreach | null;
  returnTo: string;
  title: string;
  ready?: boolean;
  onCommand?: (command: string) => void;
  onMessage?: () => void;
  onOpenMatches?: () => void;
}) {
  const action = outreach?.followups.find((item) => item.status === "open");
  const why = outreach?.derived.reasons[0]
    ? label(outreach.derived.reasons[0])
    : outreach?.derived.attention_band
      ? bandLabel(outreach.derived.attention_band)
      : copy.needsReview.title;
  const onTheCall = callStateOf(outreach) === "in_progress";
  const deck = outreach && onCommand ? splitCommands(offeredActions(outreach.allowed_actions), commandLabels) : null;
  return (
    <div className={cx("si-now", onTheCall && "si-now--live")}>
      <div className="si-now__identity">
        <h2 className="si-panel__title si-phone si-phone--lg">{title}</h2>
        <div className="si-chiprow">
          {number && <ClassificationBadge value={number.classification} />}
          {number && <EligibilityBadge value={number.eligibility} />}
          {outreach && <CallStateBadge record={outreach} />}
          <JustUpdated topics={["outreach", "attachment", "analysis", "number"]} />
        </div>
        <CallStateLine record={outreach} />
      </div>

      <div className="si-now__headline">
        <span className="si-ownership__label">{copy.panel.whyHere}</span>
        <p className={cx("si-now__reason", outreach?.derived.overdue && "is-danger")}>{why}</p>
        <p>
          {action
            ? `${label(action.kind)} · ${action.due_at ? copy.time.due(formatDateTime(action.due_at)) : copy.time.dueDateNeeded}`
            : copy.panel.noNextStep}
        </p>
        <LeadProgressLine record={outreach} />
        <OwnershipSplit
          promisedBy={action?.origin === "rep_promise" ? action.promised_by : undefined}
          assignedTo={action?.assignment.agent}
          overallOwner={outreach?.assignment.agent ?? null}
        />
      </div>

      {outreach && <LeadProvenance record={outreach} onOpenMatches={onOpenMatches} />}

      <RelatedRecordChips outreach={outreach} numberId={number?.id} returnTo={returnTo} ready={ready} />

      {deck && onCommand && (
        <div className="si-now__deck si-actions">
          <span className="si-ownership__label">{copy.now.decide}</span>
          <div className="si-actions__primary">
            {deck.call && (
              <Command
                item={deck.call}
                record={outreach}
                variant="primary"
                explain={deck.call.action === "end_call" ? copy.call.endExplain : copy.call.startExplain}
                onCommand={onCommand}
              />
            )}
            {deck.secondary.map((item) => (
              <Command key={item.action} item={item} record={outreach} size="sm" onCommand={onCommand} />
            ))}
            {onMessage && (
              <TooltipCard
                title={copy.messageRep.title}
                label={
                  <Button variant="ghost" size="sm" disabled={outreach?.state === "closed"} onClick={onMessage}>
                    {copy.messageRep.title}
                  </Button>
                }
              >
                {copy.commandExplain.message}
              </TooltipCard>
            )}
          </div>
          {!!deck.more.length && (
            <details className="si-now__more">
              <summary>{copy.now.moreActions}</summary>
              <div className="si-actions__secondary">
                {deck.more.map((item) => (
                  <Command key={item.action} item={item} record={outreach} variant="ghost" size="sm" onCommand={onCommand} />
                ))}
              </div>
            </details>
          )}
          {!deck.call && !deck.secondary.length && !deck.more.length && (
            <p className="si-text--subtle">{copy.now.noActions}</p>
          )}
          <p className="si-field__hint">{copy.now.primaryHint}</p>
        </div>
      )}
      {number && !outreach && <p className="si-text--subtle">{copy.panel.noOutreachOnNumber}</p>}
    </div>
  );
}
