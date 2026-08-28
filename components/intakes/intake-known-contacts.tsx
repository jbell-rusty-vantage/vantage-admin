import {
  FormSubmittedGranotCards,
  GranotContactStatusChip,
} from "@/components/operational/form-lead-contacts";
import type { GranotLifecycleCandidateItem } from "@/lib/api/granotLifecycle";
import { BOOKING_INTAKE_STORY } from "./intake-copy";

export function intakeShowsGranotContact(item: GranotLifecycleCandidateItem): boolean {
  return item.lead_ref.model === "FormLead" && Boolean(item.known_contacts?.granot);
}

export function IntakeKnownContactsChip({
  item,
}: {
  item: GranotLifecycleCandidateItem;
}) {
  if (item.lead_ref.model !== "FormLead") return null;
  return <GranotContactStatusChip snapshot={item.known_contacts?.granot} omitEmpty />;
}

export function IntakeContactCycleLine({
  item,
}: {
  item: GranotLifecycleCandidateItem;
}) {
  if (!intakeShowsGranotContact(item) || !item.known_contacts?.granot) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{BOOKING_INTAKE_STORY.contactCycle.line}</p>
      {item.known_contacts.granot.differs_from_ingested === true ? (
        <p className="text-sm text-muted-foreground">{BOOKING_INTAKE_STORY.contactCycle.changed}</p>
      ) : null}
    </div>
  );
}

export function IntakeKnownContactsCards({
  item,
  compact = false,
}: {
  item: GranotLifecycleCandidateItem;
  compact?: boolean;
}) {
  if (item.lead_ref.model !== "FormLead") return null;
  const known = item.known_contacts;
  const formSubmitted = known?.form_submitted ?? {
    name: item.contact?.name,
    phone_number: item.contact?.phone_number,
    email: item.contact?.email,
  };
  return (
    <FormSubmittedGranotCards
      formSubmitted={formSubmitted}
      granot={known?.granot}
      compact={compact}
    />
  );
}
