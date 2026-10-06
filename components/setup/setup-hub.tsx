"use client";
/**
 * The Setup hub (doc 01 "Setup", doc 05 section names). One card per section, each linking to the page that owns it
 * today (the Operations Registry tabs, Extension, Granot Lifecycle health, Ingestion, Testimonials). Technical health
 * pages belong here, not in the daily sidebar. Admin reads the Registry; Owner-only sections are hidden from Admin.
 */
import Link from "next/link";
import { ArrowRight, Banknote, Cable, Globe, History, Landmark, Puzzle, Truck, Users, type LucideIcon } from "lucide-react";
import { GRANOT_LIFECYCLE_HEALTH_HREF } from "@/components/granot-lifecycle/granot-lifecycle-copy";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { IconBadge, PageHeader, type CrmTone } from "@/components/ui/crm";

type SetupLink = { label: string; href: string; ownerOnly?: boolean };

type SetupSection = {
  key: string;
  title: string;
  purpose: string;
  icon: LucideIcon;
  tone: CrmTone;
  links: SetupLink[];
  ownerOnly?: boolean;
};

export const SETUP_SECTIONS: readonly SetupSection[] = [
  {
    key: "lead-sources",
    title: "Lead sources",
    purpose: "Source companies, their feeds and how each one is read.",
    icon: Cable,
    tone: "blue",
    links: [
      { label: "Lead sources", href: "/operations-registry?tab=lead-sources" },
      { label: "Granot names", href: "/operations-registry?tab=granot-names" },
      { label: "Inbound numbers", href: "/operations-registry?tab=inbound-numbers" },
    ],
  },
  {
    key: "lead-costs",
    title: "Lead costs",
    purpose: "What each feed costs per lead, by period. Missing is not zero.",
    icon: Banknote,
    tone: "amber",
    links: [
      { label: "Lead costs", href: "/operations-registry?tab=lead-costs" },
      { label: "Legacy CPL", href: "/operations-registry?tab=legacy-cpl" },
    ],
  },
  {
    key: "people",
    title: "People & access",
    purpose: "Agents, dashboard users and the Granot extension.",
    icon: Users,
    tone: "green",
    links: [
      { label: "Agents", href: "/operations-registry?tab=agents" },
      { label: "Users", href: "/operations-registry?tab=users", ownerOnly: true },
      { label: "Extension", href: "/extension", ownerOnly: true },
    ],
  },
  {
    key: "money",
    title: "Money",
    purpose: "Merchants that take deposits. Rep compensation arrives with the Money tab (server work).",
    icon: Landmark,
    tone: "purple",
    links: [{ label: "Merchants", href: "/operations-registry?tab=merchants" }],
  },
  {
    key: "carriers",
    title: "Carriers",
    purpose: "Moving carriers the booking form can name.",
    icon: Truck,
    tone: "gray",
    links: [{ label: "Moving carriers", href: "/operations-registry?tab=moving-carriers" }],
  },
  {
    key: "connections",
    title: "Connections & health",
    purpose: "Granot, RingCentral, Best Relocation and Sheets: is each one connected and recent?",
    icon: Puzzle,
    tone: "red",
    links: [
      { label: "Granot Lifecycle health", href: GRANOT_LIFECYCLE_HEALTH_HREF },
      { label: "Ingestion", href: "/ingestion" },
      { label: "Registry health", href: "/operations-registry" },
    ],
  },
  {
    key: "website",
    title: "Website",
    purpose: "Testimonials shown on the main site.",
    icon: Globe,
    tone: "blue",
    links: [{ label: "Testimonials", href: "/testimonials" }],
  },
  {
    key: "changes",
    title: "Change history",
    purpose: "Every Registry change, who made it and why.",
    icon: History,
    tone: "gray",
    links: [{ label: "Changes", href: "/operations-registry?tab=changes" }],
  },
];

export function setupSectionsFor(role: "owner" | "admin" | "manager" | null): SetupSection[] {
  return SETUP_SECTIONS.filter((section) => role === "owner" || !section.ownerOnly).map((section) => ({
    ...section,
    links: section.links.filter((link) => role === "owner" || !link.ownerOnly),
  }));
}

export function SetupHub() {
  const role = useDashboardRole();
  const sections = setupSectionsFor(role);
  return (
    <div className="crm-page" style={{ padding: 0 }}>
      <PageHeader
        title="Setup"
        subtitle="Everything you configure once and touch rarely. Daily work lives on Today, Leads and Bookings."
        help={
          <p>
            Setup groups the Operations Registry, the Granot extension, connection health, ingestion and website content. Each section opens the page that
            owns it today; the Registry keeps its tabs and change history.
          </p>
        }
      />
      <div className="crm-grid-2" data-testid="setup-sections">
        {sections.map((section) => (
          <section key={section.key} className="crm-card" style={{ display: "flex", gap: 14, padding: "16px 18px" }} data-section={section.key}>
            <IconBadge icon={section.icon} tone={section.tone} />
            <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <h2 className="crm-card__title" style={{ fontSize: 17 }}>
                {section.title}
              </h2>
              <p className="crm-card__subtitle" style={{ margin: 0 }}>
                {section.purpose}
              </p>
              <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 8 }}>
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="crm-chip crm-chip--small">
                      {link.label}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
