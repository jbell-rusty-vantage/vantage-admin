"use client";
/**
 * The "Lead outreach" shell (ADM-2): its own narrow sidebar (brand, the role's frames, a selected-nav pill, the
 * signed-in identity at its foot) around the desk frame. It replaces the Admin sidebar on `/outreach-desk` for every
 * role, as in the reference screenshots. The Owner and a Manager also get quiet links to Daily Operations, and the
 * Owner one back to the Admin dashboard. Which frames exist for a role is a URL rule (`deskViewsFor`); the sidebar
 * narrows it to the server's `permitted_views`, and the capabilities still decide what each frame may load.
 */
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Contact,
  FileText,
  Hash,
  House,
  LayoutDashboard,
  Menu,
  Settings,
  Truck,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { OutreachDeskRole } from "@/server/models/adminRoles";
import { DESK_PATH, deskNavViews, deskViewHref, type DeskView } from "../data/desk-url";
import { useCapabilities } from "../data/use-desk-reads";
import { deskCopy } from "../outreach-desk-copy";
import "../styles/outreach-desk.css";

const c = deskCopy;

/** The reference Rep desk uses a house and a clock; the team desk a person and a document. */
function viewIcon(view: DeskView, role: OutreachDeskRole): LucideIcon {
  switch (view) {
    case "team":
      return Users;
    case "my":
      return role === "rep" ? House : User;
    case "activity":
      return role === "rep" ? Clock3 : FileText;
    case "settings":
      return Settings;
    case "numbers":
      return Hash;
    case "accounts":
      return Contact;
  }
}

export function initialsFor(name: string | null, email: string): string {
  const source = name?.trim() || (email.split("@")[0] ?? "");
  const parts = source.split(/[\s.\-_+]+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}` : (parts[0] ?? "").slice(0, 2);
  return letters.toUpperCase();
}

export function displayNameFor(name: string | null, email: string): string {
  if (name?.trim()) return name.trim();
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[.\-_+]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export type DeskViewer = {
  role: OutreachDeskRole;
  email: string;
  /** A Rep's linked Agent (from the session, never the URL). */
  agentId: string | null;
};

export function DeskNav({ role, view, onNavigate }: { role: OutreachDeskRole; view: DeskView; onNavigate?: () => void }) {
  const coordinator = role !== "rep";
  const capabilities = useCapabilities();
  const permitted = capabilities.data && !capabilities.error ? capabilities.data.permitted_views : null;
  return (
    <nav aria-label={c.nav.label}>
      <div className="od-nav">
        {deskNavViews(role, permitted).map((item) => {
          const Icon = viewIcon(item, role);
          return (
            <Link
              key={item}
              href={deskViewHref(item)}
              className="od-nav__item"
              aria-current={item === view ? "page" : undefined}
              onClick={onNavigate}
              data-view={item}
            >
              <Icon aria-hidden="true" />
              <span>{c.nav.views[item]}</span>
            </Link>
          );
        })}
      </div>
      {coordinator ? (
        <div className="od-nav od-nav__group">
          <p className="od-nav__grouplabel">{c.nav.more}</p>
          <Link href="/daily" className="od-nav__item od-nav__item--minor" onClick={onNavigate}>
            <CalendarDays aria-hidden="true" />
            <span>{c.nav.dailyOperations}</span>
          </Link>
          {role === "owner" ? (
            <Link href="/" className="od-nav__item od-nav__item--minor" onClick={onNavigate}>
              <LayoutDashboard aria-hidden="true" />
              <span>{c.nav.adminDashboard}</span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}

function IdentityMenu({ viewer, name }: { viewer: DeskViewer; name: string | null }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const shown = displayNameFor(name, viewer.email);
  const roleLabel = c.roles[viewer.role];
  return (
    <div ref={rootRef} className="od-identity">
      {open ? (
        <div className="od-identity__menu" role="menu" aria-label={c.identity.menu}>
          <p className="od-identity__email">{viewer.email}</p>
          <button type="button" role="menuitem" className="od-button od-button--quiet od-button--block" onClick={signOut} disabled={signingOut}>
            {signingOut ? c.identity.signingOut : c.identity.signOut}
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className="od-identity__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${c.identity.menu}: ${shown}, ${roleLabel}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="od-avatar" aria-hidden="true">{initialsFor(name, viewer.email)}</span>
        {viewer.role === "rep" ? (
          <span className="od-identity__text">
            <span className="od-identity__name">{shown}</span>
            <span className="od-identity__role">{roleLabel}</span>
          </span>
        ) : (
          <span className="od-identity__text">
            <span className="od-identity__name">
              {shown} <span className="od-identity__role">· {roleLabel}</span>
            </span>
          </span>
        )}
        <ChevronDown aria-hidden="true" width={16} height={16} />
      </button>
    </div>
  );
}

export function DeskShell({
  viewer,
  view,
  name = null,
  children,
}: {
  viewer: DeskViewer;
  view: DeskView;
  /** The signed-in person's display name when a desk read supplies it (a Rep's Agent name); else from the email. */
  name?: string | null;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="od-root" data-role={viewer.role} data-view={view}>
      <div className="od-mobilebar">
        <button type="button" className="od-button od-button--quiet" aria-label={c.nav.openMenu} onClick={() => setMenuOpen(true)}>
          <Menu aria-hidden="true" />
        </button>
        <span className="od-brand" style={{ padding: 0 }}>
          <Truck aria-hidden="true" />
          {c.brand}
        </span>
      </div>
      {menuOpen ? <button type="button" className="od-scrim" aria-label={c.nav.closeMenu} onClick={() => setMenuOpen(false)} /> : null}
      <aside className="od-sidebar" data-open={menuOpen ? "true" : undefined}>
        <Link href={DESK_PATH} className="od-brand">
          <Truck aria-hidden="true" />
          <span>{c.brand}</span>
        </Link>
        <DeskNav role={viewer.role} view={view} onNavigate={() => setMenuOpen(false)} />
        <IdentityMenu viewer={viewer} name={name} />
      </aside>
      <div className="od-main">{children}</div>
    </div>
  );
}
