import Link from "next/link";
import type { Outreach } from "@/lib/api/salesIntelligence";
import { copy } from "./sales-intelligence-copy";
import { officialRecordHref } from "./lib/official-record";
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
  const chip = (label: string, href: string | null) => (
    <span className="si-chiprow">
      <TooltipCard title={label} guideTopic="attachments" label={href ? <Link href={href}>{label}</Link> : <span>{label}: {copy.related.none}</span>}>
        {copy.related.chipTip}
      </TooltipCard>
      {href && (
        <a href={href} target="_blank" rel="noreferrer">{copy.panel.openInNewTab}</a>
      )}
    </span>
  );
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
      {leads.length
        ? leads.map((lead) => chip(copy.related.lead, officialRecordHref(lead.model, lead.id, returnTo)))
        : chip(copy.related.lead, null)}
      {chip(copy.related.number, numberId ? `/sales-intelligence?view=numbers&number=${encodeURIComponent(numberId)}` : null)}
      {bookings.length
        ? bookings.map((item) => chip(copy.related.booking, officialRecordHref("BookedLead", item.id, returnTo)))
        : chip(copy.related.booking, null)}
      {cancellations.length
        ? cancellations.map((item) => chip(copy.related.cancellation, officialRecordHref("CancelledLead", item.id, returnTo)))
        : chip(copy.related.cancellation, null)}
    </div>
  );
}
