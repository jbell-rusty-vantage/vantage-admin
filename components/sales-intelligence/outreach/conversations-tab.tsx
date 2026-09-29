"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useOutreach } from "../data/use-outreach";
import { siKeys } from "../data/query-keys";
import { Region } from "../primitives";
import { ConversationsSection, ConversationsSkeleton } from "./analysis/conversations";
import { numberIdOf } from "./record-header";
import { useLandOnHash } from "./land-on-hash";
import { useEffect, useRef, useState } from "react";
import { scrollToSegments } from "./analysis/transcript";
import { copy } from "../sales-intelligence-copy";

function ConversationsBody({ id }: { id: string }) {
  const { outreach } = useOutreach(id);
  const client = useQueryClient();
  const numberId = numberIdOf(outreach);
  const root = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<"human" | "all">("human");
  useLandOnHash(root);
  useEffect(() => {
    const land = () => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("sid");
    const match = /^#(?:conv-|si-conversation-)(.+)$/.exec(window.location.hash);
    const conversationId = params.get("conversation_id") ?? params.get("conv") ?? (match ? decodeURIComponent(match[1]) : null);
    if (conversationId) { setFilter("all"); scrollToSegments(conversationId, sid ? sid.split(",").filter(Boolean) : []); }
    };
    land();
    window.addEventListener("hashchange", land);
    return () => window.removeEventListener("hashchange", land);
  }, []);
  return <div ref={root} id="conversations" className="si-conversations-tab">
    <div className="si-conversations-tab__filters" role="group" aria-label={copy.oi.page.tabs.conversations}>
      <button type="button" className="si-btn si-btn--secondary si-hit" aria-pressed={filter === "human"} onClick={() => setFilter("human")}>{copy.oi.page.conversationFilter}</button>
      <button type="button" className="si-btn si-btn--secondary si-hit" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>{copy.oi.page.allCalls}</button>
    </div>
    <ConversationsSection numberId={numberId} filter={filter} onRetry={() => { if (numberId) void client.resetQueries({ queryKey: siKeys.conversations(numberId) }); }} />
  </div>;
}

export function ConversationsTab({ id }: { id: string }) {
  const client = useQueryClient();
  return <Region name="outreach-conversations" skeleton={<ConversationsSkeleton />} onRetry={() => void client.resetQueries({ queryKey: siKeys.outreach(id) })}><ConversationsBody id={id} /></Region>;
}
