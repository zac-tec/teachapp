"use client";
import { useEffect, useState } from "react";
import GoogleSignIn from "./GoogleSignIn";
const learner = import.meta.env.VITE_STUDENT_NAME || "My brother";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Code2,
  NotebookPen,
  Route,
  FolderOpen,
  Plus,
  Check,
  Clock,
  CalendarDays,
} from "lucide-react";
import { stages, topics, levels, RecordItem } from "./lib/curriculum";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const blankLesson = () => ({
  title: "",
  date: today(),
  topics: [] as string[],
  completed: "",
  independent: "",
  help: "",
  attention: "",
  next: "",
  minutes: 45,
  summary: "",
  code: "",
  resources: "",
});
const blankProject = () => ({
  title: "",
  status: "Planned",
  notes: "",
  code: "",
  url: "",
});
const fields = [
  ["completed", "What he completed", "Tasks and ideas covered today"],
  [
    "independent",
    "What he could do independently",
    "What he solved without prompts",
  ],
  ["help", "Where he needed help", "The point where support was useful"],
  [
    "attention",
    "What held his attention",
    "Examples or activities that worked",
  ],
  ["next", "Next lesson focus", "One clear next step"],
] as const;
function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (s: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((x) => (
          <SelectItem key={x} value={x}>
            {x}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Resources({ text }: { text: string }) {
  return (
    <div className="resources">
      {text
        .split("\n")
        .filter(Boolean)
        .map((s, i) =>
          /^https?:\/\/\S+$/.test(s.trim()) ? (
            <a key={i} href={s.trim()} target="_blank" rel="noreferrer">
              {s}
            </a>
          ) : (
            <p key={i}>{s}</p>
          ),
        )}
    </div>
  );
}
export default function Journey() {
  const [tab, setTab] = useState("overview"),
    [records, setRecords] = useState<RecordItem[]>([]),
    [role, setRole] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false),
    [studentView, setStudentView] = useState(false);
  const [lesson, setLesson] = useState<any>(null),
    [lessonId, setLessonId] = useState(""),
    [lessonRevision, setLessonRevision] = useState(0),
    [selected, setSelected] = useState(""),
    [reflection, setReflection] = useState("");
  const [project, setProject] = useState<any>(null),
    [projectId, setProjectId] = useState(""),
    [projectRevision, setProjectRevision] = useState(0);
  const teacher = role === "teacher" && !studentView;
  const lessons = records
    .filter((x) => x.kind === "lesson")
    .sort(
      (a, b) =>
        b.payload.date.localeCompare(a.payload.date) ||
        b.updated.localeCompare(a.updated),
    );
  const projects = records.filter((x) => x.kind === "project");
  const level = (id: string) =>
    records.find((x) => x.kind === "topic" && x.id === id)?.payload.level ||
    "Not assessed";
  const independent = topics.filter((t) =>
    ["Independent", "Transfer"].includes(level(t.id)),
  ).length;
  const studied = topics.filter(
    (t) =>
      level(t.id) !== "Not assessed" ||
      lessons.some((l) => l.payload.topics.includes(t.id)),
  );
  const nextTopic = topics.find(
    (t) => !["Independent", "Transfer"].includes(level(t.id)),
  );
  const current = lessons.find((l) => l.id === selected);
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/journey");
      const data: any = await r.json();
      if (r.status === 401) {
        setRole("");
        setRecords([]);
        return;
      }
      if (!r.ok) throw Error(data.error);
      setRecords(data.records);
      setRole(data.user.role);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    setReflection(
      records.find(
        (r) => r.kind === "reflection" && r.payload.lessonId === selected,
      )?.payload.text || "",
    );
  }, [selected, records]);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: "read_learning_progress",
          description:
            "Read the current saved topic progress and class history.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: async (input: any) => {
            if (
              !input ||
              typeof input !== "object" ||
              Object.keys(input).length
            )
              throw Error("No arguments expected");
            const r = await fetch("/api/journey");
            const d: any = await r.json();
            if (!r.ok) throw Error(d.error);
            setRecords(d.records);
            return {
              records: d.records.filter(
                (x: RecordItem) => x.kind !== "settings",
              ),
            };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(console.error);
    return () => controller.abort();
  }, []);
  async function save(kind: string, id: string, payload: any, revision = 0) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, payload, revision }),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      setRecords((prev) => [d.record, ...prev.filter((x) => x.id !== id)]);
      setMessage("Saved to your learning journal.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }
  function startLesson(existing?: RecordItem) {
    setLesson(existing ? structuredClone(existing.payload) : blankLesson());
    setLessonId(existing?.id || crypto.randomUUID());
    setLessonRevision(existing?.revision || 0);
    setTab("journal");
    setSelected("");
    setMessage("");
  }
  function startProject(existing?: RecordItem) {
    setProject(existing ? structuredClone(existing.payload) : blankProject());
    setProjectId(existing?.id || crypto.randomUUID());
    setProjectRevision(existing?.revision || 0);
    setTab("projects");
    setMessage("");
  }
  function openLesson(id: string) {
    setSelected(id);
    setLesson(null);
    setTab("journal");
  }
  const stat = (number: number, label: string, icon: React.ReactNode) => (
    <article className="stat">
      <span className="stat-icon">{icon}</span>
      <div>
        <strong>{number}</strong>
        <p>{label}</p>
      </div>
    </article>
  );
  return (
    <main className="shell">
      <header>
        <div className="brand">
          <span className="mark">
            <BookOpen size={23} />
          </span>
          Learning Journey
        </div>
        <div className="header-right">
          <span className="avatar">T</span>
          <span>
            <b>{learner}</b>
            <small>Personal learning journal</small>
          </span>
          {role && (
            <button
              className="quiet"
              onClick={async () => {
                const r = await fetch("/api/auth/logout", { method: "POST" });
                if (r.ok) {
                  setRole("");
                  setRecords([]);
                  setLesson(null);
                  setProject(null);
                  setSelected("");
                  setStudentView(false);
                } else setError("Could not sign out. Please retry.");
              }}
            >
              Sign out
            </button>
          )}
          {role === "teacher" && (
            <button
              className="quiet"
              onClick={() => setStudentView(!studentView)}
            >
              {studentView ? "Guide view" : "Preview student view"}
            </button>
          )}
        </div>
      </header>
      <section className="intro">
        <div>
          <p className="eyebrow">{learner.toUpperCase()}’S LEARNING NOTEBOOK</p>
          <h1>One class. One step forward.</h1>
          <p>
            Keep the work, notice the progress, and return to what you’ve
            learned.
          </p>
        </div>
        {teacher && (
          <button
            className="primary"
            disabled={loading}
            onClick={() => startLesson()}
          >
            <Plus size={18} />
            Log a class
          </button>
        )}
      </section>
      {error && (
        <div className="notice error" role="alert">
          {error}{" "}
          <button className="quiet" onClick={refresh}>
            Reload saved data
          </button>
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          <Check size={18} />
          {message}
        </div>
      )}
      {studentView && (
        <p className="notice">
          Student-view preview. You are still signed in as the guide.
        </p>
      )}
      {loading ? (
        <div className="dashboard">
          <Skeleton className="h-60" />
          <Skeleton className="h-60" />
        </div>
      ) : !role ? (
        <article className="card">
          <h2>Your private learning journal</h2>
          <p>Sign in with the account that has access to this journal.</p>
          <GoogleSignIn onSignedIn={refresh} />
        </article>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList aria-label="Journal sections">
            <TabsTrigger value="overview">
              <BookOpen />
              Overview
            </TabsTrigger>
            <TabsTrigger value="journal">
              <NotebookPen />
              Class journal
            </TabsTrigger>
            <TabsTrigger value="roadmap">
              <Route />
              Roadmap
            </TabsTrigger>
            <TabsTrigger value="revision">
              <Code2 />
              Revision
            </TabsTrigger>
            <TabsTrigger value="projects">
              <FolderOpen />
              Projects
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <div className="stats">
              {stat(lessons.length, "Classes recorded", <CalendarDays />)}
              {stat(studied.length, "Topics explored", <BookOpen />)}
              {stat(independent, "Independent or transfer", <Check />)}
              {stat(
                projects.filter((p) => p.payload.status === "Completed").length,
                "Projects completed",
                <FolderOpen />,
              )}
            </div>
            <div className="dashboard">
              <article className="card focus">
                <p className="eyebrow">
                  {lessons.length ? "NEXT CLASS" : "BEGIN WITH A REFRESH"}
                </p>
                <h2>
                  {lessons[0]?.payload.next ||
                    nextTopic?.title ||
                    "Revisit and apply your skills"}
                </h2>
                <p>
                  {lessons.length
                    ? "Build on your last class. Keep the next step small and practical."
                    : "Python and SQL are already familiar. Start by finding out what feels clear and what needs another try."}
                </p>
                <div className="pill">
                  <Clock size={16} />
                  {lessons[0]?.payload.minutes
                    ? `${lessons[0].payload.minutes} minutes planned`
                    : "Set the time in your first class log"}
                </div>
              </article>
              <article className="card">
                <p className="eyebrow">THE LONGER JOURNEY</p>
                <h2>
                  {independent} of {topics.length} topics
                </h2>
                <p>Demonstrated independently or applied to a new problem.</p>
                <Progress
                  value={(independent / topics.length) * 100}
                  aria-label="Topics demonstrated independently"
                />
                <p className="small">
                  Includes the optional quantitative finance pathway. No
                  deadlines or streaks.
                </p>
                <button
                  className="text-button"
                  onClick={() => setTab("roadmap")}
                >
                  Explore the roadmap
                </button>
              </article>
            </div>
            <div className="section-heading">
              <h2>Recent classes</h2>
              <button className="text-button" onClick={() => setTab("journal")}>
                View journal
              </button>
            </div>
            {lessons.length ? (
              <div className="lesson-grid">
                {lessons.slice(0, 3).map((l) => (
                  <button
                    key={l.id}
                    className="card lesson-card"
                    onClick={() => openLesson(l.id)}
                  >
                    <span className="eyebrow">{l.payload.date}</span>
                    <h3>{l.payload.title}</h3>
                    <p>
                      {l.payload.completed || "Open the class notes and code."}
                    </p>
                    <span className="tag">
                      {l.payload.topics.length} topics
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <article className="empty">
                <NotebookPen />
                <h3>Your first entry belongs here</h3>
                <p>
                  After class, save the checklist, code, and one thing to
                  practise next.
                </p>
                {teacher && (
                  <button className="primary" onClick={() => startLesson()}>
                    Log the first class
                  </button>
                )}
              </article>
            )}
          </TabsContent>
          <TabsContent value="journal">
            <div className="section-heading">
              <div>
                <h2>Class journal</h2>
                <p>A day-by-day record of the work and the learning.</p>
              </div>
              {teacher && !lesson && (
                <button className="secondary" onClick={() => startLesson()}>
                  <Plus size={17} />
                  New entry
                </button>
              )}
            </div>
            {lesson ? (
              <form
                className="card editor"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await save("lesson", lessonId, lesson, lessonRevision)) {
                    setSelected(lessonId);
                    setLesson(null);
                  }
                }}
              >
                <div className="section-heading">
                  <h2>{lessonRevision ? "Edit class" : "Record a class"}</h2>
                  <button
                    type="button"
                    className="quiet"
                    onClick={() => setLesson(null)}
                  >
                    Close draft
                  </button>
                </div>
                <div className="two-columns">
                  <Field label="Class title">
                    <input
                      required
                      maxLength={160}
                      value={lesson.title}
                      onChange={(e) =>
                        setLesson({ ...lesson, title: e.target.value })
                      }
                      placeholder="Python refresh: conditions and comparisons"
                    />
                  </Field>
                  <Field label="Class date">
                    <input
                      type="date"
                      required
                      value={lesson.date}
                      onChange={(e) =>
                        setLesson({ ...lesson, date: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <fieldset>
                  <legend>Topics completed or practised in this class</legend>
                  <p className="small">
                    Check what you worked on. Independence is assessed
                    separately in the roadmap.
                  </p>
                  <div className="topic-picker">
                    {stages.map((s, i) => (
                      <details key={s.name} open={i === 0 ? true : undefined}>
                        <summary>{s.name}</summary>
                        <div className="check-grid">
                          {topics
                            .filter((t) => t.stage === i)
                            .map((t) => (
                              <label key={t.id} className="check-row">
                                <Checkbox
                                  checked={lesson.topics.includes(t.id)}
                                  onCheckedChange={(checked) =>
                                    setLesson({
                                      ...lesson,
                                      topics: checked
                                        ? [...lesson.topics, t.id]
                                        : lesson.topics.filter(
                                            (x: string) => x !== t.id,
                                          ),
                                    })
                                  }
                                />
                                {t.title}
                              </label>
                            ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </fieldset>
                <div className="two-columns">
                  {fields.map(([key, label, placeholder]) => (
                    <Field key={key} label={label}>
                      <textarea
                        rows={3}
                        value={lesson[key]}
                        onChange={(e) =>
                          setLesson({ ...lesson, [key]: e.target.value })
                        }
                        placeholder={placeholder}
                      />
                    </Field>
                  ))}
                  <Field label="Time available for the next lesson (minutes)">
                    <input
                      type="number"
                      min={0}
                      max={480}
                      required
                      value={lesson.minutes}
                      onChange={(e) =>
                        setLesson({
                          ...lesson,
                          minutes: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                </div>
                <h3>Keep for revision</h3>
                <Field label="Lesson notes and explanation">
                  <textarea
                    rows={5}
                    value={lesson.summary}
                    onChange={(e) =>
                      setLesson({ ...lesson, summary: e.target.value })
                    }
                    placeholder="Explain the idea in simple words, then add a small practice question."
                  />
                </Field>
                <Field label="Code worked on in class">
                  <textarea
                    spellCheck={false}
                    className="code-input"
                    rows={9}
                    value={lesson.code}
                    onChange={(e) =>
                      setLesson({ ...lesson, code: e.target.value })
                    }
                    placeholder={"# Paste the Python or SQL from today\n"}
                  />
                </Field>
                <Field label="Other notes or resource links">
                  <textarea
                    rows={3}
                    value={lesson.resources}
                    onChange={(e) =>
                      setLesson({ ...lesson, resources: e.target.value })
                    }
                    placeholder="One resource link or note per line"
                  />
                </Field>
                <div className="form-footer">
                  <span className="small">
                    Saved only when you choose Save class.
                  </span>
                  <button className="primary" disabled={saving}>
                    {saving ? "Saving…" : "Save class"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="journal-layout">
                <aside className="day-list">
                  {lessons.length ? (
                    lessons.map((l) => (
                      <button
                        key={l.id}
                        className={selected === l.id ? "day active" : "day"}
                        onClick={() => openLesson(l.id)}
                      >
                        <span>{l.payload.date}</span>
                        <strong>{l.payload.title}</strong>
                        <small>{l.payload.topics.length} topics</small>
                      </button>
                    ))
                  ) : (
                    <p>No classes recorded yet.</p>
                  )}
                </aside>
                {current ? (
                  <article className="card lesson-detail">
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">{current.payload.date}</p>
                        <h2>{current.payload.title}</h2>
                      </div>
                      {teacher && (
                        <button
                          className="secondary"
                          onClick={() => startLesson(current)}
                        >
                          Edit class
                        </button>
                      )}
                    </div>
                    <div className="tags">
                      {current.payload.topics.map((id: string) => (
                        <span key={id} className="tag">
                          <Check size={14} />
                          {topics.find((t) => t.id === id)?.title}
                        </span>
                      ))}
                    </div>
                    <div className="observations">
                      {fields.map(([key, label]) => (
                        <section key={key}>
                          <h3>{label}</h3>
                          <p className="preserve">
                            {current.payload[key] ||
                              "Not recorded for this class."}
                          </p>
                        </section>
                      ))}
                    </div>
                    <p className="tag">
                      <Clock size={15} />
                      Next lesson: {current.payload.minutes} minutes
                    </p>
                    <hr />
                    <h3>Lesson notes</h3>
                    <p className="preserve">
                      {current.payload.summary ||
                        "No revision notes added yet."}
                    </p>
                    <h3>Code from this class</h3>
                    {current.payload.code ? (
                      <pre>
                        <code>{current.payload.code}</code>
                      </pre>
                    ) : (
                      <p>No code added for this class.</p>
                    )}
                    {current.payload.resources && (
                      <>
                        <h3>Other notes & resources</h3>
                        <Resources text={current.payload.resources} />
                      </>
                    )}
                    <form
                      className="reflection"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const id = `reflection-${current.id}`;
                        await save(
                          "reflection",
                          id,
                          { lessonId: current.id, text: reflection },
                          records.find((r) => r.id === id)?.revision || 0,
                        );
                      }}
                    >
                      <h3>{learner}’s reflection</h3>
                      <p>What made sense? What would you like to try again?</p>
                      <Field label="My reflection">
                        <textarea
                          rows={4}
                          required
                          value={reflection}
                          onChange={(e) => setReflection(e.target.value)}
                          placeholder="Today I learned… Next time I want to…"
                        />
                      </Field>
                      <button className="secondary" disabled={saving}>
                        Save reflection
                      </button>
                    </form>
                  </article>
                ) : (
                  <article className="empty">
                    <CalendarDays />
                    <h3>
                      {lessons.length
                        ? "Choose a class to revisit"
                        : "A fresh page for your journey"}
                    </h3>
                    <p>
                      {lessons.length
                        ? "See the topics, code, notes, and reflection from that day."
                        : "Your class history will appear here after the first entry."}
                    </p>
                  </article>
                )}
              </div>
            )}
          </TabsContent>
          <TabsContent value="roadmap">
            <div className="section-heading">
              <div>
                <h2>The path ahead</h2>
                <p>
                  Move at the pace of understanding. Revisit a topic whenever it
                  helps.
                </p>
              </div>
            </div>
            <div className="legend">
              {levels.map((l, i) => (
                <span key={l}>
                  <b>{i}</b>
                  {l}
                </span>
              ))}
            </div>
            <p className="small">
              Independent means solving a familiar task using reference notes.
              Transfer means applying it to a different problem. Levels are
              guide assessments.
            </p>
            <div className="roadmap">
              {stages.map((s, i) => {
                const list = topics.filter((t) => t.stage === i),
                  n = list.filter((t) =>
                    ["Independent", "Transfer"].includes(level(t.id)),
                  ).length;
                return (
                  <details
                    className="stage"
                    key={s.name}
                    open={i === 0 ? true : undefined}
                  >
                    <summary>
                      <span className="stage-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="stage-title">
                        <strong>{s.name}</strong>
                        <small>{s.aim}</small>
                      </span>
                      <span className="stage-count">
                        {n}/{list.length}
                      </span>
                    </summary>
                    <div className="stage-body">
                      <Progress
                        value={(n / list.length) * 100}
                        aria-label={`${s.name} independent topics`}
                      />
                      {list.map((t) => (
                        <div className="topic-row" key={t.id}>
                          <div>
                            <strong>{t.title}</strong>
                            <small>
                              {
                                lessons.filter((l) =>
                                  l.payload.topics.includes(t.id),
                                ).length
                              }{" "}
                              class entries
                            </small>
                          </div>
                          {teacher ? (
                            <Choice
                              label={`${t.title} progress`}
                              value={level(t.id)}
                              options={levels}
                              onChange={async (v) => {
                                const r = records.find(
                                  (x) => x.kind === "topic" && x.id === t.id,
                                );
                                await save(
                                  "topic",
                                  t.id,
                                  { level: v },
                                  r?.revision || 0,
                                );
                              }}
                            />
                          ) : (
                            <span className="tag">{level(t.id)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </TabsContent>
          <TabsContent value="revision">
            <div className="section-heading">
              <div>
                <h2>Return to what you know</h2>
                <p>Your class notes and code, collected by topic.</p>
              </div>
            </div>
            {studied.length ? (
              <div className="revision-grid">
                {studied.map((t) => {
                  const entries = lessons.filter((l) =>
                    l.payload.topics.includes(t.id),
                  );
                  return (
                    <article className="card" key={t.id}>
                      <p className="eyebrow">{stages[t.stage].name}</p>
                      <h3>{t.title}</h3>
                      <span className="tag">{level(t.id)}</span>
                      {entries.length ? (
                        <div className="revision-links">
                          {entries.map((l) => (
                            <button
                              className="revision-link"
                              key={l.id}
                              onClick={() => openLesson(l.id)}
                            >
                              <span>{l.payload.date}</span>
                              <strong>{l.payload.title}</strong>
                              <small>
                                {l.payload.code
                                  ? "Notes & code"
                                  : "Class notes"}
                              </small>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="small">
                          This topic has been assessed. Link it to a class entry
                          to keep revision notes here.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <article className="empty">
                <Code2 />
                <h3>Your revision shelf is ready</h3>
                <p>
                  Check the topics in a class log, then add the code and
                  explanation. They’ll appear here together.
                </p>
              </article>
            )}
          </TabsContent>
          <TabsContent value="projects">
            <div className="section-heading">
              <div>
                <h2>Learning through projects</h2>
                <p>
                  Keep the idea, the work, and what you learned in one place.
                </p>
              </div>
              {!project && (
                <button className="secondary" onClick={() => startProject()}>
                  <Plus size={17} />
                  Add project
                </button>
              )}
            </div>
            {project ? (
              <form
                className="card editor"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await save("project", projectId, project, projectRevision)
                  )
                    setProject(null);
                }}
              >
                <div className="section-heading">
                  <h2>
                    {projectRevision ? "Update project" : "A new project"}
                  </h2>
                  <button
                    type="button"
                    className="quiet"
                    onClick={() => setProject(null)}
                  >
                    Close draft
                  </button>
                </div>
                <div className="two-columns">
                  <Field label="Project title">
                    <input
                      required
                      maxLength={160}
                      value={project.title}
                      onChange={(e) =>
                        setProject({ ...project, title: e.target.value })
                      }
                      placeholder="My expense analysis"
                    />
                  </Field>
                  <div className="field">
                    <span>Project status</span>
                    <Choice
                      label="Project status"
                      value={project.status}
                      options={["Planned", "In progress", "Completed"]}
                      onChange={(v) => setProject({ ...project, status: v })}
                    />
                  </div>
                </div>
                <Field label="Question, progress, and what I learned">
                  <textarea
                    rows={6}
                    value={project.notes}
                    onChange={(e) =>
                      setProject({ ...project, notes: e.target.value })
                    }
                  />
                </Field>
                <Field label="Project code">
                  <textarea
                    rows={9}
                    spellCheck={false}
                    className="code-input"
                    value={project.code}
                    onChange={(e) =>
                      setProject({ ...project, code: e.target.value })
                    }
                  />
                </Field>
                <Field label="Project link (optional)">
                  <input
                    type="url"
                    value={project.url}
                    onChange={(e) =>
                      setProject({ ...project, url: e.target.value })
                    }
                    placeholder="https://…"
                  />
                </Field>
                <button className="primary" disabled={saving}>
                  {saving ? "Saving…" : "Save project"}
                </button>
              </form>
            ) : projects.length ? (
              <div className="revision-grid">
                {projects.map((p) => (
                  <article key={p.id} className="card">
                    <span className="tag">{p.payload.status}</span>
                    <h2>{p.payload.title}</h2>
                    <p className="preserve">
                      {p.payload.notes ||
                        "Add the project question and what you learned."}
                    </p>
                    {p.payload.code && (
                      <details>
                        <summary>View project code</summary>
                        <pre>
                          <code>{p.payload.code}</code>
                        </pre>
                      </details>
                    )}
                    <div className="project-actions">
                      <button
                        className="secondary"
                        onClick={() => startProject(p)}
                      >
                        Update project
                      </button>
                      {p.payload.url && (
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href={p.payload.url}
                        >
                          Open project
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <article className="empty">
                <FolderOpen />
                <h3>Start with something small</h3>
                <p>
                  An expense summary is a good first project: a question, a few
                  rows of data, and an explanation.
                </p>
                <button className="primary" onClick={() => startProject()}>
                  Add the first project
                </button>
              </article>
            )}
          </TabsContent>
        </Tabs>
      )}
      <footer>
        <span>{learner}’s learning journey</span>
        <span>Progress through practice, at your own pace.</span>
      </footer>
    </main>
  );
}
