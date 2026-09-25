import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import type { Outreach } from "@/lib/api/salesIntelligence";
import { copy } from "./sales-intelligence-copy";
import { officialRecordHref } from "./lib/official-record";
import { legacyNumberHref } from "./lib/legacy-links";
import { TooltipCard } from "./atoms/tooltip-card";

export function RelatedRecordChips({
  outreach,
  numberId,
  returnTo,
  ready = true,
}: {
  outreach?: Outreach | null;
  numberId?: string | null;
  returnTo: string;
  ready?: boolean;
}) {
  const leads = outreach?.related_record_links?.filter((item) => item.model === "FormLead" || item.model === "CallLead")
    ?? (outreach?.subject.kind === "lead" ? [{ model: outreach.subject.model, id: outreach.subject.id }] : []);
  const bookings = outreach?.related_record_links?.filter((item) => item.model === "BookedLead") ?? [];
  const cancellations = outreach?.related_record_links?.filter((item) => item.model === "CancelledLead") ?? [];
  // FIX-UI1 (m3, m7): 44 px link targets; the legacy Number link carries the `Previous version` note (UI-1 §1.3).
  const chip = (label: string, href: string | null, key?: string, previous = false) => (
    <span key={key} className="si-chiprow">
      <TooltipCard title={label} guideTopic="attachments" label={href ? <Link className="si-related__link" href={href}>{label}</Link> : <span>{label}: {copy.related.none}</span>}>
        {copy.related.chipTip}
      </TooltipCard>
      {href && (
        <a className="si-related__link" href={href} target="_blank" rel="noreferrer">{copy.panel.openInNewTab}</a>
      )}
      {href && previous && <span className="si-card__prev si-text--sm si-text--subtle">{copy.ui1.desk.linkOut.previousVersion}</span>}
    </span>
  );
  // FIX-UI1 (m7): `·` between the records, so the line never runs together.
  const joined = (items: ReactNode[]) => items.map((item, i) => (
    <Fragment key={i}>
      {i > 0 && <span className="si-related__sep" aria-hidden>{copy.ui1.fixUi1.sep}</span>}
      {item}
    </Fragment>
  ));
  if (!ready) {
    return (
      <div className="si-related" aria-label={copy.panel.relatedRecords}>
        <strong>{copy.panel.relatedRecords}</strong>
        <span className="si-text--subtle">{copy.page.preparing}</span>
      </div>
    );
  }
  return (
    <div className="si-related" aria-label={copy.panel.relatedRecords}>
      <strong>{copy.panel.relatedRecords}</strong>
      {joined([
        ...(leads.length
          ? leads.map((lead) => chip(copy.related.lead, officialRecordHref(lead.model, lead.id, returnTo), `${lead.model}:${lead.id}`))
          : [chip(copy.related.lead, null)]),
        chip(copy.related.number, numberId ? legacyNumberHref(numberId) : null, undefined, true),
        ...(bookings.length
          ? bookings.map((item) => chip(copy.related.booking, officialRecordHref("BookedLead", item.id, returnTo), `BookedLead:${item.id}`))
          : [chip(copy.related.booking, null)]),
        ...(cancellations.length
          ? cancellations.map((item) => chip(copy.related.cancellation, officialRecordHref("CancelledLead", item.id, returnTo), `CancelledLead:${item.id}`))
          : [chip(copy.related.cancellation, null)]),
      ])}
    </div>
  );
}
