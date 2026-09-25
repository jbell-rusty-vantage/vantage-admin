"use client";

import { BandBadge, StatePill, type BandNumber } from "@/components/sales-intelligence/primitives";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { bandCounts } from "../fixtures";
import { GallerySection, Sample, Subhead } from "./section";

const BAND_NUMBERS: BandNumber[] = [1, 2, 3, 4, 5, 6, 7];

function BadgeSet() {
  const g = copy.ui1.gallery.badges;
  return (
    <>
      <Subhead>{g.tag}</Subhead>
      <div className="si-gallery__grid">
        {BAND_NUMBERS.map((n) => (
          <Sample key={n} copyKey={`copy.ui1.prim.bandTag(${n}, BANDS[${n}])`}>
            <BandBadge band={n} />
          </Sample>
        ))}
        <Sample copyKey="copy.ui1.prim.needsReview">
          <BandBadge band={null} variant="needs_review" />
        </Sample>
        <Sample copyKey="copy.ui1.prim.notInAttention">
          <BandBadge band={null} />
        </Sample>
      </div>
      <Subhead>{g.header}</Subhead>
      <div className="si-gallery__body">
        {BAND_NUMBERS.map((n) => (
          <Sample key={n} copyKey={`BANDS[${n}] · copy.ui1.prim.bandCount(${bandCounts[n]})`}>
            <BandBadge band={n} variant="header" count={bandCounts[n]} />
          </Sample>
        ))}
      </div>
    </>
  );
}

export function BadgesSection() {
  return (
    <GallerySection id="badges" title={copy.ui1.gallery.sections.badges}>
      <BadgeSet />
      <Subhead>{copy.ui1.gallery.badges.phone}</Subhead>
      <div className="si-gallery__frame" data-frame="390">
        <div className="si-gallery__body">
          <BadgeSet />
        </div>
      </div>
    </GallerySection>
  );
}

const STATES = ["unworked", "open", "waiting_on_customer", "identity_review", "closed"] as const;

export function PillsSection() {
  return (
    <GallerySection id="pills" title={copy.ui1.gallery.sections.pills}>
      <div className="si-gallery__grid">
        {STATES.map((state) => (
          <Sample key={state} copyKey={`copy.ui1.prim.states.${state}`}>
            <StatePill state={state} />
          </Sample>
        ))}
        <Sample label={copy.ui1.gallery.pills.unknown} copyKey="state: needs_callback_review">
          <StatePill state="needs_callback_review" />
        </Sample>
      </div>
    </GallerySection>
  );
}
