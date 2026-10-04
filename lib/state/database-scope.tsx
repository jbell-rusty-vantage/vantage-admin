"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { withoutRetiredDatabaseScope } from "@/lib/api/filters";

const RETIRED_STORAGE_KEY = "vantage.database_scope";

/**
 * The historical database was retired and the dashboard reads production only. Clears the scope an
 * earlier release persisted in this browser and replaces any URL that still carries
 * `database_scope`, so old bookmarks land on the production page without the retired parameter.
 */
export function RetiredDatabaseScopeCleanup() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      window.localStorage.removeItem(RETIRED_STORAGE_KEY);
    } catch {
      // Storage can be unavailable (e.g. private browsing); nothing was persisted then.
    }
  }, []);

  useEffect(() => {
    const cleaned = withoutRetiredDatabaseScope(new URLSearchParams(searchParams.toString()));
    if (!cleaned) {
      return;
    }
    const query = cleaned.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  return null;
}
