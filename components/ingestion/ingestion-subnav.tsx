"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { cn } from "@/lib/utils";

const items = [
  { href: "/ingestion", label: "Best Relocation", ownerOnly: false },
  { href: "/ingestion/granot", label: "Granot workflow", ownerOnly: true },
] as const;

export function IngestionSubnav() {
  const pathname = usePathname();
  const role = useDashboardRole();

  return (
    <nav aria-label="Ingestion workflows" className="mb-6 border-b border-steel-200">
      <div className="flex flex-wrap gap-1">
        {items
          .filter((item) => !item.ownerOnly || role === "owner")
          .map((item) => {
            const active =
              item.href === "/ingestion"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px border-b-2 px-4 py-3 text-sm font-semibold",
                  active
                    ? "border-trust-blue text-navy"
                    : "border-transparent text-steel hover:border-steel-300 hover:text-navy",
                )}
              >
                {item.label}
              </Link>
            );
          })}
      </div>
    </nav>
  );
}
