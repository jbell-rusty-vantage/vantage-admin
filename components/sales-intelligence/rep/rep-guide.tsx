"use client";
/**
 * UI2-SHELL (UI-2 §2): the rep's Guide. What the views are, what the bands mean, what a rep can do on a follow-up, that
 * the Owner sees the rep's changes, and where the Owner's messages show. It links nowhere a rep can't open.
 */
import { useEffect } from "react";
import { BANDS, copy } from "../sales-intelligence-copy";

const g = copy.ui2.guide;
export const REP_GUIDE_TOPICS = ["views", "bands", "card", "followups", "owner", "messages"] as const;
export type RepGuideTopic = (typeof REP_GUIDE_TOPICS)[number];

const topicLabel = (topic: RepGuideTopic): string => (topic === "card" ? copy.ui1.guide.topics.card : g.topics[topic]);
const parseTopic = (topic: string | null): RepGuideTopic => ((REP_GUIDE_TOPICS as readonly string[]).includes(topic ?? "") ? (topic as RepGuideTopic) : "views");

function Term({ name, body }: { name: string; body: string }) {
  return (
    <li>
      <strong>{name}.</strong> {body}
    </li>
  );
}

export function RepGuide({ topic = null }: { topic?: string | null }) {
  const current = parseTopic(topic);
  useEffect(() => {
    if (topic) document.getElementById(`rep-guide-${current}`)?.scrollIntoView({ block: "start" });
  }, [current, topic]);
  return (
    <article className="si-guide si-local-stack" data-guide="rep">
      <p>{g.intro}</p>
      <nav className="si-chiprow" aria-label={copy.ui1.guide.navLabel}>
        {REP_GUIDE_TOPICS.map((key) => (
          <a key={key} href={`#rep-guide-${key}`} className={key === current ? "si-filterchip si-hit" : "si-hit"} aria-current={key === current ? "location" : undefined}>
            {topicLabel(key)}
          </a>
        ))}
      </nav>
      <section id="rep-guide-views">
        <h2>{g.topics.views}</h2>
        <ul className="si-guide__list">{g.views.map((view) => <Term key={view.name} name={view.name} body={view.body} />)}</ul>
      </section>
      <section id="rep-guide-bands">
        <h2>{g.topics.bands}</h2>
        <p>{g.bandsIntro}</p>
        <ul className="si-guide__list">
          {([1, 2, 3, 4, 5, 6, 7] as const).map((band) => (
            <li key={band}><strong>{band} · {BANDS[band]}.</strong> {copy.bandSoWhat[band]}</li>
          ))}
        </ul>
      </section>
      <section id="rep-guide-card">
        <h2>{copy.ui1.guide.topics.card}</h2>
        <p>{copy.ui1.guide.cardIntro}</p>
        <ol className="si-guide__list si-guide__list--ordered">{copy.ui1.guide.cardLines.map((line) => <li key={line}>{line}</li>)}</ol>
      </section>
      <section id="rep-guide-followups"><h2>{g.topics.followups}</h2><p>{g.followupsBody}</p></section>
      <section id="rep-guide-owner"><h2>{g.topics.owner}</h2><p>{g.ownerBody}</p></section>
      <section id="rep-guide-messages"><h2>{g.topics.messages}</h2><p>{g.messagesBody}</p></section>
    </article>
  );
}
