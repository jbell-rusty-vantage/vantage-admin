/**
 * UI1-OVERVIEW: number formatting for the Overview. Formatting only: every count, share and state is the server's.
 * Null metrics print `—` (COPY `dash`, final spec §3.3); rates are proportions of counts and print as whole
 * percentages (`24%`, UI-1 §4.2); scores never appear here.
 */
import { copy } from "../sales-intelligence-copy";

export const DASH = copy.ui1.overview.dash;
export const BAND_NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const;

/** `1,234`. */
export const count = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? DASH : n.toLocaleString("en-US"));
/** Whole staffed minutes: `445`. */
export const minutes = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? DASH : Math.round(n).toLocaleString("en-US"));
/** Dollars from the server's dollar amount: `$75`, `$12.50`. */
export function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  const whole = Math.abs(n % 1) < 0.005;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
}
/** A 0–1 share as a whole percentage (`24%`); null → `—`. */
export const percent = (share: number | null | undefined): string => (share == null || !Number.isFinite(share) ? DASH : `${Math.round(share * 100)}%`);
/** `+25`, `−3`, `0`. */
export const signed = (n: number): string => (n > 0 ? `+${count(n)}` : n < 0 ? `\u2212${count(-n)}` : "0");
/** A band count from `bands["n"]`; a missing key is `—`, never 0. */
export const bandValue = (bands: Record<string, number> | null | undefined, band: number): number | null => {
  const value = bands?.[String(band)];
  return typeof value === "number" ? value : null;
};
