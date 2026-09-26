/**
 * Outreach card layout §5: a rep's fixed avatar colour, from the Agent id. One palette for every surface (card now;
 * Numbers and rep pages later). Every colour carries white initials at WCAG AA (≥ 4.5 : 1, a test checks it); the
 * backgrounds don't change with the theme, so the pair holds in both.
 */
export const REP_COLORS = [
  "#1d4ed8",
  "#0f766e",
  "#7c3aed",
  "#b91c1c",
  "#a21caf",
  "#047857",
  "#c2410c",
  "#4338ca",
  "#be185d",
  "#475569",
] as const;

export const REP_INITIALS_COLOR = "#ffffff";

/** FNV-1a over the id: the same id always lands on the same colour, whatever the list order. */
export function repColor(agentId: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < agentId.length; i++) {
    hash ^= agentId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return REP_COLORS[hash % REP_COLORS.length]!;
}

const words = (name: string) => name.trim().split(/\s+/).filter(Boolean);

/** `Jake Bell` → `JB`; `Jake` → `J`; `Jake van der Bell` → `JB`. */
export function repInitials(name: string): string {
  const w = words(name);
  if (!w.length) return "";
  const first = w[0]!.charAt(0);
  return (w.length > 1 ? first + w[w.length - 1]!.charAt(0) : first).toUpperCase();
}

/** `Jake Bell` → `Jake B.`; a one-word name prints as sent. */
export function repShortName(name: string): string {
  const w = words(name);
  if (w.length < 2) return w[0] ?? "";
  return `${w[0]} ${w[w.length - 1]!.charAt(0).toUpperCase()}.`;
}
