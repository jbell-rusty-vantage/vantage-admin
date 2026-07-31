"use client";

import { CatalogRegistryManager } from "./catalog-registry-manager";

export function AgentsManager({ readOnly }: { readOnly: boolean }) {
  return <CatalogRegistryManager kind="agents" readOnly={readOnly} />;
}
