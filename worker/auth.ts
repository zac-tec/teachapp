import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
export interface Env {
  DB: D1Database;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_USERNAME?: string;
  APP_ORIGIN: string;
  GOOGLE_CLIENT_ID: string;
  OWNER_EMAIL: string;
  STUDENT_EMAIL: string;
  SESSION_SECRET: string;
}
export type User = { sub: string; email: string; role: "teacher" | "student" };
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const encoder = new TextEncoder();
export function configured(env: Env) {
  return Boolean(
    env.APP_ORIGIN &&
    env.GOOGLE_CLIENT_ID &&
    env.OWNER_EMAIL &&
    env.STUDENT_EMAIL &&
    env.SESSION_SECRET?.length >= 32 &&
    !env.SESSION_SECRET.startsWith("REPLACE_"),
  );
}
export function roleFor(email: string, env: Env): User["role"] | null {
  const value = email.toLowerCase();
  if (value === env.OWNER_EMAIL?.trim().toLowerCase()) return "teacher";
  if (value === env.STUDENT_EMAIL?.trim().toLowerCase()) return "student";
  return null;
}
export function sameOrigin(req: Request, env: Env) {
  return req.headers.get("Origin") === env.APP_ORIGIN;
}
function cookieName(env: Env, kind: string) {
  return `${env.APP_ORIGIN.startsWith("https:") ? "__Host-" : ""}teachapp_${kind}`;
}
export function readCookie(req: Request, env: Env, kind: string) {
  const prefix = cookieName(env, kind) + "=";
  return (req.headers.get("Cookie") || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(prefix))
    ?.slice(prefix.length);
}
export function cookie(env: Env, kind: string, value: string, age: number) {
  return `${cookieName(env, kind)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${env.APP_ORIGIN.startsWith("https:") ? "; Secure" : ""}`;
}
async function sign(
  payload: Record<string, unknown>,
  env: Env,
  audience: string,
  expiry: string,
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("teachapp")
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(encoder.encode(env.SESSION_SECRET));
}
export async function newChallenge(env: Env) {
  const nonce = crypto.randomUUID();
  const token = await sign({ nonce }, env, "login", "10m");
  return { nonce, token };
}
export async function verifyGoogle(
  credential: string,
  nonce: string,
  env: Env,
) {
  const { payload } = await jwtVerify(credential, googleKeys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.GOOGLE_CLIENT_ID,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "sub", "email", "email_verified", "nonce"],
  });
  if (
    payload.nonce !== nonce ||
    payload.email_verified !== true ||
    typeof payload.email !== "string" ||
    !payload.sub
  )
    throw Error("Invalid Google identity");
  const role = roleFor(payload.email, env);
  if (!role) throw Error("Account not allowed");
  return { sub: payload.sub, email: payload.email, role };
}
export async function login(req: Request, credential: string, env: Env) {
  const challenge = readCookie(req, env, "login");
  if (!challenge) throw Error("Please reload the sign-in screen");
  const { payload } = await jwtVerify(
    challenge,
    encoder.encode(env.SESSION_SECRET),
    {
      issuer: "teachapp",
      audience: "login",
      algorithms: ["HS256"],
      requiredClaims: ["exp", "nonce"],
    },
  );
  if (typeof payload.nonce !== "string") throw Error("Invalid challenge");
  const user = await verifyGoogle(credential, payload.nonce, env);
  const token = await sign(
    { sub: user.sub, email: user.email },
    env,
    "session",
    "7d",
  );
  return { user, token };
}
export async function authenticate(
  req: Request,
  env: Env,
): Promise<User | null> {
  const token = readCookie(req, env, "session");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      encoder.encode(env.SESSION_SECRET),
      {
        issuer: "teachapp",
        audience: "session",
        algorithms: ["HS256"],
        requiredClaims: ["exp", "sub", "email"],
      },
    );
    if (typeof payload.email !== "string" || !payload.sub) return null;
    const role = roleFor(payload.email, env);
    return role ? { sub: payload.sub, email: payload.email, role } : null;
  } catch {
    return null;
  }
}
