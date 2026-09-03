"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  Boxes,
  ClipboardPen,
  ClipboardX,
  Copy,
  Download,
  FileText,
  Headphones,
  History,
  Home,
  Inbox,
  Import,
  MessageSquareQuote,
  Phone,
  PhoneForwarded,
  Presentation,
  Radio,
  ScrollText,
  SearchCheck,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardNavChild = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
  children?: DashboardNavChild[];
};

export type DashboardNavSection = {
  id: "today" | "records" | "people" | "insight" | "system";
  label: string;
  items: DashboardNavItem[];
};

const extraPageTitles: { href: string; title: string }[] = [
  { href: "/search", title: "Search" },
  { href: "/bookings/reconciliation", title: "Booking Reconciliation" },
  { href: "/bookings/new", title: "Precise Booking Form" },
  { href: "/cancellations/new", title: "New Cancellation" },
];

export const dashboardNavSections: DashboardNavSection[] = [
  {
    id: "today",
    label: "Today",
    items: [
      { label: "Overview", href: "/", icon: Home },
      { label: "Live Events", href: "/live-events", icon: Radio, ownerOnly: true },
      { label: "Lead Conversations", href: "/conversations", icon: Headphones, ownerOnly: true },
      { label: "Intakes", href: "/intakes", icon: Inbox, ownerOnly: true },
      { label: "Manual", href: "/manual", icon: ClipboardPen, ownerOnly: true },
    ],
  },
  {
    id: "records",
    label: "Records",
    items: [
      {
        label: "Form Leads",
        href: "/form-leads",
        icon: FileText,
        children: [{ label: "Duplicate Form Leads", href: "/duplicate-form-leads", icon: Copy }],
      },
      {
        label: "Call Leads",
        href: "/call-leads",
        icon: Phone,
        children: [{ label: "Duplicate Call Leads", href: "/duplicate-call-leads", icon: PhoneForwarded }],
      },
      { label: "Bookings", href: "/bookings", icon: BookOpenCheck },
      { label: "Cancellations", href: "/cancellations", icon: ClipboardX },
      { label: "Job Timeline", href: "/job-timeline", icon: History, ownerOnly: true },
      { label: "Customers", href: "/customers", icon: Users },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { label: "Agents", href: "/agents", icon: ShieldCheck },
      { label: "Testimonials", href: "/testimonials", icon: MessageSquareQuote },
    ],
  },
  {
    id: "insight",
    label: "Insight",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Agent Sales Report", href: "/reports/agent-sales", icon: SearchCheck },
      { label: "Reporting", href: "/reporting", icon: Presentation },
      { label: "Exports", href: "/exports", icon: Download },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { label: "Observational", href: "/observational", icon: Activity },
      { label: "Operations Registry", href: "/operations-registry", icon: Boxes },
      { label: "Ingestion", href: "/ingestion", icon: Import },
      { label: "Audit Log", href: "/audit-log", icon: ScrollText, ownerOnly: true },
    ],
  },
];

function flattenNavItems(items: DashboardNavItem[]): DashboardNavItem[] {
  return items.flatMap((item) => [
    {
      label: item.label,
      href: item.href,
      icon: item.icon,
      ...(item.ownerOnly ? { ownerOnly: true } : {}),
    },
    ...(item.children ?? []).map((child) => ({
      label: child.label,
      href: child.href,
      icon: child.icon,
    })),
  ]);
}

export function visibleDashboardNavSections(adminRole: "owner" | "admin"): DashboardNavSection[] {
  return dashboardNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => adminRole === "owner" || !item.ownerOnly),
    }))
    .filter((section) => section.items.length > 0);
}

export function visibleDashboardNav(adminRole: "owner" | "admin"): DashboardNavItem[] {
  return flattenNavItems(visibleDashboardNavSections(adminRole).flatMap((section) => section.items));
}

export const dashboardNavigation: DashboardNavItem[] = visibleDashboardNav("owner");

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function titleFromLastSegment(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean).pop();
  if (!segment) {
    return "Overview";
  }

  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function pageTitleForPath(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  if (path === "/") {
    return "Overview";
  }

  const titles = new Map<string, string>();
  for (const item of flattenNavItems(dashboardNavSections.flatMap((section) => section.items))) {
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

function itemIsVisuallyActive(pathname: string, item: DashboardNavItem | DashboardNavChild): boolean {
  if (isActivePath(pathname, item.href)) {
    return true;
  }

  if ("children" in item && item.children?.some((child) => isActivePath(pathname, child.href))) {
    return true;
  }

  return false;
}

function NavLink({
  item,
  pathname,
  collapsed,
  indented,
  onNavigate,
}: {
  item: DashboardNavItem | DashboardNavChild;
  pathname: string;
  collapsed: boolean;
  indented?: boolean;
  onNavigate?: () => void;
}) {
  const current = isActivePath(pathname, item.href);
  const active = itemIsVisuallyActive(pathname, item);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex items-center rounded-md text-[13px] leading-5 font-medium transition-colors",
        collapsed ? "justify-center px-1.5 py-1.5" : "gap-2 px-2 py-1",
        indented ? "text-xs font-normal" : undefined,
        current
          ? "bg-pale-gold/80 text-navy"
          : active
            ? "bg-pale-gold/45 text-navy"
            : "text-steel hover:bg-steel-100 hover:text-navy",
      )}
    >
      <Icon
        className={cn("shrink-0", indented ? "h-3 w-3" : "h-3.5 w-3.5")}
        aria-hidden="true"
      />
      <span className={cn("min-w-0 truncate", collapsed ? "sr-only" : undefined)}>{item.label}</span>
    </Link>
  );
}

export function DashboardNav({
  adminRole,
  collapsed = false,
  onNavigate,
}: {
  adminRole: "owner" | "admin";
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = visibleDashboardNavSections(adminRole);

  return (
    <nav aria-label="Dashboard" className="px-0.5">
      {sections.map((section, sectionIndex) => (
        <div key={section.id} className={sectionIndex === 0 ? undefined : "mt-3"}>
          {collapsed ? (
            sectionIndex > 0 ? (
              <div className="mx-1.5 mb-2 border-t border-steel-200/80" aria-hidden="true" />
            ) : null
          ) : (
            <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-steel/70">
              {section.label}
            </p>
          )}
          <div className="space-y-px">
            {section.items.map((item) => (
              <div key={item.href}>
                <NavLink item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
                {!collapsed && item.children?.length ? (
                  <div className="ml-3.5 mt-px space-y-px border-l border-steel-200 pl-2">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.href}
                        item={child}
                        pathname={pathname}
                        collapsed={false}
                        indented
                        onNavigate={onNavigate}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
