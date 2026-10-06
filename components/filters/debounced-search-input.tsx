"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  // The value this input last committed: when it echoes back as `value` (after the URL navigation's delay) the
  // draft keeps what was typed meanwhile; a value changed elsewhere (Reset, a chip) replaces the draft.
  const [lastCommit, setLastCommit] = useState<string | null>(null);
  const echoedOwnCommit = draftState.sourceValue !== value && lastCommit === value.trim();
  const draft = draftState.sourceValue === value || echoedOwnCommit ? draftState.draft : value;
  const onCommitRef = useRef(onCommit);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);
  const commit = useCallback((next: string) => {
    setLastCommit(next);
    onCommitRef.current(next);
  }, []);

  useEffect(() => {
    const nextCommit = getCommittedSearchQuery(draft, minLength);
    const committed = getCommittedSearchQuery(value, minLength);

    if (nextCommit === "") {
      // A cleared field commits from the change handler, not from here.
      return;
    }

    if (nextCommit === null) {
      if (value.trim()) {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          commit("");
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
      commit(nextCommit);
    }, debounceMs);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [draft, value, minLength, debounceMs, commit]);

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
    commit(nextCommit);
  }

  return (
    <Input
      value={draft}
      onChange={(event) => {
        const next = event.target.value;
        setDraftState({ sourceValue: value, draft: next });
        // Clearing applies at once (no debounce), but only when something was committed.
        if (!next.trim() && getCommittedSearchQuery(value, minLength)) commit("");
      }}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );
}
