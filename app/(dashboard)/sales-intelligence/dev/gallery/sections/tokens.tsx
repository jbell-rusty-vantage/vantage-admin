"use client";

import { Check, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { BAND_COLORS, BandBadge, Chip, StatePill, contrastRatio, type BandNumber } from "@/components/sales-intelligence/primitives";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { cx } from "@/components/sales-intelligence/lib/format";
import { GallerySection, Subhead } from "./section";

type Group = keyof typeof copy.ui1.gallery.tokens.groups;

const BAND_NUMBERS: BandNumber[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Every `--si-*` colour token with the hex it has in sales-intelligence.css. The swatch paints `var(--name)`, so it
 * shows the real token; the printed hex comes from here, and gallery.test.ts keeps this list equal to the CSS.
 */
export const TOKEN_GROUPS: { group: Group; tokens: { name: string; hex: string }[] }[] = [
  {
    group: "base",
    tokens: [
      { name: "--si-navy", hex: "#062b55" },
      { name: "--si-blue", hex: "#145da0" },
      { name: "--si-blue-bright", hex: "#2e86de" },
      { name: "--si-blue-tint", hex: "#e8f1fa" },
      { name: "--si-gold", hex: "#f4b400" },
      { name: "--si-gold-ink", hex: "#7a5a00" },
      { name: "--si-gold-tint", hex: "#fff6d9" },
      { name: "--si-bg", hex: "#f5f8fb" },
      { name: "--si-surface", hex: "#ffffff" },
      { name: "--si-surface-2", hex: "#eef3f8" },
      { name: "--si-ink", hex: "#0e2238" },
      { name: "--si-ink-2", hex: "#3c4f65" },
      { name: "--si-ink-3", hex: "#5a6b80" },
      { name: "--si-line", hex: "#dce4ed" },
      { name: "--si-line-strong", hex: "#c4d0dd" },
      { name: "--si-focus", hex: "#2e86de" },
    ],
  },
  {
    group: "bands",
    tokens: BAND_NUMBERS.flatMap((n) => [
      { name: `--si-band-${n}-bg`, hex: BAND_COLORS[n].bg },
      { name: `--si-band-${n}-fg`, hex: BAND_COLORS[n].fg },
    ]),
  },
  { group: "live", tokens: [{ name: "--si-live", hex: "#145da0" }] },
  { group: "bubbles", tokens: [{ name: "--si-bubble-owner", hex: "#e8f1fa" }, { name: "--si-bubble-rep", hex: "#eef3f8" }] },
  { group: "progress", tokens: [{ name: "--si-progress", hex: "#2e86de" }] },
  {
    group: "status",
    tokens: [
      { name: "--si-amber", hex: "#8a4b00" },
      { name: "--si-amber-tint", hex: "#fff1dc" },
      { name: "--si-amber-line", hex: "#f2c98a" },
      { name: "--si-red", hex: "#b42318" },
      { name: "--si-red-tint", hex: "#fdeceb" },
      { name: "--si-green", hex: "#1b6b43" },
      { name: "--si-green-tint", hex: "#e6f4ec" },
    ],
  },
];

const HEX: Record<string, string> = Object.fromEntries(TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => [t.name, t.hex])));

export const AA_RATIO = 4.5;

export type ContrastPair = { id: string; fg: string; bg: string; sample: () => ReactNode };

