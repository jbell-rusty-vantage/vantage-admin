import type { ReactNode } from "react";
import { formatDate } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import { DetailItem, DetailSection } from "@/components/record-detail/detail-section";
import type { AdminRecord } from "@/lib/api/admin";

const EMPTY = "—";

export const FORM_LEAD_CONTACTS_DESCRIPTION =
  "The landing-page contact stays on the lead. Granot contact is stored beside it when Granot has a qualified card.";

type GranotContactSnapshot = {
  first_name?: unknown;
  last_name?: unknown;
  name?: unknown;
  phone_number?: unknown;
  email?: unknown;
  differs_from_ingested?: unknown;
  captured_at?: unknown;
};

export function readGranotContactSnapshot(
  record: AdminRecord,
): GranotContactSnapshot | null {
  const value = record.granot_contact_snapshot;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as GranotContactSnapshot;
}

export function granotContactChipLabel(
  snapshot: GranotContactSnapshot | null,
): "—" | "Granot" | "Changed in Granot" {
  if (!snapshot) {
    return "—";
  }
  return snapshot.differs_from_ingested === true ? "Changed in Granot" : "Granot";
}

export function GranotContactChip({ record }: { record: AdminRecord }) {
  const snapshot = readGranotContactSnapshot(record);
  const label = granotContactChipLabel(snapshot);
  if (label === "—") {
    return EMPTY;
  }

  const tooltip = chipTooltip(snapshot);
  return (
    <StatusBadge
      tone={label === "Changed in Granot" ? "warning" : "muted"}
      className={tooltip ? "cursor-help" : undefined}
    >
      <span title={tooltip}>{label}</span>
    </StatusBadge>
  );
}

export function FormLeadContactsSection({ record }: { record: AdminRecord }) {
  const snapshot = readGranotContactSnapshot(record);

  return (
    <DetailSection title="Contacts" description={FORM_LEAD_CONTACTS_DESCRIPTION}>
      <div className="grid gap-4 sm:grid-cols-2">
        <ContactCard title="Form submitted">
          <ContactField label="Name" value={record.name} />
          <ContactField label="First" value={record.first_name} />
          <ContactField label="Last" value={record.last_name} />
          <ContactField label="Phone" value={record.phone_number} />
          <ContactField label="Email" value={record.email} />
          {!snapshot ? (
            <p className="text-sm text-muted-foreground">No Granot contact yet</p>
          ) : null}
        </ContactCard>
        {snapshot ? (
          <ContactCard
            title="Granot"
            badge={
              snapshot.differs_from_ingested === true ? "Changed in Granot" : undefined
            }
          >
            <ContactField label="Name" value={snapshot.name} />
            <ContactField label="First" value={snapshot.first_name} />
            <ContactField label="Last" value={snapshot.last_name} />
            <ContactField label="Phone" value={snapshot.phone_number} />
            <ContactField label="Email" value={snapshot.email} />
            <ContactField
              label="Recorded"
              value={formatRecordedDate(snapshot.captured_at)}
            />
          </ContactCard>
        ) : null}
      </div>
    </DetailSection>
  );
}

function ContactCard({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-medium">{title}</h4>
        {badge ? <StatusBadge tone="warning">{badge}</StatusBadge> : null}
      </div>
      <dl className="grid gap-3">{children}</dl>
    </div>
  );
}

function ContactField({ label, value }: { label: string; value: unknown }) {
  return <DetailItem label={label} value={displayLeaf(value)} />;
}

function displayLeaf(value: unknown): string {
  if (value == null || value === "") {
    return EMPTY;
  }
  const text = String(value).trim();
  return text || EMPTY;
}

function formatRecordedDate(value: unknown): string {
  if (value == null || value === "") {
    return EMPTY;
  }
  if (value instanceof Date) {
    return formatDate(value);
  }
  if (typeof value === "string") {
    return formatDate(value);
  }
  return EMPTY;
}

function chipTooltip(snapshot: GranotContactSnapshot | null): string | undefined {
  if (!snapshot) {
    return undefined;
  }
  const parts = [displayLeaf(snapshot.name), displayLeaf(snapshot.phone_number)].filter(
    (part) => part !== EMPTY,
  );
  return parts.length ? parts.join(" · ") : undefined;
}
