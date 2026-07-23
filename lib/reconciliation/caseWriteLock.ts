export async function runWithCaseWriteLock<Result>(
  pendingCaseIds: Set<string>,
  caseId: string,
  operation: () => Promise<Result>,
  onChange: (pendingCaseIds: Set<string>) => void,
): Promise<Result> {
  if (pendingCaseIds.has(caseId)) {
    throw new Error("Another update for this case is still in progress.");
  }

  pendingCaseIds.add(caseId);
  onChange(new Set(pendingCaseIds));
  try {
    return await operation();
  } finally {
    pendingCaseIds.delete(caseId);
    onChange(new Set(pendingCaseIds));
  }
}
