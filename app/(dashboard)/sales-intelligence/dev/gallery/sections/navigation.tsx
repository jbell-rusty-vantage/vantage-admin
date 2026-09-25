"use client";

import { Disclosure, RouteTabs, SubNav } from "@/components/sales-intelligence/primitives";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { GallerySection, Sample } from "./section";

const GALLERY_HREF = "/sales-intelligence/dev/gallery";

export function NavigationSection() {
  const g = copy.ui1.gallery.navigation;
  const sub = g.subNavItems;
  const tabs = g.tabItems;
  return (
    <GallerySection id="navigation" title={copy.ui1.gallery.sections.navigation}>
      <Sample label={g.disclosure} copyKey="Disclosure remember=session id=gallery-advanced" wide>
        <Disclosure id="gallery-advanced" title={g.disclosureTitle} remember="session">
          <p className="si-gallery__note">{g.disclosureBody}</p>
        </Disclosure>
      </Sample>
      <Sample label={g.subNav} copyKey="copy.ui1.prim.subNavLabel" wide>
        <SubNav
          label={g.subNav}
          activeId="gallery-nav-scores"
          items={[
            { id: "gallery-nav-situation", label: sub.situation },
            { id: "gallery-nav-scores", label: sub.scores },
            { id: "gallery-nav-findings", label: sub.findings },
            { id: "gallery-nav-conversations", label: sub.conversations },
          ]}
        />
      </Sample>
      <Sample label={g.routeTabs} copyKey="copy.ui1.prim.routeTabsLabel" wide>
        <RouteTabs
          active="analysis"
          items={[
            { key: "analysis", label: tabs.analysis, href: `${GALLERY_HREF}#navigation` },
            { key: "timeline", label: tabs.timeline, href: `${GALLERY_HREF}#navigation`, count: 42 },
            { key: "work", label: tabs.work, href: `${GALLERY_HREF}#navigation` },
          ]}
        />
      </Sample>
    </GallerySection>
  );
}
