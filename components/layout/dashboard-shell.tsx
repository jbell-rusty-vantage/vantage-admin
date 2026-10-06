"use client";
/**
 * The dashboard shell in the CRM look (dashboard-redesign-proposal/15-crm-visual-system.md "The shell, after"): a
 * white 232 px sidebar with 40 px rows and a blue-50 active pill, the environment chip and the ⌘K record search at its
 * top, the signed-in identity at its foot; a slim topbar with the page title and the connection freshness chips; a
 * phone-width bottom tab bar. `data-ui="crm"` on the root (and mirrored onto <html> while mounted, for portals) turns
 * the shared theme on for everything inside.
 */
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { setLocalStorageBoolean, useLocalStorageBoolean } from "@/lib/state/use-local-storage-boolean";
import { Avatar, cx } from "@/components/ui/crm";
import { MilestoneToastHost } from "@/components/daily/milestone-toast";
import { DASHBOARD_MAIN_ID } from "./dashboard-ids";
import { DashboardRoleProvider } from "./dashboard-role-context";
import { DashboardMobileBar, DashboardNav, pageTitleForPath, type DashboardShellRole } from "./dashboard-nav";
import { GlobalSearch } from "./global-search";
import { TopbarFreshness } from "./topbar-freshness";
import { useSidebarBadges } from "./use-sidebar-badges";
import { initialsFromEmail } from "./user-menu";

