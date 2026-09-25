import "@/components/sales-intelligence/styles/sales-intelligence.css";
import { CardShellSkeleton, SkeletonLines } from "@/components/sales-intelligence/primitives";

export default function Loading() {
  return (
    <div className="si-root">
      <div className="si-gallery" aria-busy="true">
        <SkeletonLines lines={2} widths={["40%", "64%"]} />
        <CardShellSkeleton />
        <CardShellSkeleton />
      </div>
    </div>
  );
}
