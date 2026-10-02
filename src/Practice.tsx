import { useState } from "react";
import type { RecordItem } from "./lib/curriculum";
export const outcomes = [
  "Planned",
  "Working on it",
  "Solved with help",
  "Solved independently",
  "Revisit",
];
const date = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export default function Practice({
  kind,
  records,
  save,
  saving,
  teacher,
}: {
  kind: string;
  records: RecordItem[];
  save: (
    kind: string,
    id: string,
    p: any,
    revision: number,
  ) => Promise<boolean>;
  saving: boolean;
  teacher: boolean;
}) {
  const entries = records
    .filter((r) => r.kind === kind)
    .sort((a, b) => b.payload.date.localeCompare(a.payload.date));
  const [edit, setEdit] = useState<RecordItem | null>(null);
  const [query, setQuery] = useState("");
  function create() {
    setEdit({
      id: crypto.randomUUID(),
      kind,
      revision: 0,
      updated: "",
      payload: {
        title: "",
        date: date(),
        url: "",
        notebookUrl: "",
        topic: "",
        difficulty: "Not specified",
        status: "Planned",
        code: "",
        notes: "",
        correction: "",
      },
    });
  }
  const p = edit?.payload;
  const field = (key: string, value: string) =>
    setEdit((e) => (e ? { ...e, payload: { ...e.payload, [key]: value } } : e));
  return (
    <section className="card practice-page">
      <div className="section-head">
        <div>
          <h2>
            {kind === "leetcode" ? "LeetCode notebook" : "Daily practice"}
          </h2>
          <p>Small steps count. Update whenever you have time.</p>
        </div>
        <button className="primary" onClick={create}>
          Add question
        </button>
      </div>
      {edit ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await save(kind, edit.id, p, edit.revision)) setEdit(null);
          }}
        >
          <div className="form-grid">
            <label className="field">
              Question
              <input
                required
                maxLength={160}
                value={p.title}
                onChange={(e) => field("title", e.target.value)}
              />
            </label>
            <label className="field">
              Date
              <input
                type="date"
                required
                value={p.date}
                onChange={(e) => field("date", e.target.value)}
              />
            </label>
            <label className="field">
              Topic
              <input
                maxLength={100}
                placeholder="Arrays, loops, SQL…"
                value={p.topic}
                onChange={(e) => field("topic", e.target.value)}
              />
            </label>
            <label className="field">
              Problem link (optional)
              <input
                type="url"
                value={p.url}
                onChange={(e) => field("url", e.target.value)}
              />
            </label>
            <label className="field">
              Progress
              <select
                value={p.status}
                onChange={(e) => field("status", e.target.value)}
              >
                {outcomes.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Difficulty
              <select
                value={p.difficulty}
                onChange={(e) => field("difficulty", e.target.value)}
              >
                {["Not specified", "Easy", "Medium", "Hard"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
          <section className="card">
            <h3>Solve in a notebook</h3>
            <p>Open Colab in a new tab, write and save your solution there, then come back here to update your progress.</p>
            <div className="actions">
              <a className="primary" href="https://colab.research.google.com/" target="_blank" rel="noreferrer">Open Colab (Jupyter notebook) ↗</a>
              {/^https?:\/\//.test(p.notebookUrl || "") && <a className="secondary" href={p.notebookUrl} target="_blank" rel="noreferrer">Open saved notebook ↗</a>}
            </div>
            <label className="field">My notebook link (optional)
              <input type="url" maxLength={2000} value={p.notebookUrl || ""} onChange={e => field("notebookUrl", e.target.value)} placeholder="Paste your saved Colab notebook link" />
            </label>
            <p className="muted">Colab saves the notebook in your Google Drive. Paste its link here and click Save progress. Share it with your guide in Colab if you want feedback.</p>
          </section>
          <details open={!!p.code}>
            <summary>Code copy (optional)</summary>
            <label className="field">Saved code
              <textarea className="code-input" rows={8} value={p.code} onChange={e => field("code", e.target.value)} spellCheck={false}/>
            </label>
          </details>
          <label className="field">
            Notes / next step
            <textarea
              rows={3}
              value={p.notes}
              onChange={(e) => field("notes", e.target.value)}
            />
          </label>
          <label className="field">
            Guide feedback and corrected code
            <textarea
              rows={6}
              readOnly={!teacher}
              value={p.correction}
              onChange={(e) => field("correction", e.target.value)}
            />
          </label>
          <div className="actions">
            <button className="primary" disabled={saving}>
              {saving ? "Saving…" : "Save progress"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setEdit(null)}
            >
              Close
            </button>
          </div>
        </form>
      ) : (
        <>
          <label className="field">
            Find a question
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or topic"
            />
          </label>
          {entries.length === 0 ? (
            <p className="empty">
              Add your first question. There’s no daily target to catch up with.
            </p>
          ) : (
            entries
              .filter((r) =>
                (r.payload.title + " " + r.payload.topic)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((r) => (
                <article className="practice-row" key={r.id}>
                  <div>
                    <h3>{r.payload.title}</h3>
                    <p>
                      {r.payload.date} · {r.payload.topic || "General"} ·{" "}
                      {r.payload.status}
                    </p>
                    {r.payload.url && (
                      <a href={r.payload.url} target="_blank" rel="noreferrer">
                        Open question ↗
                      </a>
                    )}
                  </div>
                  <button
                    className="secondary"
                    onClick={() => setEdit(structuredClone(r))}
                  >
                    Open notebook
                  </button>
                </article>
              ))
          )}
        </>
      )}
    </section>
  );
}
export function PracticeProgress({ records }: { records: RecordItem[] }) {
  const rows = records.filter((r) => ["practice", "leetcode"].includes(r.kind));
  return (
    <section className="card">
      <h2>Problem-solving progress</h2>
      <p>Your progress stays with you, even during busy weeks.</p>
      <div className="stats">
        {[
          [
            "Questions explored",
            rows.filter((r) => r.payload.status !== "Planned").length,
          ],
          [
            "Solved independently",
            rows.filter((r) => r.payload.status === "Solved independently")
              .length,
          ],
          [
            "Solved with help",
            rows.filter((r) => r.payload.status === "Solved with help").length,
          ],
          [
            "To revisit",
            rows.filter((r) => r.payload.status === "Revisit").length,
          ],
        ].map(([label, n]) => (
          <article className="stat" key={label}>
            <div>
              <strong>{n}</strong>
              <p>{label}</p>
            </div>
          </article>
        ))}
      </div>
      <h3>Recent practice</h3>
      {rows.slice(0, 5).map((r) => (
        <p key={r.id}>
          {r.payload.title} — {r.payload.status}
        </p>
      ))}
      {!rows.length && <p>Your first question will appear here.</p>}
    </section>
  );
}
