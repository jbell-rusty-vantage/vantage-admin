import type {
  GranotAutomationSource,
  GranotOperation,
} from "@/lib/api/granotAutomation";

export const DEFAULT_GRANOT_OPERATIONS: GranotOperation[] = [
  "form_leads",
  "call_leads",
];

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

export function submittedGranotSourceIds(
  sources: GranotAutomationSource[],
  operations: GranotOperation[],
  selectedSourceIds: string[] | null,
): string[] {
  const compatible = compatibleGranotSources(sources, operations);
  const selected =
    selectedSourceIds ?? compatible.map((source) => source.id);
  const compatibleIds = new Set(compatible.map((source) => source.id));
  return [...new Set(selected.filter((id) => compatibleIds.has(id)))];
}

export function granotSubmitLabel(operations: GranotOperation[]): string {
  if (operations.length === 2) return "Create 2 durable plans";
  return operations[0] === "form_leads"
    ? "Create Form Lead plan"
    : "Create Call Lead plan";
}
