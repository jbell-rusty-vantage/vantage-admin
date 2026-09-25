import { DeskRouteSkeleton } from "@/components/sales-intelligence/desk";
import { skeletonRole } from "./route-viewer";

export default async function Loading() {
  return <DeskRouteSkeleton role={await skeletonRole()} />;
}
