"use client";

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { GRANOT_TEST_MESSAGE, isGranotSessionPilot, readGranotSessionContext } from "../lib/granot-session-pilot";

export const GranotSessionContext = createContext<{ context: string | null; disconnect?: () => void } | null>(null);
export const useGranotSession = () => useContext(GranotSessionContext);

/** Browser retention is memory only. Explicit opening sends the context transiently for server identity checking. */
export function GranotSessionPilot({ viewer, children }: { viewer: { role: string; agentId: string | null }; children: ReactNode }) {
  if (!isGranotSessionPilot(viewer)) return children;
  return <JoshGranotSession key={`${viewer.role}:${viewer.agentId}`}>{children}</JoshGranotSession>;
}

function JoshGranotSession({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  useEffect(() => {
    if (!context) return;
    const timeout = setTimeout(() => setContext(null), 15 * 60_000);
    return () => clearTimeout(timeout);
  }, [context]);
  return <GranotSessionContext value={{ context, disconnect: () => setContext(null) }}>
    <section className="od-card" aria-label="Granot account test" style={{ margin: 12, padding: 12, flexShrink: 0 }}>
      <strong>Granot account test · Josh</strong>
      <p className="od-lead__muted">{GRANOT_TEST_MESSAGE}</p>
      {context ? <div>
        <p role="status" className="od-lead__muted">URL prepared. Your Granot account has not been verified yet; it will be checked when you open a job. This test connection clears after 15 minutes or when you reload.</p>
        <button type="button" className="od-button od-button--quiet" onClick={() => { setContext(null); setUrl(""); setError(null); }}>Disconnect Granot session</button>
      </div> : <form onSubmit={(event) => {
        event.preventDefault();
        const next = readGranotSessionContext(url);
        if (!next) { setError("Paste a job-page or main-menu URL from eagle.hellomoving.com after signing in to your own Granot account."); return; }
        setContext(next); setUrl(""); setError(null);
      }}>
        <p className="od-lead__muted">Sign in to your own Granot account in this browser, open any job normally inside Granot, then paste that job page’s URL here. Do not use a link opened by an older Outreach button.</p>
        <p className="od-lead__muted">When you open a job, Outreach sends this session identifier to our server to verify your Granot username and find the job. It is not saved. This tab forgets it after 15 minutes or when you reload. Do not paste a password.</p>
        <label htmlFor={id} className="od-lead__muted">Your signed-in Granot job URL</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <input id={id} className="od-input" type="url" value={url} onChange={(event) => setUrl(event.target.value)} autoComplete="off" spellCheck={false} required style={{ flex: "1 1 240px" }} />
          <button type="submit" className="od-button">Use my Granot session</button>
        </div>
        {error ? <p role="alert" className="od-lead__error">{error}</p> : null}
      </form>}
    </section>
    {children}
  </GranotSessionContext>;
}
