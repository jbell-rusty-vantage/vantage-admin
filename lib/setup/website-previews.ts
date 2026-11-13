/** Fixed presentation targets. Both read the same isolated CMS; neither is production. */
export const WEBSITE_PREVIEWS = [
  { id: "optimized", label: "Main optimized preview", origin: "https://vantage-main-site-optimization.vercel.app" },
  { id: "canyon", label: "Variation optimized preview (Canyon)", origin: "https://vantage-main-site-canyon.vercel.app" },
] as const;

export type PreviewDesign = typeof WEBSITE_PREVIEWS[number]["id"];
export const SHARED_PREVIEW_CONTENT = "Copy, images and testimonial settings are shared by both preview designs.";
