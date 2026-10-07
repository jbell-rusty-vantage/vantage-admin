/**
 * Owner-visible strings of Setup → Change history (doc 19). Entity and action names use the glossary words (Lead
 * source, Feed, Granot name, Inbound Number), never the registry's engineering names. Every string passes
 * `lib/operations-registry/ownerLanguageDeck.ts`.
 */
export const CHANGES_COPY = {
  listTitle: "Changes",
  listSubtitle: "Every Setup change, who made it and when. Times are exact moments, and the end date includes the whole day you pick.",
  filters: {
    entity: "What changed",
    anyEntity: "Anything",
    who: "Who",
    anyone: "Anyone",
    selectedPerson: "Selected person",
    from: "From",
    to: "To",
    clear: "Clear filters",
  },
  loading: "Loading changes",
  readFailure: "The change history did not load.",
  empty: "No changes match these filters.",
  total: (total: number, page: number) => `Page ${page} · ${total} ${total === 1 ? "change" : "changes"}`,
  columns: { when: "When", who: "Who", what: "What", reason: "Reason", detail: "Before and after" },
  noReason: "No reason recorded",
  view: "View",
  hide: "Hide",
  previous: "Previous",
  next: "Next",
  perPage: "Per page",
  drawer: {
    title: (action: string, entity: string) => `${action} · ${entity}`,
    byLine: (when: string, who: string, role: string) => `${when} · ${who} (${role})`,
    reason: "Reason",
    beforeAfter: "Before and after",
    note: "This is the history of changes made in Setup, saved together with the change itself.",
    noDiff: "No before and after differences were recorded.",
    truncated: "Showing the first 200 fields to keep the page quick.",
    columns: { field: "Field", change: "Change", before: "Before", after: "After" },
    kinds: { added: "Added", removed: "Removed", changed: "Changed", unchanged: "Unchanged" },
    none: "None",
    linkedRecord: "A linked record",
    advanced: "Advanced",
    advancedLine: (entityId: string, requestId: string) => `Record ${entityId}${requestId ? ` · Request ${requestId}` : ""}`,
    close: "Close",
  },
} as const;

/** The Owner's name for each kind of record the change log tracks. */
export const CHANGE_ENTITY_LABELS: Readonly<Record<string, string>> = {
  agent: "Agent",
  merchant: "Merchant",
  source_company: "Lead source",
  source_granularity: "Feed",
  cpl_schedule: "Lead cost schedule",
  ringcentral_route: "Inbound number",
  ringcentral_assignment: "Inbound number filing",
  granot_crm_source: "Granot name",
  granot_automation_source: "Granot name (automation)",
  systems_locations: "Where things live (Systems)",
  registry: "Registry",
};

export const CHANGE_ACTION_LABELS: Readonly<Record<string, string>> = {
  create: "Created",
  update: "Updated",
  activate: "Turned on",
  deactivate: "Turned off",
  rename: "Renamed",
  schedule_apply: "Lead costs applied",
  validate: "Checked",
  reassign: "Filed elsewhere",
  correction: "Corrected",
};
