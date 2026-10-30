"use client";

import { useState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { z } from "zod";
import { isSalesOutreachApiError, newIdempotencyKey, salesOutreachCommand } from "@/lib/api/salesOutreach";

export const granotLinkResultSchema = z.object({
  url: z.string().regex(/^https:\/\/eagle\.hellomoving\.com\/wc\.dll\?mpcharge~chargeswc~[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i),
  job_no: z.string(),
  captured_at: z.string().datetime(),
  cached: z.boolean(),
});

function failureMessage(error: unknown): string {
  if (isSalesOutreachApiError(error)) {
    if (error.revokesAccess) return "This Granot link is no longer available to you.";
    const reason = error.issues?.find(issue => issue.path === "granot_link")?.code;
    if (reason === "busy") return "Granot is syncing right now. Try again shortly.";
    if (reason === "not_found") return "Granot did not return a unique job form. Check the Job Number and try again.";
    if (reason === "unverified") return "The Granot result could not be verified against this Job Number.";
  }
  return "We couldn’t retrieve the Granot link. Try again.";
}

/** A user-initiated blank tab avoids popup blocking while the authenticated lookup finishes. */
export function GranotLinkButton({ subjectId, compact = false }: { subjectId: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  async function open(refresh: boolean) {
    if (busy) return;
    const tab = window.open("about:blank", "_blank");
    if (tab) {
      tab.opener = null;
      tab.document.title = "Opening Granot";
      tab.document.body.textContent = "Finding your Granot job… You can return to the Outreach Desk while this loads.";
    }
    setBusy(true); setError(null);
    try {
      const result = await salesOutreachCommand("POST", `outreach/${subjectId}/granot-link`, { refresh }, newIdempotencyKey("granot-link"), granotLinkResultSchema);
      if (tab && !tab.closed) tab.location.replace(result.url);
      else setError("Allow pop-ups for this site, then click Open in Granot again.");
      setReady(true);
    } catch (error) {
      tab?.close();
      setError(failureMessage(error));
    } finally { setBusy(false); }
  }
  return <div className={compact ? "od-granot-link od-granot-link--compact" : "od-granot-link"} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <button type="button" className={compact ? "od-button" : "od-button od-button--block"} disabled={busy} onClick={() => void open(false)}>
      {busy ? <LoaderCircle aria-hidden="true" size={16} /> : <ExternalLink aria-hidden="true" size={16} />}
      {busy ? "Finding Granot job…" : "Open in Granot"}
    </button>
    {!compact ? <p className="od-lead__muted">Opens in a new tab. Sign in to Granot in this browser first.</p> : null}
    {ready && !compact ? <button type="button" className="od-button od-button--quiet" disabled={busy} onClick={() => void open(true)}>Refresh link</button> : null}
    {error ? <p className="od-lead__error" role="alert">{error}</p> : null}
  </div>;
}
