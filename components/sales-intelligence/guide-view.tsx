"use client";

import { useEffect } from "react";
import { copy, BANDS } from "./sales-intelligence-copy";
import { GUIDE_TOPICS, parseGuideTopic } from "./sales-intelligence-tabs";

export function GuideView({ topic }: { topic: string | null }) {
  const current = parseGuideTopic(topic);
  useEffect(() => {
    document.getElementById(current)?.scrollIntoView({ block: "start" });
  }, [current]);
  return (
    <article className="si-guide si-local-stack">
      <nav className="si-chiprow" aria-label={copy.guide.title}>
        {GUIDE_TOPICS.map((item) => (
          <a key={item.key} href={`/sales-intelligence?view=guide&topic=${item.key}`} className={item.key === current ? "si-filterchip" : undefined}>
            {item.label}
          </a>
        ))}
      </nav>
      <section id="workspace"><h2>{copy.guide.topics.workspace}</h2><p>{copy.guide.workspaceBody}</p></section>
      <section id="views"><h2>{copy.guide.topics.views}</h2><p>{copy.guide.viewsBody}</p></section>
      <section id="bands">
        <h2>{copy.guide.topics.bands}</h2>
        <ul>
          {([1, 2, 3, 4, 5, 6, 7] as const).map((band) => (
            <li key={band}><strong>{band} · {BANDS[band]}.</strong> {copy.bandSoWhat[band]}</li>
          ))}
        </ul>
        <p>{copy.bandSoWhat.once}</p>
      </section>
      <section id="statuses">
        <h2>{copy.guide.topics.statuses}</h2>
        <ul>
          {(Object.keys(copy.statusSoWhat) as Array<keyof typeof copy.statusSoWhat>).map((state) => (
            <li key={state}><strong>{copy.outreachState[state]}.</strong> {copy.statusSoWhat[state]}</li>
          ))}
        </ul>
      </section>
      <section id="review">
        <h2>{copy.guide.topics.review}</h2>
        <ul>
          {(Object.keys(copy.reviewCauseShort) as Array<keyof typeof copy.reviewCauseShort>).map((cause) => (
            <li key={cause}><strong>{copy.reviewCauseShort[cause]}.</strong> {copy.reviewCause[cause]}</li>
          ))}
        </ul>
      </section>
      <section id="numbers"><h2>{copy.guide.topics.numbers}</h2><p>{copy.page.viewIntro.numbers}</p></section>
      <section id="attachments">
        <h2>{copy.guide.topics.attachments}</h2>
        <p>{copy.commandExplain.confirm_attachment}</p>
        <p>{copy.commandExplain.reject_attachment}</p>
        <p>{copy.commandExplain.detach}</p>
      </section>
      <section id="coverage">
        <h2>{copy.guide.topics.coverage}</h2>
        <p>{copy.coverage.intro}</p>
        <p>{copy.clocks.goingCold}</p>
        <p>{copy.live.historyThroughTip}</p>
      </section>
      <section id="analysis"><h2>{copy.guide.topics.analysis}</h2><p>{copy.guide.analysisBody}</p></section>
      <section id="summary"><h2>{copy.guide.topics.summary}</h2><p>{copy.guide.summaryBody}</p></section>
      <section id="call">
        <h2>{copy.guide.topics.call}</h2>
        <p>{copy.guide.callBody}</p>
        <ul>
          <li><strong>{copy.call.notStarted}.</strong> {copy.call.notStartedSoWhat}</li>
          <li><strong>{copy.call.inProgress}.</strong> {copy.call.startExplain}</li>
          <li><strong>{copy.call.ended}.</strong> {copy.call.endExplain}</li>
          <li><strong>{copy.call.observedClose}.</strong> {copy.call.observedCloseSoWhat}</li>
        </ul>
      </section>
      <section id="provenance">
        <h2>{copy.guide.topics.provenance}</h2>
        <p>{copy.guide.provenanceBody}</p>
        <ul>
          {(Object.keys(copy.provenance.state) as Array<keyof typeof copy.provenance.state>).map((state) => (
            <li key={state}><strong>{copy.provenance.state[state]}.</strong> {copy.provenance.soWhat[state]}</li>
          ))}
        </ul>
        <p>{copy.provenance.attachSoWhat}</p>
      </section>
      <section id="messaging"><h2>{copy.guide.topics.messaging}</h2><p>{copy.guide.messagingBody}</p></section>
    </article>
  );
}
