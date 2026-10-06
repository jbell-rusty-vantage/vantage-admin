"use client";
/**
 * The Setup frame (doc 19 "The decision"): `PageHeader` "Setup", the left sub-navigation (a `.crm-card` of 40 px rows,
 * blue-50 active pill; stacked as `Tabs` under the header at phone width) and the section outlet. Admin sees the
 * Registry's read-only banner; an Owner-only section opened by another role shows the "Not allowed" card. Every
 * section renders inside the outlet with `SetupSectionHead` for a uniform heading row.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Lock, ShieldAlert } from "lucide-react";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { Notice, PageHeader, Tabs } from "@/components/ui/crm/primitives";
import { SETUP_COPY } from "./setup-copy";
import {
  canOpenSetupSection,
  setupBadgeFor,
  setupSectionForPath,
  setupSectionsFor,
  type SetupSection,
  type SetupSectionKey,
} from "./setup-sections";
import { useSetupBadges } from "./use-setup-badges";

/** Admin and Manager read; only the Owner writes. */
export function useSetupReadOnly(): boolean {
  return useDashboardRole() !== "owner";
}

export function SetupShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const role = useDashboardRole();
  const readOnly = role !== "owner";
  const sections = setupSectionsFor(role);
  const active = setupSectionForPath(pathname);
  const badges = useSetupBadges(role);

  return (
    <div className="crm-page su-page" style={{ padding: 0 }} data-testid="setup-shell">
      <PageHeader title={SETUP_COPY.title} subtitle={SETUP_COPY.subtitle} help={<p>{SETUP_COPY.help}</p>} />
      {readOnly ? (
        <Notice icon={Lock} tone="gray" title={SETUP_COPY.readOnlyTitle} testId="setup-read-only">
          <p>{SETUP_COPY.readOnlyBody}</p>
        </Notice>
      ) : null}
      <div className="su-tabs">
        <Tabs<string>
          label={SETUP_COPY.navLabel}
          value={active?.href ?? sections[0]!.href}
          hrefFor={(href) => href}
          tabs={sections.map((item) => ({ value: item.href, label: item.label, badge: setupBadgeFor(item, badges), icon: item.icon }))}
        />
      </div>
      <div className="su-layout">
        <nav className="crm-card su-nav" aria-label={SETUP_COPY.navLabel}>
          {sections.map((item) => (
            <SetupNavRow key={item.key} item={item} active={active?.key === item.key} badge={setupBadgeFor(item, badges)} />
          ))}
        </nav>
        <div className="su-outlet">{children}</div>
      </div>
    </div>
  );
}

function SetupNavRow({ item, active, badge }: { item: SetupSection; active: boolean; badge: number | null }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className="su-nav__item" aria-current={active ? "page" : undefined} data-section={item.key} title={item.purpose}>
      <Icon aria-hidden="true" />
      <span className="su-nav__label">{item.label}</span>
      {badge ? (
        <span className="crm-nav__badge" aria-label={SETUP_COPY.badgeLabel(badge)}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/** The heading row every section starts with: the Owner question, a one-line purpose, actions on the right. */
export function SetupSectionHead({ section, right, children }: { section: SetupSectionKey; right?: ReactNode; children?: ReactNode }) {
  const copy = SETUP_COPY.sections[section];
  return (
    <header className="su-section-head" data-section={section}>
      <div className="su-section-head__titles">
        <h2 className="su-section-head__title">{copy.label}</h2>
        <p className="su-section-head__purpose">{children ?? copy.purpose}</p>
      </div>
      {right ? <div className="su-section-head__right">{right}</div> : null}
    </header>
  );
}

/** The shell's "Not allowed" card for an Owner-only section opened by another role. */
export function SetupNotAllowed() {
  return (
    <Notice icon={ShieldAlert} tone="amber" title={SETUP_COPY.notAllowedTitle} testId="setup-not-allowed">
      <p>{SETUP_COPY.notAllowedBody}</p>
    </Notice>
  );
}

/** Renders its children for the Owner and the "Not allowed" card for every other role. */
export function SetupOwnerOnly({ section, children }: { section: SetupSectionKey; children: ReactNode }) {
  const role = useDashboardRole();
  if (!canOpenSetupSection(role, section)) return <SetupNotAllowed />;
  return <>{children}</>;
}
