"use client";
/**
 * The CSV import sheet (`?import=1`, doc 19 "Carriers"): file, mode (Patch by default), a preview read in the browser,
 * then Import and the server's own result, which replaces the preview and stays on screen. Replace asks for a
 * confirmation that names how many carriers it would deactivate.
 */
import { useState } from "react";
import { RecordDrawer } from "@/components/records";
import { Pill } from "@/components/ui/crm/primitives";
import type { CarrierImportResult, MovingCarrier } from "@/lib/api/carriers";
import { previewCarrierImport, type CarrierImportMode, type CarrierPreview } from "@/lib/setup/carriers-preview";
import { CARRIERS_COPY } from "./carriers-copy";
import { useCarrierMutations } from "./use-carrier-mutations";

const PROBLEMS_SHOWN = 10;
const NAMES_SHOWN = 12;

type PickedFile = { name: string; text: string };

export function CarrierImportSheet({ carriers, onClose }: { carriers: readonly MovingCarrier[] | undefined; onClose: () => void }) {
  const copy = CARRIERS_COPY.import;
  const { importCsv } = useCarrierMutations();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [mode, setMode] = useState<CarrierImportMode>("patch");
  const [confirmingFor, setConfirmingFor] = useState<string | null>(null);
  const [result, setResult] = useState<CarrierImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Without the loaded list every row would read as new, so nothing is previewed (and nothing can be imported) until it is here.
  const preview = file && carriers ? previewCarrierImport(file.text, carriers, mode) : null;
  const confirmKey = file ? `${mode}:${file.name}:${file.text.length}` : null;
  const confirming = confirmKey !== null && confirmingFor === confirmKey;
  const deactivating = preview?.wouldDeactivate.length ?? 0;
  const importable = preview ? preview.new.length + preview.updated.length + preview.unchanged.length : 0;

  const run = () => {
    if (!file) return;
    setError(null);
    importCsv.mutate(
      { csv_text: file.text, mode },
      {
        onSuccess: (data) => {
          setResult(data);
          setConfirmingFor(null);
        },
        onError: (failure) => setError(failure instanceof Error ? failure.message : copy.failed),
      },
    );
  };
  const onImportClick = () => {
    if (mode === "replace" && deactivating > 0 && !confirming) {
      setConfirmingFor(confirmKey);
      return;
    }
    run();
  };
  const reset = () => {
    setResult(null);
    setFile(null);
    setError(null);
    setConfirmingFor(null);
  };

  return (
    <RecordDrawer title={copy.title} onClose={onClose} wide testId="carrier-import-sheet">
      <div className="su-sheet">
        <p className="su-quiet">{copy.intro}</p>

        {result ? (
          <ResultBlock result={result} onAnother={reset} onClose={onClose} />
        ) : (
          <>
            <section className="su-block">
              <h3 className="su-block__head">
                <span className="su-step">1</span>
                {copy.stepFile}
              </h3>
              <label className="su-row">
                <span className="su-row__label">{copy.fileLabel}</span>
                <input
                  className="su-input ca-file"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={importCsv.isPending}
                  onChange={(event) => {
                    const picked = event.target.files?.[0];
                    setConfirmingFor(null);
                    setError(null);
                    if (!picked) {
                      setFile(null);
                      return;
                    }
                    void picked.text().then((text) => setFile({ name: picked.name, text }));
                  }}
                />
                <span className="su-row__hint">{file && preview ? copy.fileRead(file.name, preview.totalRows) : copy.noFile}</span>
              </label>
            </section>

            <section className="su-block">
              <h3 className="su-block__head">
                <span className="su-step">2</span>
                {copy.stepMode}
              </h3>
              <fieldset className="su-fields" aria-label={copy.modeLabel} disabled={importCsv.isPending}>
                <label className="su-choice">
                  <input type="radio" name="carrier-import-mode" checked={mode === "patch"} onChange={() => setMode("patch")} />
                  <span className="su-choice__text">
                    <strong>{copy.patchTitle}</strong>
                    <span className="su-choice__hint">{copy.patchHint}</span>
                  </span>
                </label>
                <label className="su-choice">
                  <input type="radio" name="carrier-import-mode" checked={mode === "replace"} onChange={() => setMode("replace")} />
                  <span className="su-choice__text">
                    <strong>{copy.replaceTitle}</strong>
                    <span className="su-choice__hint">{copy.replaceHint}</span>
                  </span>
                </label>
              </fieldset>
            </section>

            <section className="su-block" aria-live="polite">
              <h3 className="su-block__head">
                <span className="su-step">3</span>
                {copy.stepCheck}
              </h3>
              {preview ? <PreviewBlock preview={preview} mode={mode} /> : <p className="su-quiet">{file ? copy.waitingForList : copy.noFile}</p>}
              <p className="su-quiet">{copy.honest}</p>
              {error ? (
                <div className="su-errors" role="alert">
                  {error}
                </div>
              ) : null}
              {confirming ? (
                <div className="su-errors ca-confirm" role="alertdialog" aria-label={copy.confirmTitle(deactivating)}>
                  <strong>{copy.confirmTitle(deactivating)}</strong>
                  <p>{copy.confirmBody}</p>
                  <div className="su-actions">
                    <button type="button" className="crm-button crm-button--quiet" onClick={() => setConfirmingFor(null)} disabled={importCsv.isPending}>
                      {copy.confirmBack}
                    </button>
                    <button type="button" className="crm-button crm-button--danger" onClick={run} disabled={importCsv.isPending}>
                      {importCsv.isPending ? copy.running : copy.confirmAction(deactivating)}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="su-actions">
                  <button type="button" className="crm-button crm-button--primary" onClick={onImportClick} disabled={!preview || preview.empty || importable === 0 || importCsv.isPending}>
                    {importCsv.isPending ? copy.running : mode === "replace" ? copy.runReplace : copy.runPatch}
                  </button>
                </div>
              )}
              {preview && !preview.empty && importable === 0 ? <p className="su-quiet">{copy.nothingToImport}</p> : null}
            </section>
          </>
        )}
      </div>
    </RecordDrawer>
  );
}

