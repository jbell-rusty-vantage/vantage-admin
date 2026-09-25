/**
 * UI-1 §1.3 (UX4 as amended by UX17): the only file that builds links into the quarantined legacy page.
 * Numbers live there until UI-3, which deletes this file.
 */
const LEGACY = "/sales-intelligence/legacy";

export function legacyNumberHref(numberId: string): string {
  return `${LEGACY}?view=numbers&number=${encodeURIComponent(numberId)}`;
}

export function legacyNumbersHref(): string {
  return `${LEGACY}?view=numbers`;
}
