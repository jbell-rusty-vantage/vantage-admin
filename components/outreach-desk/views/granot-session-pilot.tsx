"use client";

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { GRANOT_TEST_MESSAGE, isGranotSessionPilot, readGranotSessionContext } from "../lib/granot-session-pilot";

export const GranotSessionContext = createContext<{ context: string | null } | null>(null);
export const useGranotSession = () => useContext(GranotSessionContext);

/** Session material lives only in this mounted signed-in viewer's React state; never sent to Vantage. */
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
    const timeout = setTimeout(() => setContext(null), 90_000);
    return () => clearTimeout(timeout);
  }, [context]);
  return <GranotSessionContext value={{ context }}>
    <section className="od-card" aria-label="Granot account test" style={{ margin: 12, padding: 12, flexShrink: 0 }}>
      <strong>Granot account test · Josh</strong>
      <p className="od-lead__muted">{GRANOT_TEST_MESSAGE}</p>
      {context ? <div>
        <p role="status" className="od-lead__muted">Ready for a quick test. Open a job from a row or the side panel now. This test connection clears after 90 seconds. If Granot rejects it, sign in again before reconnecting.</p>
        <button type="button" className="od-button od-button--quiet" onClick={() => { setContext(null); setUrl(""); setError(null); }}>Disconnect Granot session</button>
      </div> : <form onSubmit={(event) => {
        event.preventDefault();
        const next = readGranotSessionContext(url);
        if (!next) { setError("Paste a job-page or main-menu URL from eagle.hellomoving.com after signing in to your own Granot account."); return; }
        setContext(next); setUrl(""); setError(null);
      }}>
        <p className="od-lead__muted">For this test, sign in again to your own Granot account in this browser, open any job normally, then immediately paste that job page’s URL here. It stays only in this Outreach tab and clears after 90 seconds or when you reload. Do not paste a password.</p>
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
