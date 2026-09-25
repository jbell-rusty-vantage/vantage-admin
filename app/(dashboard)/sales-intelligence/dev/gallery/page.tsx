import "@/components/sales-intelligence/styles/sales-intelligence.css";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAccessTokenCookie, getAdminFromAccessToken } from "@/server/auth";
import { Gallery } from "./gallery";
import { galleryEnabled } from "./gate";

/** Dev-only design-gate gallery (UI-0 §7.4): Owner only, and outside development only with SI_GALLERY=1. */
export default async function SalesIntelligenceGalleryPage() {
  if (!galleryEnabled()) notFound();
  const token = getAccessTokenCookie(await cookies());
  const admin = token ? await getAdminFromAccessToken(token) : null;
  if (!admin) redirect("/login");
  if (admin.role !== "owner") redirect("/");
  return (
    <div className="si-root">
      <Gallery />
    </div>
  );
}
