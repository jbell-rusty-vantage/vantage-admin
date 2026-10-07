/**
 * One capacity card (doc 11b, A3) for the database and both Master Sheets: the status pill (colour + word + icon)
 * and its reason sentence, a pill bar per measure, the "time until" lines with the estimate label, the Sheet Sync
 * line and the card's footnotes. Pure over a `CapacityCardView` so a static-markup test can render it.
 */
import type { CSSProperties } from "react";
import { EvidenceChip, Pill } from "@/components/ui/crm/primitives";
import type { CapacityCardView } from "./systems-model";
import { SYSTEMS_COPY } from "./systems-copy";

const copy = SYSTEMS_COPY.capacity;

function Meter({ meter }: { meter: CapacityCardView["meters"][number] }) {
  const pct = Math.max(0, Math.min(100, meter.pct));
  return (
    <div className="sy-meter">
      <span className="sy-meter__label">{meter.label}</span>
      <span className="sy-meter__value">{meter.value}</span>
      <span
        className={`sy-bar sy-bar--${meter.tone}`}
        role="progressbar"
        aria-label={`${meter.label}: ${meter.value}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <span className="sy-bar__fill" style={{ "--sy-fill": `${Math.max(pct, 0.6)}%` } as CSSProperties} />
      </span>
      <span className="sy-meter__pct">{pct < 10 ? pct.toFixed(1) : Math.round(pct)}%</span>
      {meter.growth ? <span className="sy-meter__growth">{meter.growth}</span> : <span />}
    </div>
  );
}

export function CapacityCard({ view }: { view: CapacityCardView }) {
  const StatusIcon = view.status.icon;
  return (
    <section className="crm-card sy-card" data-testid={view.testId} data-colour={view.status.colour} aria-labelledby={`${view.testId}-title`}>
      <header className="sy-card__head">
        <h3 className="sy-card__title" id={`${view.testId}-title`}>
          {view.title}
        </h3>
        <Pill variant={view.status.pill} icon={StatusIcon} className="sy-card__status">
          {view.status.label}
        </Pill>
      </header>
      <p className={`sy-reason sy-reason--${view.status.colour}`} data-testid={`${view.testId}-reason`} title={view.error ?? undefined}>
        {view.reason}
      </p>
      {view.meters.length > 0 ? (
        <div className="sy-meters">
          {view.meters.map((meter) => (
            <Meter key={meter.label} meter={meter} />
          ))}
        </div>
      ) : null}
      {view.detail ? <p className="sy-detail">{view.detail}</p> : null}
      {view.runways.length > 0 ? (
        <dl className="sy-runways">
          {view.runways.map((line) => (
            <div key={line.label} className="sy-runway">
              <dt>{line.label}:</dt>
              <dd>
                <strong className="sy-runway__value">{line.value}</strong>
                {line.note ? <span className="sy-runway__note">{line.note}</span> : null}
                {line.estimate ? (
                  <span className="sy-estimate" data-testid="systems-estimate">
                    {line.estimate}
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {view.sync ? (
        <div className="sy-sync" data-testid={`${view.testId}-sync`}>
          <span className="sy-sync__label">{copy.sync.label}</span>
          {view.sync.map((part) =>
            part.state === "none" ? (
              <span key={part.text} className="sy-sync__part">
                {part.text}
              </span>
            ) : (
              <EvidenceChip key={part.text} state={part.state}>
                {part.text}
              </EvidenceChip>
            ),
          )}
        </div>
      ) : view.syncUnavailable ? (
        <p className="sy-muted">{copy.sync.unavailable}</p>
      ) : null}
      {view.foot.map((line) => (
        <p key={line} className="sy-foot">
          {line}
        </p>
      ))}
      {view.muted ? <p className="sy-muted">{view.muted}</p> : null}
    </section>
  );
}
