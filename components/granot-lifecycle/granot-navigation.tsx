"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NewFeatureBadge } from "@/components/ui/new-badge";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/ingestion/granot", label: "Automation" },
  { href: "/ingestion/granot/lifecycle", label: "Lifecycle" },
  { href: "/ingestion/granot/live", label: "Live webhooks", isNew: true },
  { href: "/intakes", label: "Intakes", isNew: true },
  { href: "/job-timeline", label: "Job timeline", isNew: true },
  { href: "/ingestion/granot/lifecycle/health", label: "Health" },
] as const;

export function GranotNavigation() {
  const pathname = usePathname();
  return <GranotNavigationLinks pathname={pathname} />;
}

export function GranotNavigationLinks({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Granot workflows" className="mb-5 overflow-x-auto">
      <div className="flex min-w-max gap-2 rounded-lg border bg-background p-2">
        {tabs.map((tab) => {
          const active = tab.href === "/ingestion/granot"
            ? pathname === tab.href
            : tab.href === "/ingestion/granot/lifecycle"
              ? (pathname === tab.href || pathname.startsWith(`${tab.href}/`))
                && !pathname.startsWith("/ingestion/granot/lifecycle/health")
              : tab.href === "/intakes" || tab.href === "/job-timeline" || tab.href === "/ingestion/granot/live"
                ? pathname === tab.href || pathname.startsWith(`${tab.href}/`)
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                active ? "bg-primary text-white" : "text-navy hover:bg-steel-100",
              )}
            >
              {tab.label}
              {"isNew" in tab && tab.isNew ? <NewFeatureBadge /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
