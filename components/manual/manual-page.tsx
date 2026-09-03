"use client";

import { ConnectBookingSection } from "./connect-booking-section";
import { CreateLeadForm } from "./create-lead-form";
import { MANUAL_COPY } from "./manual-copy";

export function ManualPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Manual</h1>
        <p className="mt-1 text-sm text-muted-foreground">{MANUAL_COPY.pageHint}</p>
      </div>
      <section className="rounded-lg border bg-background p-4">
        <CreateLeadForm />
      </section>
      <section className="rounded-lg border bg-background p-4">
        <ConnectBookingSection />
      </section>
    </div>
  );
}
