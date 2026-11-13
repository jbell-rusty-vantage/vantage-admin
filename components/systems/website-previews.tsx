import Link from "next/link";
import { SHARED_PREVIEW_CONTENT, WEBSITE_PREVIEWS } from "@/lib/setup/website-previews";

export function WebsitePreviewLocations() {
  return <section className="sy-section" aria-labelledby="website-previews-title">
    <h2 id="website-previews-title" className="sy-section__title">Website previews</h2>
    <p className="sy-muted">These are review designs. The live website remains vantagehomemovers.com.</p>
    <ul className="crm-card">
      {WEBSITE_PREVIEWS.map(preview => <li className="sy-location" key={preview.id}>
        <div className="sy-location__name"><strong>{preview.label}</strong></div>
        <div className="sy-location__where"><span className="sy-location__url">{preview.origin}</span><span className="sy-location__note">Preview only · Shared website content</span></div>
        <div className="sy-location__actions"><a className="crm-button sy-action" href={`${preview.origin}/`} target="_blank" rel="noopener noreferrer">Open {preview.id === "optimized" ? "Optimized" : "Canyon"} ↗</a></div>
      </li>)}
    </ul>
    <p className="sy-muted">{SHARED_PREVIEW_CONTENT} <Link className="crm-link" href="/setup/website">Edit shared website content</Link></p>
  </section>;
}