export function PreviewBlock({ preview, mode }: { preview: CarrierPreview; mode: CarrierImportMode }) {
  const copy = CARRIERS_COPY.import;
  if (preview.empty) return <p className="su-errors">{copy.emptyFile}</p>;
  const problemCount = preview.problems.length;
  return (
    <div className="ca-preview">
      <div className="ca-counts" role="list">
        <span role="listitem">
          <Pill variant="green">{copy.counts.new(preview.new.length)}</Pill>
        </span>
        <span role="listitem">
          <Pill variant="blue">{copy.counts.updated(preview.updated.length)}</Pill>
        </span>
        <span role="listitem">
          <Pill variant="gray">{copy.counts.unchanged(preview.unchanged.length)}</Pill>
        </span>
        {mode === "replace" ? (
          <span role="listitem">
            <Pill variant={preview.wouldDeactivate.length > 0 ? "amber" : "gray"}>{copy.counts.wouldDeactivate(preview.wouldDeactivate.length)}</Pill>
          </span>
        ) : null}
        <span role="listitem">
          <Pill variant={problemCount > 0 ? "red" : "gray"}>{copy.counts.problems(problemCount)}</Pill>
        </span>
      </div>
      {preview.missingColumns.length > 0 ? <p className="su-errors">{copy.missingColumns(preview.missingColumns)}</p> : null}
      {preview.updated.length > 0 ? (
        <ul className="ca-list" aria-label={copy.counts.updated(preview.updated.length)}>
          {preview.updated.slice(0, NAMES_SHOWN).map((entry) => (
            <li key={entry.row.line}>
              {entry.row.name} <span className="su-quiet">· {entry.reasons.map((reason) => copy.updateReasons[reason]).join(", ")}</span>
            </li>
          ))}
          {preview.updated.length > NAMES_SHOWN ? <li className="su-quiet">{copy.moreProblems(preview.updated.length - NAMES_SHOWN)}</li> : null}
        </ul>
      ) : null}
      {mode === "replace" && preview.wouldDeactivate.length > 0 ? (
        <div>
          <h4 className="ca-subhead">{copy.deactivateTitle}</h4>
          <ul className="ca-list">
            {preview.wouldDeactivate.slice(0, NAMES_SHOWN).map((carrier) => (
              <li key={carrier.id}>{carrier.name}</li>
            ))}
            {preview.wouldDeactivate.length > NAMES_SHOWN ? <li className="su-quiet">{copy.moreProblems(preview.wouldDeactivate.length - NAMES_SHOWN)}</li> : null}
          </ul>
        </div>
      ) : null}
      {problemCount > 0 ? (
        <div>
          <h4 className="ca-subhead">{copy.problemsTitle}</h4>
          <ul className="ca-list">
            {preview.problems.slice(0, PROBLEMS_SHOWN).map((problem) => (
              <li key={`${problem.line}-${problem.reason}`}>{copy.problemLine(problem.line, problem.reason)}</li>
            ))}
            {problemCount > PROBLEMS_SHOWN ? <li className="su-quiet">{copy.moreProblems(problemCount - PROBLEMS_SHOWN)}</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ResultBlock({ result, onAnother, onClose }: { result: CarrierImportResult; onAnother: () => void; onClose: () => void }) {
  const copy = CARRIERS_COPY.import;
  return (
    <section className="su-block" aria-live="polite" data-testid="carrier-import-result">
      <h3 className="su-block__head">{copy.stepResult}</h3>
      <p className="su-quiet">{copy.resultMode(result.mode)}</p>
      <div className="ca-counts" role="list">
        <span role="listitem">
          <Pill variant="green">{copy.result.created(result.created)}</Pill>
        </span>
        <span role="listitem">
          <Pill variant="blue">{copy.result.updated(result.updated)}</Pill>
        </span>
        <span role="listitem">
          <Pill variant={result.deactivated > 0 ? "amber" : "gray"}>{copy.result.deactivated(result.deactivated)}</Pill>
        </span>
        <span role="listitem">
          <Pill variant={result.skipped > 0 ? "red" : "gray"}>{copy.result.skipped(result.skipped)}</Pill>
        </span>
      </div>
      {result.errors.length > 0 ? (
        <div>
          <h4 className="ca-subhead">{copy.result.rowErrors}</h4>
          <ul className="ca-list">
            {result.errors.map((error) => (
              <li key={`${error.row}-${error.message}`}>{copy.result.rowError(error.row, error.message)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="su-actions">
        <button type="button" className="crm-button crm-button--quiet" onClick={onAnother}>
          {copy.result.importAnother}
        </button>
        <button type="button" className="crm-button crm-button--primary" onClick={onClose}>
          {copy.result.done}
        </button>
      </div>
    </section>
  );
}
