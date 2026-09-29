"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CommandDialog } from "../command-dialog";
import { MessageRepPanel, useMessageRepAvailability } from "../composer";
import { useOutreach } from "../data/use-outreach";
import { siKeys } from "../data/query-keys";
import { Region, SkeletonBlock } from "../primitives";
import { useIsRep } from "../rep/viewer";
import { copy } from "../sales-intelligence-copy";
import { RecordCommands } from "./commands";
import { WorkTab } from "./work-tab";
import { useLandOnHash } from "./land-on-hash";

const p = copy.oi.page;

function OwnerCommands({ id }: { id: string }) {
  const { outreach, asOf } = useOutreach(id);
  const availability = useMessageRepAvailability(outreach);
  const [command, setCommand] = useState<string | null>(null);
  const [messaging, setMessaging] = useState(false);
  return <>
    <RecordCommands record={{ ...outreach, allowed_actions: outreach.allowed_actions.filter((item) => item.action !== "assign") }} onCommand={setCommand} onMessageRep={() => setMessaging(true)} messageRepDisabledReason={availability.disabledReason} />
    {command && <CommandDialog key={`${command}:${outreach.id}`} command={command} record={outreach} onClose={() => setCommand(null)} />}
    {messaging && <MessageRepPanel key={outreach.id} outreach={outreach} asOf={asOf} mode="panel" onClose={() => setMessaging(false)} />}
  </>;
}

function WorkRailLoaded({ id, returnTo }: { id: string; returnTo: string }) {
  const { outreach } = useOutreach(id);
  const client = useQueryClient();
  const rep = useIsRep();
  const active = outreach.followups.some((item) => item.status === "open") || !!outreach.derived.review_badges?.length;
  const root = useRef<HTMLDetailsElement>(null);
  const [desktop, setDesktop] = useState(true);
  useLandOnHash(root);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1100px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => { if (window.location.hash === "#work" && root.current) { root.current.open = true; root.current.querySelector("summary")?.focus(); } }, []);
  return <details ref={root} id="work" className="si-workrail" open={desktop || active}>
    <summary className="si-workrail__summary" onClick={(event) => { if (desktop) event.preventDefault(); }}><span className="si-heading si-heading--3">{p.work}</span><span className="si-workrail__hint">{outreach.next_action?.description ?? p.noNextStep}</span></summary>
    <div className="si-workrail__body">
      <WorkTab id={id} returnTo={returnTo} />
      {!rep && <Region name="work-commands" skeleton={<SkeletonBlock height={88} />} onRetry={() => void client.resetQueries({ queryKey: siKeys.outreach(id) })}><OwnerCommands id={id} /></Region>}
    </div>
  </details>;
}

export function WorkRail({ id, returnTo }: { id: string; returnTo: string }) {
  const client = useQueryClient();
  const retry = () => void client.resetQueries({ queryKey: siKeys.outreach(id) });
  return <aside className="si-outreach__rail" aria-label={p.work}><Region name="work-rail" skeleton={<WorkRailSkeleton />} onRetry={retry}><WorkRailLoaded id={id} returnTo={returnTo} /></Region></aside>;
}

export function WorkRailSkeleton() { return <div className="si-workrail" aria-hidden><SkeletonBlock height={36} /><SkeletonBlock height={180} /></div>; }
