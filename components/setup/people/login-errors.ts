/**
 * A refusal from the dashboard-login routes, as the sheets print it. `code` picks the sentence (the rules live in
 * `users-logic.ts`, kept as they were); the one sentence that named an engineering setting says it in Owner words here.
 */
import { UsersApiError } from "@/components/operations-registry/users/users-api";
import { codeField, errorSentence, issueFieldErrors, type FieldErrors } from "@/components/operations-registry/users/users-logic";
import { PEOPLE_COPY } from "./people-copy";

export function loginSentence(code: string): string {
  return code === "not_configured" ? PEOPLE_COPY.loginSheet.inviteNotSetUp : errorSentence(code);
}

export const loginErrorCode = (error: unknown): string => (error instanceof UsersApiError ? error.code : "network_error");

/** A refusal → the sentence and the fields it marks (from `issues[]` and from the code). */
export function refusalState(error: unknown): { sentence: string; fields: FieldErrors } {
  if (error instanceof UsersApiError) {
    const fields = issueFieldErrors(error.issues);
    const field = codeField(error.code);
    const sentence = loginSentence(error.code);
    if (field && !fields[field]) fields[field] = sentence;
    return { sentence, fields };
  }
  return { sentence: errorSentence("generic"), fields: {} };
}
