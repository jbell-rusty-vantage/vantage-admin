import { BrandLogo } from "@/components/brand/brand-logo";
import { DashboardNav } from "./dashboard-nav";
import { LogoutButton } from "./logout-button";
import { ScopeAwareHeaderControls } from "./scope-aware-header-controls";

export function DashboardShell({
  adminEmail,
  children,
}: {
  adminEmail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-cool-white">
      <aside className="hidden w-64 flex-col border-r border-steel-200 bg-white px-4 py-6 shadow-sm lg:flex">
        <div className="mb-8 px-2">
          <BrandLogo />
        </div>
        <DashboardNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-4 border-b border-steel-200 bg-white/95 px-6 py-3 shadow-sm backdrop-blur">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <ScopeAwareHeaderControls />
          </div>
          <div className="flex items-center gap-4">
            <p className="hidden text-sm font-medium text-steel sm:block">{adminEmail}</p>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
