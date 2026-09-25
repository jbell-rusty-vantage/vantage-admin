"use client";
/**
 * UI1-COVER: the Guide, rewritten for the UI-1 views (UI-1 §6, COPY-UI1 §12). It's the one place for explanations
 * (final spec §14): the views, the bands, the preset bar and Lead toggle, the card's seven lines, the live chip vs
 * Owner calling, where Numbers lives until UI-3, messaging the rep, capture health, then the reference topics the
 * record's commands still link to.
 */
import { useEffect } from "react";
import { copy, BANDS } from "./sales-intelligence-copy";
import { GUIDE_TOPICS, guideHref, parseGuideTopic } from "./sales-intelligence-tabs";

const g = copy.ui1.guide;

function Term({ name, body }: { name: string; body: string }) {
  return (
    <li>
      <strong>{name}.</strong> {body}
    </li>
  );
}

export function GuideView({ topic }: { topic: string | null }) {
  const current = parseGuideTopic(topic);
  useEffect(() => {
    document.getElementById(current)?.scrollIntoView({ block: "start" });
  }, [current]);
  return (
    <article className="si-guide si-local-stack">
      <nav className="si-chiprow" aria-label={g.navLabel}>
        {GUIDE_TOPICS.map((item) => (
          <a
            key={item.key}
            href={guideHref(item.key)}
            className={item.key === current ? "si-filterchip" : undefined}
            aria-current={item.key === current ? "location" : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <section id="views">
        <h2>{g.topics.views}</h2>
        <p>{g.viewsIntro}</p>
        <ul className="si-guide__list">{g.views.map((view) => <Term key={view.name} name={view.name} body={view.body} />)}</ul>
      </section>
      <section id="bands">
        <h2>{g.topics.bands}</h2>
        <p>{g.bandsIntro}</p>
        <ul className="si-guide__list">
          {([1, 2, 3, 4, 5, 6, 7] as const).map((band) => (
            <li key={band}><strong>{band} · {BANDS[band]}.</strong> {copy.bandSoWhat[band]}</li>
          ))}
        </ul>
        <p>{copy.bandSoWhat.once}</p>
      </section>
      <section id="presets">
        <h2>{g.topics.presets}</h2>
        <p>{g.presetsBody}</p>
        <ul className="si-guide__list">{g.presets.map((preset) => <Term key={preset.name} name={preset.name} body={preset.body} />)}</ul>
        <p>{g.leadToggle}</p>
      </section>
      <section id="card">
        <h2>{g.topics.card}</h2>
        <p>{g.cardIntro}</p>
        <ol className="si-guide__list si-guide__list--ordered">{g.cardLines.map((line) => <li key={line}>{line}</li>)}</ol>
      </section>
      <section id="live">
        <h2>{g.topics.live}</h2>
        <ul className="si-guide__list">{g.live.map((item) => <Term key={item.name} name={item.name} body={item.body} />)}</ul>
      </section>
      <section id="numbers"><h2>{g.topics.numbers}</h2><p>{g.numbersBody}</p></section>
      <section id="messaging"><h2>{g.topics.messaging}</h2><p>{g.messagingBody}</p></section>
      <section id="coverage">
        <h2>{g.topics.coverage}</h2>
        <p>{g.coverageIntro}</p>
        <ul className="si-guide__list">{g.coverageStates.map((state) => <Term key={state.name} name={state.name} body={state.body} />)}</ul>
        <p>{copy.ui1.coverage.pendingExplain}</p>
        <p>{copy.ui1.coverage.webhook.subscriptionMissing}</p>
        <p>{copy.live.historyThroughTip}</p>
        <p>{copy.coverage.intro}</p>
        <p>{copy.clocks.goingCold}</p>
      </section>
      <section id="statuses">
        <h2>{g.topics.statuses}</h2>
        <ul className="si-guide__list">
          {(Object.keys(copy.statusSoWhat) as Array<keyof typeof copy.statusSoWhat>).map((state) => (
            <Term key={state} name={copy.ui1.prim.states[state]} body={copy.statusSoWhat[state]} />
          ))}
        </ul>
      </section>
      <section id="review">
        <h2>{g.topics.review}</h2>
        <ul className="si-guide__list">
          {(Object.keys(copy.reviewCauseShort) as Array<keyof typeof copy.reviewCauseShort>).map((cause) => (
            <Term key={cause} name={copy.reviewCauseShort[cause]} body={copy.reviewCause[cause]} />
          ))}
        </ul>
      </section>
      <section id="call">
        <h2>{g.topics.call}</h2>
        <p>{copy.guide.callBody}</p>
        <ul className="si-guide__list">
          <Term name={copy.call.notStarted} body={copy.call.notStartedSoWhat} />
          <Term name={copy.call.inProgress} body={copy.call.startExplain} />
          <Term name={copy.call.ended} body={copy.call.endExplain} />
          <Term name={copy.call.observedClose} body={copy.call.observedCloseSoWhat} />
        </ul>
      </section>
      <section id="provenance">
        <h2>{g.topics.provenance}</h2>
        <p>{copy.guide.provenanceBody}</p>
        <ul className="si-guide__list">
          {(Object.keys(copy.provenance.state) as Array<keyof typeof copy.provenance.state>).map((state) => (
            <Term key={state} name={copy.provenance.state[state]} body={copy.provenance.soWhat[state]} />
          ))}
        </ul>
        <p>{copy.provenance.attachSoWhat}</p>
      </section>
      <section id="attachments">
        <h2>{g.topics.attachments}</h2>
        <p>{copy.commandExplain.confirm_attachment}</p>
        <p>{copy.commandExplain.reject_attachment}</p>
        <p>{copy.commandExplain.detach}</p>
      </section>
      <section id="analysis"><h2>{g.topics.analysis}</h2><p>{copy.guide.analysisBody}</p></section>
      <section id="summary"><h2>{g.topics.summary}</h2><p>{copy.guide.summaryBody}</p></section>
    </article>
  );
}
