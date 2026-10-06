# `components/ui/crm/` — the CRM look

Spec: `dashboard-redesign-proposal/15-crm-visual-system.md` (workspace root). Decided by the Owner on 2026-10-05: the
Outreach Desk's bubbly look is the whole dashboard's look.

## How it is wired

| Layer | Where | What |
|---|---|---|
| Tokens | `app/globals.css` `:root` | `--crm-page`, `--crm-card`, `--crm-border`, `--crm-ink/text/muted/faint`, `--crm-blue(-strong/-ink/-50/-100/-tint)`, `--crm-green/amber/red/purple/gold (+ -50)`, `--crm-r-card/control/pill`, `--crm-shadow-card/pop`, `--crm-focus`, `--crm-font`. |
| Dashboard theme | `app/globals.css` `[data-ui="crm"]` | Re-points the semantic aliases Tailwind reads (`--navy`, `--trust-blue`, `--steel-*`, `--pale-gold` → blue-50, `--shadow-*`, fonts) at the tokens, so existing `text-navy` / `bg-card` / `rounded-*` call sites recolour without edits. The dashboard shell (`components/layout/dashboard-shell.tsx`) renders the attribute on its root and mirrors it onto `<html>` while mounted, so portals (⌘K, side panels) get the same theme. |
| Desk alias | `components/outreach-desk/styles/outreach-desk.css` | `.od-root { --od-blue: var(--crm-blue); … }` — the desk is pixel-identical by construction. |
| Primitives | `app/crm.css` + `primitives.tsx` | `.crm-*` classes and React components (below). |
| Font | `app/layout.tsx` | Plus Jakarta Sans (`--font-plus-jakarta`), self-hosted. |

## Primitives

`IconBadge` (46 px circle, tones blue/green/red/amber/gray/purple/gold) · `Track` (pill progress, `progress` 0–1, `null` = pending) ·
`Pill` (status) · `EvidenceChip` (✓/⚠/✗/– + words) · `Avatar` / `Person` (initials circle) · `CopyJobButton` · `Segmented` ·
`CrmSelect` (native select, rounded) · `Chip` / `RemovableChip` · `SearchBox` (debounced) · `PageHeader` (+ `HelpPopover`) ·
`CrmCard` · `Notice` · `ReadFailure` · `SkeletonLine` · `TrendChip` · `SummaryCard` · `MoneyTile` · `FreshnessChips` · `Tabs` ·
`OverflowMenu` · `useDensity` / `DensityToggle`.

Formatting helpers in `format.ts`: `formatMoney`, `formatCount`, `formatTime`, `formatShortDate`, `formatAbsolute`,
`formatLongDay`, `formatRelative`, `formatAge`, `formatPhone`, `formatPercent`, `percentOf`, `newYorkDayKey`.

## Rules (doc 15)

- Blue = selection and action. Green = done or at goal. Amber = due or needs a look. Red = overdue or failed. Purple = Quoted.
  Gold only for celebration. Every colour is paired with text or an icon.
- Cards are border + `--crm-shadow-card` only. No lift shadows.
- 44 px interactive targets on list pages; 14–16 px body text.
- Long operational lists stay dense tables (`.crm-table`); cards get a Comfortable / Compact toggle (`useDensity`).
- `prefers-reduced-motion` disables transitions under `[data-ui="crm"]`.
