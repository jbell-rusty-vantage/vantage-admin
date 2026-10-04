import { redirect } from "next/navigation";
import { canonicalSiHref } from "@/components/sales-intelligence/desk";

/**
 * The old quarantined workspace's address (`/sales-intelligence/legacy?view=numbers&number={id}`): its Number links
 * open the same Number on the interim page; every other old selection opens Numbers. The page itself checks the role.
 */
export default async function SalesIntelligenceLegacyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(canonicalSiHref(await searchParams));
}
