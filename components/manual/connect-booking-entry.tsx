"use client";
/**
 * Bookings → Reconciliation → Connect (doc 01): the old Manual "Connect Booking to Lead" section, opened by
 * `?connect=1` and closable in place. `/manual?tab=attach` redirects here.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Link2, X } from "lucide-react";
import { CrmCard } from "@/components/ui/crm";
import { ConnectBookingSection } from "./connect-booking-section";
import { MANUAL_COPY } from "./manual-copy";

export function ConnectBookingEntry() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = searchParams.get("connect") === "1";
  function toggle(next: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("connect", "1");
    else params.delete("connect");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }
  if (!open) {
    return (
      <div className="mb-5 flex justify-end">
        <button type="button" className="crm-button crm-button--quiet" onClick={() => toggle(true)}>
          <Link2 aria-hidden="true" />
          {MANUAL_COPY.attachTab}
        </button>
      </div>
    );
  }
  return (
    <div className="mb-5">
      <CrmCard
        title={MANUAL_COPY.attachTab}
        tools={
          <button type="button" className="crm-button crm-button--quiet crm-button--icon" onClick={() => toggle(false)} aria-label="Close">
            <X aria-hidden="true" />
          </button>
        }
      >
        <div className="crm-card__body">
          <ConnectBookingSection />
        </div>
      </CrmCard>
    </div>
  );
}
