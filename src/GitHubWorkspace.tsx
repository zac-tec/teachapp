import { useEffect, useState } from "react";
async function request(path: string, data?: unknown) {
  const r = await fetch(
    "/api/github/" + path,
    data
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      : undefined,
  );
  const d: any = await r.json();
  if (!r.ok) throw Error(d.error || "Please try again.");
  return d;
}
export default function GitHubWorkspace({ student }: { student: boolean }) {
  const [status, setStatus] = useState<any>(null),
    [repos, setRepos] = useState<string[]>([]),
    [repo, setRepo] = useState(""),
    [name, setName] = useState(""),
    [files, setFiles] = useState<{ path: string; size: number }[]>([]),
    [head, setHead] = useState(""),
    [selected, setSelected] = useState(""),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [originals, setOriginals] = useState<Record<string, string>>({}),
    [newPath, setNewPath] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(window.location.search.includes("github=failed") ? "GitHub connection was not completed. Use the configured student account and try again." : ""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const dirty = Object.keys(drafts).filter((p) => drafts[p] !== originals[p]);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const s = await request("status");
    setStatus(s);
    if (s.connected) setRepos((await request("repos")).repos);
  }
  useEffect(() => {
    if (student) void act(refresh);
  }, [student]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.length) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty.length]);
  async function openRepo(value: string) {
    const d = await request("files?repo=" + encodeURIComponent(value));
    setRepo(value);
    setFiles(d.files);
    setHead(d.head);
    setDrafts({});
    setOriginals({});
    setSelected("");
    setNotice("");
  }
  async function openFile(path: string) {
    if (!(path in drafts)) {
      const d = await request(
        "file?repo=" +
          encodeURIComponent(repo) +
          "&path=" +
          encodeURIComponent(path),
      );
      if (d.head !== head)
        throw Error(
          "The project changed on GitHub. Save a copy of your work before reopening it.",
        );
      setDrafts((v) => ({ ...v, [path]: d.content }));
      setOriginals((v) => ({ ...v, [path]: d.content }));
    }
    setSelected(path);
  }
  async function importFiles(list: FileList | null) {
    if (!list) return;
    const additions: Record<string, string> = {};
    let total = 0;
    for (const f of Array.from(list)) {
      const path = f.webkitRelativePath || f.name;
      if (
        /(^|\/)(\.git|node_modules|\.venv|__pycache__|\.env)(\/|\.|$)/.test(
          path,
        ) ||
        path.startsWith(".github/")
      )
        continue;
      if (path in drafts || files.some((x) => x.path === path))
        throw Error(
          "A file named " + path + " already exists. Open it to edit instead.",
        );
      if (f.size > 100000) throw Error("Import text files under 100 KB.");
      const content = new TextDecoder("utf-8", { fatal: true }).decode(
        await f.arrayBuffer(),
      );
      if (content.includes("\0")) throw Error("Import text/code files only.");
      total += f.size;
      additions[path] = content;
    }
    if (total > 100000 || Object.keys(additions).length + dirty.length > 50)
      throw Error("Import up to 50 files and 100 KB per commit.");
    setDrafts((v) => ({ ...v, ...additions }));
    setSelected(Object.keys(additions)[0] || selected);
  }
  if (!student)
    return (
      <section className="card">
        <h2>GitHub projects</h2>
        <p>
          Thomman can connect his GitHub account and save projects here when
          signed in as the student.
        </p>
      </section>
    );
  return (
    <section className="card practice-page">
      <h2>Projects & GitHub</h2>
      <p>
        Create, write, and save your projects in one place. All repositories
        created here are public.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}
      {!status ? (
        <p>Loading connection…</p>
      ) : !status.connected ? (
        <>
          <p>
            {status.configured
              ? "Connect " + status.expected + " to start."
              : "GitHub connection is waiting for the guide’s one-time setup."}
          </p>
          <button
            className="primary"
            disabled={busy || !status.configured}
            onClick={() =>
              act(async () => {
                const d = await request("connect", {});
                window.location.assign(d.url);
              })
            }
          >
            Connect GitHub
          </button>
          {status.configured && (
            <p className="muted">
              GitHub asks for public-repository access. This editor uses only
              projects created here.
            </p>
          )}
        </>
      ) : (
        <>
          <p>
            Connected as <b>{status.login}</b>
          </p>
          <details>
            <summary>Connection settings</summary>
            <button
              disabled={busy || dirty.length > 0}
              className="quiet"
              onClick={() =>
                act(async () => {
                  await request("disconnect", {});
                  setRepo("");
                  setDrafts({});
                  setFiles([]);
                  await refresh();
                })
              }
            >
              Disconnect from this app
            </button>
            <p>
              You can also revoke its access in GitHub → Settings →
              Applications.
            </p>
          </details>
          <div className="form-grid">
            <label className="field">
              Open project
              <select
                disabled={busy || dirty.length > 0}
                value={repo}
                onChange={(e) =>
                  e.target.value && act(() => openRepo(e.target.value))
                }
              >
                <option value="">Choose a project</option>
                {repos.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  const d = await request("repos", { name });
                  await refresh();
                  await openRepo(d.repo);
                  setName("");
                });
              }}
            >
              <label className="field">
                New public project
                <input
                  required
                  pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="python-practice"
                />
              </label>
              <button disabled={busy || dirty.length > 0} className="secondary">
                Create repository
              </button>
            </form>
          </div>
          {repo && (
            <>
              <div className="actions">
                <label className="secondary">
                  Import files
                  <input
                    type="file"
                    multiple
                    disabled={busy}
                    onChange={(e) => {
                      const list = e.target.files;
                      void act(() => importFiles(list));
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="secondary">
                  Import folder
                  <input
                    type="file"
                    multiple
                    {...({ webkitdirectory: "" } as any)}
                    disabled={busy}
                    onChange={(e) => {
                      const list = e.target.files;
                      void act(() => importFiles(list));
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <form
                className="actions"
                onSubmit={(e) => {
                  e.preventDefault();
                  const p = newPath.trim();
                  if (!p || files.some((f) => f.path === p) || p in drafts) {
                    setError("Choose a new file path.");
                    return;
                  }
                  setDrafts((v) => ({ ...v, [p]: "" }));
                  setSelected(p);
                  setNewPath("");
                }}
              >
                <label className="field">
                  New file or folder/file
                  <input
                    required
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder="exercises/hello.py"
                  />
                </label>
                <button className="secondary" disabled={busy}>
                  Create file
                </button>
              </form>
              <p className="muted">
                Folders are created when you add a file inside them.
              </p>
              <div className="github-editor">
                <nav aria-label="Project files">
                  {Array.from(
                    new Set([
                      ...files.map((f) => f.path),
                      ...Object.keys(drafts),
                    ]),
                  )
                    .sort()
                    .map((p) => (
                      <button
                        className={selected === p ? "secondary" : "quiet"}
                        disabled={busy}
                        key={p}
                        onClick={() => act(() => openFile(p))}
                      >
                        {p}
                        {dirty.includes(p) ? " •" : ""}
                      </button>
                    ))}
                </nav>
                <div>
                  {selected ? (
                    <label className="field">
                      {selected}
                      <textarea
                        className="code-input"
                        rows={20}
                        spellCheck={false}
                        disabled={busy}
                        value={drafts[selected] || ""}
                        onChange={(e) =>
                          setDrafts((v) => ({
                            ...v,
                            [selected]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  ) : (
                    <p>Choose a file or add one to start.</p>
                  )}
                </div>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(async () => {
                    await request("commit", {
                      repo,
                      head,
                      message,
                      files: dirty.map((path) => ({
                        path,
                        content: drafts[path],
                      })),
                    });
                    await openRepo(repo);
                    setMessage("");
                    setNotice(
                      "Saved to GitHub. Your commit is a named version of this project.",
                    );
                  });
                }}
              >
                <p>
                  {dirty.length} changed file{dirty.length === 1 ? "" : "s"}
                  {dirty.length > 0 ? ": " + dirty.join(", ") : ""}
                </p>
                <label className="field">
                  What changed?
                  <input
                    required
                    maxLength={200}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add my loop exercises"
                  />
                </label>
                <button className="primary" disabled={busy || !dirty.length}>
                  {busy ? "Working…" : "Save to GitHub (commit)"}
                </button>
              </form>
              <details>
                <summary>Recent commits</summary>
                <CommitHistory repo={repo} head={head} />
              </details>
            </>
          )}
        </>
      )}
    </section>
  );
}
function CommitHistory({ repo, head }: { repo: string; head: string }) {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(window.location.search.includes("github=failed") ? "GitHub connection was not completed. Use the configured student account and try again." : "");
  useEffect(() => {
    request("history?repo=" + encodeURIComponent(repo))
      .then((d) => setRows(d.commits))
      .catch((e) => setError(e.message));
  }, [repo, head]);
  return (
    <div>
      {error && <p>{error}</p>}
      {rows.map((r) => (
        <p key={r.sha}>
          <a href={r.url} target="_blank" rel="noreferrer">
            {r.message}
          </a>{" "}
          · {r.date}
        </p>
      ))}
    </div>
  );
}
