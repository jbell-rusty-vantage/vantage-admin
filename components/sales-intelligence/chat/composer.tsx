"use client";
/**
 * UI1-CHAT (UI-0 §2.7): the textarea with a live `{n} / 1,000` counter and one primary `Send`. Enter inserts a
 * newline; Ctrl/Cmd+Enter sends. Send is disabled while sending, while the text is empty or blank, and when a
 * `disabledReason` is given (shown under it). A blank Ctrl+Enter shows `Write a note first.` (the server would
 * answer a generic 400). No preview, confirmation or undo (D16).
 */
import { Send } from "lucide-react";
import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { copy } from "../sales-intelligence-copy";
import { Button } from "../atoms/button";
import { cx } from "../lib/format";

export const COMPOSER_MAX = 1000;

/** Pure: can the text be sent right now? */
export const canSend = (value: string, sending: boolean, disabledReason?: string | null) => !sending && !disabledReason && value.trim().length > 0;

export function Composer({
  value,
  onChange,
  onSend,
  sending = false,
  disabledReason = null,
  defaultBlankNote = false,
  label = copy.ui1.chat.composerLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  disabledReason?: string | null;
  /** Gallery and tests: render with the blank-attempt note already showing. */
  defaultBlankNote?: boolean;
  label?: string;
  className?: string;
}) {
  const c = copy.ui1.chat;
  const id = useId();
  const [blank, setBlank] = useState(defaultBlankNote);
  const attempt = () => {
    if (sending || disabledReason) return;
    if (!value.trim()) {
      setBlank(true);
      return;
    }
    setBlank(false);
    onSend();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      attempt();
    }
  };
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    attempt();
  };
  const note = disabledReason ?? (blank ? c.blankNote : null);
  return (
    <form className={cx("si-composer", className)} onSubmit={onSubmit} data-sending={sending || undefined}>
      <label className="si-sr" htmlFor={`${id}-text`}>{label}</label>
      <textarea
        id={`${id}-text`}
        className="si-input si-textarea si-composer__text"
        value={value}
        maxLength={COMPOSER_MAX}
        rows={3}
        aria-describedby={`${id}-count ${id}-hint${note ? ` ${id}-note` : ""}`}
        aria-invalid={blank || undefined}
        onChange={(event) => {
          if (blank) setBlank(false);
          onChange(event.target.value);
        }}
        onKeyDown={onKeyDown}
      />
      <div className="si-composer__row">
        <span id={`${id}-count`} className="si-composer__count si-text--sm si-text--subtle" aria-live="polite" aria-label={c.counterLabel(value.length)}>
          {c.counter(value.length)}
        </span>
        <span id={`${id}-hint`} className="si-composer__hint si-text--sm si-text--subtle">{c.shortcut}</span>
        <Button type="submit" variant="primary" className="si-hit si-composer__send" disabled={!canSend(value, sending, disabledReason)}>
          <Send size={16} aria-hidden />
          {c.send}
        </Button>
      </div>
      {note && (
        <p id={`${id}-note`} className="si-composer__note si-text--sm" role={blank ? "alert" : undefined}>
          {note}
        </p>
      )}
    </form>
  );
}
