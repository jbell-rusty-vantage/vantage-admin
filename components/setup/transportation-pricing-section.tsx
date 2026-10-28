"use client";
/**
 * Owner Setup → Transportation pricing. Shows the live rates first; each part (base rates, each surcharge group, the
 * agent-pricing switch) has its own Edit and Save. Save goes live in one step and answers with a toast — the
 * operations service's draft/preview/publish protocol runs behind `saveConfiguration`, never in front of the Owner.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, History, Info, Pencil, RefreshCw, RotateCcw, ShieldCheck, X } from "lucide-react";
import { SetupOwnerOnly, SetupSectionHead } from "./setup-shell";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import {
  MILEAGE, MILEAGE_LABELS, PricingError, emptyConfiguration, newGroup, parseRates, pricingErrorText, pricingRequest,
  restoreRevision, saveConfiguration, setCalculationEnabled,
  type Configuration, type Group, type Preview, type Production, type Revision,
} from "@/lib/transportation-pricing";
import { AddGroupButton, GroupCard, RateTable, Switch, money, toTexts, type RateTexts } from "./transportation-pricing-panels";

export function TransportationPricingSection() {
  const role = useDashboardRole();
  return <SetupOwnerOnly section="transportation-pricing">{role === "owner" ? <PricingWorkspace /> : null}</SetupOwnerOnly>;
}

function when(iso: string | undefined | null) {
  return iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
}
function warningToast(warnings: Preview["warnings"]) {
  if (!warnings.length) return;
  const first = warnings[0];
  const band = MILEAGE_LABELS[MILEAGE.indexOf(first.mileage_band as typeof MILEAGE[number])] ?? "";
  toast.warning("Heads up: a bigger move can cost less", {
    duration: 9000,
    description: `${warnings.length} spot${warnings.length === 1 ? "" : "s"} where a slightly bigger move gets a lower total — e.g. ${band} miles at ${first.volume_boundary} cu ft: ${first.old_price ? money(first.old_price) : "—"} → ${money(first.new_price)}. Saved anyway; change the rates if that's not intended.`,
  });
}

function PricingWorkspace() {
  const [production, setProduction] = useState<Production | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setProduction(await pricingRequest<Production>("configuration")); setLoadError(""); }
    catch (e) { setLoadError(pricingErrorText(e)); }
  }
  useEffect(() => {
    let live = true;
    pricingRequest<Production>("configuration")
      .then(value => { if (live) setProduction(value); })
      .catch(e => { if (live) setLoadError(pricingErrorText(e)); });
    return () => { live = false; };
  }, []);

  /** Every Save funnels here: one change at a time, a toast either way, then the live rates are re-read. */
  async function run(action: () => Promise<string | null>, failTitle = "Not saved"): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      const message = await action();
      if (message) toast.success(message);
      await load();
      return true;
    } catch (e) {
      toast.error(failTitle, { description: pricingErrorText(e) });
      if (e instanceof PricingError && (e.status === 0 || e.status === 409)) await load();
      return false;
    } finally { setBusy(false); }
  }
  async function saveLive(next: Configuration, note: string, success: string, warn = false) {
    return run(async () => {
      const outcome = await saveConfiguration(production!.control.active_revision_id, next, note);
      toast.success(success, { description: outcome.calculationEnabled ? "Agents get prices from these rates now." : "Saved. Agent pricing is off, so agents won't see prices until you turn it on." });
      if (warn) warningToast(outcome.warnings);
      return null;
    });
  }

  if (!production) {
    return (
      <div className="tp-workspace">
        <SetupSectionHead section="transportation-pricing" />
        {loadError
          ? <div className="tp-card tp-load-error" role="alert"><p>{loadError}</p><button type="button" className="tp-button" onClick={() => void load()}><RefreshCw size={15} />Try again</button></div>
          : <div className="tp-card tp-loading" aria-busy="true">Loading your rates…</div>}
      </div>
    );
  }

  const { control, revision } = production;
  const live = revision?.configuration ?? null;
  const enabled = control.calculation_enabled;
  const groups = live?.surcharge_groups ?? [];

  return (
    <div className="tp-workspace" aria-busy={busy}>
      <SetupSectionHead section="transportation-pricing" />

      <section className={`tp-card tp-status ${enabled ? "tp-status-on" : ""}`} aria-label="Agent pricing">
        <div>
          <h3>Agent pricing is {enabled ? "on" : "off"}</h3>
          <p>{!live ? "Fill in your base rates below, then turn this on." : enabled ? "Agents get transportation prices from the rates on this page." : "Agents can't get transportation prices right now."}</p>
          {revision && <p className="tp-muted">Last saved {when(revision.created_at)} · {revision.change_note}</p>}
        </div>
        <Switch
          checked={enabled}
          disabled={busy || (!enabled && !live)}
          label={enabled ? "On" : "Off"}
          title={!live ? "Save your base rates first" : enabled ? "Turn agent pricing off" : "Turn agent pricing on"}
          onChange={() => void run(async () => { await setCalculationEnabled(control, !enabled); return enabled ? "Agent pricing is off" : "Agent pricing is on — agents can get prices now"; }, "Couldn't change agent pricing")}
        />
      </section>

      <div className="tp-explain"><Info size={16} /><p><strong>How a price is figured:</strong> move size in cubic feet (at least 300) × (base rate + state surcharge). One rate covers the whole load. If the pickup state has a surcharge it applies; otherwise the delivery state&apos;s does. Surcharges never add up.</p></div>

      <BaseRates
        rates={live?.base_rates ?? emptyConfiguration().base_rates}
        firstTime={!live}
        busy={busy}
        onSave={base_rates => saveLive({ ...(live ?? emptyConfiguration()), base_rates }, "Updated base rates", "Base rates saved", true)}
      />

      <section className="tp-card" aria-label="State surcharges">
        <header className="tp-card-head">
          <div>
            <h3>State surcharges</h3>
            <p>An extra amount per cubic foot for moves in certain states. New groups start on.</p>
          </div>
          <span className="tp-count">{groups.filter(g => g.active).length} on · {groups.length} total</span>
        </header>
        <Surcharges
          groups={groups}
          canAdd={!!live}
          busy={busy}
          onSaveGroups={(surcharge_groups, note, success) => saveLive({ ...live!, surcharge_groups }, note, success)}
        />
      </section>

      {revision && <HistoryCard control={production.control} busy={busy} onRestore={item => run(async () => { await restoreRevision(control, item); return `Restored the rates saved ${when(item.created_at)}`; }, "Couldn't restore")} />}

      <div className="tp-scope"><ShieldCheck size={15} /><p>Transportation price only. Fees, the Binding Estimate Fee, discounts and deposits aren&apos;t part of it.</p></div>
    </div>
  );
}

