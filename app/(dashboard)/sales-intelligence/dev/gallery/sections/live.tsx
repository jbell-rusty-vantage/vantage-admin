"use client";

import { LiveIndicator, LiveIndicatorDetails, type CaptureHealth, type LiveStatus } from "@/components/sales-intelligence/primitives";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { GALLERY_AS_OF, healthAttention, healthBroken } from "../fixtures";
import { GallerySection, Sample, Subhead } from "./section";

const noop = () => {};
const COVERAGE_HREF = "#coverage";

const attention: CaptureHealth = { status: healthAttention.status, knownCompleteThrough: healthAttention.knownCompleteThrough };
const broken: CaptureHealth = { status: healthBroken.status, knownCompleteThrough: healthBroken.knownCompleteThrough };

const STATES: { id: string; status: LiveStatus; copyKey: string }[] = [
  { id: "live", status: "live", copyKey: "copy.ui1.prim.live.live · live.updated(t)" },
  { id: "connecting", status: "connecting", copyKey: "copy.ui1.prim.live.connecting" },
  { id: "reconnecting", status: "reconnecting", copyKey: "copy.ui1.prim.live.reconnecting" },
  { id: "offline", status: "offline", copyKey: "copy.ui1.prim.live.offline · live.refresh" },
];

export function LiveSection() {
  const g = copy.ui1.gallery.live;
  const w = copy.ui1.prim.live.healthWord;
  return (
    <GallerySection id="live" title={copy.ui1.gallery.sections.live}>
      <div className="si-gallery__grid">
        {STATES.map((state) => (
          <Sample key={state.id} label={g.state(state.status)} copyKey={state.copyKey}>
            <span data-live={state.id}>
              <LiveIndicator status={state.status} updatedAt={GALLERY_AS_OF} asOf={GALLERY_AS_OF} coverageHref={COVERAGE_HREF} onRefresh={noop} />
            </span>
          </Sample>
        ))}
      </div>
      {[
        { id: "attention", health: attention, asOf: healthAttention.asOf, source: "S5c/coverage__seed.json" },
        { id: "broken", health: broken, asOf: healthBroken.asOf, source: "S5c/coverage__capture-health-broken__synthetic.json" },
      ].map(({ id, health, asOf, source }) => (
        <div key={id} className="si-gallery__body" data-live={`health-${id}`}>
          <Subhead>{g.health(w[health.status])}</Subhead>
          <Sample copyKey={`copy.ui1.prim.live.healthWord.${id} · healthSentence.${id} · ${source}`}>
            <LiveIndicator status="live" updatedAt={asOf} asOf={asOf} health={health} coverageHref={COVERAGE_HREF} onRefresh={noop} />
            <span className="si-heading si-heading--4">{g.tooltipInline}</span>
            <span className="si-gallery__tip">
              <strong>{copy.ui1.prim.live.title}</strong>
              <LiveIndicatorDetails health={health} asOf={asOf} coverageHref={COVERAGE_HREF} />
            </span>
          </Sample>
        </div>
      ))}
    </GallerySection>
  );
}
