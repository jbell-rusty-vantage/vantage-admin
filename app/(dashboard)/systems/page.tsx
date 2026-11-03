import "@/components/systems/systems.css";
import "@/components/systems/mongo-health.css";
import { SystemsPage } from "@/components/systems/systems-page";

/** URL-addressable views; unknown tabs default to live MongoDB health. */
export default async function SystemsRoute({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  return <SystemsPage tab={tab === 'locations' ? 'locations' : 'mongo'} />;
}