/** Text-on-background pairs for every band badge and chip tone, each with the sample it measures. */
export const CONTRAST_PAIRS: ContrastPair[] = [
  ...BAND_NUMBERS.map((n) => ({ id: `band-${n}`, fg: `--si-band-${n}-fg`, bg: `--si-band-${n}-bg`, sample: () => <BandBadge band={n} /> })),
  { id: "needs-review", fg: "--si-ink-2", bg: "--si-surface", sample: () => <BandBadge band={null} variant="needs_review" /> },
  { id: "not-in-attention", fg: "--si-ink-3", bg: "--si-surface-2", sample: () => <BandBadge band={null} /> },
  { id: "state-pill", fg: "--si-ink-2", bg: "--si-surface-2", sample: () => <StatePill state="open" /> },
  { id: "chip-neutral", fg: "--si-ink-2", bg: "--si-surface-2", sample: () => <Chip>{copy.ui1.gallery.chips.default}</Chip> },
  { id: "chip-live", fg: "--si-ink", bg: "--si-surface-2", sample: () => <Chip tone="live">{copy.ui1.gallery.chips.inProgress}</Chip> },
  { id: "chip-amber", fg: "--si-amber", bg: "--si-amber-tint", sample: () => <Chip tone="amber">{copy.ui1.gallery.chips.detailsDisagree}</Chip> },
  { id: "chip-red", fg: "--si-red", bg: "--si-red-tint", sample: () => <Chip tone="red">{copy.ui1.prim.live.healthWord.broken}</Chip> },
  { id: "chip-green", fg: "--si-green", bg: "--si-green-tint", sample: () => <Chip tone="green">{copy.leadProgress.booked}</Chip> },
  { id: "chip-blue", fg: "--si-blue", bg: "--si-blue-tint", sample: () => <Chip tone="blue">{copy.ui1.gallery.chips.repReplied}</Chip> },
];

export const contrastFor = (pair: { fg: string; bg: string }) => contrastRatio(HEX[pair.fg] ?? "#000000", HEX[pair.bg] ?? "#000000");

export function TokensSection() {
  const t = copy.ui1.gallery.tokens;
  return (
    <GallerySection id="tokens" title={copy.ui1.gallery.sections.tokens}>
      {TOKEN_GROUPS.map(({ group, tokens }) => (
        <div key={group} className="si-gallery__body">
          <Subhead>{t.groups[group]}</Subhead>
          <div className="si-gallery__swatches">
            {tokens.map((token) => (
              <div key={token.name} className="si-gallery__swatch" data-token={token.name}>
                <span className="si-gallery__chip" style={{ background: `var(${token.name})` }} aria-hidden />
                <span className="si-gallery__sample">
                  <code className="si-mono si-text--sm">{token.name}</code>
                  <code className="si-gallery__key">{token.hex}</code>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Subhead>{t.contrastTitle}</Subhead>
      <p className="si-gallery__note">{t.contrastNote}</p>
      <div className="si-gallery__tablewrap">
        <table className="si-gallery__table" data-table="contrast">
          <thead>
            <tr>
              <th>{t.sample}</th>
              <th>{t.pair}</th>
              <th>{t.ratio}</th>
              <th>{t.result}</th>
            </tr>
          </thead>
          <tbody>
            {CONTRAST_PAIRS.map((pair) => {
              const ratio = contrastFor(pair);
              const pass = ratio >= AA_RATIO;
              return (
                <tr key={pair.id} data-contrast={pair.id} data-ratio={ratio.toFixed(2)} data-pass={pass ? "1" : "0"}>
                  <td>{pair.sample()}</td>
                  <td>
                    <code className="si-gallery__key">
                      {pair.fg} / {pair.bg}
                    </code>
                  </td>
                  <td className="si-mono">{ratio.toFixed(2)}:1</td>
                  <td>
                    <span className={cx("si-gallery__result", !pass && "is-fail")}>
                      {pass ? <Check size={14} aria-hidden /> : <TriangleAlert size={14} aria-hidden />}
                      {pass ? t.pass : t.fail}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Subhead>{t.typeTitle}</Subhead>
      <div className="si-gallery__body">
        <TypeRow label={t.type.pageTitle}><span className="si-heading si-heading--1">{t.typeSample}</span></TypeRow>
        <TypeRow label={t.type.section}><span className="si-heading si-heading--2">{t.typeSample}</span></TypeRow>
        <TypeRow label={t.type.subsection}><span className="si-heading si-heading--3">{t.typeSample}</span></TypeRow>
        <TypeRow label={t.type.overline}><span className="si-gallery__type--overline">{t.typeSample}</span></TypeRow>
        <TypeRow label={t.type.body}><span className="si-gallery__type--body">{t.typeSample}</span></TypeRow>
        <TypeRow label={t.type.small}><span className="si-gallery__type--small">{t.typeSample}</span></TypeRow>
        <TypeRow label={t.type.badge}><span className="si-gallery__type--badge">{t.typeSample}</span></TypeRow>
      </div>
    </GallerySection>
  );
}

function TypeRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="si-gallery__typerow">
      <span className="si-gallery__key">{label}</span>
      {children}
    </div>
  );
}
