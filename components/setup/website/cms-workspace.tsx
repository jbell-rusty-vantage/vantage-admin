"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CmsError, cmsRequest, type CmsSnapshot, type TestimonialPolicy } from "@/lib/api/sitePreviewCms";
import { contentPlacement } from "@/lib/setup/website-content";
import { CmsField } from "./cms-fields";
import { CmsTestimonials } from "./cms-testimonials";
import { CmsHistory } from "./cms-history";
import { TestimonialsList } from "./testimonials-list";

const tabs = ["Content", "Images", "Testimonials", "History", "Live review archive"] as const;
type Tab = typeof tabs[number];
const snapshotKey = ["site-preview-cms", "snapshot"];

export function CmsWorkspace() {
  const query = useQuery({ queryKey: snapshotKey, queryFn: () => cmsRequest<CmsSnapshot>(), staleTime: Infinity, retry: false });
  return <section className="cms-workspace" aria-label="Preview website content">
    <div className="cms-preview-banner"><div><span className="cms-pill">Preview only</span><h3>Your website, in your words</h3><p>Manage the text, images and review selection on the optimized preview.</p></div><a className="cms-button" href="https://vantage-main-site-optimization.vercel.app/" target="_blank" rel="noreferrer">Open preview ↗</a></div>
    {query.isPending && <div className="cms-panel" role="status">Loading website content…</div>}
    {query.error && <div className="cms-panel" role="alert"><h3>Preview content is unavailable</h3><p>{query.error.message}</p><button className="cms-button" onClick={() => void query.refetch()}>Try again</button></div>}
    {query.error && <CmsGroup title="Live review archive · Read only" count={0} initiallyOpen={false}><TestimonialsList /></CmsGroup>}
    {query.data && <CmsEditor snapshot={query.data} />}
    <div className="cms-coming"><strong>Component variations</strong><span className="cms-pill">Coming soon</span><p>Choose alternate layouts and styles for each section.</p></div>
  </section>;
}

