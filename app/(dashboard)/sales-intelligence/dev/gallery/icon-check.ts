import * as lucide from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** UI-0 §7.3 icon map, row by row (kind or use → lucide names), plus the §7.2 indicator icons. */
export const ICON_MAP: { use: string; names: string[] }[] = [
  { use: "call (inbound / outbound / missed / unknown)", names: ["phone-incoming", "phone-outgoing", "phone-missed", "phone"] },
  { use: "lead_received", names: ["inbox"] },
  { use: "call_qualified", names: ["badge-check"] },
  { use: "conversation_analyzed", names: ["sparkles"] },
  { use: "assessment_published", names: ["gauge"] },
  { use: "granot_priority_changed, quoted_changed", names: ["flag", "receipt-text"] },
  { use: "receiver_agent_changed, assigned", names: ["user-round-cog", "user-check"] },
  { use: "number_attached", names: ["link"] },
  { use: "followup_created / _completed / _snoozed / _superseded / _redated", names: ["calendar-plus", "calendar-check", "alarm-clock-off", "replace", "calendar-clock"] },
  { use: "owner_note, owner_correction", names: ["sticky-note", "pencil"] },
  { use: "review_opened", names: ["circle-alert"] },
  { use: "closed, booking_recorded, cancellation_recorded", names: ["archive", "circle-dollar-sign", "circle-x"] },
  { use: "lead_message_sent, nudge_sent, rep_replied, thread_resolved", names: ["message-square-text", "send", "message-square-reply", "message-square-check"] },
  { use: "band_changed, granot_observed", names: ["arrow-up-down", "eye"] },
  { use: "unknown kind", names: ["dot"] },
  { use: "Actions: Open analysis, Message rep, Apply, Refresh, Filters", names: ["file-search", "send", "check", "refresh-cw", "sliders-horizontal"] },
  { use: "Chips: live, review / uncertain, disagree, blocker, default", names: ["radio", "circle-help", "triangle-alert", "phone-off", "bot"] },
  { use: "Chips: recording, analyzed, human, voicemail", names: ["mic", "sparkles", "user-round", "voicemail"] },
  { use: "State pills", names: ["circle", "circle-dot", "circle-pause", "circle-help", "circle-check"] },
];

/**
 * The substitute chosen for a name missing from the installed lucide-react (kebab name → PascalCase export).
 * Empty: every name exists in 1.17.0 (checked by gallery.test.ts). Add an entry here if an upgrade drops one.
 */
export const ICON_SUBSTITUTES: Record<string, string> = {};

export const toExportName = (kebab: string) => kebab.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");

const exportsMap = lucide as unknown as Record<string, unknown>;

export type IconCheck = { use: string; name: string; exportName: string; Icon: LucideIcon | null; substitute: string | null; SubstituteIcon: LucideIcon | null };

const lookup = (exportName: string): LucideIcon | null => {
  const value = exportsMap[exportName];
  return value && (typeof value === "object" || typeof value === "function") ? (value as LucideIcon) : null;
};

/** Each name in the map, looked up in the installed package. */
export function checkIcons(): IconCheck[] {
  return ICON_MAP.flatMap(({ use, names }) =>
    names.map((name) => {
      const exportName = toExportName(name);
      const Icon = lookup(exportName);
      const substitute = Icon ? null : (ICON_SUBSTITUTES[name] ?? null);
      return { use, name, exportName, Icon, substitute, SubstituteIcon: substitute ? lookup(substitute) : null };
    }),
  );
}
