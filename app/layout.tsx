import type { Metadata } from "next";
import { Archivo, Public_Sans } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
