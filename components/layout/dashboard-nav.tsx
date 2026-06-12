"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  Boxes,
  ClipboardX,
  Download,
  FileClock,
  FileText,
  Home,
  Phone,
  SearchCheck,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const navigation: NavItem[] = [
  { label: "Overview", href: "/", icon: Home },
  { label: "Form Leads", href: "/form-leads", icon: FileText },
  { label: "Duplicate Form Leads", href: "/duplicate-form-leads", icon: FileClock },
  { label: "Call Leads", href: "/call-leads", icon: Phone },
  { label: "Bookings", href: "/bookings", icon: BookOpenCheck },
  { label: "Cancellations", href: "/cancellations", icon: ClipboardX },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Agents", href: "/agents", icon: ShieldCheck },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Agent Sales Report", href: "/reports/agent-sales", icon: SearchCheck },
  { label: "Observational", href: "/observational", icon: Activity },
  { label: "Audit Log", href: "/audit-log", icon: Boxes },
  { label: "Exports", href: "/exports", icon: Download },
  { label: "Settings", href: "/settings", icon: Settings },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {navigation.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md border-l-[3px] px-3 py-2 text-sm font-semibold transition-colors",
              collapsed ? "justify-center px-2" : undefined,
              active
                ? "border-gold bg-pale-gold/70 text-navy"
                : "border-transparent text-steel hover:border-steel-200 hover:bg-steel-100 hover:text-navy",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
