import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand/brand-logo";
import "@/components/sales-intelligence/styles/sales-intelligence.css";
import { AcceptInviteClient } from "./accept-invite-client";

/** UI2-USERS: the public accept-invite page (session-free in `server/auth/routeGuard.ts`). No dashboard layout. */
export const metadata: Metadata = {
  title: "Set your password · Vantage Admin",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function AcceptInvitePage() {
  return (
    <main className="si-root si-accept">
      <div className="si-accept__frame">
        <BrandLogo subtitle="Admin" />
        <AcceptInviteClient />
      </div>
    </main>
  );
}
