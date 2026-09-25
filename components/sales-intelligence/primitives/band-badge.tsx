import { CircleHelp } from "lucide-react";
import { BANDS, copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";

export type BandNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** UI-0 §7.1 band ramp. Mirrors `--si-band-n-bg/fg` in sales-intelligence.css (a test keeps them in step). */
export const BAND_COLORS: Record<BandNumber, { bg: string; fg: string }> = {
  1: { bg: "#062b55", fg: "#ffffff" },
  2: { bg: "#0f4a85", fg: "#ffffff" },
  3: { bg: "#145da0", fg: "#ffffff" },
  4: { bg: "#2f6daf", fg: "#ffffff" },
  5: { bg: "#cfe0f2", fg: "#062b55" },
  6: { bg: "#e0ebf6", fg: "#0e2238" },
  7: { bg: "#eef3f8", fg: "#3c4f65" },
};

function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two hex colours (1 … 21). */
export function contrastRatio(hexA: string, hexB: string): number {
  const [a, b] = [luminance(hexA), luminance(hexB)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const isBand = (band: unknown): band is BandNumber => typeof band === "number" && band >= 1 && band <= 7 && Number.isInteger(band);

/**
 * UI-0 §7.2 band badge. `tag`: badge + `Band n · {name}`. `header`: badge + 15 px heading + count.
 * `needs_review`: outlined badge with circle-help. `band: null`: a `—` badge reading `Not in Attention`.
 */
export function BandBadge({
  band,
  variant = "tag",
  count,
  headingLevel = 3,
  className,
}: {
  band: BandNumber | null;
  variant?: "tag" | "header" | "needs_review";
  count?: number | null;
  headingLevel?: 2 | 3 | 4;
  className?: string;
}) {
  const p = copy.ui1.prim;
  let badge;
  let name: string;
  if (variant === "needs_review") {
    badge = (
      <span className="si-bandbadge si-bandbadge--review" aria-hidden>
        <CircleHelp size={14} aria-hidden />
      </span>
    );
    name = p.needsReview;
  } else if (!isBand(band)) {
    badge = <span className="si-bandbadge si-bandbadge--none" aria-hidden>—</span>;
    name = p.notInAttention;
  } else {
    badge = <span className={cx("si-bandbadge", `si-bandbadge--${band}`)} aria-hidden>{band}</span>;
    name = variant === "tag" ? p.bandTag(band, BANDS[band]) : BANDS[band];
  }

  if (variant === "header") {
    const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
    return (
      <div className={cx("si-bandhead", className)}>
        {badge}
        <Heading className="si-bandhead__name">
          {isBand(band) && <span className="si-sr">{p.bandNumber(band)} · </span>}
          {name}
        </Heading>
        {count != null && (
          <span className="si-bandhead__count" aria-label={p.bandCount(count)}>{count.toLocaleString("en-US")}</span>
        )}
      </div>
    );
  }
  return (
    <span className={cx("si-bandtag", variant === "needs_review" && "is-review", !isBand(band) && variant !== "needs_review" && "is-none", className)}>
      {badge}
      <span className="si-bandtag__name">{name}</span>
    </span>
  );
}
