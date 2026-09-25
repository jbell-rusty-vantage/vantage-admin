"use client";

import { ArrowUp } from "lucide-react";
import type { MouseEvent } from "react";
import { copy } from "../../sales-intelligence-copy";

/**
 * UI-0 §2.5: `Updated list available · Show`, above the list. `Show` applies the new list and brings the top of
 * the list into view (the pill's container is the list's top).
 */
export function UpdatedListPill({ onShow }: { onShow: () => void }) {
  const l = copy.ui1.live;
  const show = (event: MouseEvent<HTMLButtonElement>) => {
    const top = event.currentTarget.closest(".si-listpill")?.parentElement ?? null;
    onShow();
    top?.scrollIntoView({ block: "start" });
  };
  return (
    <div className="si-listpill" role="status">
      <span className="si-listpill__text">{l.updatedList}</span>
      <span aria-hidden>·</span>
      <button type="button" className="si-link si-listpill__show" aria-label={l.showLabel} onClick={show}>
        <ArrowUp size={14} aria-hidden />
        {l.show}
      </button>
    </div>
  );
}
