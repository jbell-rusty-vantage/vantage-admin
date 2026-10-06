"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { InviteResult, LastInvite } from "@/components/operations-registry/users/users-api";
import { formatExactFull } from "@/components/sales-intelligence/lib/time";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";

const r = copy.ui2.users.inviteResult;
const MARK = "\u0000";

/** Splits a copy template around one slot so the slot can be an element (a `<time>`). */
function around(text: string): [string, string] {
  const [before = "", after = ""] = text.split(MARK);
  return [before, after];
}

/** An exact Eastern time on a `<time>`: the title and accessible label carry the same words. */
function ExactTime({ t }: { t: string }) {
  const exact = formatExactFull(t);
  return (
    <time dateTime={t} title={exact} aria-label={exact}>
      {exact}
    </time>
  );
}

/**
 * The invite state of a login. `pending` prints the expiry as an exact time (the list read has no `as_of`, so no relative
 * phrase and no browser clock).
 */
export function InviteLine({ invite }: { invite: LastInvite | null }) {
  const words = copy.ui2.users.invite;
  if (!invite) return <span className="su-quiet">{words.none}</span>;
  if (invite.state === "pending") {
    const [before, after] = words.pending(MARK).split(MARK);
    return (
      <span>
        {before}
        <ExactTime t={invite.expires_at} />
        {after}
      </span>
    );
  }
  const word = invite.state === "accepted" ? words.accepted : invite.state === "expired" ? words.expired : invite.state === "revoked" ? words.revoked : words.none;
  return <span className="su-quiet">{word}</span>;
}

/**
 * The invite result. `sent` prints `Invite emailed to {email}. It expires {time}.`; any other delivery shows the link in a
 * read-only field with Copy link and `Not emailed: {reason}`. The link lives only in this field: never logged, never put
 * in the URL or in storage.
 */
export function InviteResultView({ email, result }: { email: string; result: InviteResult }) {
  const fieldId = useId();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  if (result.delivery === "sent" || !result.link) {
    const [before, after] = around(r.sent(email, MARK));
    return (
      <p className="su-review" role="status">
        {before}
        <ExactTime t={result.expires_at} />
        {after}
      </p>
    );
  }

  const link = result.link;
  const reason = r.reason[result.delivery] ?? r.reason.failed!;
  const [expBefore, expAfter] = around(r.expires(MARK));
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (permissions or an insecure origin): the field stays selectable.
      document.getElementById(fieldId)?.focus();
    }
  };
  return (
    <div className="su-fields">
      <p className="su-review" role="status">
        {r.notEmailed(reason)}
      </p>
      <div className="su-row">
        <label className="su-row__label" htmlFor={fieldId}>
          {r.linkLabel}
        </label>
        <div className="pp-linkrow">
          <input id={fieldId} className="su-input" readOnly value={link} onFocus={(event) => event.currentTarget.select()} autoComplete="off" spellCheck={false} />
          <button type="button" className="crm-button crm-button--primary" onClick={() => void copyLink()} aria-live="polite">
            {copied ? <Check aria-hidden="true" width={16} height={16} /> : <Copy aria-hidden="true" width={16} height={16} />}
            {copied ? r.copied : r.copy}
          </button>
        </div>
        <p className="su-row__hint">
          <span>
            {expBefore}
            <ExactTime t={result.expires_at} />
            {expAfter}
          </span>
        </p>
      </div>
    </div>
  );
}
