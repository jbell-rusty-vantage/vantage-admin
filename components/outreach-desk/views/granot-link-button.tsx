"use client";

import { ExternalLink } from "lucide-react";

/** Owner-requested pause. Keep the control visible without any navigation or lookup handler. */
export function GranotLinkButton({ compact = false }: { subjectId: string; compact?: boolean }) {
  return <div className={compact ? "od-granot-link od-granot-link--compact" : "od-granot-link"}>
    <button type="button" className={compact ? "od-button" : "od-button od-button--block"} disabled aria-disabled="true" title="Attempting auth fix.">
      <ExternalLink aria-hidden="true" size={16} />Open in Granot
    </button>
    <p className="od-lead__muted" role="status" style={{ fontSize: 11, marginTop: 4 }}>Attempting auth fix.</p>
  </div>;
}
