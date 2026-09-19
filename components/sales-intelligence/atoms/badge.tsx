"use client";
import { type ReactNode } from "react";
import { cx } from "../lib/format";

export type Tone = "neutral" | "blue" | "navy" | "gold" | "amber" | "red" | "green";

export function Badge({ tone = "neutral", icon, children, className, title }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string; title?: string }) {
  return (
    <span className={cx("si-badge", `si-badge--${tone}`, className)} title={title}>
      {icon}
      <span>{children}</span>
    </span>
  );
}
