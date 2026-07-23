import { BookingsSubnav } from "@/components/bookings/bookings-subnav";

export default function BookingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <BookingsSubnav />
      {children}
    </div>
  );
}
