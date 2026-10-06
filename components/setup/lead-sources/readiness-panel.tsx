"use client";
/**
 * "Turn it on" (doc 19): the readiness plan drawn as rows with one button that runs it in order
 * (`lib/setup/readiness.ts`). Used twice: as the compact block on an open source card and as screen 6 of Add a lead
 * source. Each row reports done / blocked / failed with the server's reason. When a channel has two feeds the panel asks
 * which one is the default and turns it on last.
 */
import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pill } from "@/components/ui/crm/primitives";
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import type { LeadSourceDetail } from "@/lib/api/leadSources";
import {
  defaultReadinessDeps,
  planReadiness,
  runReadinessPlan,
  type ReadinessChannel,
  type ReadinessNumber,
  type ReadinessPlan,
  type StepResult,
} from "@/lib/setup/readiness";
import { ADD_COPY, CHANNEL_WORDS, LS_COPY } from "./lead-sources-copy";
import { moveTypeWord } from "./lead-sources-model";
import type { LeadSourcesUrl } from "./lead-sources-url";

type HrefFor = (patch: Partial<LeadSourcesUrl>) => string;

export function ReadinessRows({
  plan,
  results,
  hrefFor,
  sourceId,
}: {
  plan: ReadinessPlan;
  results: readonly StepResult[] | null;
  hrefFor: HrefFor;
  sourceId: string;
}) {
  return (
    <ol className="ls-steps-list">
      {plan.steps.map((step) => {
        const result = results?.find((item) => item.step.key === step.key);
        const status = result ? result.status : step.satisfied ? "done" : "ready";
        const variant = status === "done" ? "green" : status === "blocked" ? "amber" : status === "failed" ? "red" : "blue";
        const word =
          status === "done"
            ? LS_COPY.readinessDone
            : status === "blocked"
              ? LS_COPY.readinessBlocked
              : status === "failed"
                ? LS_COPY.readinessFailed
                : LS_COPY.readinessReady;
        const link =
          step.kind === "lead_cost" && status !== "done"
            ? { href: hrefFor({ edit: "cost", source: sourceId, feed: step.feed_id }), label: LS_COPY.setLeadCost }
            : step.kind === "customer_text" && status !== "done"
              ? { href: hrefFor({ view: "granot", edit: "granot", granot: step.granot_id, source: sourceId }), label: LS_COPY.edit }
              : null;
        return (
          <li key={step.key} className="ls-steps-list__row" data-step={step.kind} data-status={status}>
            <span className="ls-steps-list__label">{step.label}</span>
            <Pill variant={variant}>{word}</Pill>
            {link ? (
              <Link href={link.href} scroll={false} className="crm-link">
                {link.label}
              </Link>
            ) : null}
            {result?.reason ? <span className="su-quiet ls-steps-list__reason">{result.reason}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Which feed is the default for a channel that has two: the Owner chooses, the chosen one is turned on last. */
export function DefaultFeedQuestion({
  channels,
  detail,
  value,
  onChange,
}: {
  channels: readonly ReadinessChannel[];
  detail: Pick<LeadSourceDetail, "feeds">;
  value: Partial<Record<ReadinessChannel, string>>;
  onChange: (channel: ReadinessChannel, feedId: string) => void;
}) {
  return (
    <>
      {channels.map((channel) => (
        <fieldset key={channel} className="su-fields" data-default-question={channel}>
          <legend className="su-row__label">{ADD_COPY.defaultQuestion(channel)}</legend>
          {detail.feeds.items
            .filter((feed) => feed.channel === channel)
            .map((feed) => (
              <label key={feed.id} className="su-choice">
                <input type="radio" name={`ls-default-${channel}`} checked={value[channel] === feed.id} onChange={() => onChange(channel, feed.id)} />
                <span className="su-choice__text">
                  {feed.display_name}
                  <span className="su-choice__hint">
                    {CHANNEL_WORDS[feed.channel]}
                    {moveTypeWord(feed.move_type) ? ` · ${moveTypeWord(feed.move_type)}` : ""}
                  </span>
                </span>
              </label>
            ))}
          <p className="su-quiet">{ADD_COPY.defaultHint}</p>
        </fieldset>
      ))}
    </>
  );
}

/** The run state shared by both uses: results as they settle, a running flag, and a `run` that refreshes the reads after. */
export function useReadinessRun(onSettled?: () => Promise<unknown> | void) {
  const queryClient = useQueryClient();
  const [results, setResults] = useState<StepResult[] | null>(null);
  const [running, setRunning] = useState(false);
  async function run(plan: ReadinessPlan) {
    setRunning(true);
    setResults([]);
    try {
      await runReadinessPlan(plan, defaultReadinessDeps, (_result, all) => setResults([...all]));
    } finally {
      await invalidateRegistryQueries(queryClient);
      await onSettled?.();
      setRunning(false);
    }
  }
  return { results, running, run };
}

/** The compact block on an open source card: the server's plan rows, the default question, one button. */
export function ReadinessBlock({
  detail,
  numbers = [],
  readOnly,
  hrefFor,
  onSettled,
}: {
  detail: LeadSourceDetail;
  numbers?: readonly ReadinessNumber[];
  readOnly: boolean;
  hrefFor: HrefFor;
  onSettled?: () => Promise<unknown> | void;
}) {
  const [defaults, setDefaults] = useState<Partial<Record<ReadinessChannel, string>>>({});
  const { results, running, run } = useReadinessRun(onSettled);
  const plan = planReadiness(detail, { defaultFeedIdByChannel: defaults, numbers });
  const pending = plan.steps.some((step) => !step.satisfied);
  // The cost and the customer text are the Owner's to do by hand; the button runs what the commands can.
  const runnable = plan.steps.some((step) => !step.satisfied && step.kind !== "customer_text" && step.kind !== "lead_cost");
  const canRun = !readOnly && runnable && plan.channelsNeedingDefault.length === 0 && !running;

  return (
    <section className="ls-readiness" aria-label={LS_COPY.readinessTitle} data-testid="readiness-block">
      <div className="ls-readiness__head">
        <h4 className="ls-readiness__title">{LS_COPY.readinessTitle}</h4>
        {pending ? null : <span className="su-quiet">{LS_COPY.readinessNone}</span>}
      </div>
      {detail.readiness_plan.length > 0 ? (
        <ul className="ls-readiness__server">
          {detail.readiness_plan.map((row) => (
            <li key={`${row.action}-${row.gate}`}>
              <span>{row.gate}</span>{" "}
              <Pill variant={row.status === "done" ? "green" : row.status === "blocked" ? "amber" : row.status === "suggested" ? "gray" : "blue"}>
                {row.status === "done"
                  ? LS_COPY.readinessDone
                  : row.status === "blocked"
                    ? LS_COPY.readinessBlocked
                    : row.status === "suggested"
                      ? LS_COPY.readinessSuggestedPill
                      : LS_COPY.readinessReady}
              </Pill>
              {row.status === "blocked" && row.blocked_until ? <span className="su-quiet"> {LS_COPY.waitingOn(row.blocked_until)}</span> : null}
              {row.status === "suggested" ? <span className="su-quiet"> {LS_COPY.readinessSuggested}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {pending ? (
        <>
          <DefaultFeedQuestion
            channels={plan.channelsNeedingDefault}
            detail={detail}
            value={defaults}
            onChange={(channel, feedId) => setDefaults((current) => ({ ...current, [channel]: feedId }))}
          />
          <ReadinessRows plan={plan} results={results} hrefFor={hrefFor} sourceId={detail.id} />
          {readOnly ? null : (
            <div className="su-actions" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="crm-button crm-button--primary crm-button--sm" disabled={!canRun} onClick={() => void run(plan)}>
                {running ? LS_COPY.readinessRunning : LS_COPY.readinessButton}
              </button>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
