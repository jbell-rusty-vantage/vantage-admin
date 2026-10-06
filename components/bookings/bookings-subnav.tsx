"use client";
/**
 * Bookings tabs (doc 01): To finish · All bookings · Cancellations · Reconciliation, plus the Precise Booking Form.
 * To finish and Reconciliation are Owner-only (the booking intakes and the reconciliation workbench).
 */
import { usePathname } from "next/navigation";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { useSidebarBadges } from "@/components/layout/use-sidebar-badges";
import { Tabs } from "@/components/ui/crm";

type BookingsTab = {
  href: string;
  label: string;
  ownerOnly?: boolean;
  badge?: "bookings";
};

const tabs: BookingsTab[] = [
  { href: "/intakes", label: "To finish", ownerOnly: true, badge: "bookings" },
  { href: "/bookings", label: "All bookings" },
  { href: "/bookings/cancellations", label: "Cancellations" },
  { href: "/bookings/reconciliation", label: "Reconciliation", ownerOnly: true },
  { href: "/bookings/new", label: "Precise Booking Form" },
];

const tabHrefs = tabs.map((tab) => tab.href);

export function isBookingsTabActive(pathname: string, href: string): boolean {
  const matches = (tabHref: string) =>
    pathname === tabHref || pathname.startsWith(`${tabHref}/`);

  if (!matches(href)) {
    return false;
  }

  return !tabHrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      matches(other),
  );
}

export function BookingsSubnav() {
  const pathname = usePathname();
  const role = useDashboardRole();
  const badges = useSidebarBadges(role ?? "admin");
  const visible = tabs.filter((tab) => role === "owner" || !tab.ownerOnly);
  const active = visible.find((tab) => isBookingsTabActive(pathname, tab.href))?.href ?? "/bookings";

  return (
    <Tabs<string>
      label="Bookings navigation"
      value={active}
      hrefFor={(href) => href}
      tabs={visible.map((tab) => ({ value: tab.href, label: tab.label, badge: tab.badge ? badges[tab.badge] : null }))}
    />
  );
}
