import type { ContentField } from "@/lib/api/sitePreviewCms";

// These installed manifest IDs are keyboard constants, not rendered website copy.
const inventoryOnlyKeys = new Set([
  "text.ecf744d6189c940f", "text.91c1a43bc5577791", "text.c42573a836deb67a", "text.8a15b2620682f2bb",
]);
export function isOwnerEditableField(field: ContentField) {
  return !inventoryOnlyKeys.has(field.key);
}

const services: Record<string, string> = {
  "auto-transport": "Auto transport", "corporate-office-moving": "Office moving",
  "long-distance-moving": "Long-distance moving", "military-moving": "Military moving",
  "packing-services": "Packing services", "residential-moving": "Residential moving",
  "senior-moving": "Senior moving", "storage-options": "Storage options",
  "transporte-de-autos": "Transporte de autos", "mudanzas-de-oficina": "Mudanzas de oficina",
  "mudanzas-larga-distancia": "Mudanzas de larga distancia", "mudanzas-militares": "Mudanzas militares",
  "servicios-de-embalaje": "Servicios de embalaje", "mudanzas-residenciales": "Mudanzas residenciales",
  "mudanzas-para-personas-mayores": "Mudanzas para personas mayores", "opciones-de-almacenamiento": "Opciones de almacenamiento",
};
const serviceImages: Record<string, string> = {
  "auto-arrival.webp": "auto-transport", "office-moving.webp": "corporate-office-moving",
  "long-distance-arrival.webp": "long-distance-moving", "military-arrival.webp": "military-moving",
  "military-packing.webp": "military-moving", "packing-care.webp": "packing-services",
  "senior-moving.webp": "senior-moving", "storage-belongings.webp": "storage-options",
};

function placement(field: ContentField) {
  const source = field.section.toLowerCase();
  const route = field.section.match(/^\/(?:services|es\/servicios)\/([^/]+)$/)?.[1];
  if (route && services[route]) return `Services · ${services[route]}`;
  if (source.startsWith("images /")) {
    const file = field.defaultValue.split("/").at(-1) ?? "";
    if (serviceImages[file]) return `Services · ${services[serviceImages[file]]}`;
    if (file === "home-arrival.webp") return "Home · Hero & facts";
    if (file === "move-coordinator.webp") return "Home · About Vantage";
    return "Home · Contact & quote";
  }
  if (/move_sizes/.test(source)) return "Quote form · Move sizes";
  if (/quoteformschema|spanisherrors|quote-form\.schema/.test(source)) return "Quote form · Messages";
  if (/quote-copy|quotewizard|pickuplocation|movingassistant|quotesection|quoteaction/.test(source)) return /^(?:error|failure|success|invalid|unavailable|retry)\b/i.test(field.label) ? "Quote form · Messages" : "Quote form · Labels";
  if (/smsprivacy|smsterms|sms-privacy|sms-terms/.test(source)) return "Policies · Text messages";
  if (/privacy/.test(source)) return "Policies · Privacy";
  if (/terms|cancellation/.test(source)) return "Policies · Terms & cancellations";
  if (/accessibility/.test(source)) return "Policies · Accessibility";
  if (/consumer-information|policypage/.test(source)) return "Policies · Consumer information";
  if (/not-found|errorstate|loadingskeleton/.test(source)) return "Site messages · Loading & errors";
  if (/header|footer|navigation|compliance|logo|dropdown|^publication$/.test(source)) return "Header & footer · Navigation & notices";
  if (/^hero-proof|^sections \/ hero|^content \/ hero/.test(source)) return "Home · Hero & facts";
  if (/about|whyvantage|militaryappreciation|content \/ business/.test(source)) return "Home · About Vantage";
  if (/truststrip|trustband/.test(source)) return "Home · Trust & referrals";
  if (/testimonials|ui \/ stars/.test(source)) return "Home · Reviews";
  if (/faq/.test(source)) return "Home · Questions & answers";
  if (/coverage|statenames/.test(source)) return "Home · Coverage";
  if (/howitworks|movingprocess/.test(source)) return "Home · Moving process";
  if (/contact|carrier|finalcta|es \/ page/.test(source)) return "Home · Contact & quote";
  if (/^content \/ (services|featurerows)|sections \/ services/.test(source)) return "Home · Services overview";
  if (/editorial.*(?:service|preparation|pricing)/.test(source)) return "Services · Shared planning guidance";
  if (/destination|state-geography|geography-sources|stateroutemap/.test(source)) return "Destinations · Maps & place names";
  if (/florida|locations|locationpage|moving-routes/.test(source)) return "Destinations · Guides & routes";
  if (/resourceentries|planningresources/.test(source)) return "Resources · Guides & worksheets";
  if (/editorial|resource/.test(source)) return "Resources · Page labels & references";
  return "Website · Shared copy";
}

const fieldNames: Record<string, string> = {
  title: "Title", heading: "Heading", headline: "Headline", paragraphs: "Paragraph", bullets: "List item",
  navLabel: "Navigation label", description: "Description", body: "Paragraph", question: "Question", answer: "Answer",
  q: "Question", a: "Answer", alt: "Image description", eyebrow: "Small heading", caption: "Caption",
  columns: "Column heading", steps: "Step", html: "Content", bodyHtml: "Content", cta: "Button label",
  ctaLabel: "Button label", primaryCta: "Primary button", secondaryCta: "Secondary button", checklist: "Checklist item",
  directoryName: "Directory title", heroNote: "Hero note", quoteTitle: "Quote heading", quoteDescription: "Quote description",
  planningTitle: "Planning heading", preparationTitle: "Preparation heading", routeTitle: "Route heading",
  routeIntro: "Route introduction", serviceTitle: "Service heading", serviceIntro: "Service introduction",
};
function label(field: ContentField) {
  const [name, ...parts] = field.label.split(" · ");
  if (!parts.length) return field.label;
  const sample = parts.join(" · ").replace(/<[^>]*>/g, "").trim();
  if (/^(?:copy|en|es|rows|blankrows|items|label|text|b|MOVE_SIZES)$/i.test(name)) return sample || field.label;
  const role = fieldNames[name] ?? name.replace(/([a-z\d])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/^./, character => character.toUpperCase());
  return `${role} · ${sample}`;
}

/** Display labels only; catalog identity, locale, exact values and save keys stay unchanged. */
export function contentPlacement(field: ContentField): ContentField {
  return { ...field, section: placement(field), label: label(field) };
}

const homeOrder = ["Hero & facts", "Services overview", "Moving process", "Coverage", "About Vantage", "Trust & referrals", "Reviews", "Questions & answers", "Contact & quote"];
const areaOrder = ["Home", "Header & footer", "Services", "Resources", "Destinations", "Quote form", "Policies", "Site messages", "Website"];
export function compareContentSections(left: string, right: string) {
  const [leftArea, leftSection] = left.split(" · ");
  const [rightArea, rightSection] = right.split(" · ");
  const area = areaOrder.indexOf(leftArea) - areaOrder.indexOf(rightArea);
  if (area) return area;
  if (leftArea === "Home") return homeOrder.indexOf(leftSection) - homeOrder.indexOf(rightSection);
  return left.localeCompare(right);
}
