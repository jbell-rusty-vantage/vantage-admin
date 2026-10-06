import { BookingForm } from "@/components/forms/booking-form";
import { BOOKING_FORM_COPY } from "@/components/forms/booking-form-copy";
import { PageHeader } from "@/components/ui/crm/primitives";

export default function NewBookingPage() {
  return (
    <div className="crm-page" style={{ padding: 0, maxWidth: 896 }}>
      <PageHeader title={BOOKING_FORM_COPY.pageTitle} subtitle={BOOKING_FORM_COPY.pageHint} />
      <BookingForm />
    </div>
  );
}
