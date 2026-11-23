"use client";
/**
 * Bookings tabs (doc 01): To finish · All bookings · Cancellations · Reconciliation. The Precise Booking Form is the New booking button on All bookings.
 * To finish and Reconciliation are Owner-only (the booking intakes and the reconciliation workbench).
 */
import { usePathname } from "next/navigation";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { useQuery } from "@tanstack/react-query";
import { newBookingCount } from "@/lib/api/bookingsToFinish";
import { fetchGranotLifecycleHealth } from "@/lib/api/granotLifecycle";
import { queryKeys } from "@/lib/query/keys";
import { Tabs } from "@/components/ui/crm";

type BookingsTab = {
  href: string;
  label: string;
  ownerOnly?: boolean;
};

const tabs: BookingsTab[] = [
  { href: "/intakes", label: "To finish", ownerOnly: true },
  { href: "/bookings", label: "All bookings" },
  { href: "/bookings/cancellations", label: "Cancellations" },
  { href: "/bookings/reconciliation", label: "Reconciliation", ownerOnly: true },
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
  const { data: toFinishCount } = useQuery({
    queryKey: queryKeys.granotLifecycle.health(),
    queryFn: fetchGranotLifecycleHealth,
    enabled: role === "owner",
    select: (health) => newBookingCount(health.open_cases),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
  const visible = tabs.filter((tab) => role === "owner" || !tab.ownerOnly);
  const active = visible.find((tab) => isBookingsTabActive(pathname, tab.href))?.href ?? "/bookings";

  return (
    <Tabs<string>
      label="Bookings navigation"
      value={active}
      hrefFor={(href) => href}
      tabs={visible.map((tab) => ({ value: tab.href, label: tab.label, badge: tab.href === "/intakes" ? toFinishCount : null }))}
    />
  );
}
