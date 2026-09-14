"use client";

import type {
  GranotLifecycleCandidateItem,
  GranotLifecycleCaseDetail,
} from "@/lib/api/granotLifecycle";
import { BookingCommandForm } from "./booking-command-form";
import { BookingUpdateForm } from "./booking-update-form";
import { CancellationCommandForm } from "./cancellation-command-form";
import { NoActionForm } from "./no-action-form";
import { ReferralBookingForm } from "./referral-booking-form";

export function BookingOwnerActions({
  detail,
  matchedLead,
  surface = "technical",
}: {
  detail: GranotLifecycleCaseDetail;
  matchedLead?: GranotLifecycleCandidateItem;
  surface?: "intakes" | "technical";
}) {
  if (
    detail.kind !== "booking" ||
    !detail.capabilities.commands ||
    detail.state !== "open"
  ) return null;
  const showConfirmCancellation = surface !== "intakes" && detail.capabilities.confirm_cancellation;
  return (
    <div className="space-y-5">
      {detail.mode === "create_missing_booking"
        ? <BookingCommandForm detail={detail} matchedLead={matchedLead} />
        : null}
      {detail.mode === "create_referral_booking" ? <ReferralBookingForm detail={detail} /> : null}
      {detail.mode === "review_existing_booking" ? <BookingUpdateForm detail={detail} /> : null}
      {showConfirmCancellation
        ? <CancellationCommandForm detail={detail} confirm="booking" />
        : null}
      {(detail.mode === "create_missing_booking" || detail.mode === "review_existing_booking" || detail.mode === "create_referral_booking")
        ? <NoActionForm detail={detail} />
        : null}
    </div>
  );
}
