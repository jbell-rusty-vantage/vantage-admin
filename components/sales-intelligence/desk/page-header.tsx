"use client";
/**
 * The page header: the title, the Numbers search box and the live indicator with `Refresh`. A submit searches Numbers
 * (from RingCentral Accounts it opens Numbers with `q`). Clearing the box removes `q`. A number of 1–3 digits and
 * nothing else shows `Enter at least 4 digits to search by phone` and doesn't submit.
 */
import { useState, type ReactNode } from "react";
import { SearchField } from "../chrome";
import { HeaderLive } from "../data/live";
import { copy } from "../sales-intelligence-copy";

const s = copy.search;

/** 1–3 digits, optionally with phone punctuation, and nothing else. */
export function isShortPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || !/^[\d\s()+.-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 1 && digits.length <= 3;
}

export type SearchAction = { kind: "hint" } | { kind: "clear" } | { kind: "search"; q: string };

/** What a submit does: the phone hint (no request), clear `q`, or search. */
export function searchAction(value: string): SearchAction {
  const q = value.trim();
  if (!q) return { kind: "clear" };
  if (isShortPhone(q)) return { kind: "hint" };
  return { kind: "search", q };
}

export function PageHeaderView({ value, onChange, onSubmit, live }: { value: string; onChange: (value: string) => void; onSubmit: (value: string) => void; live?: ReactNode }) {
  return (
    <div className="si-desk__titlebar">
      <h1 className="si-desk__title">{copy.page.title}</h1>
      <div className="si-desk__search">
        <SearchField value={value} onChange={onChange} onSubmit={onSubmit} placeholder={s.placeholder} label={s.label} hint={isShortPhone(value) ? s.hint : null} maxLength={200} />
      </div>
      {live && <div className="si-desk__live">{live}</div>}
    </div>
  );
}

export function PageHeader({ q, onSearch }: { q: string | null; onSearch: (q: string | null) => void }) {
  const [value, setValue] = useState(q ?? "");
  const [seen, setSeen] = useState(q);
  // The URL's `q` wins when it changes from elsewhere (a view link, Back). Render-time adjust, no effect.
  if (seen !== q) {
    setSeen(q);
    setValue(q ?? "");
  }
  const onChange = (next: string) => {
    setValue(next);
    if (!next && q) onSearch(null);
  };
  const onSubmit = (next: string) => {
    const action = searchAction(next);
    if (action.kind === "hint") return;
    onSearch(action.kind === "search" ? action.q : null);
  };
  return <PageHeaderView value={value} onChange={onChange} onSubmit={onSubmit} live={<HeaderLive />} />;
}
