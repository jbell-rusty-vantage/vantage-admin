import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Vantage Home Movers",
  description: "Privacy policy for Vantage Home Movers, including SMS communications.",
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-cool-white text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
    </div>
  );
}
