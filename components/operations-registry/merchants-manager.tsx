"use client";

import { CatalogRegistryManager } from "./catalog-registry-manager";

export function MerchantsManager({ readOnly }: { readOnly: boolean }) {
  return <CatalogRegistryManager kind="merchants" readOnly={readOnly} />;
}
