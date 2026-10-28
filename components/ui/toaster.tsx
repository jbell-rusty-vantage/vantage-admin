"use client";
/**
 * App-wide toast outlet (sonner). Call `toast.success(...)` / `toast.error(...)` from `sonner` anywhere in a client
 * component for save feedback; this one `<Toaster>` in the root layout renders them.
 */
import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      duration={4500}
      toastOptions={{ style: { fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif", fontSize: 14 } }}
    />
  );
}
