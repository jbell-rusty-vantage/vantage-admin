import { SetupOwnerOnly } from "@/components/setup/setup-shell";
import { ConnectionsSection } from "@/components/setup/connections/connections-section";

export default function SetupConnectionsSectionPage() {
  return (
    <SetupOwnerOnly section="connections">
      <ConnectionsSection />
    </SetupOwnerOnly>
  );
}
