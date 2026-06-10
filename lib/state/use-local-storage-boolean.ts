"use client";

import { useCallback, useSyncExternalStore } from "react";

const localStorageBooleanChangedEvent = "vantage-admin-local-storage-boolean-changed";

function getLocalStorageBoolean(key: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(key) === "true";
}

function subscribeToLocalStorageBoolean(key: string, onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  function onStorage(event: StorageEvent) {
    if (event.key === key) {
      onStoreChange();
    }
  }

  function onPreferenceChange(event: Event) {
    if ((event as CustomEvent<{ key?: string }>).detail?.key === key) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener(localStorageBooleanChangedEvent, onPreferenceChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(localStorageBooleanChangedEvent, onPreferenceChange);
  };
}

export function setLocalStorageBoolean(key: string, value: boolean) {
  window.localStorage.setItem(key, String(value));
  window.dispatchEvent(new CustomEvent(localStorageBooleanChangedEvent, { detail: { key } }));
}

export function useLocalStorageBoolean(key: string): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => (
    subscribeToLocalStorageBoolean(key, onStoreChange)
  ), [key]);
  const getSnapshot = useCallback(() => getLocalStorageBoolean(key), [key]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
