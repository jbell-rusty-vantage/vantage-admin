import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import "@/components/intakes/to-finish.css";
import { BookingsSubnav } from "@/components/bookings/bookings-subnav";
import { getAccessTokenCookie, getAdminFromAccessToken } from "@/server/auth";

/** Bookings → To finish (doc 06): the bookings to finish, Owner only, shown under the Bookings tabs. */
export default async function IntakesLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const accessToken = getAccessTokenCookie(cookieStore);
  const admin = accessToken ? await getAdminFromAccessToken(accessToken) : null;
  if (!admin) redirect("/login");
  if (admin.role !== "owner") redirect("/");

  return (
    <div className="space-y-5">
      <BookingsSubnav />
      {children}
    </div>
  );
}
