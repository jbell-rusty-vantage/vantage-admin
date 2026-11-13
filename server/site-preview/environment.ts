export type SitePreviewEnvironment = {
  SITE_PREVIEW_API_BASE_URL?: string;
  SITE_PREVIEW_API_SECRET?: string;
  SITE_PREVIEW_API_PROTECTION_BYPASS?: string;
  SITE_PREVIEW_ADMIN_SIGNING_SECRET?: string;
};

export function sitePreviewOrigin(value: string, production = process.env.NODE_ENV === "production") {
  const url = new URL(value);
  const preview = url.origin === "https://vantage-sites-preview-api.vercel.app";
  const local = !production && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((!preview && !local) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Use the isolated website preview API origin.");
  return url.origin;
}

// Separate from operational settings: missing CMS settings cannot break the dashboard.
export function getSitePreviewEnvironment(): SitePreviewEnvironment {
  return {
    SITE_PREVIEW_API_BASE_URL: process.env.SITE_PREVIEW_API_BASE_URL,
    SITE_PREVIEW_API_SECRET: process.env.SITE_PREVIEW_API_SECRET,
    SITE_PREVIEW_API_PROTECTION_BYPASS: process.env.SITE_PREVIEW_API_PROTECTION_BYPASS,
    SITE_PREVIEW_ADMIN_SIGNING_SECRET: process.env.SITE_PREVIEW_ADMIN_SIGNING_SECRET,
  };
}
