import Link from "next/link";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";

export type RouteTab<K extends string = string> = { key: K; label: string; href: string; count?: number | null };

/** Link-based tabs (each tab is a route): a `nav` with `aria-current="page"`, styled like `.si-tab`. */
export function RouteTabs<K extends string>({ items, active, label = copy.ui1.prim.routeTabsLabel, className }: { items: RouteTab<K>[]; active: K; label?: string; className?: string }) {
  return (
    <nav className={cx("si-tabs si-routetabs", className)} aria-label={label}>
      {items.map((item) => (
        <Link key={item.key} href={item.href} className={cx("si-tab si-routetab", item.key === active && "is-active")} aria-current={item.key === active ? "page" : undefined}>
          <span>{item.label}</span>
          {item.count != null && <span className="si-tab__count">{item.count.toLocaleString("en-US")}</span>}
        </Link>
      ))}
    </nav>
  );
}
