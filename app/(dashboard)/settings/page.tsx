import { CatalogManager } from "@/components/settings/catalog-manager";

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-sm text-muted-foreground">
        Manage the active Agent and Merchant catalogs used by booking dropdowns and production filters.
      </p>
      <CatalogManager />
    </div>
  );
}
