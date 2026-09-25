"use client";
/**
 * UI1-SHELL: the record header's command grouping (UI-1 §5.1, UX26). Only the order is decided here; every
 * command, its enabled flag and its blockers come from the server's `allowed_actions[]`.
 * - One primary: `End the call` when enabled, otherwise `Start the call` (`splitCommands`).
 * - Then `Mark as worked`, `Add next step`, `Assign`, each when offered (UX-C4: `Assign` no longer overflows into More).
 * - Everything else under `More actions`. `Override disposition` is hidden when its only blocker is
 *   `FEATURE_DISABLED` (`offeredActions`).
 * - A disabled command keeps its focusable tooltip anchor and says why as a sentence (the call blocker copy,
 *   `copy.call.blockerCodes`), repeated as screen-reader text, so the reason is never hover-only.
 * - `Message rep` sits after the secondaries and is disabled with `No rep to message` (UI1-CHAT availability).
 * Each command opens the kept `command-dialog.tsx` through `onCommand`.
 */
import { MoreHorizontal, Send } from "lucide-react";
import { useId, useState } from "react";
import type { Outreach } from "@/lib/api/salesIntelligence";
import { Button } from "../atoms/button";
import { TooltipCard } from "../atoms/tooltip-card";
import { callBlockerSentence, callBlockerText, offeredActions, splitCommands } from "../lib/owner-now";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";

type Availability = Outreach["allowed_actions"][number];
type CommandOutreach = Pick<Outreach, "allowed_actions" | "state" | "derived"> & Partial<Outreach>;

const k = copy.ui1.outreach.commands;

/** The header's button words (COPY-UI1 §8). A server action without a word here is never rendered blind. */
export const HEADER_COMMAND_LABELS: Record<string, string> = {
  start_call: k.primaryStart,
  end_call: k.primaryEnd,
  mark_worked: k.markWorked,
  create_followup: k.addNextStep,
  assign: k.assign,
  set_waiting: k.wait,
  add_note: k.note,
  close: k.close,
  reopen: k.reopen,
  override_disposition: k.override,
};

/** `More actions` order: the UX26 list. The everyday three are always secondaries in the header (UX-C4). */
const MORE_ORDER = ["set_waiting", "add_note", "close", "reopen", "override_disposition"];

export type CommandGroups = { primary: Availability | null; secondary: Availability[]; more: Availability[] };

export function groupCommands(actions: readonly Availability[]): CommandGroups {
  const deck = splitCommands(offeredActions(actions), HEADER_COMMAND_LABELS, 3);
  const rank = (a: Availability) => {
    const at = MORE_ORDER.indexOf(a.action);
    return at === -1 ? MORE_ORDER.length : at;
  };
  // A second call command (the one not chosen as primary) is not repeated under More.
  const more = deck.more.filter((a) => a.action !== "start_call" && a.action !== "end_call").sort((a, b) => rank(a) - rank(b));
  return { primary: deck.call, secondary: deck.secondary, more };
}

/** The server's reason for a disabled command, as a sentence. Never empty: an unknown code gets a generic sentence. */
export function disabledReason(item: Availability, record: CommandOutreach): string | null {
  if (item.enabled) return null;
  return callBlockerSentence(item.action, record as Outreach, item.blocker_codes, copy.call.blockers, copy.call.blockerCodes)
    || callBlockerText(item.blocker_codes, copy.call.blockerCodes)
    || k.unavailable;
}

function CommandButton({ item, record, variant, onCommand }: { item: Availability; record: CommandOutreach; variant: "primary" | "secondary" | "ghost"; onCommand: (command: string) => void }) {
  const text = HEADER_COMMAND_LABELS[item.action]!;
  const why = disabledReason(item, record);
  const button = (
    <Button variant={variant} size={variant === "primary" ? "md" : "sm"} className="si-hit" disabled={!!why} data-command={item.action} onClick={() => onCommand(item.action)}>
      {text}
      {why && <span className="si-sr">{` (${why})`}</span>}
    </Button>
  );
  if (!why) return button;
  return <TooltipCard title={text} label={button}>{why}</TooltipCard>;
}

export function RecordCommands({
  record,
  onCommand,
  onMessageRep,
  messageRepDisabledReason,
}: {
  record: CommandOutreach;
  onCommand: (command: string) => void;
  onMessageRep?: () => void;
  /** `undefined` while the destination read is pending; `null` enabled; a string disables with that sentence. */
  messageRepDisabledReason?: string | null;
}) {
  const groups = groupCommands(record.allowed_actions);
  const [moreOpen, setMoreOpen] = useState(false);
  const noteId = useId();
  const moreId = useId();
  const messageDisabled = messageRepDisabledReason !== null || !onMessageRep;
  const empty = !groups.primary && !groups.secondary.length && !groups.more.length;
  return (
    <div className="si-now__deck si-actions si-recordcmds" role="group" aria-label={k.label}>
      <div className="si-actions__primary">
        {groups.primary && <CommandButton item={groups.primary} record={record} variant="primary" onCommand={onCommand} />}
        {groups.secondary.map((item) => <CommandButton key={item.action} item={item} record={record} variant="secondary" onCommand={onCommand} />)}
        <span className="si-recordcmds__msg">
          <Button
            variant="secondary"
            size="sm"
            className="si-hit"
            data-command="message_rep"
            disabled={messageDisabled}
            aria-describedby={messageRepDisabledReason ? noteId : undefined}
            onClick={onMessageRep}
          >
            <Send size={14} aria-hidden />
            {k.messageRep}
          </Button>
          {messageRepDisabledReason && <span id={noteId} className="si-text--sm si-text--subtle">{messageRepDisabledReason}</span>}
        </span>
        {!!groups.more.length && (
          <Button
            variant="ghost"
            size="sm"
            className="si-hit"
            aria-expanded={moreOpen}
            aria-controls={moreId}
            data-command="more"
            onClick={() => setMoreOpen((open) => !open)}
            onKeyDown={(event) => { if (event.key === "Escape" && moreOpen) { event.stopPropagation(); setMoreOpen(false); } }}
          >
            <MoreHorizontal size={16} aria-hidden />
            {k.more}
          </Button>
        )}
      </div>
      {!!groups.more.length && (
        <div
          id={moreId}
          className={cx("si-actions__secondary si-recordcmds__more", !moreOpen && "is-closed")}
          hidden={!moreOpen}
          data-more
          onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setMoreOpen(false); } }}
        >
          {groups.more.map((item) => <CommandButton key={item.action} item={item} record={record} variant="ghost" onCommand={(command) => { setMoreOpen(false); onCommand(command); }} />)}
        </div>
      )}
      {empty && <p className="si-text--sm si-text--subtle">{copy.now.noActions}</p>}
    </div>
  );
}