const sidebarStorageKey = "vantage-admin-sidebar-collapsed";
const ownerOnlyPagePrefixes = [
  "/automations",
  "/bookings/reconciliation",
  "/granot-lifecycle",
  "/ingestion/granot",
  "/intakes",
  "/daily",
  "/sales-intelligence",
  "/outreach-desk",
  "/manual",
  "/extension",
] as const;
// /operations-registry is intentionally readable by admin roles (mutations gated in UI/proxy).
// /granot-lifecycle is Owner-only except Health, which Admin reaches from Setup.
// A Manager (P09b) renders this shell only for Today → Operations; the desk has its own "Lead outreach" shell.
const managerPagePrefixes = ["/"] as const;

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[.\-_+]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function roleLabel(role: DashboardShellRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function IdentityMenu({ email, role, collapsed }: { email: string; role: DashboardShellRole; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  const name = displayNameFromEmail(email);
  return (
    <div className="crm-identity">
      {open ? (
        <div className="crm-identity__menu" role="menu" aria-label="Account menu">
          <p className="crm-identity__email">{email}</p>
          <button type="button" role="menuitem" className="crm-button crm-button--quiet crm-button--block" onClick={signOut} disabled={signingOut}>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className="crm-identity__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu: ${name}, ${roleLabel(role)}`}
        title={collapsed ? `${name} · ${roleLabel(role)}` : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="crm-avatar" aria-hidden="true">
          {initialsFromEmail(email) || <Avatar name={name} />}
        </span>
        <span className="crm-identity__text">
          <span className="crm-identity__name">
            {name} <span className="crm-identity__role">· {roleLabel(role)}</span>
          </span>
        </span>
        <ChevronDown className="crm-identity__chevron" aria-hidden="true" width={16} height={16} />
      </button>
    </div>
  );
}

function SidebarBody({
  adminRole,
  adminEmail,
  collapsed,
  onToggleCollapsed,
  onNavigate,
  onClose,
  badges,
}: {
  adminRole: DashboardShellRole;
  adminEmail: string;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
  badges: ReturnType<typeof useSidebarBadges>;
}) {
  return (
    <>
      <div className="crm-sidebar__top">
        <Link href="/" className="crm-brand" aria-label="Vantage Movers admin, home">
          <Image src="/vantage/vantage-mark.png" alt="" width={34} height={34} priority className="crm-brand__mark" />
          <span className="crm-brand__word">
            <span className="crm-brand__name">Vantage</span>
            <span className="crm-brand__suffix">Movers</span>
          </span>
        </Link>
        {onClose ? (
          <button type="button" className="crm-button crm-button--quiet crm-button--icon" onClick={onClose} aria-label="Close navigation">
            <X aria-hidden="true" />
          </button>
        ) : onToggleCollapsed ? (
          <button type="button" className="crm-button crm-button--quiet crm-button--icon" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      <span className="crm-env" data-testid="environment-chip">
        <span className="crm-dot crm-dot--green" aria-hidden="true" />
        Production
      </span>
      {adminRole === "manager" ? null : collapsed ? (
        <div className="mb-2 flex justify-center">
          <GlobalSearch variant="icon" />
        </div>
      ) : (
        <GlobalSearch />
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DashboardNav adminRole={adminRole} badges={badges} onNavigate={onNavigate} />
      </div>
      <IdentityMenu email={adminEmail} role={adminRole} collapsed={collapsed} />
    </>
  );
}

export function DashboardShell({
  adminEmail,
  adminRole,
  children,
}: {
  adminEmail: string;
  adminRole: DashboardShellRole;
  children: React.ReactNode;
}) {
  const collapsed = useLocalStorageBoolean(sidebarStorageKey);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const badges = useSidebarBadges(adminRole);
  const granotLifecycleHealth =
    pathname === "/granot-lifecycle/health" ||
    pathname.startsWith("/granot-lifecycle/health/");
  const underPrefix = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  const pageAllowed =
    adminRole === "owner" ||
    (adminRole === "manager"
      ? managerPagePrefixes.some((prefix) => (prefix === "/" ? pathname === "/" : underPrefix(prefix)))
      : granotLifecycleHealth || !ownerOnlyPagePrefixes.some(underPrefix));

  // Lock the document while the shell is mounted. Only undo the classes this effect added: the root layout already
  // gives <body> `h-full min-h-0`, and stripping them on unmount left every page reached from here (the Outreach
  // Desk, login) without a height, so it could not scroll. The CRM theme attribute is mirrored onto <html> the same
  // way so portals (⌘K, side panels) share the look.
  useEffect(() => {
    const wanted: [Element, string][] = [
      [document.documentElement, "overflow-hidden"],
      [document.body, "h-full"],
      [document.body, "min-h-0"],
      [document.body, "overflow-hidden"],
    ];
    const added = wanted.filter(([element, name]) => !element.classList.contains(name));
    for (const [element, name] of added) element.classList.add(name);
    const hadTheme = document.documentElement.getAttribute("data-ui");
    document.documentElement.setAttribute("data-ui", "crm");
    return () => {
      for (const [element, name] of added) element.classList.remove(name);
      if (hadTheme === null) document.documentElement.removeAttribute("data-ui");
      else document.documentElement.setAttribute("data-ui", hadTheme);
    };
  }, []);

  // The phone drawer closes on navigation (state adjusted from the previous render, not in an effect).
  const [drawerPath, setDrawerPath] = useState(pathname);
  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    setMobileOpen(false);
  }

  function toggleCollapsed() {
    setLocalStorageBoolean(sidebarStorageKey, !collapsed);
  }

  return (
    <DashboardRoleProvider role={adminRole}>
      <div className="crm-shell flex h-full min-h-0 overflow-hidden" data-ui="crm" data-role={adminRole}>
        <aside className="crm-sidebar" data-collapsed={collapsed ? "true" : undefined}>
          <SidebarBody adminRole={adminRole} adminEmail={adminEmail} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} badges={badges} />
        </aside>
        <div className="crm-main">
          <header className="crm-topbar">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button type="button" className="crm-button crm-button--quiet crm-button--icon lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
                <Menu aria-hidden="true" />
              </button>
              <h1 className="crm-topbar__title">{pageTitleForPath(pathname)}</h1>
            </div>
            <div className="crm-topbar__right">
              {adminRole === "owner" ? <TopbarFreshness /> : null}
              <span className="lg:hidden">{adminRole === "manager" ? null : <GlobalSearch variant="icon" />}</span>
            </div>
          </header>
          <main
            id={DASHBOARD_MAIN_ID}
            className={
              pathname === "/sales-intelligence" || pathname.startsWith("/sales-intelligence/")
                ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overflow-x-hidden p-0"
                : "crm-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-5 lg:p-6"
            }
          >
            {pageAllowed ? (
              children
            ) : (
              <div className="crm-card p-6">
                <h1 className="text-xl font-semibold text-navy">Not allowed</h1>
                <p className="mt-2 text-sm text-steel">
                  Your admin role does not have access to this page.
                </p>
              </div>
            )}
          </main>
          <DashboardMobileBar adminRole={adminRole} badges={badges} />
        </div>
        {adminRole === "owner" || adminRole === "manager" ? <MilestoneToastHost /> : null}
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" aria-label="Close navigation" className="crm-scrim" onClick={() => setMobileOpen(false)} />
            <aside className={cx("crm-sidebar crm-sidebar--drawer")}>
              <SidebarBody adminRole={adminRole} adminEmail={adminEmail} collapsed={false} onClose={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} badges={badges} />
            </aside>
          </div>
        ) : null}
      </div>
    </DashboardRoleProvider>
  );
}
