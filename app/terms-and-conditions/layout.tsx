import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions | Vantage Home Movers",
  description: "Terms and conditions for Vantage Home Movers, including SMS communications.",
  robots: { index: true, follow: true },
};

export default function TermsAndConditionsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
    </div>
  );
}
