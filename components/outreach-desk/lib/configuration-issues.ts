/**
 * A refused `PATCH /configuration` in words (lifecycle repair ADM-5). The server answers 400 `INVALID_INPUT` with
 * `issues[] {path, code, message?}`: its own guards (`count_scope_not_prospective`, olr C1a; `engine_policy_unavailable`,
 * olr B3) and the schema's issue codes (`too_big`, `custom`, …). Each issue reads by its code, with the setting named
 * from the editor's copy; the server's message and raw paths are never shown. An unknown code reads as a generic
 * refusal naming the code, and is reported once in development (`unknown-codes.ts`). Pure: no React.
 */
import { isSalesOutreachApiError } from "@/lib/api/salesOutreach";
import { deskCopy } from "../outreach-desk-copy";
import { CONFIGURATION_RULE_SWITCHES, CONFIGURATION_TUNABLE_GROUPS, tunablePath } from "./configuration-patch";
import { reportUnknownDeskCode } from "./unknown-codes";

const c = deskCopy.configEditor;

export type ConfigurationIssueLine = { code: string; text: string };

/** The setting an issue path names, in words (never the raw path). */
export function configurationFieldLabel(rawPath: string): string {
  const path = rawPath.replace(/^value\./, "");
  for (const group of Object.values(CONFIGURATION_TUNABLE_GROUPS)) {
    for (const t of group) if (path === tunablePath(t)) return c.tunables[t.field]?.label ?? c.fields.fallback;
  }
  for (const [key, sw] of Object.entries(CONFIGURATION_RULE_SWITCHES)) {
    if (path === `${sw.namespace}.${sw.field}`) return c.rules.names[key] ?? c.fields.fallback;
  }
  if (path === "goals.count_scope_schedule" || path.startsWith("goals.count_scope_schedule.")) return c.fields.count_scope_schedule;
  const intake = /^cadence\.intake_default_rule\.([a-z_]+)$/.exec(path);
  if (intake) {
    const source = c.intake.sources[intake[1]!];
    return source ? c.fields.intake(source) : c.intake.title;
  }
  if (path === "cadence.intake_default_rule") return c.intake.title;
  if (path === "transition.backfill_lookback_days" || path === "transition.backfill_include_upcoming_moves") return c.fields.backfill;
  if (path === "cadence") return c.fields.cadence;
  return c.fields.fallback;
}

function issueText(path: string, code: string): string {
  const field = configurationFieldLabel(path);
  const bare = path.replace(/^value\./, "");
  switch (code) {
    case "count_scope_not_prospective":
      return c.issues.count_scope_not_prospective;
    case "engine_policy_unavailable":
      return c.issues.engine_policy_unavailable;
    case "custom":
      if (bare === "evidence.today_coverage_tolerance_minutes") return c.issues.coverageBelowSettlement;
      if (field === c.fields.backfill) return c.issues.backfillRequired;
      return c.issues.failedCheck(field);
    case "too_small":
    case "too_big":
      return c.issues.outOfRange(field);
    case "invalid_type":
    case "invalid_value":
    case "invalid_format":
    case "invalid_union":
      return c.issues.notAccepted(field);
    case "unrecognized_keys":
      return c.issues.unknownKey;
    default:
      reportUnknownDeskCode({ kind: "configuration_issue", code: null, value: code });
      return c.issues.refused(field, code);
  }
}

/** One line per distinct refusal (several `engine_policy_unavailable` reasons read as one line). */
export function configurationIssueLines(issues: ReadonlyArray<{ path: string; code: string }> | undefined): ConfigurationIssueLine[] {
  const lines: ConfigurationIssueLine[] = [];
  const seen = new Set<string>();
  for (const issue of issues ?? []) {
    const text = issueText(issue.path, issue.code);
    if (seen.has(text)) continue;
    seen.add(text);
    lines.push({ code: issue.code, text });
  }
  return lines;
}

/**
 * What a failed configuration write says: a stale revision reads as the configuration conflict; a 400 with issues
 * reads issue by issue; anything else is the desk's generic failure.
 */
export function configurationWriteError(error: unknown): { summary: string; lines: ConfigurationIssueLine[] } | null {
  if (!error) return null;
  if (isSalesOutreachApiError(error)) {
    if (error.code === "REVISION_CONFLICT") return { summary: c.conflict, lines: [] };
    if (error.status === 403) return { summary: deskCopy.errors.forbidden, lines: [] };
    const lines = configurationIssueLines(error.issues);
    if (lines.length) return { summary: c.refusedSummary, lines };
  }
  return { summary: deskCopy.errors.failed(null), lines: [] };
}
