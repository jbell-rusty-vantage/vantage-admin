"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "./logout-button";

export function initialsFromEmail(email: string): string {
  const local = email.trim().split("@")[0] ?? "";
  const parts = local.split(/[.\-_+\s]+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.[0];
    const second = parts[1]?.[0];
    if (first && second) {
      return `${first}${second}`.toUpperCase();
    }
  }

  const letter = local[0];
  return letter ? letter.toUpperCase() : "";
}

function capitalizeRole(role: "owner" | "admin"): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function UserMenu({ email, role }: { email: string; role: "owner" | "admin" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const initials = initialsFromEmail(email);
  const roleLabel = capitalizeRole(role);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={cn(
          "flex items-center gap-2 rounded-md px-1.5 py-1",
          "hover:bg-steel-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
          {initials}
        </span>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="text-sm font-medium text-navy">{email}</span>
          <span className="text-xs text-steel">{roleLabel}</span>
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-steel-200 bg-white p-3 shadow-lg"
        >
          <p className="truncate text-sm font-medium text-navy">{email}</p>
          <p className="mb-3 text-xs text-steel">{roleLabel}</p>
          <LogoutButton />
        </div>
      ) : null}
    </div>
  );
}
