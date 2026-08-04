import type {
  ReportingCatalogDataset,
  ReportingDefinitionDraft,
  ReportingSelectedColumn,
  ReportingSourceSelection,
} from "@/lib/api/reporting";

export function defaultColumns(dataset: ReportingCatalogDataset): ReportingSelectedColumn[] {
  return dataset.columns
    .filter((column) => column.default_selected)
    .map((column) => ({ id: column.id, label: column.default_label }));
}

export function reconcileColumns(
  dataset: ReportingCatalogDataset,
  selected: ReportingSelectedColumn[],
): ReportingSelectedColumn[] {
  const allowed = new Map(dataset.columns.map((column) => [column.id, column]));
  return selected
    .filter((column) => allowed.has(column.id))
    .map((column) => ({
      id: column.id,
      label: column.label.trim() || allowed.get(column.id)!.default_label,
    }));
}

export function moveColumn(
  columns: ReportingSelectedColumn[],
  index: number,
  direction: -1 | 1,
): ReportingSelectedColumn[] {
  const target = index + direction;
  if (index < 0 || index >= columns.length || target < 0 || target >= columns.length) {
    return columns;
  }
  const next = [...columns];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function normalizeSourceSelection(
  selections: ReportingSourceSelection[],
): ReportingSourceSelection[] {
  return selections
    .filter((selection) => selection.company_key)
    .map((selection) => ({
      ...selection,
      granularities: [...selection.granularities].sort((a, b) =>
        a.granularity_key.localeCompare(b.granularity_key),
      ),
    }))
    .sort((a, b) => a.company_key.localeCompare(b.company_key));
}

export function localDateInTimeZone(timezone: string, instant = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function idempotencyKeyForRunAttempt(
  current: { revisionId: string; key: string } | null,
  revisionId: string,
  createKey: () => string = () => crypto.randomUUID(),
): string {
  return current?.revisionId === revisionId ? current.key : createKey();
}

export function validateDraft(draft: ReportingDefinitionDraft): string[] {
  const issues: string[] = [];
  if (!draft.name.trim()) issues.push("Name is required.");
  if (draft.date_window_spec.kind === "explicit") {
    const end =
      draft.date_window_spec.throughLocal ??
      draft.date_window_spec.toExclusiveLocal;
    if (!draft.date_window_spec.fromLocal || !end) {
      issues.push("An explicit date range is required.");
    } else if (
      ("throughLocal" in draft.date_window_spec &&
        draft.date_window_spec.fromLocal > end) ||
      ("toExclusiveLocal" in draft.date_window_spec &&
        draft.date_window_spec.fromLocal >= end)
    ) {
      issues.push("The end boundary must be after the start boundary.");
    }
  } else if (
    draft.date_window_spec.preset !== "last_n_days" ||
    !Number.isInteger(draft.date_window_spec.days) ||
    draft.date_window_spec.days < 1 ||
    draft.date_window_spec.days > 366 ||
    draft.date_window_spec.anchor !== "preview_or_run_time" ||
    draft.date_window_spec.endPolicy !== "include_current_local_day"
  ) {
    issues.push("Rolling windows must use the vetted 1–366 day policy.");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: draft.timezone }).format();
  } catch {
    issues.push("Timezone must be a valid IANA timezone.");
  }
  if (draft.source_selection.length === 0) issues.push("Select at least one source company.");
  if (draft.selected_columns.length === 0) issues.push("Select at least one vetted column.");
  if (new Set(draft.selected_columns.map((column) => column.id)).size !== draft.selected_columns.length) {
    issues.push("Selected columns cannot contain duplicates.");
  }
  if (!draft.destination_id.trim()) issues.push("Destination ID is required.");
  if (!/^[a-f\d]{64}$/i.test(draft.destination_snapshot_checksum)) {
    issues.push("Destination snapshot checksum must be 64 hexadecimal characters.");
  }
  return issues;
}
