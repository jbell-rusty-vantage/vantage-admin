"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SidePanel({
  title,
  description,
  open,
  onClose,
  header,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close detail panel"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-3xl flex-col border-l bg-background shadow-xl">
        <header className={header ? "border-b-0" : "border-b"}>
          <div className="flex items-start justify-between gap-4 p-5">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            </div>
            <Button variant="ghost" className="h-9 w-9 px-0" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          {header}
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}
