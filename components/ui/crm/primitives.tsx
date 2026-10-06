"use client";
/**
 * CRM primitives (dashboard-redesign-proposal/15-crm-visual-system.md, step 3): the Outreach Desk's primitives lifted
 * into the app as `.crm-*` components over the shared `--crm-*` tokens (`app/crm.css`). Colour is always paired with
 * text or an icon; progress bars cap at 100% and expose their value to assistive technology; a `null` progress renders
 * the pending pattern (unknown, never zero).
 *
 * The desk keeps its own `od-*` primitives for now (its Playwright suite selects them); the two share the tokens.
 */
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  ClipboardCopy,
  Minus,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";

export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export type CrmTone = "blue" | "green" | "red" | "amber" | "gray" | "purple" | "gold";

/** A 46 px soft icon circle. */
export function IconBadge({ icon: Icon, tone = "blue", size = "md", className }: { icon: LucideIcon; tone?: CrmTone; size?: "md" | "sm"; className?: string }) {
  return (
    <span className={cx("crm-badge", tone !== "blue" && `crm-badge--${tone}`, size === "sm" && "crm-badge--sm", className)} aria-hidden="true">
      <Icon />
    </span>
  );
}

/** Capped fill width for a pill track (always 0–100). */
export function fillPercent(progress: number | null): number {
  return progress === null ? 0 : Math.round(Math.min(1, Math.max(0, progress)) * 1000) / 10;
}

/** A broad pill progress track. `progress` is 0–1; null renders the pending pattern. */
export function Track({
  progress,
  done = false,
  tone,
  size = "md",
  label,
}: {
  progress: number | null;
  done?: boolean;
  tone?: "amber";
  size?: "md" | "lg";
  label: string;
}) {
  const pct = fillPercent(progress);
  return (
    <div
      className={cx("crm-track", size === "lg" && "crm-track--lg", progress === null && "crm-track--pending")}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress === null ? undefined : Math.round(pct)}
      aria-valuetext={progress === null ? "Pending" : `${Math.round(pct)}%`}
    >
      {progress === null ? null : (
        <span className={cx("crm-track__fill", done && "crm-track__fill--done", tone === "amber" && !done && "crm-track__fill--amber")} style={{ width: `${pct}%` }} />
      )}
    </div>
  );
}

export type PillVariant = "blue" | "new" | "quoted" | "purple" | "neutral" | "gray" | "amber" | "green" | "red" | "gold";

