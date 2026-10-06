/**
 * Owner-visible strings of the Setup shell (doc 19). Each section keeps its own words in its own `*-copy.ts`.
 * Glossary words only: Feed (never the engineering name), Granot name, Inbound Number, Lead Cost, Agent, Merchant,
 * Moving Carrier. Every string here passes `lib/operations-registry/ownerLanguageDeck.ts`.
 */
export const SETUP_COPY = {
  title: "Setup",
  subtitle: "Everything you configure once and touch rarely. Daily work lives on Today, Leads and Bookings.",
  help:
    "Setup is one place with nine sections. Lead sources shows each company you buy or receive leads from as one tree: its feeds, the Granot names and inbound numbers that land in them, and what each lead costs. People & access shows one card per person. Connections & health says whether Granot, RingCentral and Google Sheets are connected and recent. External Sheet Ingestion is the Best Relocation sheet pull.",
  navLabel: "Setup sections",
  /** The Registry's read-only banner, reused for the Admin role. */
  readOnlyTitle: "Read-only view",
  readOnlyBody: "Changes here need the owner role. Health evidence and change history stay available for inspection.",
  notAllowedTitle: "Not allowed",
  notAllowedBody: "This section is for the owner. Ask the owner to make this change, or open one of the sections on the left.",
  sections: {
    "lead-sources": { label: "Lead sources", purpose: "Who sends me leads, and how do they arrive." },
    "lead-costs": { label: "Lead costs", purpose: "What do I pay per lead." },
    people: { label: "People & access", purpose: "Who works here, and what can they open." },
    merchants: { label: "Merchants", purpose: "Merchants that take deposits." },
    carriers: { label: "Carriers", purpose: "Moving carriers for tariff work." },
    connections: { label: "Connections & health", purpose: "Granot · RingCentral · Google Sheets." },
    "sheet-ingestion": { label: "External Sheet Ingestion", purpose: "Lead sheets pulled in from outside partners, Best Relocation first." },
    website: { label: "Website", purpose: "Testimonials shown on the main site." },
    changes: { label: "Change history", purpose: "Every change, who made it, before and after." },
  },
  badgeLabel: (n: number) => `${n} waiting`,
} as const;
