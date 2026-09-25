"use client";
/**
 * UI1-CHAT (UI-1 §5.5, UX17, UX28): `Message {rep}`.
 * - `mode="panel"`: a 420 px non-modal side panel (the card's and the record header's `Message rep`), a full-screen
 *   sheet at 390 px. Focus moves in on open and returns to the opener on close; Escape closes the innermost layer
 *   (the picker first, then the panel).
 * - `mode="inline"`: the Work tab's composer under the message history (no header, no close).
 * First line: `Goes to the rep's RingCentral, never to the customer.` Recipient: the linked rep by default, or
 * whoever `Send to someone else` picked; the title follows the choice. No linked rep and no choice: the picker
 * opens and Send is disabled with `No rep to message`. Channel, purpose and template come from `nudgeSendBody`.
 * The presentational `MessageRepPanelView` takes everything as props (tests and the gallery); the wrapper owns the hooks.
 */
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { copy } from "../sales-intelligence-copy";
import { Button } from "../atoms/button";
import { cx } from "../lib/format";
import { Composer } from "../chat";
import { siKeys } from "../data/query-keys";
import type { NudgeRecipient } from "../data/use-nudges";
import { Region, SkeletonLines } from "../primitives";
import { MessageHistory } from "./message-history";
import { RecipientPicker } from "./recipient-picker";
import { useMessageRep, useMessageRepAvailability, type MessageOutreach } from "./use-message-rep";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Pure: the panel title follows the recipient. */
export const panelTitle = (recipient: Pick<NudgeRecipient, "name"> | null) =>
  recipient?.name ? copy.ui1.chat.title(recipient.name) : copy.ui1.chat.titleNoRep;

export type MessageRepPanelViewProps = {
  mode: "panel" | "inline";
  recipient: NudgeRecipient | null;
  /** True once the destination read has answered (so `No rep to message` isn't shown while loading). */
  resolved: boolean;
  picking: boolean;
  picker: ReactNode;
  history: ReactNode;
  composer: ReactNode;
  onSomeoneElse: () => void;
  onClose?: () => void;
};

export function MessageRepPanelView({ mode, recipient, resolved, picking, picker, history, composer, onSomeoneElse, onClose }: MessageRepPanelViewProps) {
  const c = copy.ui1.chat;
  const titleId = useId();
  const ref = useRef<HTMLElement>(null);
  const panel = mode === "panel";

  useEffect(() => {
    if (!panel) return;
    const opener = document.activeElement;
    ref.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [panel]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!panel) return;
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.stopPropagation();
      onClose?.();
      return;
    }
    if (event.key !== "Tab" || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0]!, last = items[items.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const body = (
    <div className="si-msgpanel__body">
      <p className="si-msgpanel__first">{c.firstLine}</p>
      <div className="si-msgpanel__to">
        <span className="si-msgpanel__recipient" data-recipient={recipient ? recipient.rc_extension_id : ""}>
          {recipient?.name ? c.recipient(recipient.name) : resolved ? c.noRep : c.noRecipient}
        </span>
        {!picking && (
          <button type="button" className="si-link si-hit" onClick={onSomeoneElse}>{c.sendToSomeoneElse}</button>
        )}
      </div>
      {picking && picker}
      {history}
      {composer}
    </div>
  );

  if (!panel) {
    return (
      <section className="si-msgpanel si-msgpanel--inline" aria-label={panelTitle(recipient)} data-mode="inline">
        {body}
      </section>
    );
  }
  return (
    <aside ref={ref} className="si-msgpanel si-msgpanel--panel" role="dialog" aria-modal="false" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown} data-mode="panel">
      <header className="si-msgpanel__header">
        <h2 id={titleId} className="si-msgpanel__title">{panelTitle(recipient)}</h2>
        <Button variant="ghost" className="si-iconbtn--hit" aria-label={c.close} onClick={onClose}>
          <X size={18} aria-hidden />
        </Button>
      </header>
      {body}
    </aside>
  );
}

export function MessageRepPanel({ outreach, asOf, mode, onClose }: { outreach: MessageOutreach; asOf: string; mode: "panel" | "inline"; onClose?: () => void }) {
  const client = useQueryClient();
  const availability = useMessageRepAvailability(outreach);
  const [chosen, setChosen] = useState<NudgeRecipient | null>(null);
  const [picking, setPicking] = useState(false);
  const recipient = chosen ?? availability.recipient;
  const resolved = availability.disabledReason !== undefined;
  // No linked rep and no choice: open with the picker (UI-1 §5.5).
  const showPicker = picking || (resolved && !recipient);
  const rep = useMessageRep({ outreach, asOf, recipient });
  const disabledReason = recipient ? null : resolved ? copy.ui1.chat.noRep : copy.ui1.chat.noRecipient;

  return (
    <MessageRepPanelView
      mode={mode}
      recipient={recipient}
      resolved={resolved}
      picking={showPicker}
      onSomeoneElse={() => setPicking(true)}
      onClose={onClose}
      picker={
        <Region name="recipient-picker" skeleton={<SkeletonLines lines={4} />} onRetry={() => void client.resetQueries({ queryKey: siKeys.reps("limit=100") })}>
          <RecipientPicker
            current={recipient}
            onPick={(next) => {
              setChosen(next);
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
          />
        </Region>
      }
      history={
        <MessageHistory
          outreachId={outreach.id}
          local={rep.local}
          checking={rep.checking}
          onRetryLocal={rep.retry}
          onResend={(text) => void rep.send(text)}
          onCheckLocal={(key) => void rep.checkLocal(key)}
          onCheckStored={(id) => void rep.checkStored(id)}
        />
      }
      composer={
        <Composer
          value={rep.draft}
          onChange={rep.setDraft}
          onSend={() => void rep.send()}
          sending={rep.sending}
          disabledReason={disabledReason}
          className={cx(mode === "panel" && "si-composer--pinned")}
        />
      }
    />
  );
}
