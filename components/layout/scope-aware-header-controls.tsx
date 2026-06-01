"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseDatabaseScope } from "@/lib/api/filters";
import type { DatabaseScope } from "@/lib/api/types";
import { DatabaseScopeSelector } from "./database-scope-selector";
import { GlobalSearch } from "./global-search";

function canUseCombinedScope(pathname: string): boolean {
  return pathname.startsWith("/analytics") || pathname.startsWith("/exports") || pathname.startsWith("/search");
}

export function ScopeAwareHeaderControls() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const includeCombined = canUseCombinedScope(pathname);
  const scope = parseDatabaseScope(searchParams.get("database_scope"));
  const effectiveScope: DatabaseScope = includeCombined || scope !== "combined" ? scope : "production";

  function onScopeChange(next: DatabaseScope) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("database_scope", next);
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <>
      <DatabaseScopeSelector value={effectiveScope} onChange={onScopeChange} includeCombined={includeCombined} />
      <GlobalSearch scope={effectiveScope} />
    </>
  );
}
