"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseDatabaseScope } from "@/lib/api/filters";
import type { DatabaseScope } from "@/lib/api/types";

const STORAGE_KEY = "vantage.database_scope";

type DatabaseScopeContextValue = {
  scope: DatabaseScope;
  setScope: (scope: DatabaseScope) => void;
};

const DatabaseScopeContext = createContext<DatabaseScopeContextValue | null>(null);

// The selected scope is kept in a tiny module-level external store rather than
// component state. This lets it persist across in-app navigation (the provider
// lives in the dashboard layout) and survive reloads via localStorage, while
// `useSyncExternalStore` gives us SSR-safe reads without setState-in-effect.
let storeScope: DatabaseScope | undefined;
const listeners = new Set<() => void>();

function readStoredScope(): DatabaseScope | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "production" || value === "historical" || value === "combined"
      ? value
      : null;
  } catch {
    return null;
  }
}

function getScopeSnapshot(): DatabaseScope {
  if (storeScope === undefined) {
    storeScope = readStoredScope() ?? "production";
  }
  return storeScope;
}

function getServerScopeSnapshot(): DatabaseScope {
  return "production";
}

function subscribeScope(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function writeScope(next: DatabaseScope): void {
  storeScope = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore persistence failures (e.g. private browsing).
  }
  for (const listener of listeners) {
    listener();
  }
}

export function DatabaseScopeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlScope = searchParams.get("database_scope");

  const scope = useSyncExternalStore(subscribeScope, getScopeSnapshot, getServerScopeSnapshot);

  // A pinned scope on the URL (deep link / shared link / back-forward) wins and
  // is adopted into the external store. Updating an external system from an
  // effect is the intended use; no React state is set here.
  useEffect(() => {
    if (!urlScope) {
      return;
    }
    const parsed = parseDatabaseScope(urlScope);
    if (parsed !== getScopeSnapshot()) {
      writeScope(parsed);
    }
  }, [urlScope]);

  const setScope = useCallback(
    (next: DatabaseScope) => {
      writeScope(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("database_scope", next);
      params.delete("page");
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const value = useMemo(() => ({ scope, setScope }), [scope, setScope]);

  return (
    <DatabaseScopeContext.Provider value={value}>{children}</DatabaseScopeContext.Provider>
  );
}

export function useDatabaseScope(): DatabaseScopeContextValue {
  const context = useContext(DatabaseScopeContext);
  if (!context) {
    throw new Error("useDatabaseScope must be used within a DatabaseScopeProvider");
  }
  return context;
}
