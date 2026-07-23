import { notFound } from "next/navigation";
import { EmployeeBookingForm } from "@/components/employee-booking/employee-booking-form";
import { getServerEnv } from "@/lib/env/server";

export const dynamic = "force-dynamic";

export default function EmployeeBookingPage() {
  if (!getServerEnv().EMPLOYEE_BOOKING_PUBLIC_ENABLED) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-cool-white px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <section className="space-y-3 text-center sm:text-left">
          <h1 className="text-3xl font-semibold text-navy">Record Employee Booking</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Use this form to record a completed sale. Choose the lead source, confirm the
            sale details, and submit once.
          </p>
        </section>
        <EmployeeBookingForm />
      </div>
    </main>
  );
}
