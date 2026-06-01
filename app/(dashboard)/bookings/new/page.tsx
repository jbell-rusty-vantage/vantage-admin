import { BookingForm } from "@/components/forms/booking-form";

export default function NewBookingPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Create Booking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Book from a selected form/call lead or use the global form by entering the identifiers directly.
        </p>
      </div>
      <BookingForm />
    </div>
  );
}
