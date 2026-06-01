import Link from "next/link";
import { Truck } from "lucide-react";
import { LogoutButton } from "./logout-button";
import { ScopeAwareHeaderControls } from "./scope-aware-header-controls";

const navigation = [
  { label: "Overview", href: "/" },
  { label: "Form Leads", href: "/form-leads" },
  { label: "Call Leads", href: "/call-leads" },
  { label: "Bookings", href: "/bookings" },
  { label: "Referral Booking", href: "/bookings/referral/new" },
  { label: "Cancellations", href: "/cancellations" },
  { label: "Customers", href: "/customers" },
  { label: "Agents", href: "/agents" },
  { label: "Analytics", href: "/analytics" },
  { label: "Agent Sales Report", href: "/reports/agent-sales" },
  { label: "Audit Log", href: "/audit-log" },
  { label: "Exports", href: "/exports" },
  { label: "Settings", href: "/settings" },
];

export function DashboardShell({
  adminEmail,
  children,
}: {
  adminEmail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="hidden w-64 flex-col border-r bg-background px-4 py-6 lg:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Truck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">Vantage Admin</p>
            <p className="text-xs text-muted-foreground">Owner dashboard</p>
          </div>
        </div>
        <nav className="space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-4 border-b bg-background/95 px-6 py-3 backdrop-blur">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <ScopeAwareHeaderControls />
          </div>
          <div className="flex items-center gap-4">
            <p className="hidden text-sm text-muted-foreground sm:block">{adminEmail}</p>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
