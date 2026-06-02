"use client";

export default function TermsAndConditionsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Unable to load this page</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Something went wrong while loading the terms and conditions. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Try again
      </button>
    </main>
  );
}
