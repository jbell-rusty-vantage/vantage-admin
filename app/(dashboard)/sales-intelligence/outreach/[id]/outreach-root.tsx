"use client";
import { OutreachPage } from "@/components/sales-intelligence/outreach";
import "@/components/sales-intelligence/styles/sales-intelligence.css";

export function OutreachRoot({ id, tab, run, siReturn }: { id: string; tab?: string; run?: string; siReturn?: string }) {
  return (
    <div className="si-root si-route">
      <OutreachPage id={id} tab={tab} run={run} siReturn={siReturn} />
    </div>
  );
}
