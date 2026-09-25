"use client";

import { Smartphone } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { SubNav } from "@/components/sales-intelligence/primitives";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { AnalysisFindingsSection } from "./sections/analysis-findings";
import { AnalysisSection } from "./sections/analysis";
import { BadgesSection, PillsSection } from "./sections/badges";
import { CardSection } from "./sections/card";
import { ChatSection } from "./sections/chat";
import { ChipsSection } from "./sections/chips";
import { CoverageSection } from "./sections/coverage";
import { ClosedSection } from "./sections/closed";
import { IconsSection } from "./sections/icons";
import { LiveSection } from "./sections/live";
import { LoadingSection } from "./sections/loading-errors";
import { MetricsSection } from "./sections/metrics";
import { NavigationSection } from "./sections/navigation";
import { OverviewSection } from "./sections/overview";
import { PresetBarSection } from "./sections/preset-bar";
import { RailSection } from "./sections/rail";
import { RecordHeaderSection } from "./sections/record-header";
import { FrameContext } from "./sections/section";
import { TimeSection } from "./sections/time";
import { TimelineSection } from "./sections/timeline";
import { TokensSection } from "./sections/tokens";
import { AcceptInviteSection } from "./sections/accept-invite";
import { RepCardSection } from "./sections/rep-card";
import { RepFollowupSection } from "./sections/rep-followup";
import { RepMessagesSection } from "./sections/rep-messages";
import { RepOverviewSection } from "./sections/rep-overview";
import { RepPhoneSection } from "./sections/rep-phone";
import { RepShellSection } from "./sections/rep-shell";
import { UsersSection } from "./sections/users";

type SectionId = keyof typeof copy.ui1.gallery.sections | keyof typeof copy.ui2.gallery.sections;
const SECTION_TITLES: Record<SectionId, string> = { ...copy.ui1.gallery.sections, ...copy.ui2.gallery.sections };

/** Section order and anchors. UI-2's rep and Users sections come first (the UI-2 design gate reviews them first). */
export const GALLERY_SECTIONS: { id: SectionId; render: () => ReactNode }[] = [
  { id: "rep-shell", render: () => <RepShellSection /> },
  { id: "rep-card", render: () => <RepCardSection /> },
  { id: "rep-followup", render: () => <RepFollowupSection /> },
  { id: "rep-messages", render: () => <RepMessagesSection /> },
  { id: "rep-overview", render: () => <RepOverviewSection /> },
  { id: "rep-phone", render: () => <RepPhoneSection /> },
  { id: "users", render: () => <UsersSection /> },
  { id: "accept-invite", render: () => <AcceptInviteSection /> },
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
  { id: "record-header", render: () => <RecordHeaderSection /> },
  { id: "metrics", render: () => <MetricsSection /> },
  { id: "presets", render: () => <PresetBarSection /> },
  { id: "rail", render: () => <RailSection /> },
  { id: "timeline", render: () => <TimelineSection /> },
  { id: "analysis", render: () => <AnalysisSection /> },
  { id: "analysis-findings", render: () => <AnalysisFindingsSection /> },
  { id: "chat", render: () => <ChatSection /> },
  { id: "overview", render: () => <OverviewSection /> },
  { id: "closed", render: () => <ClosedSection /> },
  { id: "coverage", render: () => <CoverageSection /> },
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
      <SubNav items={GALLERY_SECTIONS.map(({ id }) => ({ id, label: SECTION_TITLES[id] }))} />
      <FrameContext.Provider value={framed}>
        {GALLERY_SECTIONS.map(({ id, render }) => (
          <Fragment key={id}>{render()}</Fragment>
        ))}
      </FrameContext.Provider>
    </div>
  );
}
