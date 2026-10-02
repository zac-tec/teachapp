import { EncryptJWT, jwtDecrypt, SignJWT, jwtVerify } from "jose";
import { cookie, readCookie, type Env, type User } from "./auth.ts";
import { InvalidEntry } from "./validation.ts";
const encoder = new TextEncoder();
const respond = (data: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
const key = async (env: Env) =>
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(env.SESSION_SECRET)),
  );
export function validPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.length < 240 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !/[\x00-\x1f]/.test(path) &&
    path
      .split("/")
      .every(
        (p) =>
          !!p &&
          ![".", "..", ".git", "node_modules", ".venv", "__pycache__"].includes(
            p,
          ) &&
          !/^\.env(?:\.|$)/i.test(p) &&
          !/(?:\.pem|\.key|credentials\.json)$/i.test(p),
      ) &&
    !path.startsWith(".github/")
  );
}
export function validateFiles(
  files: unknown,
): { path: string; content: string }[] {
  if (!Array.isArray(files) || !files.length || files.length > 50)
    throw new InvalidEntry("Save 1–50 text files at a time.");
  const seen = new Set();
  let size = 0;
  for (const f of files) {
    if (
      !f ||
      !validPath(f.path) ||
      seen.has(f.path) ||
      typeof f.content !== "string" ||
      f.content.includes("\0")
    )
      throw new InvalidEntry(
        "Check the file paths. Secret files, workflows and generated folders are excluded.",
      );
    if (
      /-----BEGIN .*PRIVATE KEY-----|(?:gh[pousr]_[A-Za-z0-9]{20,})|github_pat_[A-Za-z0-9_]{20,}/.test(
        f.content,
      )
    )
      throw new InvalidEntry(
        "Remove the credential from your file before publishing.",
      );
    size += encoder.encode(f.content).length;
    seen.add(f.path);
  }
  if (size > 100000) throw new InvalidEntry("Keep each commit under 100 KB.");
  return files;
}
async function api(
  token: string,
  path: string,
  method = "GET",
  data?: unknown,
) {
  const r = await fetch("https://api.github.com" + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "User-Agent": "Teachapp",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!r.ok)
    throw new InvalidEntry(
      r.status === 401
        ? "Reconnect GitHub to continue."
        : r.status === 403
          ? "GitHub denied this request. Check account access or try later."
          : r.status === 422
            ? "GitHub could not save this change. The repository name may be taken, or its branch has changed."
            : "GitHub request failed. Please try again.",
    );
  return r.status === 204 ? {} : ((await r.json()) as any);
}
export async function github(
  req: Request,
  env: Env,
  user: User,
  body: () => Promise<any>,
) {
  const url = new URL(req.url),
    path = url.pathname;
  if (user.role !== "student")
    return respond(
      {
        error:
          "Sign in with the student account to connect and edit GitHub projects.",
      },
      403,
    );
  const row = await env.DB.prepare(
    "SELECT login,token FROM github_connections WHERE user_sub=?",
  )
    .bind(user.sub)
    .first<{ login: string; token: string }>();
  const configured = !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_USERNAME);
  if (path === "/api/github/status")
    return respond({
      configured,
      connected: !!row,
      login: row?.login,
      expected: env.GITHUB_USERNAME || "tompaul1027-droid",
    });
  if (path === "/api/github/disconnect" && req.method === "POST") {
    await env.DB.prepare("DELETE FROM github_connections WHERE user_sub=?")
      .bind(user.sub)
      .run();
    return respond({ ok: true });
  }
  if (!configured)
    return respond(
      { error: "The guide needs to finish the one-time GitHub app setup." },
      503,
    );
  if (path === "/api/github/connect" && req.method === "POST") {
    const state = crypto.randomUUID(),
      verifier = crypto.randomUUID() + crypto.randomUUID();
    const token = await new SignJWT({ state, verifier, sub: user.sub })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("github-connect")
      .setExpirationTime("10m")
      .sign(encoder.encode(env.SESSION_SECRET));
    const challenge = btoa(
      String.fromCharCode(
        ...new Uint8Array(
          await crypto.subtle.digest("SHA-256", encoder.encode(verifier)),
        ),
      ),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const target = new URL("https://github.com/login/oauth/authorize");
    target.search = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID!,
      redirect_uri: env.APP_ORIGIN + "/api/github/callback",
      scope: "public_repo",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      login: env.GITHUB_USERNAME || "tompaul1027-droid",
    }).toString();
    return respond({ url: target.toString() }, 200, {
      "Set-Cookie": cookie(env, "github", token, 600),
    });
  }
  if (path === "/api/github/callback" && req.method === "GET") {
    try {
      const saved = readCookie(req, env, "github");
      if (!saved) throw Error();
      const { payload } = await jwtVerify(
        saved,
        encoder.encode(env.SESSION_SECRET),
        { algorithms: ["HS256"], audience: "github-connect" },
      );
      if (
        payload.sub !== user.sub ||
        payload.state !== url.searchParams.get("state") ||
        !url.searchParams.get("code")
      )
        throw Error();
      const r = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: url.searchParams.get("code"),
          redirect_uri: env.APP_ORIGIN + "/api/github/callback",
          code_verifier: payload.verifier,
        }),
      });
      const t: any = await r.json();
      if (!t.access_token) throw Error();
      const account = await api(t.access_token, "/user");
      if (
        account.login.toLowerCase() !==
        (env.GITHUB_USERNAME || "tompaul1027-droid").toLowerCase()
      )
        throw Error();
      const encrypted = await new EncryptJWT({ token: t.access_token })
        .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
        .setSubject(user.sub)
        .encrypt(await key(env));
      await env.DB.prepare(
        "INSERT INTO github_connections(user_sub,login,token) VALUES(?,?,?) ON CONFLICT(user_sub) DO UPDATE SET login=excluded.login,token=excluded.token",
      )
        .bind(user.sub, account.login, encrypted)
        .run();
      return new Response(null, {
        status: 302,
        headers: {
          Location: env.APP_ORIGIN + "/#github",
          "Cache-Control": "no-store",
          "Set-Cookie": cookie(env, "github", "", 0),
        },
      });
    } catch {
      return new Response(null, {
        status: 302,
        headers: {
          Location: env.APP_ORIGIN + "/?github=failed#github",
          "Set-Cookie": cookie(env, "github", "", 0),
          "Cache-Control": "no-store",
        },
      });
    }
  }
  if (!row) return respond({ error: "Connect GitHub first." }, 401);
  const { payload } = await jwtDecrypt(row.token, await key(env), {
    subject: user.sub,
  });
  const token = String(payload.token);
  if (path === "/api/github/repos" && req.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT full_name FROM github_repos WHERE user_sub=?",
    )
      .bind(user.sub)
      .all();
    return respond({ repos: rows.results.map((x) => x.full_name) });
  }
  if (path === "/api/github/repos" && req.method === "POST") {
    const d = await body();
    if (
      typeof d.name !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(d.name)
    )
      throw new InvalidEntry(
        "Use letters, numbers, hyphens or underscores in the project name.",
      );
    const repo = await api(token, "/user/repos", "POST", {
      name: d.name,
      private: false,
      auto_init: true,
      description: "Learning project",
    });
    await env.DB.prepare(
      "INSERT INTO github_repos(full_name,user_sub) VALUES(?,?)",
    )
      .bind(repo.full_name, user.sub)
      .run();
    return respond({ repo: repo.full_name });
  }
  const d =
    req.method === "POST" ? await body() : Object.fromEntries(url.searchParams);
  const name = d.repo;
  if (
    typeof name !== "string" ||
    !new RegExp(
      "^" +
        row.login.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "/[a-zA-Z0-9_.-]+$",
      "i",
    ).test(name)
  )
    throw new InvalidEntry("Choose one of your learning repositories.");
  const allowed = await env.DB.prepare(
    "SELECT full_name FROM github_repos WHERE full_name=? AND user_sub=?",
  )
    .bind(name, user.sub)
    .first();
  if (!allowed)
    return respond(
      { error: "This repository is not connected to the learning workspace." },
      403,
    );
  const repo = await api(token, "/repos/" + name);
  if (
    repo.private ||
    repo.owner.login.toLowerCase() !== row.login.toLowerCase()
  )
    return respond(
      { error: "Only your public learning repositories can be edited here." },
      403,
    );
  const base = "/repos/" + name,
    branch = repo.default_branch;
  const ref = await api(
    token,
    base + "/git/ref/heads/" + encodeURIComponent(branch),
  );
  if (path === "/api/github/history" && req.method === "GET") {
    const commits = await api(token, base + "/commits?per_page=10");
    return respond({
      commits: commits.map((c: any) => ({
        sha: c.sha,
        url: c.html_url,
        message: c.commit.message,
        date: c.commit.author.date,
      })),
    });
  }
  if (path === "/api/github/files" && req.method === "GET") {
    const tree = await api(
      token,
      base + "/git/trees/" + ref.object.sha + "?recursive=1",
    );
    if (tree.truncated)
      throw new InvalidEntry(
        "This project is too large for the simple editor.",
      );
    return respond({
      head: ref.object.sha,
      files: tree.tree
        .filter((x: any) => x.type === "blob" && x.mode === "100644")
        .map((x: any) => ({ path: x.path, size: x.size })),
      branch,
    });
  }
  if (path === "/api/github/file" && req.method === "GET") {
    if (!validPath(d.path))
      throw new InvalidEntry("This file cannot be edited here.");
    const f = await api(
      token,
      base +
        "/contents/" +
        d.path.split("/").map(encodeURIComponent).join("/") +
        "?ref=" +
        ref.object.sha,
    );
    if (f.type !== "file" || f.size > 100000 || f.encoding !== "base64")
      throw new InvalidEntry("Choose a text file under 100 KB.");
    const content = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(atob(f.content.replace(/\s/g, "")), (c) =>
        c.charCodeAt(0),
      ),
    );
    if (content.includes("\0"))
      throw new InvalidEntry("Binary files are not supported.");
    return respond({ content, head: ref.object.sha });
  }
  if (path === "/api/github/commit" && req.method === "POST") {
    const files = validateFiles(d.files);
    if (
      typeof d.message !== "string" ||
      !d.message.trim() ||
      d.message.length > 200
    )
      throw new InvalidEntry("Add a short commit message.");
    if (d.head !== ref.object.sha)
      return respond(
        {
          error:
            "This project changed on GitHub. Copy your unsaved work before reopening the project to load its latest version.",
        },
        409,
      );
    const previous = await api(token, base + "/git/commits/" + ref.object.sha);
    const tree = await api(token, base + "/git/trees", "POST", {
      base_tree: previous.tree.sha,
      tree: files.map((f) => ({
        path: f.path,
        mode: "100644",
        type: "blob",
        content: f.content,
      })),
    });
    const commit = await api(token, base + "/git/commits", "POST", {
      message: d.message.trim(),
      tree: tree.sha,
      parents: [ref.object.sha],
    });
    await api(
      token,
      base + "/git/refs/heads/" + encodeURIComponent(branch),
      "PATCH",
      { sha: commit.sha, force: false },
    );
    return respond({ head: commit.sha, url: commit.html_url });
  }
  return respond({ error: "Not found" }, 404);
}
