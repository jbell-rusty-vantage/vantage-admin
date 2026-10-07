"use client";
/**
 * Systems › Where things live (doc 11b, A2). One row per location: the main button (Install for the extension, Open,
 * or nothing for the copy-only MCP), Copy with a confirmation, partner paths as chips that each open, and Code / Vercel
 * / Logs links only where they exist (the extension's code link carries "personal account"). The Owner's inline
 * Edit form PATCHes only what changed and shows the server's own validation sentence.
 */
import { useState } from "react";
import { Check, Copy, Download, ExternalLink, Pencil } from "lucide-react";
import { formatRelative } from "@/components/ui/crm/format";
import type { EditableLocationFields, SystemsLocation, SystemsLocations, SystemsLocationsPatch } from "@/lib/api/systems";
import { displayLink, pathLink } from "./systems-model";
import { SYSTEMS_COPY } from "./systems-copy";

const copy = SYSTEMS_COPY.locations;

type DraftRow = Record<Exclude<keyof EditableLocationFields, "paths">, string> & { paths: string };
type Draft = Record<string, DraftRow>;

const TEXT_FIELDS = ["label", "url", "note", "code_url", "code_note", "host_url", "logs_url"] as const;

function draftFrom(data: SystemsLocations): Draft {
  const draft: Draft = {};
  for (const location of data.locations) {
    if (!location.editable) continue;
    draft[location.key] = {
      label: location.label,
      url: location.url,
      note: location.note ?? "",
      paths: location.paths.join("\n"),
      code_url: location.code_url ?? "",
      code_note: location.code_note ?? "",
      host_url: location.host_url ?? "",
      logs_url: location.logs_url ?? "",
    };
  }
  return draft;
}

/** Only the fields that changed, trimmed; an emptied optional field is sent as "" (the server clears it). */
export function locationsPatchFrom(data: SystemsLocations, draft: Draft): SystemsLocationsPatch["locations"] {
  const patch: SystemsLocationsPatch["locations"] = {};
  for (const location of data.locations) {
    const row = draft[location.key];
    if (!location.editable || !row) continue;
    const changes: Partial<EditableLocationFields> = {};
    for (const field of TEXT_FIELDS) {
      const next = row[field].trim();
      const before = (location[field] ?? "").trim();
      if (next !== before) (changes as Record<string, string>)[field] = next;
    }
    const paths = row.paths
      .split(/\r?\n|,/)
      .map((path) => path.trim())
      .filter(Boolean);
    if (paths.join("\n") !== location.paths.join("\n")) changes.paths = paths;
    if (Object.keys(changes).length > 0) patch[location.key] = changes;
  }
  return patch;
}

function OutLink({ href, children, label }: { href: string; children: React.ReactNode; label?: string }) {
  return (
    <a className="sy-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
      {children}
      <ExternalLink aria-hidden="true" width={13} height={13} />
    </a>
  );
}

function LocationRow({ location, copied, onCopy }: { location: SystemsLocation; copied: "ok" | "failed" | null; onCopy: () => void }) {
  const hasLink = Boolean(location.url);
  return (
    <li className="sy-location" data-testid={`systems-location-${location.key}`}>
      <div className="sy-location__name">
        <strong>{location.label}</strong>
      </div>
      <div className="sy-location__where">
        {hasLink ? (
          <span className="sy-location__url" title={location.url}>
            {displayLink(location.url)}
          </span>
        ) : (
          <span className="sy-muted">{copy.noLink}</span>
        )}
        {location.paths.length > 0 ? (
          <span className="sy-paths">
            {location.paths.map((path) => (
              <a key={path} className="crm-chip crm-chip--small sy-path" href={pathLink(location.url, path)} target="_blank" rel="noopener noreferrer" aria-label={copy.openPath(path)}>
                {path}
              </a>
            ))}
          </span>
        ) : null}
        {location.note ? <span className="sy-location__note">{location.note}</span> : null}
      </div>
      <div className="sy-location__actions">
        {hasLink && location.action === "install" ? (
          <a className="crm-button crm-button--primary sy-action" href={location.url} target="_blank" rel="noopener noreferrer" aria-label={copy.installLabel(location.label)}>
            <Download aria-hidden="true" width={15} height={15} />
            {copy.install}
          </a>
        ) : hasLink && location.action === "open" ? (
          <a className="crm-button sy-action" href={location.url} target="_blank" rel="noopener noreferrer" aria-label={copy.openLabel(location.label)}>
            {copy.open}
            <ExternalLink aria-hidden="true" width={14} height={14} />
          </a>
        ) : null}
        {hasLink && location.key !== "master_leads" && location.key !== "master_booked" ? (
          <button type="button" className="crm-button crm-button--quiet sy-action" onClick={onCopy} aria-label={copy.copyLabel(location.label)}>
            {copied === "ok" ? <Check aria-hidden="true" width={15} height={15} /> : <Copy aria-hidden="true" width={15} height={15} />}
            {copied === "ok" ? copy.copied : copy.copy}
          </button>
        ) : null}
        <span className="sr-only" role="status" aria-live="polite">
          {copied === "ok" ? copy.copied : copied === "failed" ? copy.copyFailed : ""}
        </span>
      </div>
      <div className="sy-location__links">
        {location.code_url ? (
          <span className="sy-codelink">
            <OutLink href={location.code_url}>{copy.code}</OutLink>
            {location.code_note ? <span className="sy-tag">{location.code_note}</span> : null}
          </span>
        ) : null}
        {location.host_url && location.host_url !== location.url ? (
          <OutLink href={location.host_url}>{/vercel\.com/.test(location.host_url) ? copy.host : copy.store}</OutLink>
        ) : null}
        {location.logs_url ? <OutLink href={location.logs_url}>{copy.logs}</OutLink> : null}
      </div>
      {copied === "failed" ? <p className="sy-location__error crm-text-red">{copy.copyFailed}</p> : null}
    </li>
  );
}

