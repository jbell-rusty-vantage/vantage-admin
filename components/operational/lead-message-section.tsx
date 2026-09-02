"use client";

import Link from "next/link";
import { FeedbackMessage } from "@/components/ui/feedback";
import { DetailGrid, DetailItem } from "@/components/record-detail/detail-section";
import { OPERATIONAL_COPY, leadMessageSentValue } from "@/components/operational/operational-copy";
import { formatDate, formatPlain, getValue } from "@/components/operational/operational-helpers";
import { getRecordId, type AdminRecord } from "@/lib/api/admin";

export function LeadMessageSection({ record }: { record: AdminRecord }) {
  const message = getValue(record, "sms_message");
  const sent = leadMessageSentValue(record.sms_message_sent === true);

  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return (
      <div className="space-y-3">
        <FeedbackMessage>{OPERATIONAL_COPY.leadMessage.empty}</FeedbackMessage>
        <DetailGrid>
          <DetailItem label={OPERATIONAL_COPY.leadMessage.sentLabel} value={sent} />
        </DetailGrid>
      </div>
    );
  }

  const smsMessage = message as AdminRecord;
  return (
    <div className="space-y-4">
      <DetailGrid>
        <DetailItem label={OPERATIONAL_COPY.leadMessage.sentLabel} value={sent} />
        <DetailItem label="Status" value={formatPlain(smsMessage.status)} />
        <DetailItem label="Provider status" value={formatPlain(smsMessage.provider_status)} />
        <DetailItem label="To" value={formatPlain(smsMessage.to)} />
        <DetailItem label="From" value={formatPlain(smsMessage.from)} />
        <DetailItem label="Purpose" value={formatPlain(smsMessage.purpose)} />
        <DetailItem label="Twilio message SID" value={formatPlain(smsMessage.twilio_message_sid)} />
        <DetailItem label="Accepted" value={formatDate(smsMessage.accepted_at)} />
        <DetailItem label="Sent" value={formatDate(smsMessage.sent_at)} />
        <DetailItem label="Delivered" value={formatDate(smsMessage.delivered_at)} />
      </DetailGrid>
      <div>
        <Link
          className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
          href={`/observational?tab=events&category=messaging&entity_type=form_lead&entity_id=${encodeURIComponent(getRecordId(record))}`}
        >
          {OPERATIONAL_COPY.leadMessage.viewEvents}
        </Link>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-navy">{OPERATIONAL_COPY.leadMessage.bodyLabel}</p>
        <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
          {String(smsMessage.body ?? "") || "-"}
        </pre>
      </div>
    </div>
  );
}
