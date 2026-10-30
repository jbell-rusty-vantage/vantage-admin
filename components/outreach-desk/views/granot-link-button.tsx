"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { isSalesOutreachApiError, newIdempotencyKey, salesOutreachCommand } from "@/lib/api/salesOutreach";
import { isSearchableGranotJob } from "../lib/granot-session-pilot";
import { useGranotSession } from "./granot-session-pilot";

const resultSchema = z.object({
  url: z.string().regex(/^https:\/\/eagle\.hellomoving\.com\/wc\.dll\?mpcharge~chargeswc~[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i),
  job_no: z.string(), account_verified: z.literal(true), captured_at: z.string().datetime(),
});
function failure(error: unknown): { message: string; disconnect: boolean } {
  if (isSalesOutreachApiError(error)) {
    const reason = error.issues?.find(issue => issue.path === "granot_link")?.code;
    if (reason === "account_mismatch") return { message: "That URL belongs to a different Granot account. Open a job normally in your own Granot account and reconnect. Do not reuse an older Outreach link.", disconnect: true };
    if (reason === "session_expired") return { message: "Granot did not accept that session. Sign in to your own Granot account and reconnect using a job opened normally inside Granot.", disconnect: true };
    if (reason === "busy") return { message: "Granot is syncing. Try again shortly.", disconnect: false };
    if (reason === "identity_unavailable") return { message: "Your Granot username is not configured. Contact the owner before testing.", disconnect: true };
    if (reason === "not_found" || reason === "unverified") return { message: "Granot did not return a unique matching job. Check the Job Number before trying again.", disconnect: false };
    if (error.revokesAccess) return { message: "This job is no longer available to you.", disconnect: true };
  }
  return { message: "The Granot account and job could not be verified. Try again or reconnect using a job opened normally inside Granot.", disconnect: false };
}

/** The shared-account opening path stays paused. Only Josh's explicit local-session pilot can submit. */
export function GranotLinkButton({ subjectId, compact = false, jobNo }: { subjectId: string; jobNo?: string | null; compact?: boolean }) {
  const pilot = useGranotSession();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const monitor = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeContext = useRef(pilot?.context);
  useEffect(() => { activeContext.current = pilot?.context; }, [pilot?.context]);
  useEffect(() => () => { if (monitor.current) clearInterval(monitor.current); }, []);
  const ready = Boolean(pilot?.context && isSearchableGranotJob(jobNo));
  async function open() {
    if (!ready || busy || !pilot?.context) return;
    const context = pilot.context;
    if (monitor.current) clearInterval(monitor.current);
    const tab = window.open("about:blank", "_blank");
    if (!tab) { setMessage("Chrome blocked the new tab. Allow pop-ups for Outreach, then try again."); return; }
    tab.opener = null;
    tab.document.title = "Checking Granot account";
    const referrer = tab.document.createElement("meta"); referrer.name = "referrer"; referrer.content = "no-referrer"; tab.document.head.append(referrer);
    tab.document.body.textContent = "Checking your Granot account and finding the job. Keep this tab open while Outreach checks the result.";
    setBusy(true); setMessage("Checking your Granot account and job…");
    try {
      const result = await salesOutreachCommand("POST", `outreach/${subjectId}/granot-session-link`, { session_context: context }, newIdempotencyKey("granot-session-link"), resultSchema);
      if (activeContext.current !== context) { tab.close(); setMessage("Your Granot connection changed. Reconnect before trying again."); return; }
      if (tab.closed) { setMessage("The test tab was closed before the job could open. Click Open in Granot again."); return; }
      const link = tab.document.createElement("a");
      link.href = result.url; link.target = "_self"; link.rel = "noopener noreferrer"; link.referrerPolicy = "no-referrer";
      tab.document.body.append(link); link.click();
      setMessage("Granot username matched your desk. Check your account, email templates and controls in the new tab.");
      const deadline = Date.now() + 15_000;
      monitor.current = setInterval(() => {
        if (tab.closed) {
          if (monitor.current) clearInterval(monitor.current);
          monitor.current = null;
          setMessage("The Granot tab closed before the test could be confirmed. Granot may have rejected the browser session. Reconnect using a job opened normally inside Granot.");
        } else if (Date.now() >= deadline) { if (monitor.current) clearInterval(monitor.current); monitor.current = null; }
      }, 250);
    } catch (error) {
      tab.close(); const result = failure(error); setMessage(result.message); if (result.disconnect) pilot.disconnect?.();
    } finally { setBusy(false); }
  }
  if (pilot) return <div className={compact ? "od-granot-link od-granot-link--compact" : "od-granot-link"} onClick={(event) => event.stopPropagation()}>
    <button type="button" className={compact ? "od-button" : "od-button od-button--block"} disabled={!ready || busy} onClick={() => void open()}>
      <ExternalLink aria-hidden="true" size={16} />{busy ? "Checking Granot…" : "Open in Granot · test"}
    </button>
    <p className="od-lead__muted" role="status" style={{ fontSize: 11, marginTop: 4 }}>{message ?? (ready ? "Your Granot username will be verified before opening." : pilot.context ? "This Job Number cannot be searched in the account test." : "Prepare your Granot session above to test.")}</p>
  </div>;
  return <div className={compact ? "od-granot-link od-granot-link--compact" : "od-granot-link"}>
    <button type="button" className={compact ? "od-button" : "od-button od-button--block"} disabled aria-disabled="true" title="Attempting auth fix.">
      <ExternalLink aria-hidden="true" size={16} />Open in Granot
    </button>
    <p className="od-lead__muted" role="status" style={{ fontSize: 11, marginTop: 4 }}>Attempting auth fix.</p>
  </div>;
}