function BaseRates({ rates, firstTime, busy, onSave }: { rates: Configuration["base_rates"]; firstTime: boolean; busy: boolean; onSave: (rates: Configuration["base_rates"]) => Promise<boolean> }) {
  const [texts, setTexts] = useState<RateTexts | null>(firstTime ? toTexts(rates) : null);
  const [saving, setSaving] = useState(false);
  const cells = texts ? MILEAGE.map(band => parseRates(texts[band])) : [];
  const empty = cells.reduce((sum, row) => sum + row.empty, 0);
  const invalid = cells.reduce((sum, row) => sum + row.invalid, 0);

  async function save() {
    if (invalid) { toast.error("Not saved", { description: `${invalid} rate${invalid === 1 ? " isn't a number" : "s aren't numbers"}. Use numbers like 3.25 (marked in red).` }); return; }
    if (empty) { toast.error("Not saved", { description: `${empty} rate${empty === 1 ? " is" : "s are"} empty (marked in yellow). Fill every box; use 0 for no charge.` }); return; }
    setSaving(true);
    const ok = await onSave(Object.fromEntries(MILEAGE.map((band, i) => [band, cells[i].rates])));
    setSaving(false);
    if (ok) setTexts(null);
  }

  return (
    <section className={`tp-card ${texts ? "tp-card-editing" : ""}`} aria-label="Base rates">
      <header className="tp-card-head">
        <div>
          <h3>Base rates</h3>
          <p>Dollars per cubic foot, by distance and move size.</p>
        </div>
        {texts
          ? <span className={`tp-count ${empty || invalid ? "tp-count-warn" : "tp-count-ok"}`}>{56 - empty - invalid} of 56 filled</span>
          : <button type="button" className="tp-button tp-button-primary" disabled={busy} onClick={() => setTexts(toTexts(rates))}><Pencil size={15} />Edit base rates</button>}
      </header>
      <RateTable rates={rates} texts={texts ?? undefined} disabled={saving} onText={(band, tier, value) => setTexts(current => current && { ...current, [band]: { ...current[band], [tier]: value } })} />
      {texts && (
        <footer className="tp-edit-actions">
          {!firstTime && <button type="button" className="tp-button" disabled={saving} onClick={() => setTexts(null)}><X size={15} />Cancel</button>}
          <button type="button" className="tp-button tp-button-primary" disabled={busy || saving} onClick={() => void save()}>{saving ? "Saving…" : <><Check size={15} />Save base rates</>}</button>
        </footer>
      )}
    </section>
  );
}

