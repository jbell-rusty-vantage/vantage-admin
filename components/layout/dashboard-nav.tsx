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
  History,
  Home,
  Inbox,
  Import,
  MessageSquareQuote,
  Phone,
  Presentation,
  SearchCheck,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { NewFeatureBadge } from "@/components/ui/new-badge";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
  isNew?: boolean;
};

const navigation: NavItem[] = [
  { label: "Overview", href: "/", icon: Home },
  { label: "Form Leads", href: "/form-leads", icon: FileText },
  { label: "Duplicate Form Leads", href: "/duplicate-form-leads", icon: FileClock },
  { label: "Call Leads", href: "/call-leads", icon: Phone },
  { label: "Duplicate Call Leads", href: "/duplicate-call-leads", icon: FileClock },
  { label: "Bookings", href: "/bookings", icon: BookOpenCheck },
  { label: "Cancellations", href: "/cancellations", icon: ClipboardX },
  { label: "Intakes", href: "/intakes", icon: Inbox, ownerOnly: true, isNew: true },
  { label: "Job timeline", href: "/job-timeline", icon: History, ownerOnly: true, isNew: true },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Testimonials", href: "/testimonials", icon: MessageSquareQuote },
  { label: "Agents", href: "/agents", icon: ShieldCheck },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Agent Sales Report", href: "/reports/agent-sales", icon: SearchCheck },
  { label: "Observational", href: "/observational", icon: Activity },
  { label: "Operations Registry", href: "/operations-registry", icon: Boxes },
  { label: "Ingestion", href: "/ingestion", icon: Import },
  { label: "Reporting", href: "/reporting", icon: Presentation },
  { label: "Audit Log", href: "/audit-log", icon: FileClock, ownerOnly: true },
  { label: "Exports", href: "/exports", icon: Download },
  { label: "Settings", href: "/settings", icon: Settings, ownerOnly: true },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav({
  adminRole,
  collapsed = false,
  onNavigate,
}: {
  adminRole: "owner" | "admin";
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {navigation.filter((item) => adminRole === "owner" || !item.ownerOnly).map((item) => {
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
            <span className="relative">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.isNew && collapsed ? (
                <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
              ) : null}
            </span>
            <span className={cn("flex min-w-0 items-center gap-2", collapsed ? "sr-only" : undefined)}>
              {item.label}
              {item.isNew ? <NewFeatureBadge /> : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
