"use client";
/** The client root the route page mounts (the `.si-route` scroll wrapper around the desk). */
import { Desk } from "@/components/sales-intelligence/desk";
import "@/components/sales-intelligence/styles/sales-intelligence.css";

export function DeskRoot() {
  return (
    <div className="si-root si-route">
      <Desk />
    </div>
  );
}