function Surcharges({ groups, canAdd, busy, onSaveGroups }: { groups: Group[]; canAdd: boolean; busy: boolean; onSaveGroups: (groups: Group[], note: string, success: string) => Promise<boolean> }) {
  const [adding, setAdding] = useState<Group | null>(null);
  return (
    <div className="tp-group-list">
      {groups.length === 0 && !adding && <p className="tp-empty">No state surcharges. Prices use the base rates only.</p>}
      {groups.map((group, index) => (
        <GroupCard
          key={group.group_id ?? index}
          group={group}
          others={groups.filter((_, i) => i !== index)}
          busy={busy}
          onSave={(next, note, success) => onSaveGroups(groups.map((g, i) => i === index ? next : g), note, success)}
          onDelete={async () => {
            if (!window.confirm(`Delete the surcharge group “${group.name}”? Its states go back to base rates only.`)) return;
            await onSaveGroups(groups.filter((_, i) => i !== index), `Deleted surcharge group “${group.name}”`, `Surcharge group “${group.name}” deleted`);
          }}
        />
      ))}
      {adding && (
        <GroupCard
          isNew
          group={adding}
          others={groups}
          busy={busy}
          onCancelNew={() => setAdding(null)}
          onSave={async (next, note, success) => { const ok = await onSaveGroups([...groups, next], note, success); if (ok) setAdding(null); return ok; }}
        />
      )}
      {!adding && <AddGroupButton disabled={busy || !canAdd || groups.length >= 100} onClick={() => setAdding(newGroup())} hint={canAdd ? undefined : "Save your base rates first."} />}
    </div>
  );
}

function HistoryCard({ control, busy, onRestore }: { control: Production["control"]; busy: boolean; onRestore: (revision: Revision) => Promise<boolean> }) {
  const [items, setItems] = useState<Revision[] | null>(null);
  const [error, setError] = useState("");
  async function open() {
    try { setItems((await pricingRequest<{ items: Revision[] }>("revisions?limit=15")).items); setError(""); }
    catch (e) { setError(pricingErrorText(e)); }
  }
  return (
    <details className="tp-card tp-history" onToggle={e => { if ((e.target as HTMLDetailsElement).open) void open(); }}>
      <summary><History size={16} />Earlier versions</summary>
      {error && <p className="tp-muted">{error}</p>}
      {items === null && !error && <p className="tp-muted">Loading…</p>}
      {items?.map(item => {
        const current = item._id === control.active_revision_id;
        return (
          <div className="tp-history-row" key={item._id}>
            <span><strong>{item.change_note}</strong><small>{when(item.created_at)}</small></span>
            {current
              ? <span className="tp-pill-live">Live now</span>
              : <button type="button" className="tp-button" disabled={busy} onClick={() => { if (window.confirm(`Go back to the rates saved ${when(item.created_at)}? They replace the current rates right away.`)) void onRestore(item).then(ok => { if (ok) void open(); }); }}><RotateCcw size={15} />Use these rates</button>}
          </div>
        );
      })}
    </details>
  );
}
