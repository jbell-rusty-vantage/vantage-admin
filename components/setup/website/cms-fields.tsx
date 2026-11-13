"use client";
import { useState } from "react";
import { cmsRequest, previewImageUrl, type ContentField } from "@/lib/api/sitePreviewCms";

type Props = { field: ContentField; value: string; changed: boolean; disabled: boolean; images: ContentField[]; onChange: (value: string | null) => void };
export function CmsField({ field, value, changed, disabled, images, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputId = `cms-${field.key}`;
  async function upload(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) { setError("Choose a PNG, JPEG or WebP image up to 2 MB."); return; }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("Could not read the image.")); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.readAsDataURL(file); });
      const result = await cmsRequest<{ url: string }>("admin/media", "POST", { filename: file.name, contentType: file.type, base64 });
      onChange(result.url);
    } catch (e) { setError(e instanceof Error ? e.message : "The image could not be uploaded."); }
    finally { setUploading(false); }
  }
  return <article className="cms-field">
    <div className="cms-field__heading"><label htmlFor={inputId}>{field.label}</label><span className="cms-pill">{field.locale === "shared" ? "Shared" : field.locale === "es" ? "Español" : "English"}</span>{changed && <span className="cms-pill cms-pill--changed">Edited</span>}</div>
    {field.kind === "image" ? <>
      {previewImageUrl(value) ? <div className="cms-image-preview">
        {/* Native img supports the authenticated same-origin media route. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewImageUrl(value)} alt={`Current image for ${field.label}`} loading="lazy" />
      </div> : <p>No image selected.</p>}
      <label className="cms-label" htmlFor={inputId}>Choose an existing image</label>
      <select id={inputId} className="su-input" disabled={disabled || uploading} value={value} onChange={event => onChange(event.target.value)}>
        {!images.some(image => image.defaultValue === value) && <option value={value}>Uploaded image</option>}
        {Array.from(new Map(images.map(image => [image.defaultValue, image])).values()).map(image => <option key={image.defaultValue} value={image.defaultValue}>{image.label} · {image.section}</option>)}
      </select>
      <label className="cms-upload">{uploading ? "Uploading…" : "Upload a replacement"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled || uploading} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label>
      <small>PNG, JPEG or WebP · up to 2 MB. Save changes to use this image on the preview.</small>
      {error && <p className="cms-error" role="alert">{error}</p>}
    </> : <textarea id={inputId} className="su-input cms-textarea" value={value} rows={value.length > 250 ? 6 : value.length > 80 ? 3 : 2} disabled={disabled} onChange={event => onChange(event.target.value)} />}
    <div className="cms-field__bottom"><button type="button" className="cms-link" disabled={disabled || uploading || value === field.defaultValue} onClick={() => onChange(null)}>Reset to original</button><details><summary>Original content</summary><p className="cms-original">{field.defaultValue}</p></details></div>
  </article>;
}
