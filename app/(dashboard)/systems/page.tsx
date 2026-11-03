import "@/components/systems/systems.css";
import "@/components/systems/mongo-health.css";
import { SystemsPage } from "@/components/systems/systems-page";

/** URL-addressable views; missing and unknown tabs default to System locations. */
export default async function SystemsRoute({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  return <SystemsPage tab={tab === 'mongo' ? 'mongo' : 'locations'} />;
}
