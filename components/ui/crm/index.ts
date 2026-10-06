/**
 * The CRM look's primitives (dashboard-redesign-proposal/15-crm-visual-system.md). Import from here:
 *
 *   import { PageHeader, SummaryCard, IconBadge, Track, Pill, Avatar, Segmented, CrmSelect, SearchBox, CrmCard } from "@/components/ui/crm";
 *
 * Styles live in `app/crm.css` (`.crm-*` classes over the `--crm-*` tokens in `app/globals.css`); the dashboard shell
 * carries `data-ui="crm"`, which re-points the Tailwind theme aliases (`text-navy`, `bg-card`, …) at the same tokens.
 */
export * from "./primitives";
export * from "./format";
