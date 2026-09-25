"use client";

import { createContext, useContext, type ReactNode } from "react";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { cx } from "@/components/sales-intelligence/lib/format";

/** True while the `390 px frame` toggle is on: every section body renders inside a 390 px wide frame. */
export const FrameContext = createContext(false);

export function GallerySection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const framed = useContext(FrameContext);
  return (
    <section id={id} className="si-gallery__section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="si-heading si-heading--2">{title}</h2>
      <div className={cx("si-gallery__body", framed && "si-gallery__frame")} data-frame={framed ? "390" : undefined}>
        {children}
      </div>
    </section>
  );
}

/** One sample with its label above and the copy key (or source) printed under it, so a screenshot reads on its own. */
export function Sample({ label, copyKey, wide, children }: { label?: string; copyKey?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cx("si-gallery__sample", wide && "si-gallery__sample--wide")}>
      {label && <span className="si-heading si-heading--4">{label}</span>}
      {children}
      {copyKey && <code className="si-gallery__key">{copyKey}</code>}
    </div>
  );
}

export function Subhead({ children }: { children: ReactNode }) {
  return <h3 className="si-heading si-heading--3">{children}</h3>;
}

export function Placeholder({ id, stage }: { id: keyof typeof copy.ui1.gallery.sections; stage: string }) {
  const g = copy.ui1.gallery;
  return (
    <GallerySection id={id} title={g.sections[id]}>
      <p className="si-gallery__placeholder" data-placeholder={stage}>{g.placeholder(stage)}</p>
    </GallerySection>
  );
}
