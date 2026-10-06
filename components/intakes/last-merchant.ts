"use client";
/**
 * The merchant the Owner filed their last booking with, remembered per viewer in the browser (doc 06: Merchant is
 * pre-selected to the last used). An external store read with `useSyncExternalStore`, never an effect that sets state;
 * blocked storage reads as "nothing remembered".
 */
import { useSyncExternalStore } from "react";
import { LAST_MERCHANT_STORAGE_KEY } from "@/lib/api/bookingsToFinish";

const CHANGED = "vantage-admin-last-merchant-changed";

function read(): string {
  try {
    return window.localStorage.getItem(LAST_MERCHANT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === LAST_MERCHANT_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGED, onChange);
  };
}

export function useLastMerchant(): string {
  return useSyncExternalStore(subscribe, read, () => "");
}

export function rememberMerchant(merchantId: string): void {
  try {
    window.localStorage.setItem(LAST_MERCHANT_STORAGE_KEY, merchantId);
  } catch {
    // Private mode or blocked storage: nothing is remembered, nothing breaks.
  }
  window.dispatchEvent(new Event(CHANGED));
}