export function Pill({ variant, icon: Icon, children, title, className }: { variant: PillVariant; icon?: LucideIcon; children: ReactNode; title?: string; className?: string }) {
  return (
    <span className={cx("crm-pill", `crm-pill--${variant}`, className)} title={title}>
      {Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export type EvidenceState = "ok" | "warn" | "bad" | "none";

const EVIDENCE_ICON: Record<EvidenceState, LucideIcon> = { ok: Check, warn: TriangleAlert, bad: X, none: Minus };

/** A proof chip: ✓ / ⚠ / ✗ / – paired with words. */
export function EvidenceChip({ state, children, title }: { state: EvidenceState; children: ReactNode; title?: string }) {
  const Icon = EVIDENCE_ICON[state];
  return (
    <span className={cx("crm-evidence", state !== "none" && `crm-evidence--${state}`)} title={title} data-state={state}>
      <Icon aria-hidden="true" />
      {children}
    </span>
  );
}

export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length >= 2 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : parts[0]!.slice(0, 2);
  return letters.toUpperCase();
}

/** A round initials avatar. A missing name renders the empty (unassigned) circle. */
export function Avatar({ name, size = "md", className }: { name: string | null | undefined; size?: "md" | "sm" | "lg"; className?: string }) {
  const empty = !name?.trim();
  return (
    <span className={cx("crm-avatar", size !== "md" && `crm-avatar--${size}`, empty && "crm-avatar--empty", className)} aria-hidden="true" title={name ?? undefined}>
      {initialsOf(name)}
    </span>
  );
}

/** Avatar plus name, with a fallback label when unassigned. */
export function Person({ name, fallback = "Unassigned", size = "sm" }: { name: string | null | undefined; fallback?: string; size?: "sm" | "md" }) {
  return (
    <span className="crm-person">
      <Avatar name={name} size={size} />
      <span>{name?.trim() || fallback}</span>
    </span>
  );
}

/** Copy a job number to the clipboard. Disabled (never fabricated) while the job number is pending. */
export function CopyJobButton({ jobNo, size = "sm", label = "Copy job #" }: { jobNo: string | null | undefined; size?: "sm" | "md"; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (!jobNo) return;
    try {
      await navigator.clipboard.writeText(jobNo);
      setState("copied");
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1600);
  };
  const text = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label;
  return (
    <button
      type="button"
      className={cx("crm-button crm-button--quiet", size === "sm" && "crm-button--sm")}
      onClick={copy}
      onKeyDown={(event) => event.stopPropagation()}
      disabled={!jobNo}
      aria-label={jobNo ? `${label} ${jobNo}` : "Job number pending"}
      title={jobNo ? undefined : "Job number pending"}
    >
      {state === "copied" ? <Check aria-hidden="true" /> : <ClipboardCopy aria-hidden="true" />}
      <span aria-live="polite">{text}</span>
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size,
}: {
  options: readonly { value: T; label: string; count?: number | null; icon?: LucideIcon }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm";
}) {
  return (
    <div className="crm-segmented" role="group" aria-label={label} data-size={size}>
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button key={option.value} type="button" className="crm-segmented__item" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
            {Icon ? <Icon aria-hidden="true" width={14} height={14} /> : null}
            {option.label}
            {option.count !== undefined && option.count !== null ? <span className="crm-segmented__count">{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** A native select dressed as the rounded dropdown (keeps native keyboard and screen reader behaviour). */
export function CrmSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  icon: Icon,
  active = false,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  /** Options with the same `group` render inside one <optgroup>; ungrouped options come first. */
  options: readonly { value: T; label: string; group?: string }[];
  label: string;
  icon?: LucideIcon;
  /** Highlights the control (a filter that narrows the list). */
  active?: boolean;
  className?: string;
}) {
  const ungrouped = options.filter((option) => !option.group);
  const groups = [...new Set(options.filter((option) => option.group).map((option) => option.group as string))];
  const renderOption = (option: { value: T; label: string }) => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  );
  return (
    <label className={cx("crm-select crm-select--native", active && "crm-select--active", className)}>
      {Icon ? <Icon aria-hidden="true" width={16} height={16} /> : null}
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)} aria-label={label}>
        {ungrouped.map(renderOption)}
        {groups.map((group) => (
          <optgroup key={group} label={group}>
            {options.filter((option) => option.group === group).map(renderOption)}
          </optgroup>
        ))}
      </select>
      <ChevronDown aria-hidden="true" width={16} height={16} className="crm-select__chevron" />
    </label>
  );
}

export function Chip({ active = false, onClick, icon: Icon, children, small = false, className, title }: { active?: boolean; onClick?: () => void; icon?: LucideIcon; children: ReactNode; small?: boolean; className?: string; title?: string }) {
  return (
    <button type="button" className={cx("crm-chip", small && "crm-chip--small", className)} aria-pressed={active} onClick={onClick} title={title}>
      {Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/** An active-filter chip with a remove control. */
export function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" className="crm-chip crm-chip--small crm-chip--removable crm-chip--active" onClick={onRemove} aria-label={`Remove filter ${label}`}>
      {label}
      <X aria-hidden="true" />
    </button>
  );
}

/**
 * A search box. `debounceMs` commits while typing (300 ms by default, as the Leads workspace wants); Enter commits
 * at once; clearing the field commits null.
 */
export function SearchBox({
  value,
  onSearch,
  placeholder,
  debounceMs = 300,
  compact = false,
  hint,
  autoFocus,
  className,
}: {
  value: string | null;
  onSearch: (value: string | null) => void;
  placeholder: string;
  debounceMs?: number | null;
  compact?: boolean;
  hint?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value ?? "");
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const commit = (next: string) => {
    clearTimeout(timer.current);
    onSearch(next.trim() || null);
  };
  return (
    <form
      className={cx("crm-search", compact && "crm-search--compact", className)}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        commit(draft);
      }}
    >
      <Search aria-hidden="true" width={16} height={16} />
      <input
        type="search"
        value={draft}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={120}
        autoFocus={autoFocus}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          clearTimeout(timer.current);
          if (!next.trim()) {
            if (value) onSearch(null);
            return;
          }
          if (debounceMs !== null) timer.current = setTimeout(() => onSearch(next.trim() || null), debounceMs);
        }}
      />
      {hint ? <span className="crm-search__hint">{hint}</span> : null}
    </form>
  );
}

