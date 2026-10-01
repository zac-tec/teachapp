import test from "node:test";
import assert from "node:assert/strict";
import { validateEntry, mayWrite } from "../worker/validation.ts";
import {
  authenticate,
  configured,
  cookie,
  roleFor,
  sameOrigin,
  type Env,
} from "../worker/auth.ts";
import { SignJWT } from "jose";
const env = {
  APP_ORIGIN: "https://journal.example.com",
  GOOGLE_CLIENT_ID: "client",
  OWNER_EMAIL: "guide@example.com",
  STUDENT_EMAIL: "student@example.com",
  SESSION_SECRET: "a".repeat(64),
} as Env;
const lesson = {
  id: "lesson-1",
  kind: "lesson",
  revision: 0,
  payload: {
    title: "Variables",
    date: "2026-10-01",
    topics: ["1-1"],
    completed: "Assigned a value",
    independent: "",
    help: "",
    attention: "",
    next: "",
    minutes: 45,
    summary: "",
    code: "print(1)",
    resources: "",
  },
};
test("class validation preserves code and rejects invalid topic IDs", () => {
  assert.equal(validateEntry(lesson).payload.code, "print(1)");
  assert.throws(() =>
    validateEntry({
      ...lesson,
      payload: { ...lesson.payload, topics: ["unknown"] },
    }),
  );
});
test("student cannot change class assessments, but can update projects and reflections", () => {
  assert.equal(mayWrite("student", "lesson"), false);
  assert.equal(mayWrite("student", "topic"), false);
  assert.equal(mayWrite("student", "project"), true);
  assert.equal(mayWrite("student", "reflection"), true);
  assert.equal(mayWrite("teacher", "lesson"), true);
});
test("rejects script links and incorrect revision numbers", () => {
  assert.throws(() =>
    validateEntry({
      id: "p",
      kind: "project",
      revision: 0,
      payload: {
        title: "Project",
        notes: "",
        code: "",
        status: "Planned",
        url: "javascript:alert(1)",
      },
    }),
  );
  assert.throws(() => validateEntry({ ...lesson, revision: -1 }));
});
test("cookie is host-only and secure; origins are exact", () => {
  assert.match(cookie(env, "session", "x", 10), /^__Host-/);
  assert.match(
    cookie(env, "session", "x", 10),
    /HttpOnly; SameSite=Lax; Max-Age=10; Secure/,
  );
  assert.equal(
    sameOrigin(
      new Request(env.APP_ORIGIN, {
        headers: { Origin: "https://attacker.example" },
      }),
      env,
    ),
    false,
  );
  assert.equal(sameOrigin(new Request(env.APP_ORIGIN), env), false);
});
test("account removal immediately invalidates existing sessions", async () => {
  const token = await new SignJWT({ email: "student@example.com" })
    .setSubject("google-user")
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("teachapp")
    .setAudience("session")
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(env.SESSION_SECRET));
  const req = new Request(env.APP_ORIGIN, {
    headers: { Cookie: `__Host-teachapp_session=${token}` },
  });
  assert.equal((await authenticate(req, env))?.role, "student");
  assert.equal(
    await authenticate(req, { ...env, STUDENT_EMAIL: "other@example.com" }),
    null,
  );
  assert.equal(
    await authenticate(
      new Request(env.APP_ORIGIN, {
        headers: { Cookie: "__Host-teachapp_session=forged" },
      }),
      env,
    ),
    null,
  );
});
test("fails closed when hosting is unconfigured or identity is uninvited", () => {
  assert.equal(configured({ ...env, SESSION_SECRET: "" }), false);
  assert.equal(roleFor("attacker@example.com", env), null);
});
