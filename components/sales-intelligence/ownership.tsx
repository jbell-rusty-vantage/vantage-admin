import type { Agent } from "@/lib/api/salesIntelligence";
import { copy } from "./sales-intelligence-copy";

export function ownerlessLabel() {
  return copy.signals.noOwner;
}

export function ownershipPhrase(
  kind: "assigned" | "owned" | "promised",
  agent: Agent | null | undefined,
) {
  if (!agent) {
    if (kind === "promised") return copy.fields.unknown;
    return copy.fields.unassigned;
  }
  if (kind === "assigned") return `${copy.fields.assignedTo} ${agent.name}`;
  if (kind === "owned") return `${copy.fields.outreachOwnedBy} ${agent.name}`;
  return `${copy.fields.promisedBy} ${agent.name}`;
}

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
    return <span className="si-ownership si-ownership--compact">{ownerlessLabel()}</span>;
  }
  return (
    <span className="si-ownership">
      {promisedBy !== undefined && promisedBy && (
        <span className="si-ownership__item">{ownershipPhrase("promised", promisedBy)}</span>
      )}
      {assignedTo !== undefined && (
        <span className="si-ownership__item">{ownershipPhrase("assigned", assignedTo)}</span>
      )}
      <span className="si-ownership__item">{ownershipPhrase("owned", overallOwner)}</span>
    </span>
  );
}
