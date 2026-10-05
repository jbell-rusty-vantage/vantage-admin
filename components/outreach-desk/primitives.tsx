"use client";
/**
 * Small desk primitives styled only by the route-scoped desk token set (`styles/outreach-desk.css`). Color is always
 * paired with text or an icon; progress bars cap at 100% and expose their value to assistive technology.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ClipboardCopy, Search, type LucideIcon } from "lucide-react";
import type { SalesOutreachFreshness } from "@/lib/api/salesOutreach";
import { fillPercent, freshnessChips } from "./lib/format";
import { deskCopy } from "./outreach-desk-copy";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export function IconBadge({ icon: Icon, tone = "blue", size }: { icon: LucideIcon; tone?: "blue" | "green" | "red" | "amber" | "gray"; size?: number }) {
  return (
    <span className={cx("od-badge", tone !== "blue" && `od-badge--${tone}`)} style={size ? { width: size, height: size } : undefined} aria-hidden="true">
      <Icon />
    </span>
  );
}

/** A broad pill progress track. `progress` null renders the pending pattern (unknown, never zero). */
export function Track({
  progress,
  done = false,
  size = "md",
  label,
}: {
  progress: number | null;
  done?: boolean;
  size?: "md" | "lg";
  label: string;
}) {
  const pct = fillPercent(progress);
  return (
    <div
      className={cx("od-track", size === "lg" && "od-track--lg", progress === null && "od-track--pending")}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress === null ? undefined : Math.round(pct)}
      aria-valuetext={progress === null ? deskCopy.text.pending : `${Math.round(pct)}%`}
    >
      {progress === null ? null : <span className={cx("od-track__fill", done && "od-track__fill--done")} style={{ width: `${pct}%` }} />}
    </div>
  );
}

export function Pill({ variant, children }: { variant: "new" | "quoted" | "neutral" | "amber" | "green" | "red"; children: ReactNode }) {
  return <span className={`od-pill od-pill--${variant}`}>{children}</span>;
}

/** A round initials avatar (the sidebar identity's look) for a person's name. */
export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "sm" }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : (parts[0] ?? "?").slice(0, 2);
  return (
    <span className={cx("od-avatar", size === "sm" && "od-avatar--sm")} aria-hidden="true">
      {letters.toUpperCase()}
    </span>
  );
}

/** Copy job # — the desk's main action. Disabled (never fabricated) while the Job Number is pending. */
export function CopyJobButton({ jobNo, block = false }: { jobNo: string | null; block?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (event: React.MouseEvent) => {
    event.stopPropagation();
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
  const c = deskCopy.lead;
  const text = state === "copied" ? c.copied : state === "failed" ? c.copyFailed : c.copy;
  return (
    <button
      type="button"
      className={cx("od-button", block && "od-button--block")}
      onClick={copy}
      onKeyDown={(event) => event.stopPropagation()}
      disabled={!jobNo}
      aria-label={jobNo ? `${c.copy} ${jobNo}` : c.copyDisabled}
      title={jobNo ? undefined : c.jobPending}
    >
      {state === "copied" ? <Check aria-hidden="true" /> : <ClipboardCopy aria-hidden="true" />}
      <span aria-live="polite">{text}</span>
    </button>
  );
}

const DOT_CLASS = { green: "od-dot--green", amber: "od-dot--amber", gray: "od-dot--gray" } as const;

/** Header freshness chips: Moving software, RingCentral calls, RingCentral SMS — each its own capture state. */
export function FreshnessChips({ freshness }: { freshness: SalesOutreachFreshness | null | undefined }) {
  if (!freshness) return null;
  const chips = freshnessChips(freshness);
  return (
    <div className="od-freshness" aria-label={deskCopy.freshness.label} role="group">
      {chips.map((chip, index) => (
        <span key={chip.key} style={{ display: "contents" }}>
          {index > 0 ? <span className="od-freshness__sep" aria-hidden="true" /> : null}
          <span className="od-freshness__chip" title={chip.title} data-freshness={chip.key} data-state={chip.tone}>
            <span className="od-freshness__source">{chip.source}</span>
            <span className={cx("od-dot", DOT_CLASS[chip.tone])} aria-hidden="true" />
            <span>{chip.label}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="od-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" className="od-segmented__item" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A native select dressed as the reference's rounded dropdown (keeps native keyboard and screen reader behavior). */
export function DeskSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  icon: Icon,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  label: string;
  icon?: LucideIcon;
}) {
  return (
    <label className="od-select od-select--native">
      {Icon ? <Icon aria-hidden="true" width={16} height={16} /> : null}
      <span className="od-sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)} aria-label={label}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" width={16} height={16} className="od-select__chevron" />
    </label>
  );
}

/** A search box that submits on Enter and clears on empty. */
export function SearchBox({ value, onSearch, placeholder }: { value: string | null; onSearch: (value: string | null) => void; placeholder: string }) {
  const [draft, setDraft] = useState(value ?? "");
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value ?? "");
  }
  return (
    <form
      className="od-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(draft.trim() || null);
      }}
    >
      <Search aria-hidden="true" width={16} height={16} />
      <input
        type="search"
        value={draft}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={100}
        onChange={(event) => {
          setDraft(event.target.value);
          if (!event.target.value && value) onSearch(null);
        }}
      />
    </form>
  );
}

export function DeskHeader({ title, subtitle, right }: { title: string; subtitle?: string | null; right?: ReactNode }) {
  return (
    <header className="od-header">
      <div className="od-header__titles">
        <h1 className="od-title">{title}</h1>
        {subtitle ? <p className="od-subtitle">{subtitle}</p> : null}
      </div>
      {right ? <div className="od-header__right">{right}</div> : null}
    </header>
  );
}

export function Notice({ icon, title, children, tone = "gray" }: { icon: LucideIcon; title: string; children?: ReactNode; tone?: "blue" | "green" | "red" | "amber" | "gray" }) {
  return (
    <section className="od-card od-notice" role="status">
      <IconBadge icon={icon} tone={tone} />
      <div>
        <h2>{title}</h2>
        {children ? <div className="od-notice__body">{children}</div> : null}
      </div>
    </section>
  );
}

export function SkeletonLine({ width = "100%", height = 12 }: { width?: number | string; height?: number }) {
  return <span className="od-skeleton" style={{ width, height }} aria-hidden="true" />;
}

/** A summary card: a circular icon badge, a title, a big value, an optional pill track and a caption. */
export function SummaryCard({
  icon,
  tone,
  title,
  value,
  progress,
  caption,
  testId,
}: {
  icon: LucideIcon;
  tone: "blue" | "green" | "red" | "amber" | "gray";
  title: string;
  value: ReactNode;
  progress?: { value: number | null; done?: boolean; label: string } | null;
  caption?: ReactNode;
  testId: string;
}) {
  return (
    <section className="od-card od-summary" data-testid={testId}>
      <IconBadge icon={icon} tone={tone} />
      <div className="od-summary__body">
        <h2 className="od-summary__title">{title}</h2>
        <p className={typeof value === "string" && /^D/.test(value) ? "od-summary__value od-summary__value--word" : "od-summary__value"}>{value}</p>
        {progress ? <Track progress={progress.value} done={progress.done} label={progress.label} /> : null}
        {caption ? <p className="od-summary__caption">{caption}</p> : null}
      </div>
    </section>
  );
}