function EditForm({
  data,
  saving,
  error,
  onSave,
  onCancel,
}: {
  data: SystemsLocations;
  saving: boolean;
  error: string | null;
  onSave: (locations: SystemsLocationsPatch["locations"]) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(data));
  const [nothing, setNothing] = useState(false);
  const set = (key: string, field: keyof DraftRow, value: string) => {
    setNothing(false);
    setDraft((current) => ({ ...current, [key]: { ...current[key]!, [field]: value } }));
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const patch = locationsPatchFrom(data, draft);
    if (Object.keys(patch).length === 0) {
      setNothing(true);
      return;
    }
    onSave(patch);
  };
  const f = copy.fields;
  return (
    <form className="crm-card sy-edit" onSubmit={submit} data-testid="systems-locations-edit" aria-labelledby="systems-edit-title">
      <h3 id="systems-edit-title" className="sy-card__title">
        {copy.editTitle}
      </h3>
      <p className="sy-muted">{copy.editHint}</p>
      {data.locations
        .filter((location) => location.editable)
        .map((location) => {
          const row = draft[location.key]!;
          const field = (name: keyof DraftRow, label: string, kind: "url" | "text" = "text") => (
            <label className="sy-field">
              <span>{label}</span>
              <input
                className="crm-input"
                type={kind === "url" ? "url" : "text"}
                inputMode={kind === "url" ? "url" : undefined}
                value={row[name]}
                onChange={(event) => set(location.key, name, event.target.value)}
                name={`${location.key}.${name}`}
              />
            </label>
          );
          return (
            <fieldset key={location.key} className="sy-edit__row">
              <legend>{location.label}</legend>
              {field("label", f.label)}
              {field("url", f.url, "url")}
              {field("note", f.note)}
              {location.key === "partner_pages" ? (
                <label className="sy-field sy-field--wide">
                  <span>{f.paths}</span>
                  <textarea className="crm-input" rows={4} value={row.paths} onChange={(event) => set(location.key, "paths", event.target.value)} name={`${location.key}.paths`} />
                </label>
              ) : null}
              {field("code_url", f.code_url, "url")}
              {field("code_note", f.code_note)}
              {field("host_url", f.host_url, "url")}
              {field("logs_url", f.logs_url, "url")}
            </fieldset>
          );
        })}
      <p className="sy-muted">{copy.sheetsNote}</p>
      {error ? (
        <p className="sy-edit__error crm-text-red" role="alert" data-testid="systems-edit-error">
          {error}
        </p>
      ) : null}
      {nothing ? <p className="sy-muted" role="status">{copy.nothingChanged}</p> : null}
      <div className="sy-edit__actions">
        <button type="submit" className="crm-button crm-button--primary sy-action" disabled={saving}>
          {saving ? copy.saving : copy.save}
        </button>
        <button type="button" className="crm-button crm-button--quiet sy-action" onClick={onCancel} disabled={saving}>
          {copy.cancel}
        </button>
      </div>
    </form>
  );
}

export function LocationsList({
  data,
  saving,
  saveError,
  justSaved,
  onSave,
  onEditToggle,
  editing,
}: {
  data: SystemsLocations;
  saving: boolean;
  saveError: string | null;
  justSaved: boolean;
  editing: boolean;
  onSave: (patch: SystemsLocationsPatch) => void;
  onEditToggle: (editing: boolean) => void;
}) {
  const [copied, setCopied] = useState<{ key: string; state: "ok" | "failed" } | null>(null);
  const copyLink = (location: SystemsLocation) => {
    const done = (state: "ok" | "failed") => {
      setCopied({ key: location.key, state });
      setTimeout(() => setCopied((current) => (current?.key === location.key ? null : current)), 2_500);
    };
    if (typeof navigator === "undefined" || !navigator.clipboard) return done("failed");
    navigator.clipboard.writeText(location.url).then(
      () => done("ok"),
      () => done("failed"),
    );
  };
  return (
    <section className="sy-section" aria-labelledby="systems-locations-title" data-testid="systems-locations">
      <div className="sy-section__head">
        <h2 id="systems-locations-title" className="sy-section__title">
          {copy.title}
        </h2>
        {!editing ? (
          <button type="button" className="crm-button crm-button--quiet sy-action" onClick={() => onEditToggle(true)} data-testid="systems-edit-locations">
            <Pencil aria-hidden="true" width={14} height={14} />
            {copy.edit}
          </button>
        ) : null}
      </div>
      {justSaved ? (
        <p className="sy-saved crm-text-green" role="status">
          <Check aria-hidden="true" width={14} height={14} /> {copy.saved}
        </p>
      ) : null}
      <ul className="crm-card sy-locations">
        {data.locations.map((location) => (
          <LocationRow
            key={location.key}
            location={location}
            copied={copied?.key === location.key ? copied.state : null}
            onCopy={() => copyLink(location)}
          />
        ))}
      </ul>
      {data.updated_by && data.updated_at ? <p className="sy-muted">{copy.lastEdited(data.updated_by, formatRelative(data.updated_at))}</p> : null}
      {editing ? (
        <EditForm
          data={data}
          saving={saving}
          error={saveError}
          onSave={(locations) => onSave({ revision: data.revision, locations })}
          onCancel={() => onEditToggle(false)}
        />
      ) : null}
    </section>
  );
}
