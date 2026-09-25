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
