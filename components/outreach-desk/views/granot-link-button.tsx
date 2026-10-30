"use client";

import { ExternalLink } from "lucide-react";
import { granotSessionSearch } from "../lib/granot-session-pilot";
import { useGranotSession } from "./granot-session-pilot";

/** The shared-account opening path stays paused. Only Josh's explicit local-session pilot can submit. */
export function GranotLinkButton({ compact = false, jobNo }: { subjectId: string; jobNo?: string | null; compact?: boolean }) {
  const pilot = useGranotSession();
  const search = pilot?.context ? granotSessionSearch(pilot.context, jobNo) : null;
  if (pilot) return <form method="post" action={search?.action} target="_blank" rel="noopener noreferrer"
    className={compact ? "od-granot-link od-granot-link--compact" : "od-granot-link"}
    onClick={(event) => event.stopPropagation()} onSubmit={(event) => { if (!search) event.preventDefault(); }}>
    {search ? <><input type="hidden" name="VALUE" value={search.job} /><input type="hidden" name="B5" value="Search" /></> : null}
    <button type="submit" className={compact ? "od-button" : "od-button od-button--block"} disabled={!search}>
      <ExternalLink aria-hidden="true" size={16} />Open in Granot · test
    </button>
    <p className="od-lead__muted" style={{ fontSize: 11, marginTop: 4 }}>{search ? "Check your account and email templates after opening." : pilot.context ? "This Job Number cannot be searched in the account test." : "Connect your Granot session above to test."}</p>
  </form>;
  return <div className={compact ? "od-granot-link od-granot-link--compact" : "od-granot-link"}>
    <button type="button" className={compact ? "od-button" : "od-button od-button--block"} disabled aria-disabled="true" title="Attempting auth fix.">
      <ExternalLink aria-hidden="true" size={16} />Open in Granot
    </button>
    <p className="od-lead__muted" role="status" style={{ fontSize: 11, marginTop: 4 }}>Attempting auth fix.</p>
  </div>;
}
