"use client";
/**
 * UI2-SHELL (UI-2 §1): the dashboard frame for a rep. No sidebar and no page links: a rep reaches only the interim
 * Sales Intelligence page (which says it is not available for Rep accounts yet), so the frame is the brand, who is
 * signed in, and Sign out. It makes no server read.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { DASHBOARD_MAIN_ID } from "@/components/layout/dashboard-ids";
import { copy } from "../sales-intelligence-copy";

/** Sign out, at the 44 px rep target (the shared `LogoutButton` is 36 px). */
function RepSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <span className="si-root">
      <button type="button" className="si-btn si-btn--secondary si-btn--md si-hit" onClick={signOut} disabled={busy}>
        {copy.ui2.shell.signOut}
      </button>
    </span>
  );
}

export function RepFrame({ email, children }: { email: string; children: ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("overflow-hidden");
    body.classList.add("h-full", "min-h-0", "overflow-hidden");
    return () => {
      html.classList.remove("overflow-hidden");
      body.classList.remove("h-full", "min-h-0", "overflow-hidden");
    };
  }, []);
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-cool-white" data-frame="rep">
      <header className="z-30 flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-steel-200 bg-white/95 px-4 py-2 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <BrandLogo size="sm" subtitle={copy.ui2.shell.title} showText={false} />
          <span className="truncate text-sm text-steel" data-rep-email>{copy.ui2.shell.signedInAs(email)}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <RepSignOut />
        </div>
      </header>
      <main id={DASHBOARD_MAIN_ID} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overflow-x-hidden p-0">
        {children}
      </main>
    </div>
  );
}
