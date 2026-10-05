/**
 * Every owner/rep-visible string of the Sales Outreach Desk ("Lead outreach"). Display only: query keys, server codes
 * and DTO field names never appear on screen (snake_case identifiers are mapped here to words).
 */
import type { DeskView } from "./data/desk-url";

export const deskCopy = {
  brand: "Lead outreach",
  nav: {
    label: "Lead outreach",
    views: {
      team: "Team overview",
      my: "My work",
      activity: "Activity",
      settings: "Settings",
      numbers: "Numbers",
      accounts: "RingCentral Accounts",
    } satisfies Record<DeskView, string>,
    dailyOperations: "Daily Operations",
    adminDashboard: "Admin dashboard",
    more: "Elsewhere",
    openMenu: "Open navigation",
    closeMenu: "Close navigation",
  },
  titles: {
    team: "Team outreach",
    my: "My outreach",
    myInspecting: (name: string) => `${name}'s outreach`,
    activity: "Activity",
    settings: "Settings",
    numbers: "Numbers",
    accounts: "RingCentral Accounts",
  },
  roles: {
    owner: "Owner",
    manager: "Manager",
    rep: "Sales Representative",
  },
  identity: {
    menu: "Account menu",
    signOut: "Sign out",
    signingOut: "Signing out…",
  },
  notAllowed: {
    title: "This page isn't part of your desk",
    body: "Your account can't open this view.",
  },
} as const;

export type DeskCopy = typeof deskCopy;
