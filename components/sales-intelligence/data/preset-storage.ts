/**
 * UI1-DATA: the Priority preset and the Lead toggle, remembered per user in `localStorage` (UI-1 §3.2,
 * addendum §5). Read once on mount; written when the Owner changes them. Every access is guarded: a private
 * window, blocked storage or server rendering reads as "nothing stored" and never throws.
 */
export type StoredPreset = { priority: string[]; attachment: "lead" | "none" | null };

const KEY_PREFIX = "vantage-admin-si-desk-preset:";
export const presetStorageKey = (userId: string) => `${KEY_PREFIX}${userId || "anonymous"}`;

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function readStoredPreset(userId: string): StoredPreset | null {
  try {
    const raw = storage()?.getItem(presetStorageKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as { priority?: unknown; attachment?: unknown };
    const priority = Array.isArray(value.priority) ? value.priority.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
    const attachment = value.attachment === "lead" || value.attachment === "none" ? value.attachment : null;
    return { priority, attachment };
  } catch { return null; }
}

export function writeStoredPreset(userId: string, value: StoredPreset): void {
  try { storage()?.setItem(presetStorageKey(userId), JSON.stringify({ priority: value.priority, attachment: value.attachment })); } catch { /* storage unavailable: the URL still holds the choice */ }
}

/** Addendum §5: New = `0` + `Not set`; Quoted = `1`; Other = `3, 4, 7, 8, 9`. Any other selection is Custom; none is All. */
export const PRIORITY_PRESETS = { new: ["0", "not_set"], quoted: ["1"], other: ["3", "4", "7", "8", "9"] } as const;
export type PriorityPreset = "all" | keyof typeof PRIORITY_PRESETS | "custom";
export function presetOf(priority: readonly string[]): PriorityPreset {
  if (!priority.length) return "all";
  const chosen = [...new Set(priority)].sort().join(",");
  for (const [name, keys] of Object.entries(PRIORITY_PRESETS)) if ([...keys].sort().join(",") === chosen) return name as PriorityPreset;
  return "custom";
}
export const presetPriority = (preset: Exclude<PriorityPreset, "custom">): string[] => (preset === "all" ? [] : [...PRIORITY_PRESETS[preset]]);
