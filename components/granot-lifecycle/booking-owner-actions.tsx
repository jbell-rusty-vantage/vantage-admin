"use client";

import type { GranotLifecycleCaseDetail } from "@/lib/api/granotLifecycle";
import { BookingCommandForm } from "./booking-command-form";
import { BookingUpdateForm } from "./booking-update-form";
import { NoActionForm } from "./no-action-form";
import { ReferralBookingForm } from "./referral-booking-form";

export function BookingOwnerActions({ detail }: { detail: GranotLifecycleCaseDetail }) {
  if (
    detail.kind !== "booking" ||
    !detail.capabilities.commands ||
    detail.state !== "open"
  ) return null;
  return (
    <div className="space-y-5">
      {detail.mode === "create_missing_booking" ? <BookingCommandForm detail={detail} /> : null}
      {detail.mode === "create_referral_booking" ? <ReferralBookingForm detail={detail} /> : null}
      {detail.mode === "review_existing_booking" ? <BookingUpdateForm detail={detail} /> : null}
      {(detail.mode === "create_missing_booking" || detail.mode === "review_existing_booking" || detail.mode === "create_referral_booking")
        ? <NoActionForm detail={detail} />
        : null}
    </div>
  );
}
