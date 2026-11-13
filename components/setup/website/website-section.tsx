"use client";
/** Setup → Website (doc 19): the testimonials the main site can show. The Owner-only gate is the page's. */
import { SetupSectionHead } from "@/components/setup/setup-shell";
import { CmsWorkspace } from "./cms-workspace";

export function WebsiteSection() {
  return (
    <>
      <SetupSectionHead section="website">Manage the optimized preview website.</SetupSectionHead>
      <CmsWorkspace />
    </>
  );
}
