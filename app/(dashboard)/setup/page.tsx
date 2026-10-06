import { SetupHub } from "@/components/setup/setup-hub";

/**
 * Setup (doc 01): everything the Owner configures once and touches rarely. The Operations Registry, Extension, Granot
 * Lifecycle, Ingestion and Testimonials pages keep their routes; this hub groups them the way doc 05 names them.
 */
export default function SetupPage() {
  return <SetupHub />;
}
