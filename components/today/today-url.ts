import { Banknote, CalendarClock, Gauge, Users, type LucideIcon } from "lucide-react";
import { todayCopy } from "./today-copy";

export type TodayTab = "pulse" | "operations" | "team" | "money";
export type TodayRole = "owner" | "admin" | "manager" | null;

export const TODAY_TAB_VALUES: readonly TodayTab[] = ["pulse", "operations", "team", "money"];

export const TODAY_TABS: readonly { value: TodayTab; label: string; icon: LucideIcon }[] = [
  { value: "pulse", label: todayCopy.tabs.pulse, icon: Gauge },
  { value: "operations", label: todayCopy.tabs.operations, icon: CalendarClock },
  { value: "team", label: todayCopy.tabs.team, icon: Users },
  { value: "money", label: todayCopy.tabs.money, icon: Banknote },
];

/** The tab a URL means for a role: a manager only has Operations, an unknown value is Pulse. */
export function parseTodayTab(value: string | null | undefined, role: TodayRole): TodayTab {
  if (role === "manager") return "operations";
  return TODAY_TAB_VALUES.find((tab) => tab === value) ?? "pulse";
}

/** The tabs a role can open. Admin has no Today. */
export function todayTabsFor(role: TodayRole): readonly (typeof TODAY_TABS)[number][] {
  if (role === "owner") return TODAY_TABS;
  if (role === "manager") return TODAY_TABS.filter((tab) => tab.value === "operations");
  return [];
}

export function todayTabHref(tab: TodayTab): string {
  return tab === "pulse" ? "/" : `/?tab=${tab}`;
}

/** Admin has no Today; it lands on Leads. */
export const TODAY_ADMIN_REDIRECT = "/leads";
