"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Overview", href: "/" },
  { label: "Form Leads", href: "/form-leads" },
  { label: "Duplicate Form Leads", href: "/duplicate-form-leads" },
  { label: "Call Leads", href: "/call-leads" },
  { label: "Bookings", href: "/bookings" },
  { label: "Cancellations", href: "/cancellations" },
  { label: "Customers", href: "/customers" },
  { label: "Agents", href: "/agents" },
  { label: "Analytics", href: "/analytics" },
  { label: "Agent Sales Report", href: "/reports/agent-sales" },
  { label: "Audit Log", href: "/audit-log" },
  { label: "Exports", href: "/exports" },
  { label: "Settings", href: "/settings" },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {navigation.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "block rounded-md border-l-[3px] px-3 py-2 text-sm font-semibold transition-colors",
              active
                ? "border-gold bg-pale-gold/70 text-navy"
                : "border-transparent text-steel hover:border-steel-200 hover:bg-steel-100 hover:text-navy",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
