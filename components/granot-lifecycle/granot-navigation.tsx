"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/ingestion/granot", label: "Automation" },
  { href: "/ingestion/granot/lifecycle", label: "Lifecycle" },
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
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                active ? "bg-primary text-white" : "text-navy hover:bg-steel-100",
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
