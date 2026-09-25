"use client";
/**
 * UI1-TOP: Scores (final spec §11.2, D6/D8, RD3/RD11). Two cards side by side: title, `{n} / 100 · {Level}`,
 * `Confidence {word}`, rationale, `Conditions`, `View evidence ({n})`. Under both, one freshness sentence, the stale
 * sentence, the applicability sentence and the ordinal note. No current section prints the availability explanation.
 * Never a `%`. The version picker (UX10, cuttable) is cut: no fixture carries more than one version.
 */
import { useId } from "react";
import { scoreText, type AssessmentSection, type OutreachAssessment, type Score } from "@/lib/api/salesIntelligenceAssessment";
import { useAssessment } from "../../data/use-assessment";
import { useOutreach } from "../../data/use-outreach";
import { assessmentCopy } from "../../evidence-chain-copy";
import { copy } from "../../sales-intelligence-copy";
import { RegionProgress, SkeletonBlock, SkeletonLines, TimeText } from "../../primitives";
import { ViewEvidence, refIds } from "./cite";

const t = copy.ui1.analysis.scores;
const SEP = " · ";
type ScoreName = "transaction_intent" | "move_likelihood";

/** `50 / 100 · Active`; an unscored value prints the server's word (`Unknown`, `Pending`). Applicability never hides the number (§11.2). */
export function scoreValueText(score: Score, availability: string | null): string {
  if (typeof score.score === "number" && Number.isFinite(score.score)) {
    const value = `${Math.round(score.score)} / 100`;
    return score.level_label ? `${value}${SEP}${score.level_label}` : value;
  }
  return scoreText({ score: null, label: score.label }, availability === "ready" ? null : availability);
}

export const confidenceLine = (confidence: string | null) => (confidence ? t.confidence(confidence) : assessmentCopy.confidenceUnstated);

/** The availability explanation (kept `availabilityExplain`), or the plain availability word for a value it lacks. */
export function availabilitySentence(availability: string): string {
  const explain = assessmentCopy.availabilityExplain as Record<string, string>;
  return explain[availability] ?? (assessmentCopy.availability as Record<string, string>)[availability] ?? availability;
}

function ScoreCard({ name, score, section }: { name: ScoreName; score: Score; section: AssessmentSection }) {
  const headingId = useId();
  const title = assessmentCopy.score[name];
  return (
    <article className="si-scorecard" aria-labelledby={headingId} data-score={name}>
      <h3 id={headingId} className="si-heading si-heading--3">{title}</h3>
      <p className="si-scorecard__value">{scoreValueText(score, section.availability)}</p>
      <p className="si-scorecard__confidence si-text--sm">{confidenceLine(score.confidence)}</p>
      {score.rationale && <p className="si-scorecard__rationale">{score.rationale}</p>}
      {score.conditions.length > 0 && (
        <div className="si-scorecard__conditions">
          <h4 className="si-heading si-heading--4">{t.conditions}</h4>
          <ul>
            {score.conditions.map((condition, i) => <li key={i}>{condition}</li>)}
          </ul>
        </div>
      )}
      <ViewEvidence
        target={section.artifact_id ? { source: "assessment", artifactId: section.artifact_id, ids: refIds(score.evidence), label: title } : null}
        missingText={score.evidence_missing ? t.evidenceMissing : undefined}
      />
    </article>
  );
}

/** `Assessed {exact} · covers {n} conversations through {exact} · {k} newer calls not yet assessed`, or the Lead-only sentence. */
function Freshness({ section, asOf }: { section: AssessmentSection; asOf: string }) {
  const assessedAt = section.published_at ?? section.generated_at;
  const assessed = assessedAt ? <TimeText t={assessedAt} asOf={asOf} mode="exact" prefix={t.assessed} /> : null;
  if (section.input_mode === "lead_only") {
    return <p className="si-scores__freshness" data-freshness="lead_only">{assessed} {t.leadOnly}</p>;
  }
  const k = section.newer_calls_count ?? 0;
  return (
    <p className="si-scores__freshness" data-freshness="conversations">
      {assessed}
      {section.coverage && (
        <>
          {SEP}
          {t.covers(section.coverage.conversations_selected)}
          {section.latest_conversation_at && (
            <>
              {" "}
              <TimeText t={section.latest_conversation_at} asOf={asOf} mode="exact" prefix={t.through} />
            </>
          )}
        </>
      )}
      {k > 0 && <span data-newer={k}>{`${SEP}${t.newer(k)}`}</span>}
    </p>
  );
}

/** Presentational Scores (UX15): the parsed `GET /outreach/:id/assessment` body in, no role, no read. */
export function Scores({ assessment, asOf, priorityLabel = null }: { assessment: OutreachAssessment; asOf: string; priorityLabel?: string | null }) {
  const section = assessment.current;
  if (!section) {
    return (
      <div className="si-scores" data-availability={assessment.availability}>
        <p role="status" className="si-scores__state">{availabilitySentence(assessment.availability)}</p>
      </div>
    );
  }
  const applicability = section.transaction_intent.applicability ?? assessment.subject.applicability;
  const stale = section.stale_reason ?? section.transaction_intent.stale_reason;
  return (
    <div className="si-scores" data-availability={section.availability}>
      {section.availability !== "ready" && <p role="status" className="si-scores__state">{availabilitySentence(section.availability)}</p>}
      <div className="si-scores__cards">
        <ScoreCard name="transaction_intent" score={section.transaction_intent} section={section} />
        <ScoreCard name="move_likelihood" score={section.move_likelihood} section={section} />
      </div>
      <Freshness section={section} asOf={asOf} />
      {stale && <p className="si-scores__stale" data-stale={stale}>{t.stale[stale] ?? t.staleOther}</p>}
      {applicability === "closed" && <p className="si-scores__applicability" data-applicability="closed">{t.closed}</p>}
      {applicability === "not_applicable" && (
        <p className="si-scores__applicability" data-applicability="not_applicable">
          {priorityLabel ? t.notApplicable(priorityLabel) : assessmentCopy.availabilityExplain.not_applicable}
        </p>
      )}
      <p className="si-scores__note si-text--sm si-text--subtle">{assessmentCopy.scoreNote}</p>
    </div>
  );
}

export function ScoresSkeleton() {
  return (
    <div className="si-scores" aria-hidden>
      <div className="si-scores__cards">
        {[0, 1].map((i) => (
          <div key={i} className="si-scorecard">
            <SkeletonLines lines={5} widths={["45%", "35%", "30%", "95%", "80%"]} />
          </div>
        ))}
      </div>
      <SkeletonBlock height={14} width="75%" />
    </div>
  );
}
Scores.Skeleton = ScoresSkeleton;

/** Reads `GET /outreach/:id/assessment` (and the cached detail for the Granot Priority label). */
export function ScoresSection({ outreachId }: { outreachId: string }) {
  const { assessment, asOf, isFetching } = useAssessment(outreachId);
  const { outreach, asOf: detailAsOf } = useOutreach(outreachId);
  return (
    <>
      <RegionProgress active={isFetching} />
      <Scores assessment={assessment} asOf={asOf ?? detailAsOf} priorityLabel={outreach.official?.priority?.label ?? null} />
    </>
  );
}
