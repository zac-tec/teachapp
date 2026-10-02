import { topics, levels } from "../src/lib/curriculum.ts";
export class InvalidEntry extends Error {}
const text = (value: unknown, max = 30000): value is string =>
  typeof value === "string" && value.length <= max;
function fail(message: string): never {
  throw new InvalidEntry(message);
}
export function validateEntry(input: unknown) {
  if (!input || typeof input !== "object") fail("Invalid entry.");
  const { id, kind, payload: p, revision } = input as Record<string, any>;
  if (
    !text(id, 100) ||
    !id ||
    !Number.isInteger(revision) ||
    revision < 0 ||
    !p ||
    typeof p !== "object" ||
    ![
      "lesson",
      "topic",
      "project",
      "reflection",
      "practice",
      "leetcode",
    ].includes(kind)
  )
    fail("Invalid entry.");
  let payload: Record<string, any> = {};
  if (["practice", "leetcode"].includes(kind)) {
    if (
      !text(p.title, 160) ||
      !p.title.trim() ||
      !text(p.topic, 100) ||
      !text(p.date, 10) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
      !Number.isFinite(Date.parse(p.date + "T00:00:00Z")) ||
      new Date(p.date + "T00:00:00Z").toISOString().slice(0, 10) !== p.date ||
      !text(p.code) ||
      !text(p.notes) ||
      !text(p.correction) ||
      !text(p.url, 2000) ||
      ![
        "Planned",
        "Working on it",
        "Solved with help",
        "Solved independently",
        "Revisit",
      ].includes(p.status) ||
      !["Not specified", "Easy", "Medium", "Hard"].includes(p.difficulty)
    )
      fail("Check the question fields.");
    if (p.url) {
      try {
        const u = new URL(p.url);
        if (
          !["https:", "http:"].includes(u.protocol) ||
          u.username ||
          u.password
        )
          fail("Use an http or https question link.");
      } catch {
        fail("Use a valid question link.");
      }
    }
    payload = Object.fromEntries(
      [
        "title",
        "topic",
        "date",
        "code",
        "notes",
        "correction",
        "url",
        "status",
        "difficulty",
      ].map((k) => [k, p[k]]),
    );
  }
  if (kind === "lesson") {
    if (
      !text(p.title, 160) ||
      !p.title.trim() ||
      !text(p.date, 10) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
      !Number.isFinite(Date.parse(p.date + "T00:00:00Z")) ||
      new Date(p.date + "T00:00:00Z").toISOString().slice(0, 10) !== p.date ||
      !Array.isArray(p.topics) ||
      p.topics.length > topics.length ||
      p.topics.some((t: unknown) => !topics.some((x) => x.id === t))
    )
      fail("Add a title, valid date, and valid topics.");
    payload = {
      title: p.title.trim(),
      date: p.date,
      topics: [...new Set(p.topics)],
    };
    for (const key of [
      "completed",
      "independent",
      "help",
      "attention",
      "next",
      "summary",
      "code",
      "resources",
    ]) {
      if (!text(p[key])) fail("Lesson text is too long or invalid.");
      payload[key] = p[key];
    }
    if (!Number.isInteger(p.minutes) || p.minutes < 0 || p.minutes > 480)
      fail("Next lesson time must be 0–480 minutes.");
    payload.minutes = p.minutes;
  }
  if (kind === "topic") {
    if (!topics.some((t) => t.id === id) || !levels.includes(p.level))
      fail("Invalid topic assessment.");
    payload = { level: p.level };
  }
  if (kind === "project") {
    if (
      !text(p.title, 160) ||
      !p.title.trim() ||
      !["Planned", "In progress", "Completed"].includes(p.status) ||
      !text(p.notes) ||
      !text(p.code) ||
      !text(p.url, 2000)
    )
      fail("Check the project fields.");
    if (p.url) {
      try {
        const url = new URL(p.url);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          fail(
            "Use a full http:// or https:// project link without credentials.",
          );
      } catch {
        fail("Use a valid project link.");
      }
    }
    payload = {
      title: p.title.trim(),
      status: p.status,
      notes: p.notes,
      code: p.code,
      url: p.url,
    };
  }
  if (kind === "reflection") {
    if (
      !text(p.lessonId, 80) ||
      !text(p.text) ||
      !p.text.trim() ||
      id !== `reflection-${p.lessonId}`
    )
      fail("Write a reflection for an existing class.");
    payload = { lessonId: p.lessonId, text: p.text };
  }
  return { id, kind, payload, revision } as {
    id: string;
    kind: string;
    payload: Record<string, any>;
    revision: number;
  };
}
export function mayWrite(role: string, kind: string) {
  return (
    role === "teacher" ||
    (role === "student" &&
      ["reflection", "project", "practice", "leetcode"].includes(kind))
  );
}
