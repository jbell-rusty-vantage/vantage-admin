/** Temporary Owner-authorized pilot, scoped to the signed-in Rep, never the selected desk. */
export const GRANOT_SESSION_PILOT_AGENT = "6a1dc03e419f58fdad44944f";
export const GRANOT_TEST_MESSAGE = "After the job opens, confirm that Granot shows your account and that your usual email templates and controls are available. Let us know if anything looks different.";

export function isGranotSessionPilot(viewer: { role: string; agentId: string | null }): boolean {
  return viewer.role === "rep" && viewer.agentId === GRANOT_SESSION_PILOT_AGENT;
}

/** Accept only an observed Granot job or main-menu URL. No arbitrary origin, path or action. */
export function readGranotSessionContext(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.origin !== "https://eagle.hellomoving.com" || url.pathname !== "/wc.dll" || url.username || url.password || url.hash) return null;
    const match = /^\?(?:mpcharge~chargeswc~|mv~mainmenuwc~)([a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})(?:~LOGIN)?$/i.exec(url.search);
    return match?.[1] ?? null;
  } catch { return null; }
}

export function granotSessionSearch(context: string, jobNo: string | null | undefined): { action: string; job: string } | null {
  if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(context)) return null;
  // The observed native QuickSearch takes the numeric portion of Granot's P-prefixed job.
  const job = /^P?(\d{1,20})$/i.exec(jobNo?.trim() ?? "")?.[1];
  return job ? { action: `https://eagle.hellomoving.com/wc.dll?mv~searchret~${context}~QSEARCH`, job } : null;
}
