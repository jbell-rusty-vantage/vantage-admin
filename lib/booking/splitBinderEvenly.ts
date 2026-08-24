/**
 * Mirrors vantage-main-server `splitBinderEvenly`: integer cents, leftover
 * cent to the primary Agent.
 */
export function splitBinderEvenly(totalAmount: number, agentCount: 1 | 2): number[] {
  const totalCents = Math.round(totalAmount * 100);
  if (agentCount === 1) {
    return [totalCents / 100];
  }
  const secondaryCents = Math.floor(totalCents / 2);
  return [(totalCents - secondaryCents) / 100, secondaryCents / 100];
}
