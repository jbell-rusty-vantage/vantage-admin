"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  GRANOT_LIFECYCLE_COPY,
  GRANOT_LIFECYCLE_HEALTH_HREF,
  GRANOT_LIFECYCLE_HREF,
  GRANOT_LIFECYCLE_RECEIPTS_HREF,
} from "./granot-lifecycle-copy";

function isHealthPath(pathname: string): boolean {
  return (
    pathname === GRANOT_LIFECYCLE_HEALTH_HREF ||
    pathname.startsWith(`${GRANOT_LIFECYCLE_HEALTH_HREF}/`)
  );
}

function isReceiptsPath(pathname: string): boolean {
  if (isHealthPath(pathname)) {
    return false;
  }
  return (
    pathname === GRANOT_LIFECYCLE_HREF ||
    pathname === GRANOT_LIFECYCLE_RECEIPTS_HREF ||
    pathname.startsWith(`${GRANOT_LIFECYCLE_RECEIPTS_HREF}/`)
  );
}

export function GranotLifecycleSubnav() {
  const pathname = usePathname();
  return <GranotLifecycleSubnavLinks pathname={pathname ?? ""} />;
}

export function GranotLifecycleSubnavLinks({ pathname }: { pathname: string }) {
  const receiptsActive = isReceiptsPath(pathname);
  const healthActive = isHealthPath(pathname);

  return (
    <nav aria-label={GRANOT_LIFECYCLE_COPY.pageTitle} className="mb-6 border-b border-steel-200">
      <div className="flex flex-wrap gap-1">
        <Link
          href={GRANOT_LIFECYCLE_RECEIPTS_HREF}
          aria-current={receiptsActive ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-4 py-3 text-sm font-semibold",
            receiptsActive
              ? "border-trust-blue text-navy"
              : "border-transparent text-steel hover:border-steel-300 hover:text-navy",
          )}
        >
          {GRANOT_LIFECYCLE_COPY.receiptsTab}
        </Link>
        <Link
          href={GRANOT_LIFECYCLE_HEALTH_HREF}
          aria-current={healthActive ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-4 py-3 text-sm font-semibold",
            healthActive
              ? "border-trust-blue text-navy"
              : "border-transparent text-steel hover:border-steel-300 hover:text-navy",
          )}
        >
          {GRANOT_LIFECYCLE_COPY.healthTab}
        </Link>
      </div>
    </nav>
  );
}
