"use client";
/**
 * UI1-CHAT (UX28): `Send to someone else`: a searchable list over the RingCentral directory (`GET /reps`,
 * `useReps()`). A user without a reviewed, still-effective identity link is marked `No reviewed Agent match`
 * (the server decides whether it accepts the destination). 44 px rows; Escape closes the picker only.
 */
import { Check, Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { repsSchema } from "@/lib/api/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { useReps } from "../data/use-reps";
import type { NudgeRecipient } from "../data/use-nudges";

type RepsData = ReturnType<typeof repsSchema.parse>["data"];

export type PickerRow = { id: string; name: string; detail: string | null; reviewed: boolean; recipient: NudgeRecipient | null };

/** Pure: one row per directory user, named by the reviewed Agent when there is one. */
export function pickerRows(data: RepsData): PickerRow[] {
  const c = copy.ui1.chat;
  const accounts = data.directory.accounts ?? [];
  return data.directory.users.map((user) => {
    const link = data.items.find((item) => item.rc_extension_id === user.extension_id && item.status === "reviewed" && !item.effective_to
      && (!user.rc_account_id || item.rc_account_id === user.rc_account_id));
    const account = user.rc_account_id ?? link?.rc_account_id ?? (accounts.length === 1 ? accounts[0]!.rc_account_id : null);
    const name = link?.agent_name ?? user.attached_agent?.name ?? user.extension_name ?? c.unnamedExtension(user.extension_number ?? user.extension_id);
    const detail = [user.extension_name && user.extension_name !== name ? user.extension_name : null, user.extension_number ? c.extension(user.extension_number) : null]
      .filter(Boolean).join(" · ") || null;
    const recipient: NudgeRecipient | null = account
      ? { rc_account_id: account, rc_extension_id: user.extension_id, rep_identity_link_id: link?.id ?? null, expected_rep_revision: link?.revision ?? null,
          name, agent_id: link?.agent_id ?? null }
      : null;
    return { id: `${account ?? "?"}:${user.extension_id}`, name, detail, reviewed: !!link, recipient };
  });
}

/** Pure: case-insensitive match on the name and the detail line. */
export function filterRows(rows: readonly PickerRow[], query: string): PickerRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter((row) => row.name.toLowerCase().includes(q) || (row.detail ?? "").toLowerCase().includes(q));
}

export function RecipientPickerView({
  rows,
  current,
  onPick,
  onClose,
  defaultQuery = "",
  autoFocus = true,
}: {
  rows: readonly PickerRow[];
  current: NudgeRecipient | null;
  onPick: (recipient: NudgeRecipient) => void;
  onClose: () => void;
  defaultQuery?: string;
  /** Focus the search box on open (the gallery turns it off). */
  autoFocus?: boolean;
}) {
  const c = copy.ui1.chat;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(defaultQuery);
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);
  const shown = filterRows(rows, query);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      onClose();
    }
  };
  const isCurrent = (row: PickerRow) => !!current && !!row.recipient && row.recipient.rc_account_id === current.rc_account_id && row.recipient.rc_extension_id === current.rc_extension_id;
  return (
    <div className="si-picker" onKeyDown={onKeyDown} data-picker>
      <div className="si-picker__search">
        <Search size={16} aria-hidden />
        <label className="si-sr" htmlFor={`${id}-q`}>{c.pickerPlaceholder}</label>
        <input
          ref={input}
          id={`${id}-q`}
          className="si-input si-picker__input"
          type="search"
          placeholder={c.pickerPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" className="si-link si-hit si-picker__close" onClick={onClose}>{c.pickerClose}</button>
      </div>
      {shown.length ? (
        <ul className="si-picker__list" aria-label={c.pickerLabel}>
          {shown.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={cx("si-picker__row", isCurrent(row) && "is-current")}
                disabled={!row.recipient}
                aria-current={isCurrent(row) || undefined}
                onClick={() => row.recipient && onPick(row.recipient)}
                data-reviewed={row.reviewed ? "1" : "0"}
              >
                <span className="si-picker__name">{row.name}</span>
                {row.detail && <span className="si-picker__detail si-text--sm si-text--subtle">{row.detail}</span>}
                {!row.reviewed && <span className="si-picker__flag si-text--sm">{c.noReviewedMatch}</span>}
                {isCurrent(row) && (
                  <span className="si-picker__current">
                    <Check size={14} aria-hidden />
                    <span className="si-sr">{c.current}</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="si-picker__empty si-text--sm si-text--subtle">{c.pickerEmpty}</p>
      )}
    </div>
  );
}

/** Reads the directory (suspends: render inside a Region). */
export function RecipientPicker(props: Omit<Parameters<typeof RecipientPickerView>[0], "rows">) {
  const { data } = useReps();
  return <RecipientPickerView rows={pickerRows(data.data)} {...props} />;
}
