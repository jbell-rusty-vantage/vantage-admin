/**
 * Owner language deck — banned implementation terms.
 *
 * Must match vantage-main-server/src/services/operationsRegistry/ownerLanguageDeck.ts.
 * Do not change one copy without the other.
 *
 * Database fields stay `source_company` / `source_granularity`. Owner-facing
 * strings say Lead source and Feed. Specification §7.6.
 */
export const OWNER_LANGUAGE_DECK_BANNED_TERMS = [
  "granularity",
  "lifecycle",
  "disposition",
  "route_key",
  "lead_model",
  "policy_version",
] as const;

/** §7.6 Avoid terms. Allowed only where the spec names a replacement exception. */
export const OWNER_LANGUAGE_DECK_AVOID_PHRASES = [
  "owner label",
  "crm label",
  "validation status",
  "route assignment",
  "outbound sms",
  "consent basis",
  "template version",
  "granot sources",
  "display label",
  "operational label",
  "lifecycle route",
  "lifecycle activation",
  "lead created policy",
  "operational csv enabled",
  "link_only",
  "observation_only",
  "create_if_missing",
  "{company}",
  "sheet lead source column",
] as const;

export const OWNER_LANGUAGE_DECK_OBJECT_ID = /^[a-f0-9]{24}$/i;

export const COMPATIBILITY_OBSERVATION_WINDOW_STARTED_AT = "2026-09-01";

const ALLOWED_EXCEPTIONS = [
  "source company column",
  "ringcentral verified queue",
  "checked against ringcentral",
  "check it against ringcentral",
];

function stripAdvanced(markup: string): string {
  return markup
    .replace(/<details[\s\S]*?<\/details>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
}

function visibleText(markup: string): string {
  return stripAdvanced(markup)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function findOwnerMarkupLeaks(markup: string): string[] {
  const text = visibleText(markup);
  const lower = text.toLowerCase();
  const leaks: string[] = [];
  for (const term of OWNER_LANGUAGE_DECK_BANNED_TERMS) {
    if (lower.includes(term)) {
      leaks.push(term);
    }
  }
  for (const phrase of OWNER_LANGUAGE_DECK_AVOID_PHRASES) {
    if (lower.includes(phrase)) {
      leaks.push(phrase);
    }
  }
  const hex = text.match(/\b[a-f0-9]{24}\b/gi) ?? [];
  for (const id of hex) {
    leaks.push(`raw_object_id:${id}`);
  }
  void ALLOWED_EXCEPTIONS;
  return leaks;
}
