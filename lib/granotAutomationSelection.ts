import type {
  GranotAutomationSource,
  GranotOperation,
} from "@/lib/api/granotAutomation";

export const DEFAULT_GRANOT_OPERATIONS: GranotOperation[] = [
  "form_leads",
  "call_leads",
];

/** Exact Granot source labels left unchecked until the operator opts in. */
export const GRANOT_SOURCES_UNSELECTED_BY_DEFAULT = new Set([
  "Best Relocation Forms",
  "BestRelocation Inbounds",
]);

export function isGranotSourceAvailableForApply(
  source: GranotAutomationSource,
): boolean {
  return source.compatibility?.available_for_apply !== false;
}

export function compatibleGranotSources(
  sources: GranotAutomationSource[],
  operations: GranotOperation[],
): GranotAutomationSource[] {
  return sources.filter((source) =>
    source.supported_operations.some((operation) =>
      operations.includes(operation),
    ),
  );
}

export function defaultGranotSourceIds(
  sources: GranotAutomationSource[],
  operations: GranotOperation[],
): string[] {
  return compatibleGranotSources(sources, operations)
    .filter((source) => !GRANOT_SOURCES_UNSELECTED_BY_DEFAULT.has(source.label))
    .filter(isGranotSourceAvailableForApply)
    .map((source) => source.id);
}

export function submittedGranotSourceIds(
  sources: GranotAutomationSource[],
  operations: GranotOperation[],
  selectedSourceIds: string[] | null,
): string[] {
  const compatible = compatibleGranotSources(sources, operations);
  const selected =
    selectedSourceIds ?? defaultGranotSourceIds(sources, operations);
  const selectableIds = new Set(
    compatible.filter(isGranotSourceAvailableForApply).map((source) => source.id),
  );
  return [...new Set(selected.filter((id) => selectableIds.has(id)))];
}

export function granotSubmitLabel(operations: GranotOperation[]): string {
  if (operations.length === 2) return "Create 2 durable plans";
  return operations[0] === "form_leads"
    ? "Create Form Lead plan"
    : "Create Call Lead plan";
}