/** The page header strip: title, a one-line purpose, page actions on the right, long explanations behind `?`. */
export function PageHeader({ title, subtitle, help, right, eyebrow }: { title: ReactNode; subtitle?: ReactNode; help?: ReactNode; right?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="crm-header">
      <div className="crm-header__titles">
        {eyebrow ? <p className="crm-subtitle" style={{ margin: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{eyebrow}</p> : null}
        <h1 className="crm-title">{title}</h1>
        {subtitle || help ? (
          <p className="crm-subtitle">
            {subtitle}
            {help ? (
              <>
                {" "}
                <HelpPopover>{help}</HelpPopover>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      {right ? <div className="crm-header__right">{right}</div> : null}
    </header>
  );
}

export function HelpPopover({ children, label = "What this page is for" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
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
  return (
    <span className="crm-help" ref={rootRef}>
      <button type="button" className="crm-help__button" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen((current) => !current)}>
        <CircleHelp aria-hidden="true" width={15} height={15} />
      </button>
      {open ? (
        <div id={id} role="dialog" aria-label={label} className="crm-help__pop">
          {children}
        </div>
      ) : null}
    </span>
  );
}

/** A section card with an optional head. */
export function CrmCard({ title, subtitle, tools, foot, children, className, id, selected, onClick, testId, ...rest }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  tools?: ReactNode;
  foot?: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
  selected?: boolean;
  onClick?: () => void;
  testId?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const headingId = useId();
  return (
    <section
      className={cx("crm-card", selected && "crm-card--selected", onClick && "crm-card--clickable", className)}
      id={id}
      data-testid={testId}
      aria-labelledby={title ? headingId : rest["aria-labelledby"]}
      aria-label={rest["aria-label"]}
      onClick={onClick}
    >
      {title || tools ? (
        <div className="crm-card__head">
          {title ? (
            <div>
              <h2 id={headingId} className="crm-card__title">
                {title}
              </h2>
              {subtitle ? <p className="crm-card__subtitle">{subtitle}</p> : null}
            </div>
          ) : null}
          {tools ? <div className="crm-card__tools">{tools}</div> : null}
        </div>
      ) : null}
      {children}
      {foot ? <p className="crm-card__foot">{foot}</p> : null}
    </section>
  );
}

export function Notice({ icon, title, children, tone = "gray", testId }: { icon: LucideIcon; title: ReactNode; children?: ReactNode; tone?: CrmTone; testId?: string }) {
  return (
    <section className="crm-card crm-notice" role="status" data-testid={testId}>
      <IconBadge icon={icon} tone={tone} />
      <div>
        <h2>{title}</h2>
        {children ? <div className="crm-notice__body">{children}</div> : null}
      </div>
    </section>
  );
}

/** A read that failed: said in words, never an endless skeleton. */
export function ReadFailure({ what, error, onRetry, inset = false, testId }: { what: string; error: unknown; onRetry?: () => void; inset?: boolean; testId?: string }) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "The read failed.";
  return (
    <div className={cx(!inset && "crm-card", "crm-read-error")} role="alert" data-testid={testId}>
      <CircleAlert aria-hidden="true" width={18} height={18} />
      <p>
        <strong>{what}</strong> {message}
      </p>
      {onRetry ? (
        <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={onRetry}>
          <RefreshCw aria-hidden="true" width={14} height={14} />
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function SkeletonLine({ width = "100%", height = 12 }: { width?: number | string; height?: number }) {
  return <span className="crm-skeleton" style={{ width, height }} aria-hidden="true" />;
}

export type TrendTone = "up" | "down" | "even";

/** A small trend chip ("▲ +12%"), tone paired with the glyph. */
export function TrendChip({ tone, children, title }: { tone: TrendTone; children: ReactNode; title?: string }) {
  return (
    <span className={cx("crm-trend", `crm-trend--${tone}`)} title={title}>
      <span aria-hidden="true">{tone === "up" ? "▲" : tone === "down" ? "▼" : "•"}</span>
      {children}
    </span>
  );
}

/** A summary card: a circular icon badge, a title, a big value, an optional pill track and a caption. */
export function SummaryCard({
  icon,
  tone,
  title,
  value,
  trend,
  progress,
  caption,
  href,
  testId,
}: {
  icon: LucideIcon;
  tone: CrmTone;
  title: ReactNode;
  value: ReactNode;
  trend?: ReactNode;
  progress?: { value: number | null; done?: boolean; label: string } | null;
  caption?: ReactNode;
  /** Makes the whole card a link. */
  href?: string;
  testId?: string;
}) {
  const body = (
    <>
      <IconBadge icon={icon} tone={tone} />
      <div className="crm-summary__body">
        <h2 className="crm-summary__title">{title}</h2>
        <p className="crm-summary__value">
          <span>{value}</span>
          {trend}
        </p>
        {progress ? <Track progress={progress.value} done={progress.done} label={progress.label} /> : null}
        {caption ? <p className="crm-summary__caption">{caption}</p> : null}
      </div>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="crm-card crm-summary crm-summary--link" data-testid={testId}>
        {body}
      </Link>
    );
  }
  return (
    <section className="crm-card crm-summary" data-testid={testId}>
      {body}
    </section>
  );
}

/** A small money tile (Binder · Deposit · Merchant). */
export function MoneyTile({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <span className="crm-money">
      <span className="crm-money__label">{label}</span>
      <span className="crm-money__value">{value}</span>
    </span>
  );
}

export type FreshnessTone = "green" | "amber" | "red" | "gray";

/** Header freshness chips (Granot · RingCentral · Sheets): a source, a dot and a word, optionally linking to Setup. */
export function FreshnessChips({ chips, label = "Connections" }: { chips: readonly { key: string; source: string; tone: FreshnessTone; label: string; title?: string; href?: string }[]; label?: string }) {
  if (chips.length === 0) return null;
  return (
    <div className="crm-freshness" aria-label={label} role="group">
      {chips.map((chip, index) => {
        const inner = (
          <>
            <span className="crm-freshness__source">{chip.source}</span>
            <span className={cx("crm-dot", `crm-dot--${chip.tone}`)} aria-hidden="true" />
            <span>{chip.label}</span>
          </>
        );
        return (
          <span key={chip.key} style={{ display: "contents" }}>
            {index > 0 ? <span className="crm-freshness__sep" aria-hidden="true" /> : null}
            {chip.href ? (
              <Link href={chip.href} className="crm-freshness__chip" title={chip.title} data-freshness={chip.key} data-state={chip.tone}>
                {inner}
              </Link>
            ) : (
              <span className="crm-freshness__chip" title={chip.title} data-freshness={chip.key} data-state={chip.tone}>
                {inner}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** A tab strip; each tab is a link (URL-driven) or a button. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  hrefFor,
  label,
}: {
  tabs: readonly { value: T; label: string; badge?: number | null; icon?: LucideIcon }[];
  value: T;
  onChange?: (value: T) => void;
  hrefFor?: (value: T) => string;
  label: string;
}) {
  return (
    <div className="crm-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const selected = tab.value === value;
        const inner = (
          <>
            {Icon ? <Icon aria-hidden="true" width={16} height={16} /> : null}
            {tab.label}
            {tab.badge ? <span className="crm-nav__badge">{tab.badge}</span> : null}
          </>
        );
        if (hrefFor) {
          return (
            <Link key={tab.value} href={hrefFor(tab.value)} role="tab" aria-selected={selected} className="crm-tab" data-tab={tab.value} onClick={onChange ? () => onChange(tab.value) : undefined}>
              {inner}
            </Link>
          );
        }
        return (
          <button key={tab.value} type="button" role="tab" aria-selected={selected} className="crm-tab" data-tab={tab.value} onClick={() => onChange?.(tab.value)}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}

/** A tiny ··· menu. Items are links or buttons. */
export function OverflowMenu({ label = "More actions", items }: { label?: string; items: readonly { key: string; label: string; href?: string; onClick?: () => void; danger?: boolean; icon?: LucideIcon; external?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
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
  if (items.length === 0) return null;
  return (
    <span className="crm-help" ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="crm-button crm-button--quiet crm-button--sm"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        ···
      </button>
      {open ? (
        <div className="crm-menu" role="menu" onClick={(event) => event.stopPropagation()}>
          {items.map((item) => {
            const Icon = item.icon;
            const inner = (
              <>
                {Icon ? <Icon aria-hidden="true" width={15} height={15} /> : null}
                {item.label}
              </>
            );
            if (item.href) {
              return (
                <Link key={item.key} role="menuitem" href={item.href} className={cx("crm-menu__item", item.danger && "crm-menu__item--danger")} target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined} onClick={() => setOpen(false)}>
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={cx("crm-menu__item", item.danger && "crm-menu__item--danger")}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {inner}
              </button>
            );
          })}
        </div>
      ) : null}
    </span>
  );
}

export type Density = "comfortable" | "compact";

const DENSITY_EVENT = "vantage-admin-density-changed";

function readDensity(storageKey: string): Density {
  try {
    return window.localStorage.getItem(storageKey) === "compact" ? "compact" : "comfortable";
  } catch {
    // Private mode or blocked storage: the default.
    return "comfortable";
  }
}

/** The Comfortable / Compact density toggle, stored per viewer under `storageKey` (an external store, like the sidebar). */
export function useDensity(storageKey: string): [Density, (next: Density) => void] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === storageKey) onStoreChange();
      };
      const onChange = (event: Event) => {
        if ((event as CustomEvent<{ key?: string }>).detail?.key === storageKey) onStoreChange();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(DENSITY_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(DENSITY_EVENT, onChange);
      };
    },
    [storageKey],
  );
  const density = useSyncExternalStore(subscribe, () => readDensity(storageKey), () => "comfortable" as const);
  const write = (next: Density) => {
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent(DENSITY_EVENT, { detail: { key: storageKey } }));
  };
  return [density, write];
}

export function DensityToggle({ value, onChange }: { value: Density; onChange: (next: Density) => void }) {
  return (
    <Segmented
      label="Card density"
      value={value}
      options={[
        { value: "comfortable", label: "Comfortable" },
        { value: "compact", label: "Compact" },
      ]}
      onChange={onChange}
    />
  );
}
