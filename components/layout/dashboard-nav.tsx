"use client";
/**
 * The dashboard sidebar (dashboard-redesign-proposal/01-sidebar-and-information-architecture.md). Six destinations
 * answer the Owner's three questions — what needs me (Today), find this customer or job (Leads, Bookings), how is the
 * team doing (Outreach Desk) — and push everything else behind Insights and Setup. Nothing was deleted: the old
 * destinations are regrouped under tabs and reached by permanent redirects (`next.config.ts`).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpenCheck,
  Headset,
  LayoutDashboard,
  ListChecks,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type DashboardNavKey = "today" | "leads" | "bookings" | "outreach-desk" | "insights" | "setup";

export type DashboardNavItem = {
  key: DashboardNavKey;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Other route prefixes this destination owns (old pages regrouped under it); they keep the item active. */
  activeFor: readonly string[];
  ownerOnly?: boolean;
  /** Sales Outreach Desk (P09b): the destinations a Manager sees. */
  managerVisible?: boolean;
  /** Which badge the sidebar shows next to the item (counts come from `useSidebarBadges`). */
  badge?: "today" | "bookings" | "leads";
};

/** Roles that render the dashboard shell: the Owner, a generic Admin and (for Today → Operations only) a Manager. */
export type DashboardShellRole = "owner" | "admin" | "manager";

const extraPageTitles: { href: string; title: string }[] = [
  { href: "/leads/timeline", title: "Job Timeline" },
  { href: "/job-timeline", title: "Job Timeline" },
  { href: "/intakes", title: "Bookings to finish" },
  { href: "/bookings/reconciliation", title: "Booking Reconciliation" },
  { href: "/bookings/new", title: "Precise Booking Form" },
  { href: "/cancellations/new", title: "Record a cancellation" },
  { href: "/analytics", title: "Analytics" },
  { href: "/reporting", title: "Sheets" },
  { href: "/reporting/new", title: "Create New Report" },
  { href: "/reporting/destinations", title: "Sheets" },
  { href: "/operations-registry", title: "Setup" },
  { href: "/granot-lifecycle", title: "Connections & health" },
  { href: "/ingestion", title: "Connections & health" },
  { href: "/extension", title: "People & access" },
  { href: "/testimonials", title: "Website" },
  { href: "/sales-intelligence", title: "Sales Intelligence" },
];

export const dashboardNavItems: readonly DashboardNavItem[] = [
  { key: "today", label: "Today", href: "/", icon: LayoutDashboard, activeFor: ["/daily"], ownerOnly: true, managerVisible: true, badge: "today" },
  { key: "leads", label: "Leads", href: "/leads", icon: ListChecks, activeFor: ["/leads", "/job-timeline", "/manual", "/search"], badge: "leads" },
  { key: "bookings", label: "Bookings", href: "/bookings", icon: BookOpenCheck, activeFor: ["/bookings", "/intakes", "/cancellations"], badge: "bookings" },
  { key: "outreach-desk", label: "Outreach Desk", href: "/outreach-desk", icon: Headset, activeFor: ["/outreach-desk", "/sales-intelligence"], ownerOnly: true, managerVisible: true },
  { key: "insights", label: "Insights", href: "/insights", icon: BarChart3, activeFor: ["/insights", "/analytics", "/reporting"] },
  {
    key: "setup",
    label: "Setup",
    href: "/setup",
    icon: Settings,
    activeFor: ["/setup", "/operations-registry", "/granot-lifecycle", "/ingestion", "/extension", "/testimonials", "/settings"],
  },
];

function navItemVisible(adminRole: DashboardShellRole, item: DashboardNavItem): boolean {
  if (adminRole === "owner") return true;
  if (adminRole === "manager") return item.managerVisible === true;
  return !item.ownerOnly;
}

export function visibleDashboardNav(adminRole: DashboardShellRole): DashboardNavItem[] {
  return dashboardNavItems.filter((item) => navItemVisible(adminRole, item));
}

export const dashboardNavigation: DashboardNavItem[] = visibleDashboardNav("owner");

/** The role's home: the Owner and a Manager land on Today; an Admin has no Today and lands on Leads. */
export function dashboardHomeFor(adminRole: DashboardShellRole): string {
  return adminRole === "admin" ? "/leads" : "/";
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The sidebar item a path belongs to (its own href or one of the regrouped prefixes). */
export function activeNavKey(pathname: string): DashboardNavKey | null {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  let best: { key: DashboardNavKey; length: number } | null = null;
  for (const item of dashboardNavItems) {
    for (const prefix of [item.href, ...item.activeFor]) {
      if (!isActivePath(path, prefix)) continue;
      const length = prefix === "/" ? 1 : prefix.length;
      if (!best || length > best.length) best = { key: item.key, length };
    }
  }
  return best?.key ?? null;
}

function titleFromLastSegment(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean).pop();
  if (!segment) {
    return "Today";
  }

  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function pageTitleForPath(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  if (path === "/") {
    return "Today";
  }

  const titles = new Map<string, string>();
  for (const item of dashboardNavItems) {
    titles.set(item.href, item.label);
  }
  for (const extra of extraPageTitles) {
    titles.set(extra.href, extra.title);
  }

  let bestHref = "";
  let bestTitle = "";
  for (const [href, title] of titles) {
    if (href === "/") {
      continue;
    }
    if (path === href || path.startsWith(`${href}/`)) {
      if (href.length > bestHref.length) {
        bestHref = href;
        bestTitle = title;
      }
    }
  }

  return bestTitle || titleFromLastSegment(path);
}

export type SidebarBadgeCounts = Partial<Record<NonNullable<DashboardNavItem["badge"]>, number | null>>;

function NavLink({ item, active, badge, onNavigate }: { item: DashboardNavItem; active: boolean; badge: number | null | undefined; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className="crm-nav__item" aria-current={active ? "page" : undefined} onClick={onNavigate} data-nav={item.key} title={item.label}>
      <Icon aria-hidden="true" />
      <span className="crm-nav__label">{item.label}</span>
      {badge ? (
        <span className="crm-nav__badge" aria-label={`${badge} waiting`}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function DashboardNav({
  adminRole,
  badges = {},
  onNavigate,
}: {
  adminRole: DashboardShellRole;
  badges?: SidebarBadgeCounts;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = visibleDashboardNav(adminRole);
  const active = activeNavKey(pathname);

  return (
    <nav aria-label="Dashboard" className="crm-nav">
      {items.map((item) => (
        <NavLink key={item.key} item={item} active={item.key === active} badge={item.badge ? badges[item.badge] : null} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

/** The phone-width bottom bar: the same items, badges on Today, Leads and Bookings. */
export function DashboardMobileBar({ adminRole, badges = {} }: { adminRole: DashboardShellRole; badges?: SidebarBadgeCounts }) {
  const pathname = usePathname();
  const items = visibleDashboardNav(adminRole);
  const active = activeNavKey(pathname);
  return (
    <nav aria-label="Dashboard" className="crm-mobilebar">
      {items.map((item) => {
        const Icon = item.icon;
        const badge = item.badge ? badges[item.badge] : null;
        return (
          <Link key={item.key} href={item.href} className="crm-mobilebar__item" aria-current={item.key === active ? "page" : undefined} data-nav={item.key}>
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
            {badge ? <span className="crm-nav__badge">{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
