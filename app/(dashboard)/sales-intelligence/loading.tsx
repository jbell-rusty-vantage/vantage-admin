import { SiRouteSkeleton } from "@/components/sales-intelligence/desk";
import { skeletonRole } from "./route-viewer";

export default async function Loading() {
  return <SiRouteSkeleton role={await skeletonRole()} />;
}
