"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/** Wait for full names / phone digits before hitting the API. */
export const DEFAULT_SEARCH_DEBOUNCE_MS = 400;
/** Names and phone prefixes are useful from 3 characters; clears apply immediately. */
export const MIN_SEARCH_QUERY_LENGTH = 3;

export function getCommittedSearchQuery(value: string, minLength = MIN_SEARCH_QUERY_LENGTH) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.length >= minLength ? trimmed : null;
}

type DebouncedSearchInputProps = {
  value: string;
  onCommit: (value: string) => void;
  debounceMs?: number;
  minLength?: number;
  placeholder?: string;
  "aria-label"?: string;
};

export function DebouncedSearchInput({
  value,
  onCommit,
  debounceMs = DEFAULT_SEARCH_DEBOUNCE_MS,
  minLength = MIN_SEARCH_QUERY_LENGTH,
  placeholder = "Name, phone, email, or ID…",
  "aria-label": ariaLabel = "Search",
}: DebouncedSearchInputProps) {
  const [draftState, setDraftState] = useState({ sourceValue: value, draft: value });
  const draft = draftState.sourceValue === value ? draftState.draft : value;
  const onCommitRef = useRef(onCommit);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    const nextCommit = getCommittedSearchQuery(draft, minLength);
    const committed = getCommittedSearchQuery(value, minLength);

    if (nextCommit === "") {
      onCommitRef.current("");
      return;
    }

    if (nextCommit === null) {
      if (value.trim()) {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          onCommitRef.current("");
        }, debounceMs);
        return () => {
          if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        };
      }
      return;
    }

    if (nextCommit === committed) {
      return;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onCommitRef.current(nextCommit);
    }, debounceMs);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [draft, value, minLength, debounceMs]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    const nextCommit = getCommittedSearchQuery(draft, minLength);
    const committed = getCommittedSearchQuery(value, minLength);
    if (nextCommit === null || nextCommit === committed) {
      return;
    }
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onCommitRef.current(nextCommit);
  }

  return (
    <Input
      value={draft}
      onChange={(event) => setDraftState({ sourceValue: value, draft: event.target.value })}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );
}
