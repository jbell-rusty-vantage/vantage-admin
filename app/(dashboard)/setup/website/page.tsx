import { SetupOwnerOnly } from "@/components/setup/setup-shell";
import { WebsiteSection } from "@/components/setup/website/website-section";

export default function SetupWebsiteSectionPage() {
  return (
    <SetupOwnerOnly section="website">
      <WebsiteSection />
    </SetupOwnerOnly>
  );
}
