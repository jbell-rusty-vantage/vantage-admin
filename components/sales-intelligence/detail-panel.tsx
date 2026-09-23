"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./atoms/button";
import { Tabs } from "./chrome";
import { copy } from "./sales-intelligence-copy";
import { SI_PANEL_TABS, type SiPanelKey } from "./sales-intelligence-tabs";
import { assessmentCopy } from "./evidence-chain-copy";
import "./styles/assessment.css";

export function DetailPanel({
  title,
  panel,
  onPanel,
  now,
  onClose,
  children,
}: {
  title?: string;
  panel: SiPanelKey;
  onPanel: (next: SiPanelKey) => void;
  now: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Expand / Restore stays inside the viewport and keeps this one dialog: no second surface, so
  // Escape still closes only the topmost thing (a nested command dialog stops its own Escape).
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className={expanded ? "si-root si-local-dialog is-expanded" : "si-root si-local-dialog"} onCancel={onClose} aria-labelledby="si-detail-title">
      <header className="si-panel__header">
        <h2 id="si-detail-title" className="si-panel__dtitle" title={title ?? copy.page.detailTitle}>{title ?? copy.page.detailTitle}</h2>
        <div className="si-panel__headeractions">
          <Button
            variant="ghost"
            className="si-panel__expand"
            aria-pressed={expanded}
            aria-label={expanded ? assessmentCopy.restoreLabel : assessmentCopy.expandLabel}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? assessmentCopy.restore : assessmentCopy.expand}
          </Button>
          <Button variant="ghost" onClick={onClose} aria-label={copy.actions.closePanel}>{copy.actions.closePanel}</Button>
        </div>
      </header>
      {now}
      <div className="si-panel__tabs">
        <Tabs
          idBase="si-panel"
          label={copy.page.viewsLabel}
          value={panel}
          onChange={onPanel}
          items={SI_PANEL_TABS.map((item) => ({ key: item.key, label: item.label }))}
        />
      </div>
      <div className="si-panel__body" role="tabpanel" id={`si-panel-panel-${panel}`} aria-labelledby={`si-panel-tab-${panel}`}>
        {children}
      </div>
    </dialog>
  );
}
