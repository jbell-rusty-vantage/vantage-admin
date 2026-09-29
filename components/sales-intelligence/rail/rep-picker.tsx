"use client";
import { useId, useState } from "react";
import type { DeskUrlPatch, DeskUrlState } from "../data/url-state";
import type { RailRep } from "./regions";

export function RepPicker({ value, reps, onChange, available }: { value: DeskUrlState; reps: readonly RailRep[]; onChange: (patch: DeskUrlPatch) => void; available: boolean }) {
  const id = useId();
  const [search, setSearch] = useState("");
  const selected = value.assignment === "unassigned" ? "unassigned" : value.assigned_agent_id[0] ?? "";
  const options = reps.filter((rep) => rep.name.toLowerCase().includes(search.toLowerCase()) || rep.id === selected);
  return <div className="si-searchctl" data-control="assigned-rep">
    <label htmlFor={id}>Assigned rep</label>
    <input aria-label="Search sales roster" className="si-input" placeholder="Find a rep" value={search} disabled={!available} onChange={(event) => setSearch(event.target.value)} />
    <select id={id} className="si-input si-select" value={selected} disabled={!available} onChange={(event) => onChange(event.target.value === "unassigned" ? { assigned_agent_id: [], assignment: "unassigned" } : { assigned_agent_id: event.target.value ? [event.target.value] : [], assignment: null })}>
      <option value="">All</option><option value="unassigned">Unassigned</option>
      {options.map((rep) => <option key={rep.id} value={rep.id}>{rep.name}{!rep.active ? " (inactive)" : ""}</option>)}
      {!!selected && selected !== "unassigned" && !options.some((rep) => rep.id === selected) && <option value={selected}>Unknown rep</option>}
    </select>
    {!available && <small>Not available yet</small>}
  </div>;
}
