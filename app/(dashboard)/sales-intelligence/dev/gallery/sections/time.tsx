"use client";

import { TimeText, timePhrase } from "@/components/sales-intelligence/primitives";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { formatExactFull } from "@/components/sales-intelligence/lib/time";
import { GALLERY_AS_OF, timeSamples } from "../fixtures";
import { GallerySection } from "./section";

type Mode = "relative" | "exact" | "countdown";

export type TimeSample = { id: string; mode: Mode; t: string; prefix?: string; overdue?: boolean; source: string };

export const TIME_SAMPLES: TimeSample[] = [
  { id: "relative", mode: "relative", t: timeSamples.lastCallAt, source: "facts.last_call_at" },
  { id: "exact", mode: "exact", t: timeSamples.lastCallAt, source: "facts.last_call_at" },
  { id: "countdown-in", mode: "countdown", t: timeSamples.followupDueAt, prefix: copy.ui1.gallery.time.duePrefix, overdue: false, source: "followups[4dad].due_at" },
  {
    id: "countdown-overdue",
    mode: "countdown",
    t: timeSamples.overdueDueAt,
    prefix: copy.ui1.gallery.time.duePrefix,
    overdue: timeSamples.nextActionState === "overdue",
    source: "followups[4dc2].due_at · facts.next_action_state",
  },
];

/** The `title` and `aria-label` TimeText puts on its `<time>` (printed beside the sample; the test checks they match). */
export function expectedAttrs(sample: TimeSample): { title: string; label: string } {
  const exact = formatExactFull(sample.t);
  const lead = sample.prefix ? `${sample.prefix} ` : "";
  const phrase = timePhrase(sample.t, GALLERY_AS_OF, sample.mode).text;
  return { title: exact, label: sample.mode === "countdown" ? `${lead}${exact}, ${phrase}` : `${lead}${exact}` };
}

export function TimeSection() {
  const g = copy.ui1.gallery.time;
  return (
    <GallerySection id="time" title={copy.ui1.gallery.sections.time}>
      <p className="si-gallery__note">
        <code className="si-gallery__key">{g.asOf(GALLERY_AS_OF)}</code> · S1/attention__all-outreach.json
      </p>
      <p className="si-gallery__note">{g.overdueNote}</p>
      <div className="si-gallery__tablewrap">
        <table className="si-gallery__table" data-table="time">
          <thead>
            <tr>
              <th>{g.mode}</th>
              <th>{g.rendered}</th>
              <th>{g.attrs}</th>
              <th>{copy.ui1.gallery.source}</th>
            </tr>
          </thead>
          <tbody>
            {TIME_SAMPLES.map((sample) => {
              const attrs = expectedAttrs(sample);
              return (
                <tr key={sample.id} data-time={sample.id}>
                  <td>
                    <code className="si-gallery__key">{sample.mode}</code>
                  </td>
                  <td>
                    <TimeText t={sample.t} asOf={GALLERY_AS_OF} mode={sample.mode} prefix={sample.prefix} overdue={sample.overdue} />
                  </td>
                  <td>
                    <span className="si-gallery__sample">
                      <code className="si-gallery__key" data-attr="title">{attrs.title}</code>
                      <code className="si-gallery__key" data-attr="aria-label">{attrs.label}</code>
                    </span>
                  </td>
                  <td>
                    <code className="si-gallery__key">{sample.source}</code>
                  </td>
                </tr>
              );
            })}
            <tr data-time="null">
              <td>
                <code className="si-gallery__key">{g.nullMode}</code>
              </td>
              <td>
                <TimeText t={null} asOf={GALLERY_AS_OF} mode="relative" nullText={g.nullSample} />
              </td>
              <td>—</td>
              <td>
                <code className="si-gallery__key">t: null</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GallerySection>
  );
}
