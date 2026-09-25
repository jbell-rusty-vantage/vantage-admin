import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted (Google Fonts latin variable subsets) so the build never fetches
// fonts.googleapis.com: the fetched CSS broke Turbopack's next/font/google on CI.
const archivo = localFont({
  src: "./fonts/archivo-latin-wght.woff2",
  variable: "--font-archivo",
  weight: "700 800",
  display: "swap",
});

const publicSans = localFont({
  src: "./fonts/public-sans-latin-wght.woff2",
  variable: "--font-public-sans",
  weight: "400 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vantage Admin",
  description: "Owner dashboard for Vantage Movers operations.",
  icons: {
    icon: "/vantage/vantagelogo.png",
    apple: "/vantage/vantagelogo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${publicSans.variable} h-full overflow-x-hidden antialiased`}
    >
      <body className="flex h-full min-h-0 flex-col overflow-x-hidden">{children}</body>
    </html>
  );
}
