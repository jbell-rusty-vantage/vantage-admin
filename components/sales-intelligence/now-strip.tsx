import type { AttentionRow, NumberRead, Outreach } from "@/lib/api/salesIntelligence";
import { copy } from "./sales-intelligence-copy";
import { bandLabel, formatDateTime, label } from "./lib/format";
import { ClassificationBadge, EligibilityBadge } from "./chrome";
import { OwnershipSplit } from "./ownership";
import { RelatedRecordChips } from "./related-record-chips";
import { Button } from "./atoms/button";
import { TooltipCard } from "./atoms/tooltip-card";
import { commandLabels } from "./lib/commands";

export function NowStrip({
  number,
  outreach,
  returnTo,
  title,
  ready = true,
  onCommand,
  onMessage,
}: {
  number?: NumberRead["data"];
  outreach?: Outreach | null;
  returnTo: string;
  title: string;
  ready?: boolean;
  onCommand?: (command: string) => void;
  onMessage?: () => void;
}) {
  const action = outreach?.followups.find((item) => item.status === "open");
  const why = outreach?.derived.reasons[0] ? label(outreach.derived.reasons[0]) : outreach?.derived.attention_band ? bandLabel(outreach.derived.attention_band) : copy.needsReview.title;
  return (
    <div className="si-now">
      <div>
        <h2 className="si-panel__title">{title}</h2>
        {number && (
          <div className="si-chiprow">
            <ClassificationBadge value={number.classification} />
            <EligibilityBadge value={number.eligibility} />
          </div>
        )}
      </div>
      <div>
        <span className="si-ownership__label">{copy.panel.whyHere}</span>
        <p>{why}</p>
        <p>
          {action
            ? `${label(action.kind)} · ${action.due_at ? copy.time.due(formatDateTime(action.due_at)) : copy.time.dueDateNeeded}`
            : copy.panel.noNextStep}
        </p>
        <OwnershipSplit
          promisedBy={action?.origin === "rep_promise" ? action.promised_by : undefined}
          assignedTo={action?.assignment.agent}
          overallOwner={outreach?.assignment.agent ?? null}
        />
      </div>
      <RelatedRecordChips outreach={outreach} numberId={number?.id} returnTo={returnTo} ready={ready} />
      {outreach && onCommand && (
        <div className="si-chiprow">
          {outreach.allowed_actions.filter((item) => commandLabels[item.action]).slice(0, 3).map((item) => (
            item.enabled ? (
              <Button key={item.action} size="sm" onClick={() => onCommand(item.action)}>{commandLabels[item.action]}</Button>
            ) : (
              <TooltipCard key={item.action} title={commandLabels[item.action]} label={<Button size="sm" disabled>{commandLabels[item.action]}</Button>}>
                {item.blocker_codes.map(label).join(", ") || copy.errors.loadFailed}
              </TooltipCard>
            )
          ))}
          {onMessage && (
            <TooltipCard title={copy.messageRep.title} label={<Button size="sm" disabled={outreach.state === "closed"} onClick={onMessage}>{copy.messageRep.title}</Button>}>
              {copy.commandExplain.message}
            </TooltipCard>
          )}
        </div>
      )}
      {number && !outreach && <p className="si-text--subtle">{copy.panel.noOutreachOnNumber}</p>}
    </div>
  );
}
