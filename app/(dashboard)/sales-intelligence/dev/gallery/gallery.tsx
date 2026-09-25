"use client";

import { Smartphone } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { SubNav } from "@/components/sales-intelligence/primitives";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { BadgesSection, PillsSection } from "./sections/badges";
import { CardSection } from "./sections/card";
import { ChipsSection } from "./sections/chips";
import { IconsSection } from "./sections/icons";
import { LiveSection } from "./sections/live";
import { LoadingSection } from "./sections/loading-errors";
import { NavigationSection } from "./sections/navigation";
import { FrameContext, Placeholder } from "./sections/section";
import { TimeSection } from "./sections/time";
import { TokensSection } from "./sections/tokens";

type SectionId = keyof typeof copy.ui1.gallery.sections;

/** Section order and anchors. Later UI-1 stages replace their placeholder with a real section. */
export const GALLERY_SECTIONS: { id: SectionId; render: () => ReactNode }[] = [
  { id: "tokens", render: () => <TokensSection /> },
  { id: "badges", render: () => <BadgesSection /> },
  { id: "pills", render: () => <PillsSection /> },
  { id: "chips", render: () => <ChipsSection /> },
  { id: "icons", render: () => <IconsSection /> },
  { id: "time", render: () => <TimeSection /> },
  { id: "loading", render: () => <LoadingSection /> },
  { id: "live", render: () => <LiveSection /> },
  { id: "navigation", render: () => <NavigationSection /> },
  { id: "card", render: () => <CardSection /> },
  { id: "metrics", render: () => <Placeholder id="metrics" stage="UI1-DESK" /> },
  { id: "presets", render: () => <Placeholder id="presets" stage="UI1-PRESET" /> },
  { id: "rail", render: () => <Placeholder id="rail" stage="UI1-RAIL" /> },
  { id: "timeline", render: () => <Placeholder id="timeline" stage="UI1-TL" /> },
  { id: "analysis", render: () => <Placeholder id="analysis" stage="UI1-TOP / UI1-MOVE / UI1-FIND" /> },
  { id: "chat", render: () => <Placeholder id="chat" stage="UI1-CHAT" /> },
  { id: "overview", render: () => <Placeholder id="overview" stage="UI1-OVERVIEW" /> },
  { id: "closed", render: () => <Placeholder id="closed" stage="UI1-CLOSED" /> },
  { id: "coverage", render: () => <Placeholder id="coverage" stage="UI1-COVER" /> },
];

/** UI1-GALLERY (UI-0 §7.4): every UI-1 primitive in every state, from fixtures, for the design gate. Dev only. */
export function Gallery({ initialFramed = false }: { initialFramed?: boolean }) {
  const g = copy.ui1.gallery;
  const [framed, setFramed] = useState(initialFramed);
  return (
    <div className="si-gallery">
      <header className="si-gallery__head">
        <div className="si-gallery__headtext">
          <h1 className="si-heading si-heading--1">{g.title}</h1>
          <p className="si-gallery__note">{g.intro}</p>
        </div>
        <button type="button" className="si-gallery__toggle" aria-pressed={framed} title={g.frameHint} onClick={() => setFramed((on) => !on)}>
          <Smartphone size={16} aria-hidden />
          {g.frameToggle}
        </button>
      </header>
      <SubNav items={GALLERY_SECTIONS.map(({ id }) => ({ id, label: g.sections[id] }))} />
      <FrameContext.Provider value={framed}>
        {GALLERY_SECTIONS.map(({ id, render }) => (
          <Fragment key={id}>{render()}</Fragment>
        ))}
      </FrameContext.Provider>
    </div>
  );
}
