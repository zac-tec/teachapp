import {
  authenticate,
  configured,
  cookie,
  login,
  newChallenge,
  sameOrigin,
  type Env,
} from "./auth.ts";
import { InvalidEntry, mayWrite, validateEntry } from "./validation.ts";
function json(body: unknown, status = 200, headers?: Headers) {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  h.set("Cache-Control", "no-store");
  h.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(body), { status, headers: h });
}
async function body(req: Request) {
  if (!req.headers.get("Content-Type")?.startsWith("application/json"))
    throw new InvalidEntry("Send JSON.");
  const reader = req.body?.getReader();
  if (!reader) throw new InvalidEntry("Missing request.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 150000) {
      await reader.cancel();
      throw new InvalidEntry("This entry is too large.");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(result));
  } catch {
    throw new InvalidEntry("Invalid JSON.");
  }
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const path = new URL(req.url).pathname;
    try {
      if (path === "/api/health") return json({ status: "ok" });
      if (!configured(env))
        return json(
          {
            error:
              "Sign-in is not configured yet. Complete the hosting setup first.",
          },
          503,
        );
      if (!["GET", "POST"].includes(req.method))
        return json({ error: "Method not allowed." }, 405);
      if (req.method === "POST" && !sameOrigin(req, env))
        return json({ error: "Request origin is not allowed." }, 403);
      if (path === "/api/auth/config" && req.method === "GET") {
        const { nonce, token } = await newChallenge(env);
        return json(
          { clientId: env.GOOGLE_CLIENT_ID, nonce },
          200,
          new Headers({ "Set-Cookie": cookie(env, "login", token, 600) }),
        );
      }
      if (path === "/api/auth/google" && req.method === "POST") {
        const data = await body(req);
        if (
          typeof data.credential !== "string" ||
          data.credential.length > 16000
        )
          return json({ error: "Missing Google sign-in response." }, 400);
        try {
          const { user, token } = await login(req, data.credential, env);
          const h = new Headers();
          h.append("Set-Cookie", cookie(env, "session", token, 604800));
          h.append("Set-Cookie", cookie(env, "login", "", 0));
          return json({ user }, 200, h);
        } catch {
          return json(
            {
              error:
                "Sign-in failed. Use an invited account, or reload and try again.",
            },
            401,
          );
        }
      }
      if (path === "/api/auth/logout" && req.method === "POST") {
        const h = new Headers();
        h.append("Set-Cookie", cookie(env, "session", "", 0));
        h.append("Set-Cookie", cookie(env, "login", "", 0));
        return json({ ok: true }, 200, h);
      }
      const user = await authenticate(req, env);
      if (!user) return json({ error: "Please sign in." }, 401);
      if (path !== "/api/journey") return json({ error: "Not found." }, 404);
      if (req.method === "GET") {
        const rows = await env.DB.prepare(
          "SELECT * FROM records ORDER BY updated DESC",
        ).all();
        return json({
          user,
          records: rows.results.map((r: any) => ({
            ...r,
            payload: JSON.parse(r.payload),
          })),
        });
      }
      const { id, kind, payload, revision } = validateEntry(await body(req));
      if (!mayWrite(user.role, kind))
        return json(
          { error: "Only the guide can edit assessments and class records." },
          403,
        );
      if (kind === "reflection") {
        const row = await env.DB.prepare(
          "SELECT id FROM records WHERE id = ? AND kind = ?",
        )
          .bind(payload.lessonId, "lesson")
          .first();
        if (!row) return json({ error: "Class not found." }, 400);
      }
      const now = new Date().toISOString();
      const result =
        revision === 0
          ? await env.DB.prepare(
              "INSERT INTO records (id,kind,payload,revision,updated) VALUES (?,?,?,1,?) ON CONFLICT(id) DO NOTHING",
            )
              .bind(id, kind, JSON.stringify(payload), now)
              .run()
          : await env.DB.prepare(
              "UPDATE records SET payload = ?, revision = revision + 1, updated = ? WHERE id = ? AND kind = ? AND revision = ?",
            )
              .bind(JSON.stringify(payload), now, id, kind, revision)
              .run();
      if (result.meta.changes === 0)
        return json(
          {
            error:
              "This entry changed in another session. Reload saved data before reopening it for editing; your unsaved text is still here.",
          },
          409,
        );
      return json({
        record: { id, kind, payload, revision: revision + 1, updated: now },
      });
    } catch (error) {
      if (error instanceof InvalidEntry)
        return json({ error: error.message }, 400);
      console.error(
        "Journal request failed",
        error instanceof Error ? error.name : "UnknownError",
      );
      return json(
        {
          error:
            "The journal is temporarily unavailable. Your unsaved text is still here; please try again.",
        },
        503,
      );
    }
  },
};
