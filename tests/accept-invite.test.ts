import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AcceptInviteView, initialAcceptState, type AcceptViewState } from "../app/accept-invite/accept-invite-view";
import { acceptInviteResultSchema, parseUsersBody, UsersApiError } from "../components/operations-registry/users/users-api";
import { acceptOutcome, acceptProblem, readInviteToken } from "../components/operations-registry/users/users-logic";
import { copy } from "../components/sales-intelligence/sales-intelligence-copy";
import { fixtureTest, requireContracts } from "./sales-intelligence/contracts-dir";

/*
 * UI2-USERS: the public /accept-invite page (UI-2 §8, UI2-A13). The token comes from `location.hash` only;
 * the states render from the S8 accept-invite fixtures. Static markup, no DOM.
 */

const a = copy.ui2.acceptInvite;
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const render = (state: Partial<AcceptViewState>) => decode(renderToStaticMarkup(createElement(AcceptInviteView, { state: { ...initialAcceptState, ...state } })));
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";
type Fixture = { status: number; body: unknown };
const fixture = (name: string): Fixture =>
  JSON.parse(fs.readFileSync(path.join(requireContracts(), "S8", "admin-users", `${name}.json`), "utf8")) as Fixture;

/** The page state a fixture response leads to (the client's own mapping). */
function phaseFor(name: string): Partial<AcceptViewState> {
  const { status, body } = fixture(name);
  try {
    parseUsersBody(status, body, acceptInviteResultSchema);
    return { phase: "success" };
  } catch (error) {
    assert.ok(error instanceof UsersApiError);
    const outcome = acceptOutcome(error.code);
    return outcome === "invalid" ? { phase: "invalid" } : { phase: "form", password: "x", confirm: "x", error: outcome };
  }
}

test("the token is read from the fragment only and must be 43 base64url characters", () => {
  assert.equal(TOKEN.length, 43);
  assert.equal(readInviteToken(`#token=${TOKEN}`), TOKEN);
  assert.equal(readInviteToken(""), null, "no hash → malformed");
  assert.equal(readInviteToken("#"), null);
  assert.equal(readInviteToken("#token="), null);
  assert.equal(readInviteToken(`#token=${TOKEN.slice(1)}`), null, "42 characters");
  assert.equal(readInviteToken(`#token=${TOKEN.slice(1)}+`), null, "not base64url");
  assert.equal(readInviteToken(`?token=${TOKEN}`.replace("?", "#x=1&")), TOKEN, "other fragment params are ignored");
});

test("no hash → malformed with no form; a token → the form with the policy and Set password disabled until both are filled", () => {
  const malformed = render({ phase: "malformed" });
  assert.ok(malformed.includes(a.states.malformed));
  assert.ok(!malformed.includes("<form") && !malformed.includes('type="password"'));

  const form = render({ phase: "form" });
  assert.ok(form.includes("<form") && form.split('type="password"').length - 1 === 2);
  assert.ok(form.includes(a.policy) && form.includes(a.password) && form.includes(a.confirm) && form.includes(a.intro));
  assert.match(form, /<button[^>]*disabled=""[^>]*>Set password<\/button>/);
  assert.match(render({ phase: "form", password: "one" }), /<button[^>]*disabled=""[^>]*>Set password<\/button>/);
  assert.doesNotMatch(render({ phase: "form", password: "one", confirm: "two" }), /<button[^>]*disabled=""[^>]*>Set password</);
  assert.ok(render({ phase: "form", password: "p", confirm: "p", submitting: true }).includes(a.submitting));
});

fixtureTest("accept-invite__used / __expired / __malformed-token → states.invalid (no form)", () => {
  for (const name of ["accept-invite__used", "accept-invite__expired", "accept-invite__malformed-token"]) {
    const out = render(phaseFor(name));
    assert.ok(out.includes(a.states.invalid), name);
    assert.ok(!out.includes("<form"), name);
  }
});

fixtureTest("accept-invite__weak-password → states.weak on the form", () => {
  const out = render(phaseFor("accept-invite__weak-password"));
  assert.ok(out.includes(a.states.weak) && out.includes("<form") && out.includes('aria-invalid="true"'));
});

fixtureTest("accept-invite__success → the success sentence and Go to sign in → /login", () => {
  const out = render(phaseFor("accept-invite__success"));
  assert.ok(out.includes(a.success));
  assert.equal(a.success, "Password set. Sign in with your email and new password.");
  assert.match(out, /<a[^>]*href="\/login"[^>]*>Go to sign in<\/a>/);
  assert.ok(!("successManual" in a), "successManual is gone");
});

test("client checks: weak first, then mismatch; 60 two-byte characters are over 72 bytes", () => {
  assert.equal(acceptProblem("short", "short"), "weak");
  assert.equal(acceptProblem("long-enough-1", "long-enough-2"), "mismatch");
  assert.equal(acceptProblem("long-enough-1", "long-enough-1"), null);
  const twoByte = "ü".repeat(60);
  assert.equal(acceptProblem(twoByte, twoByte), "weak");
  assert.ok(render({ phase: "form", password: "a", confirm: "b", error: "mismatch" }).includes(a.states.mismatch));
  assert.equal(acceptOutcome("network_error"), "generic");
  assert.ok(render({ phase: "form", error: "generic" }).includes(a.states.generic));
});

test("the page never reads the query string, never logs, and clears the fragment after reading it", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app/accept-invite/accept-invite-client.tsx"), "utf8");
  assert.ok(source.includes("window.location.hash") && source.includes("history.replaceState"));
  assert.ok(!/location\.search\)|searchParams|useSearchParams/.test(source.replace("${window.location.search}", "")), "no query-string token");
  assert.ok(!/console\./.test(source), "no logging");
});
