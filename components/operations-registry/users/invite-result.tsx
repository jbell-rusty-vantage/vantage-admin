"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/sales-intelligence/atoms/button";
import { TimeText } from "@/components/sales-intelligence/primitives/time-text";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import type { InviteResult } from "./users-api";
import { UsersDialog } from "./users-dialog";

const r = copy.ui2.users.inviteResult;
const MARK = "\u0000";

/** Splits a copy template around one slot so the slot can be an element (a `<time>`). */
function around(text: string): [string, string] {
  const [before = "", after = ""] = text.split(MARK);
  return [before, after];
}

function ExpiresTime({ t }: { t: string }) {
  return <TimeText t={t} asOf={null} mode="exact" />;
}

/**
 * The invite result (UI-2 §8). `sent` → `Invite emailed to {email}. It expires {expires_at}.`; any other
 * delivery → the link in a read-only field, `Copy link` (`Copied` for 2 s) and `Not emailed: {reason}`.
 * The link lives only in this field: never logged, never put in the URL or in storage.
 */
export function InviteResultView({ email, result }: { email: string; result: InviteResult }) {
  const fieldId = useId();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  if (result.delivery === "sent" || !result.link) {
    const [before, after] = around(r.sent(email, MARK));
    return (
      <p className="si-users__inviteresult" role="status">
        {before}
        <ExpiresTime t={result.expires_at} />
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
    <div className="si-users__inviteresult">
      <p className="si-users__notemailed" role="status">{r.notEmailed(reason)}</p>
      <div className="si-field">
        <label className="si-field__label" htmlFor={fieldId}>{r.linkLabel}</label>
        <div className="si-users__linkrow">
          <input
            id={fieldId}
            className="si-input si-mono si-users__link"
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="button" variant="primary" className="si-hit si-users__copy" onClick={() => void copyLink()} aria-live="polite">
            {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            {copied ? r.copied : r.copy}
          </Button>
        </div>
        <p className="si-field__hint">
          {expBefore}
          <ExpiresTime t={result.expires_at} />
          {expAfter}
        </p>
      </div>
    </div>
  );
}

export function InviteResultDialog({ email, result, onClose, inline }: { email: string; result: InviteResult; onClose: () => void; inline?: boolean }) {
  return (
    <UsersDialog
      title={copy.ui2.users.inviteResultTitle}
      description={email}
      inline={inline}
      onClose={onClose}
      onSubmit={onClose}
      size="md"
      footer={<Button type="submit" variant="primary" className="si-hit">{copy.ui2.users.done}</Button>}
    >
      <InviteResultView email={email} result={result} />
    </UsersDialog>
  );
}