function CmsEditor({ snapshot }: { snapshot: CmsSnapshot }) {
  const cache = useQueryClient();
  const [tab, setTab] = useState<Tab>("Content");
  const [search, setSearch] = useState("");
  const [locale, setLocale] = useState("all");
  const [section, setSection] = useState("all");
  const [pending, setPending] = useState<Record<string, string | null>>({});
  const [policy, setPolicy] = useState<TestimonialPolicy>(snapshot.testimonialPolicy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const policyChanged = policy.minimumRating !== snapshot.testimonialPolicy.minimumRating || [...policy.excludedIds].sort().join() !== [...snapshot.testimonialPolicy.excludedIds].sort().join();
  const dirty = Object.keys(pending).length > 0 || policyChanged;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const catalog = snapshot.catalog.map(contentPlacement);
  const imageFields = catalog.filter(field => field.kind === "image");
  const kind = tab === "Images" ? "image" : "text";
  const fieldsOfKind = catalog.filter(field => field.kind === kind);
  const sections = [...new Set(fieldsOfKind.map(field => field.section))].sort();
  const needle = search.toLocaleLowerCase();
  const matching = fieldsOfKind.filter(field => (locale === "all" || field.locale === locale || field.locale === "shared") && (section === "all" || field.section === section) && `${field.label} ${field.section} ${snapshot.values[field.key] ?? field.defaultValue}`.toLocaleLowerCase().includes(needle));
  const groups = [...new Set(matching.map(field => field.section))];
  function edit(key: string, value: string | null) {
    const field = snapshot.catalog.find(item => item.key === key)!;
    const current = snapshot.values[key] ?? field.defaultValue;
    setPending(previous => { const next = { ...previous }; if ((value ?? field.defaultValue) === current) delete next[key]; else next[key] = value; return next; });
    setNotice("");
  }
  async function reload() {
    setBusy(true); setError("");
    try { const next = await cmsRequest<CmsSnapshot>(); cache.setQueryData(snapshotKey, next); setPending({}); setPolicy(next.testimonialPolicy); setConflict(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not reload preview content."); }
    finally { setBusy(false); }
  }
  async function save(restoreRevision?: number) {
    setBusy(true); setError(""); setNotice("");
    try {
      if (restoreRevision !== undefined) await cmsRequest("admin/restore", "POST", { expectedRevision: snapshot.revision, revision: restoreRevision });
      else await cmsRequest("admin", "PUT", { expectedRevision: snapshot.revision, values: pending, ...(policyChanged ? { testimonialPolicy: policy } : {}) });
      const next = await cmsRequest<CmsSnapshot>();
      cache.setQueryData(snapshotKey, next);
      setPending({}); setPolicy(next.testimonialPolicy); setConflict(false);
      setNotice(restoreRevision === undefined ? "Saved to the preview. Refresh the preview page to see your changes." : "Earlier content restored to the preview.");
      await cache.invalidateQueries({ queryKey: ["site-preview-cms", "history"] });
      await cache.invalidateQueries({ queryKey: ["site-preview-cms", "testimonials"] });
    } catch (e) { setError(e instanceof CmsError && e.status === 409 ? "Someone saved a newer version. Your edits are still here. Copy any text you want to keep, then reload the latest version before saving again." : e instanceof Error ? e.message : "Could not save preview content."); setConflict(e instanceof CmsError && e.status === 409); }
    finally { setBusy(false); }
  }
  return <>
    <div className="cms-savebar"><span>Revision {snapshot.revision}{dirty ? ` · Unsaved changes${Object.keys(pending).length ? ` in ${Object.keys(pending).length} fields` : ""}` : " · All changes saved"}</span><div className="cms-actions"><button type="button" className="cms-button" disabled={busy} onClick={() => void reload()}>{dirty ? "Discard edits and reload" : "Refresh content"}</button><button type="button" className="cms-button cms-button--primary" disabled={!dirty || busy || conflict} onClick={() => void save()}>{busy ? "Saving…" : "Save to preview"}</button></div></div>
    {error && <p className="cms-error" role="alert">{error}</p>}{notice && <p className="cms-success" role="status">{notice}</p>}
    <div className="cms-tabs" role="tablist" aria-label="Website editor">{tabs.map(item => <button key={item} type="button" role="tab" aria-selected={tab === item} aria-controls="cms-tab-panel" id={`cms-tab-${item.replaceAll(" ", "-")}`} onClick={() => { setTab(item); setSection("all"); }} className={tab === item ? "is-active" : undefined}>{item}</button>)}</div>
    <div id="cms-tab-panel" role="tabpanel" aria-labelledby={`cms-tab-${tab.replaceAll(" ", "-")}`}>
      {(tab === "Content" || tab === "Images") && <>
        <div className="cms-filters"><label>Search<input className="su-input" placeholder="Find a heading, paragraph or section" value={search} onChange={event => setSearch(event.target.value)} /></label><label>Language<select className="su-input" value={locale} onChange={event => setLocale(event.target.value)}><option value="all">All languages</option><option value="en">English</option><option value="es">Español</option></select></label><label>Section<select className="su-input" value={section} onChange={event => setSection(event.target.value)}><option value="all">All sections</option>{sections.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
        <p className="cms-count">{matching.length} {tab === "Images" ? "image placements" : "content fields"}{search || locale !== "all" || section !== "all" ? " match your filters" : " available"}. Shared fields update every placement that uses them.</p>
        {matching.length === 0 && <div className="cms-panel">No content matches these filters.</div>}
        {groups.map(group => <CmsGroup key={`${tab}:${group}:${search}:${locale}:${section}`} title={group} count={matching.filter(field => field.section === group).length} initiallyOpen={section !== "all" || Boolean(search) || groups.length === 1}><div className={tab === "Images" ? "cms-image-grid" : "cms-fields"}>{matching.filter(field => field.section === group).map(field => <CmsField key={field.key} field={field} value={Object.hasOwn(pending, field.key) ? pending[field.key] ?? field.defaultValue : snapshot.values[field.key] ?? field.defaultValue} changed={Object.hasOwn(pending, field.key)} disabled={busy} images={imageFields} onChange={value => edit(field.key, value)} />)}</div></CmsGroup>)}
      </>}
      {tab === "Testimonials" && <CmsTestimonials policy={policy} onChange={setPolicy} disabled={busy} revision={snapshot.revision} />}
      {tab === "History" && <>{dirty && <p className="cms-error">Save or discard your edits before restoring a revision.</p>}<CmsHistory revision={snapshot.revision} disabled={busy || dirty} onRestore={revision => save(revision)} /></>}
      {tab === "Live review archive" && <><div className="cms-panel"><strong>Live review archive · Read only</strong><p>These are the existing live-site records. The preview selection above is managed separately.</p></div><TestimonialsList /></>}
    </div>
  </>;
}

function CmsGroup({ title, count, initiallyOpen, children }: { title: string; count: number; initiallyOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <details className="cms-group" open={open} onToggle={event => setOpen(event.currentTarget.open)}><summary>{title}{count > 0 && <span>{count} fields</span>}</summary>{open ? children : null}</details>;
}
