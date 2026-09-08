import { BookingForm } from "@/components/forms/booking-form";
import { BOOKING_FORM_COPY } from "@/components/forms/booking-form-copy";

export default function NewBookingPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{BOOKING_FORM_COPY.pageTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {BOOKING_FORM_COPY.pageHint}
        </p>
      </div>
      <BookingForm />
    </div>
  );
}
