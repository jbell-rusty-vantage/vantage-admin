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

export function isSearchableGranotJob(jobNo: string | null | undefined): boolean {
  return /^P?\d{1,20}$/i.test(jobNo?.trim() ?? "");
}
