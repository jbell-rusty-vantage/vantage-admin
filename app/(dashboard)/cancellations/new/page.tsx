import { CancellationForm } from "@/components/forms/cancellation-form";

export default function NewCancellationPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Create Cancellation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cancel from a selected booking, a booked source lead, or by entering identifiers directly.
        </p>
      </div>
      <CancellationForm />
    </div>
  );
}
