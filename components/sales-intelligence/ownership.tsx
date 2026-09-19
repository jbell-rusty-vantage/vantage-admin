import type { Agent } from "@/lib/api/salesIntelligence";
import { copy } from "./sales-intelligence-copy";

export function OwnershipSplit({
  promisedBy,
  assignedTo,
  overallOwner,
}: {
  promisedBy?: Agent | null;
  assignedTo?: Agent | null;
  overallOwner: Agent | null;
}) {
  if (promisedBy === undefined && assignedTo === undefined && !overallOwner) {
    return <span className="si-ownership si-ownership--compact">{copy.signals.noOwner}</span>;
  }
  return (
    <span className="si-ownership">
      {promisedBy !== undefined && (
        <span className="si-ownership__item">
          <span className="si-ownership__label">{copy.fields.promisedBy}</span> {promisedBy?.name ?? copy.fields.unknown}
        </span>
      )}
      {assignedTo !== undefined && (
        <span className="si-ownership__item">
          <span className="si-ownership__label">{copy.fields.assignedTo}</span> {assignedTo?.name ?? copy.fields.unassigned}
        </span>
      )}
      <span className="si-ownership__item">
        <span className="si-ownership__label">{copy.fields.outreachOwnedBy}</span> {overallOwner?.name ?? copy.fields.unassigned}
      </span>
    </span>
  );
}
