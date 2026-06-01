"use client";

import { usePathname } from "next/navigation";
import { useDatabaseScope } from "@/lib/state/database-scope";
import type { DatabaseScope } from "@/lib/api/types";
import { DatabaseScopeSelector } from "./database-scope-selector";
import { GlobalSearch } from "./global-search";

function canUseCombinedScope(pathname: string): boolean {
  return pathname.startsWith("/analytics") || pathname.startsWith("/exports") || pathname.startsWith("/search");
}

export function ScopeAwareHeaderControls() {
  const pathname = usePathname();
  const includeCombined = canUseCombinedScope(pathname);
  const { scope, setScope } = useDatabaseScope();
  const effectiveScope: DatabaseScope = includeCombined || scope !== "combined" ? scope : "production";

  return (
    <>
      <DatabaseScopeSelector value={effectiveScope} onChange={setScope} includeCombined={includeCombined} />
      <GlobalSearch scope={effectiveScope} />
    </>
  );
}
