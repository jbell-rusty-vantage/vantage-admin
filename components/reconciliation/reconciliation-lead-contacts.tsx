import {
  FormSubmittedGranotCards,
  type GranotContactFacts,
} from "@/components/operational/form-lead-contacts";

export type ReconciliationKnownContact = {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  email?: string | null;
  differs_from_ingested?: boolean | null;
  captured_at?: string | Date | null;
};

export type ReconciliationLeadContactSource = {
  lead_model?: "FormLead" | "CallLead";
  name?: string | null;
  phone_number?: string | null;
  email?: string | null;
  ingested_contact_snapshot?: ReconciliationKnownContact | null;
  granot_contact_snapshot?: ReconciliationKnownContact | null;
};

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function reconciliationLeadDisplayName(
  source: ReconciliationLeadContactSource,
  fallback: string,
): string {
  return (
    firstNonEmpty(
      source.name,
      source.granot_contact_snapshot?.name,
      source.ingested_contact_snapshot?.name,
    ) || fallback
  );
}

export function reconciliationLeadContactSourceFromSnapshot(
  leadModel: "FormLead" | "CallLead",
  snapshot: ReconciliationLeadContactSource,
): ReconciliationLeadContactSource {
  return {
    lead_model: leadModel,
    name: snapshot.name,
    phone_number: snapshot.phone_number,
    email: snapshot.email,
    ingested_contact_snapshot: snapshot.ingested_contact_snapshot,
    granot_contact_snapshot: snapshot.granot_contact_snapshot,
  };
}

export function ReconciliationLeadContacts({
  source,
}: {
  source: ReconciliationLeadContactSource;
}) {
  const liveTitle = source.lead_model === "CallLead" ? "Called" : "Form submitted";
  const formSubmitted = {
    name: firstNonEmpty(source.name, source.ingested_contact_snapshot?.name) || undefined,
    phone_number:
      firstNonEmpty(source.phone_number, source.ingested_contact_snapshot?.phone_number) ||
      undefined,
    email: firstNonEmpty(source.email, source.ingested_contact_snapshot?.email) || undefined,
  };
  const granot = source.granot_contact_snapshot
    ? (source.granot_contact_snapshot as GranotContactFacts)
    : null;

  return (
    <FormSubmittedGranotCards
      formSubmitted={formSubmitted}
      granot={granot}
      compact
      liveTitle={liveTitle}
    />
  );
}
