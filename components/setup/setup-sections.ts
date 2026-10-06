/**
 * The nine Setup sections (doc 19 "Routes", plus External Sheet Ingestion split out of Connections on the Owner's ask): keys, routes, roles and badges. Pure (no JSX) so `tests/setup-shell.test.ts`
 * covers the role filter and the active-section lookup. Admin reads every section except Connections and Website
 * (Owner only; the nav hides them and the route shows the shell's "Not allowed" card); People shows Admin the roster
 * read-only. Badges: Lead sources carries the "Things that need you" count, People the "Not matched to a person" count.
 */
import { Banknote, Cable, FileSpreadsheet, Globe, History, Landmark, Puzzle, Truck, Users, type LucideIcon } from "lucide-react";
import { SETUP_ROUTES } from "@/lib/setup/setup-links";
import { SETUP_COPY } from "./setup-copy";

export type SetupSectionKey = keyof typeof SETUP_COPY.sections;

export type SetupBadgeKey = "needsYou" | "notMatched";

export type SetupSection = {
  key: SetupSectionKey;
  label: string;
  purpose: string;
  href: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
  badge?: SetupBadgeKey;
};

function section(key: SetupSectionKey, href: string, icon: LucideIcon, extra: Partial<Pick<SetupSection, "ownerOnly" | "badge">> = {}): SetupSection {
  return { key, href, icon, label: SETUP_COPY.sections[key].label, purpose: SETUP_COPY.sections[key].purpose, ...extra };
}

export const SETUP_SECTIONS: readonly SetupSection[] = [
  section("lead-sources", SETUP_ROUTES.leadSources, Cable, { badge: "needsYou" }),
  section("lead-costs", SETUP_ROUTES.leadCosts, Banknote),
  section("people", SETUP_ROUTES.people, Users, { badge: "notMatched" }),
  section("merchants", SETUP_ROUTES.merchants, Landmark),
  section("carriers", SETUP_ROUTES.carriers, Truck),
  section("connections", SETUP_ROUTES.connections, Puzzle, { ownerOnly: true }),
  section("sheet-ingestion", SETUP_ROUTES.sheetIngestion, FileSpreadsheet),
  section("website", SETUP_ROUTES.website, Globe, { ownerOnly: true }),
  section("changes", SETUP_ROUTES.changes, History),
];

export type SetupRole = "owner" | "admin" | "manager" | null;

/** The sections a role is shown in the sub-navigation. */
export function setupSectionsFor(role: SetupRole): SetupSection[] {
  return SETUP_SECTIONS.filter((item) => role === "owner" || !item.ownerOnly);
}

/** The section a pathname belongs to (`/setup/people?…` → people); `/setup` itself maps to Lead sources. */
export function setupSectionForPath(pathname: string): SetupSection | null {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  if (path === "/setup" || path === "/setup/") return SETUP_SECTIONS[0]!;
  return SETUP_SECTIONS.find((item) => path === item.href || path.startsWith(`${item.href}/`)) ?? null;
}

/** Whether a role may open a section's route (the nav hides Owner-only sections; the route shows "Not allowed"). */
export function canOpenSetupSection(role: SetupRole, key: SetupSectionKey): boolean {
  const item = SETUP_SECTIONS.find((candidate) => candidate.key === key);
  if (!item) return false;
  return role === "owner" || !item.ownerOnly;
}

export type SetupBadgeCounts = Partial<Record<SetupBadgeKey, number | null>>;

/** A badge is a count, never zero. */
export function setupBadgeFor(section: SetupSection, counts: SetupBadgeCounts): number | null {
  if (!section.badge) return null;
  const value = counts[section.badge];
  return value && value > 0 ? value : null;
}
