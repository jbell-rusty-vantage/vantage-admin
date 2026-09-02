"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { cn } from "@/lib/utils";

type BookingsTab = {
  href: string;
  label: string;
  ownerOnly?: boolean;
};

const tabs: BookingsTab[] = [
  { href: "/bookings", label: "All Bookings" },
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

  return (
    <nav aria-label="Bookings navigation" className="overflow-x-auto">
      <div className="flex min-w-max gap-2 rounded-lg border bg-background p-2">
        {tabs
          .filter((tab) => role === "owner" || !tab.ownerOnly)
          .map((tab) => {
            const active = isBookingsTabActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "bg-primary text-white"
                    : "text-steel hover:bg-steel-100 hover:text-navy",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
      </div>
    </nav>
  );
}
