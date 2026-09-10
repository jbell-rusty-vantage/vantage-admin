"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { REPORTING_COPY, REPORTING_HREFS } from "./reporting-copy";

export type ReportingTab = "reports" | "create" | "sheets";

export function reportingTabForPath(pathname: string): ReportingTab {
  if (
    pathname === REPORTING_HREFS.sheets ||
    pathname.startsWith(`${REPORTING_HREFS.sheets}/`)
  ) {
    return "sheets";
  }
  if (pathname === REPORTING_HREFS.create || pathname.endsWith("/edit")) {
    return "create";
  }
  return "reports";
}

const tabs: Array<{ href: string; tab: ReportingTab; label: string }> = [
  { href: REPORTING_HREFS.reports, tab: "reports", label: REPORTING_COPY.tabReports },
  { href: REPORTING_HREFS.create, tab: "create", label: REPORTING_COPY.tabCreate },
  { href: REPORTING_HREFS.sheets, tab: "sheets", label: REPORTING_COPY.tabSheets },
];

export function ReportingSubnav() {
  const pathname = usePathname() ?? "";
  const active = reportingTabForPath(pathname);

  return (
    <nav aria-label={REPORTING_COPY.eyebrow} className="mb-6 border-b border-steel-200">
      <div className="flex flex-wrap gap-1">
        {tabs.map((item) => {
          const current = active === item.tab;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-4 py-3 text-sm font-semibold",
                current
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
