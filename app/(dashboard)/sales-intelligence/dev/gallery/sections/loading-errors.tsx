"use client";

import { CardShell, DelayedSkeleton, RegionError, RegionProgress, SkeletonBlock, SkeletonLines } from "@/components/sales-intelligence/primitives";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { GallerySection, Sample } from "./section";

const noop = () => {};

export function LoadingSection() {
  const g = copy.ui1.gallery.loading;
  return (
    <GallerySection id="loading" title={copy.ui1.gallery.sections.loading}>
      <div className="si-gallery__grid">
        <Sample label={g.card} copyKey="CardShell.Skeleton" wide>
          <CardShell.Skeleton />
        </Sample>
        <Sample label={g.block} copyKey="SkeletonBlock" wide>
          <SkeletonBlock height={96} />
        </Sample>
        <Sample label={g.lines} copyKey="SkeletonLines" wide>
          <SkeletonLines lines={3} widths={["80%", "64%", "40%"]} />
        </Sample>
        <Sample label={g.delayed} copyKey="DelayedSkeleton" wide>
          <p className="si-gallery__note">{g.delayedNote}</p>
          <DelayedSkeleton>
            <SkeletonLines lines={2} />
          </DelayedSkeleton>
        </Sample>
      </div>
      <div className="si-gallery__grid">
        <Sample label={g.error} copyKey="copy.ui1.prim.loadFailed · errorCode · tryAgain" wide>
          <RegionError error={{ code: g.errorSample }} onRetry={noop} />
        </Sample>
        <Sample label={g.progress} copyKey="copy.ui1.prim.refreshing" wide>
          <div className="si-gallery__progressbox">
            <RegionProgress active />
            <p className="si-gallery__note">{g.progressNote}</p>
          </div>
        </Sample>
      </div>
    </GallerySection>
  );
}
