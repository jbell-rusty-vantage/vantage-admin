import "@/components/sales-intelligence/styles/sales-intelligence.css";
import { CardShell, SkeletonLines } from "@/components/sales-intelligence/primitives";

export default function Loading() {
  return (
    <div className="si-root">
      <div className="si-gallery" aria-busy="true">
        <SkeletonLines lines={2} widths={["40%", "64%"]} />
        <CardShell.Skeleton />
        <CardShell.Skeleton />
      </div>
    </div>
  );
}
