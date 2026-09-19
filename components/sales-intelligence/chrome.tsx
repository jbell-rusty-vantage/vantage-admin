"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes } from "react";
import { AlertCircle, Building2, HelpCircle, ListFilter, Pause, Phone, PhoneOff, Radio, Search, User, UserX, X } from "lucide-react";
import { copy } from "./sales-intelligence-copy";
import { classificationLabel, cx, eligibilityLabel, label, reviewCauseLabel } from "./lib/format";
import { Badge, type Tone } from "./atoms/badge";
import { Button } from "./atoms/button";

export function Field({
  label: fieldLabel,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: (ids: { id: string }) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="si-field">
      <label htmlFor={id} className="si-field__label">{fieldLabel}</label>
      {children({ id })}
      {hint && <p className="si-field__hint">{hint}</p>}
    </div>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx("si-input", "si-select", className)} {...props}>{children}</select>;
}

export function Checkbox({
  label: checkLabel,
  hint,
  checked,
  onChange,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="si-checkwrap">
      <label htmlFor={id} className="si-check">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{checkLabel}</span>
      </label>
      {hint && <p className="si-field__hint">{hint}</p>}
    </div>
  );
}

export function Tabs<K extends string>({
  items,
  value,
  onChange,
  label: tabLabel,
  idBase,
}: {
  items: { key: K; label: ReactNode; count?: number | null }[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  idBase: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.key === value);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    onChange(items[next].key);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={tabLabel} className="si-tabs" onKeyDown={onKey}>
      {items.map((item, index) => (
        <button
          key={item.key}
          ref={(node) => { refs.current[index] = node; }}
          role="tab"
          type="button"
          id={`${idBase}-tab-${item.key}`}
          aria-selected={item.key === value}
          aria-controls={`${idBase}-panel-${item.key}`}
          tabIndex={item.key === value ? 0 : -1}
          className={cx("si-tab", item.key === value && "is-active")}
          onClick={() => onChange(item.key)}
        >
          <span>{item.label}</span>
          {item.count != null && <span className="si-tab__count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function FilterChip({ label: chipLabel, onRemove }: { label: ReactNode; onRemove: () => void }) {
  return (
    <span className="si-filterchip">
      <span>{chipLabel}</span>
      <button type="button" aria-label="Remove filter" onClick={onRemove}>
        <X size={12} aria-hidden />
      </button>
    </span>
  );
}

export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder,
  label: searchLabel,
  hint,
  maxLength = 200,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder: string;
  label: string;
  hint?: string | null;
  maxLength?: number;
}) {
  return (
    <form
      role="search"
      className="si-search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(value);
      }}
    >
      <Search size={16} aria-hidden className="si-search__icon" />
      <input
        type="search"
        aria-label={searchLabel}
        className="si-search__input"
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button type="button" className="si-iconbtn si-iconbtn--sm" aria-label="Clear search" onClick={() => onChange("")}>
          <X size={14} aria-hidden />
        </button>
      )}
      {hint && <span className="si-search__hint" role="note">{hint}</span>}
    </form>
  );
}

export function LiveIndicator({ status }: { status: "connecting" | "live" | "reconnecting" }) {
  return (
    <span className="si-live" title={copy.live.liveNote}>
      <span className={cx("si-dot", status === "live" && "si-dot--green si-dot--pulse", status === "reconnecting" && "si-dot--amber", status === "connecting" && "si-dot--amber")} />
      <Radio size={14} aria-hidden />
      <span>{copy.live[status]}</span>
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="si-empty" role="status">
      <p className="si-empty__title">{title}</p>
      {children && <p className="si-empty__text">{children}</p>}
    </div>
  );
}

export function Failure({ error, retry, message }: { error?: Error; retry: () => void; message?: string }) {
  return (
    <div role="alert" className="si-local-notice">
      {message ?? copy.errors.loadFailed} {error && label(error.message)}{" "}
      <Button variant="link" size="sm" onClick={retry}>{copy.actions.retry}</Button>
    </div>
  );
}

const classificationIcon = {
  unknown: HelpCircle,
  customer: User,
  company: Building2,
  non_customer: UserX,
} as const;

const eligibilityIcon = {
  allowed: Phone,
  temporarily_blocked: Pause,
  suppressed: PhoneOff,
  unknown: HelpCircle,
} as const;

const eligibilityTone: Record<string, Tone> = {
  allowed: "green",
  temporarily_blocked: "amber",
  suppressed: "red",
  unknown: "neutral",
};

export function ClassificationBadge({ value }: { value: string }) {
  const Icon = classificationIcon[value as keyof typeof classificationIcon] ?? HelpCircle;
  return <Badge icon={<Icon size={12} aria-hidden />}>{classificationLabel(value)}</Badge>;
}

export function EligibilityBadge({ value }: { value: string }) {
  const Icon = eligibilityIcon[value as keyof typeof eligibilityIcon] ?? HelpCircle;
  return <Badge tone={eligibilityTone[value] ?? "neutral"} icon={<Icon size={12} aria-hidden />}>{eligibilityLabel(value)}</Badge>;
}

export function ReviewBadge({ value }: { value: string }) {
  return <Badge tone="amber" icon={<AlertCircle size={12} aria-hidden />}>{reviewCauseLabel(value)}</Badge>;
}

export function FilterRail({
  title,
  intro,
  onClose,
  children,
}: {
  title: string;
  intro: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside className="si-listview__rail" aria-label={title}>
      <div className="si-filters__head">
        <div>
          <h3 className="si-filters__title">{title}</h3>
          <p className="si-filters__intro">{intro}</p>
        </div>
        <button type="button" className="si-iconbtn si-iconbtn--sm" aria-label={copy.filters.close} onClick={onClose}>
          <X size={16} aria-hidden />
        </button>
      </div>
      {children}
    </aside>
  );
}

export function FilterToolbar({
  open,
  onToggle,
  chips,
  activeCount,
  note,
}: {
  open: boolean;
  onToggle: () => void;
  chips: ReactNode;
  activeCount: number;
  note?: ReactNode;
}) {
  return (
    <div className="si-listview__toolbar">
      <Button variant={open || activeCount ? "primary" : "secondary"} size="sm" aria-expanded={open} onClick={onToggle}>
        <ListFilter size={14} aria-hidden />
        {copy.actions.filters}{activeCount ? ` (${activeCount})` : ""}
      </Button>
      {activeCount > 0 && (
        <span className="si-text--sm si-text--subtle">
          {activeCount === 1 ? copy.filters.appliedOne : copy.filters.appliedMany(activeCount)}
        </span>
      )}
      {note}
      <span className="si-chiprow">{chips}</span>
    </div>
  );
}
