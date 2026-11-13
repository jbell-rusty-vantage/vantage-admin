import type { ContentField } from "@/lib/api/sitePreviewCms";

function words(value: string) {
  return value.replace(/([a-z\d])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/\b(?:page|section|component)\b/gi, "").replace(/\s+/g, " ").trim().replace(/^./, character => character.toUpperCase());
}

/** Translate developer placement names into the website locations the Owner knows. */
export function contentPlacement(field: ContentField): ContentField {
  const source = field.section.toLowerCase();
  const last = field.section.split(" / ").filter(part => !["page", "error", "layout", "(en)", "es"].includes(part)).at(-1) ?? "General";
  let group = "Home";
  let placement = words(last);
  if (/legal|policy|privacy|terms|cancellation|accessibility|consumer-information/.test(source)) group = "Policies";
  else if (/quote|pickup|movingassistant/.test(source)) group = "Forms";
  else if (/header|footer|navigation|compliance|floatingcall|anchor|dropdown/.test(source) || /\(en\) \/ layout/.test(source)) group = "Header & footer";
  else if (/editorial.*(service|pricing)/.test(source)) group = "Services";
  else if (/destination|geograph|florida|locations|locationpage|moving-routes|stateroutemap/.test(source)) group = "Destinations";
  else if (/resource|article|sources|editorialpage|directorypage|printbutton/.test(source)) group = "Resources";
  else if (/contactpage|carrier/.test(source)) group = "Contact & carriers";
  else if (/error|not-found|loadingskeleton|manifest|opengraph/.test(source)) group = "Site messages";
  if (source === "content") placement = "Shared website copy";
  if (source === "images") placement = "Shared images";
  if (source === "(en) / page") placement = "English page";
  if (source === "es / page") placement = "Spanish page";
  if (source === "homepage") placement = "Page";
  const [name, ...sample] = field.label.split(" · ");
  return { ...field, section: `${group} · ${placement}`, label: `${words(name)}${sample.length ? ` · ${sample.join(" · ")}` : ""}` };
}
