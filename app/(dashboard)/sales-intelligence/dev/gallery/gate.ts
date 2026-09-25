/** The gallery exists outside development only with SI_GALLERY=1 (UI-0 §7.4). */
export function galleryEnabled(env: { NODE_ENV?: string; SI_GALLERY?: string } = process.env): boolean {
  return env.NODE_ENV !== "production" || env.SI_GALLERY === "1";
}
