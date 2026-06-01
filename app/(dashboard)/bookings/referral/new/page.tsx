import { ReferralBookingForm } from "@/components/forms/referral-booking-form";

export default function NewReferralBookingPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Create Referral Booking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a leadless referral booking for the Master Booked Sheet Booked Deals tab.
        </p>
      </div>
      <ReferralBookingForm />
    </div>
  );
}
