"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const apply = () => setMatches(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [query]);
  return matches;
}

export function useSiLayout() {
  const compact = useMediaQuery("(max-width: 1099px)");
  const sheet = useMediaQuery("(max-width: 720px)");
  return { compact, sheet };
}
