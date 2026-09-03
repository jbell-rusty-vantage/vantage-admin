"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StatusBadge } from "@/components/data-table/status-badge";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { cn } from "@/lib/utils";
import { INGESTION_COPY } from "./ingestion-copy";

export const INGESTION_SUBNAV_ITEMS = [
  { href: "/ingestion/granot", label: INGESTION_COPY.granotWorkflowTab, ownerOnly: true },
  {
    href: "/ingestion",
    label: INGESTION_COPY.bestRelocationTab,
    ownerOnly: false,
    deprecated: true,
  },
] as const;

export function IngestionSubnav() {
  const pathname = usePathname();
  const role = useDashboardRole();
  return <IngestionSubnavLinks pathname={pathname ?? ""} role={role} />;
}

export function IngestionSubnavLinks({
  pathname,
  role,
}: {
  pathname: string;
  role: "owner" | "admin" | null;
}) {
  return (
    <nav aria-label="Ingestion workflows" className="mb-6 border-b border-steel-200">
      <div className="flex flex-wrap gap-1">
        {INGESTION_SUBNAV_ITEMS
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
                  "-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-semibold",
                  active
                    ? "border-trust-blue text-navy"
                    : "border-transparent text-steel hover:border-steel-300 hover:text-navy",
                )}
              >
                {item.label}
                {"deprecated" in item && item.deprecated ? (
                  <StatusBadge tone="warning" className="px-1.5 py-0 text-[10px] font-semibold">
                    {INGESTION_COPY.bestRelocationDeprecatedBadge}
                  </StatusBadge>
                ) : null}
              </Link>
            );
          })}
      </div>
    </nav>
  );
}
