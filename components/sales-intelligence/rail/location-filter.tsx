"use client";
import { useRef, useState, type FormEvent } from "react";
import type { DeskUrlPatch, DeskUrlState } from "../data/url-state";

const states = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ");
export function LocationFilter({ value, onChange, available }: { value: DeskUrlState; onChange: (patch: DeskUrlPatch) => void; available: boolean }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const [side, setSide] = useState<string>(value.loc_side ?? "either");
  const [city, setCity] = useState(value.loc_city ?? "");
  const [state, setState] = useState(value.loc_state ?? "");
  const [zip, setZip] = useState(value.loc_zip ?? "");
  const valid = (!zip || /^\d{5}$/.test(zip)) && (city.trim().length <= 100) && !!(city.trim() || state || zip);
  const apply = (event: FormEvent) => { event.preventDefault(); if (valid) { onChange({ loc_side: side as DeskUrlState["loc_side"], loc_city: city.trim() || null, loc_state: state || null, loc_zip: zip || null }); if (disclosure.current) disclosure.current.open = false; } };
  const selected = [value.loc_city, value.loc_state, value.loc_zip].filter(Boolean).join(", ");
  return <details ref={disclosure} className="si-searchctl si-searchctl__compact" data-control="location">
    <summary aria-disabled={!available} onClick={(event) => { if (!available) event.preventDefault(); }}><span>Location</span><strong>{available ? selected || "Any" : "Not available yet"}</strong></summary>
    <form className="si-searchctl__location si-searchctl__panel" onSubmit={apply}>
    <select aria-label="Location side" className="si-input si-select" value={side} disabled={!available} onChange={(event) => setSide(event.target.value)}><option value="either">Either</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select>
    <input aria-label="City contains" className="si-input" placeholder="City" maxLength={100} value={city} disabled={!available} onChange={(event) => setCity(event.target.value)} />
    <select aria-label="State" className="si-input si-select" value={state} disabled={!available} onChange={(event) => setState(event.target.value)}><option value="">State</option>{states.map((item) => <option key={item} value={item}>{item}</option>)}</select>
    <input aria-label="ZIP" className="si-input" inputMode="numeric" placeholder="ZIP" maxLength={5} value={zip} disabled={!available} onChange={(event) => setZip(event.target.value)} />
    <button type="submit" className="si-btn si-btn--secondary si-hit" disabled={!available || !valid}>Apply</button>
    {!available && <small>Not available yet</small>}
    </form>
  </details>;
}
