"use client";
import { useId, useState } from "react";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";

/** Sticky in-page anchor nav (analysis sections). 44 px targets; scrolls sideways at 390 px. */
export function SubNav({ items, activeId, label = copy.ui1.prim.subNavLabel, className }: { items: { id: string; label: string }[]; activeId?: string | null; label?: string; className?: string }) {
  return (
    <nav className={cx("si-subnav", className)} aria-label={label}>
      <ul className="si-subnav__list">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className={cx("si-subnav__link", item.id === activeId && "is-active")} aria-current={item.id === activeId ? "location" : undefined}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * UI2-PHONE (UI-2 §7): the sub-nav as a `Jump to` select for narrow screens (below 768 px the CSS shows this and hides
 * the link row; above, the reverse). Picking a section scrolls to its anchor and writes the hash, like the links do.
 */
export function JumpSelect({ items, label, className }: { items: { id: string; label: string }[]; label: string; className?: string }) {
  const id = useId();
  const [value, setValue] = useState(items[0]?.id ?? "");
  return (
    <div className={cx("si-jump", className)}>
      <label htmlFor={id} className="si-jump__label">{label}</label>
      <select
        id={id}
        className="si-input si-select si-jump__select"
        value={value}
        onChange={(event) => {
          const target = event.target.value;
          setValue(target);
          const el = document.getElementById(target);
          if (!el) return;
          el.scrollIntoView({ block: "start" });
          window.history.replaceState(null, "", `#${target}`);
        }}
      >
        {items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </div>
  );
}
