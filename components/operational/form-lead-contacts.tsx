import type { ReactNode } from "react";
import { formatDate } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import { DetailItem, DetailSection } from "@/components/record-detail/detail-section";
import type { AdminRecord } from "@/lib/api/admin";
import { cn } from "@/lib/utils";

const EMPTY = "—";

export const FORM_LEAD_CONTACTS_DESCRIPTION =
  "The landing-page contact stays on the lead. Granot contact is stored beside it when Granot has a qualified card.";

export const CALL_LEAD_CONTACTS_DESCRIPTION =
  "The Called contact stays on the lead. Granot contact is stored beside it when Granot has a qualified card.";

export type ContactLeaves = {
  first_name?: unknown;
  last_name?: unknown;
  name?: unknown;
  phone_number?: unknown;
  email?: unknown;
};

export type GranotContactFacts = ContactLeaves & {
  differs_from_ingested?: unknown;
  captured_at?: unknown;
};

export function readGranotContactSnapshot(
  record: AdminRecord,
): GranotContactFacts | null {
  const value = record.granot_contact_snapshot;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as GranotContactFacts;
}

export function granotContactChipLabel(
  snapshot: GranotContactFacts | null | undefined,
): "—" | "Granot" | "Changed in Granot" {
  if (!snapshot) {
    return "—";
  }
  return snapshot.differs_from_ingested === true ? "Changed in Granot" : "Granot";
}

export function GranotContactStatusChip({
  snapshot,
  omitEmpty = false,
}: {
  snapshot?: GranotContactFacts | null;
  omitEmpty?: boolean;
}) {
  const label = granotContactChipLabel(snapshot);
  if (label === "—") {
    return omitEmpty ? null : EMPTY;
  }

  const tooltip = chipTooltip(snapshot ?? null);
  return (
    <StatusBadge
      tone={label === "Changed in Granot" ? "warning" : "muted"}
      className={tooltip ? "cursor-help" : undefined}
    >
      <span title={tooltip}>{label}</span>
    </StatusBadge>
  );
}

export function GranotContactChip({ record }: { record: AdminRecord }) {
  return <GranotContactStatusChip snapshot={readGranotContactSnapshot(record)} />;
}

export function FormSubmittedGranotCards({
  formSubmitted,
  granot,
  showNameParts = false,
  emptyGranotHint,
  compact = false,
  liveTitle = "Form submitted",
}: {
  formSubmitted: ContactLeaves;
  granot?: GranotContactFacts | null;
  showNameParts?: boolean;
  emptyGranotHint?: string;
  compact?: boolean;
  liveTitle?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", compact && "gap-2")}>
      <ContactCard title={liveTitle} compact={compact}>
        <ContactField label="Name" value={formSubmitted.name} />
        {showNameParts ? (
          <>
            <ContactField label="First" value={formSubmitted.first_name} />
            <ContactField label="Last" value={formSubmitted.last_name} />
          </>
        ) : null}
        <ContactField label="Phone" value={formSubmitted.phone_number} />
        <ContactField label="Email" value={formSubmitted.email} />
        {!granot && emptyGranotHint ? (
          <p className="text-sm text-muted-foreground">{emptyGranotHint}</p>
        ) : null}
      </ContactCard>
      {granot ? (
        <ContactCard
          title="Granot"
          badge={granot.differs_from_ingested === true ? "Changed in Granot" : undefined}
          compact={compact}
        >
          <ContactField label="Name" value={granot.name} />
          {showNameParts ? (
            <>
              <ContactField label="First" value={granot.first_name} />
              <ContactField label="Last" value={granot.last_name} />
            </>
          ) : null}
          <ContactField label="Phone" value={granot.phone_number} />
          <ContactField label="Email" value={granot.email} />
          <ContactField label="Recorded" value={formatRecordedDate(granot.captured_at)} />
        </ContactCard>
      ) : null}
    </div>
  );
}

export function FormLeadContactsSection({
  record,
  liveTitle = "Form submitted",
  description = FORM_LEAD_CONTACTS_DESCRIPTION,
}: {
  record: AdminRecord;
  liveTitle?: string;
  description?: string;
}) {
  const snapshot = readGranotContactSnapshot(record);

  return (
    <DetailSection title="Contacts" description={description}>
      <FormSubmittedGranotCards
        formSubmitted={{
          name: record.name,
          first_name: record.first_name,
          last_name: record.last_name,
          phone_number: record.phone_number,
          email: record.email,
        }}
        granot={snapshot}
        showNameParts
        emptyGranotHint="No Granot contact yet"
        liveTitle={liveTitle}
      />
    </DetailSection>
  );
}

export function CallLeadContactsSection({ record }: { record: AdminRecord }) {
  return (
    <FormLeadContactsSection
      record={record}
      liveTitle="Called"
      description={CALL_LEAD_CONTACTS_DESCRIPTION}
    />
  );
}

function ContactCard({
  title,
  badge,
  compact,
  children,
}: {
  title: string;
  badge?: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-md border p-3", compact && "p-2")}>
      <div className={cn("mb-3 flex flex-wrap items-center gap-2", compact && "mb-2")}>
        <h4 className="text-sm font-medium">{title}</h4>
        {badge ? <StatusBadge tone="warning">{badge}</StatusBadge> : null}
      </div>
      <dl className={cn("grid gap-3", compact && "gap-2")}>{children}</dl>
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

function chipTooltip(snapshot: GranotContactFacts | null): string | undefined {
  if (!snapshot) {
    return undefined;
  }
  const parts = [displayLeaf(snapshot.name), displayLeaf(snapshot.phone_number)].filter(
    (part) => part !== EMPTY,
  );
  return parts.length ? parts.join(" · ") : undefined;
}
