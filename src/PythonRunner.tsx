import { useEffect, useRef, useState } from "react";
import runnerDocument from "./python-runner.html?raw";
export default function PythonRunner({ code }: { code: string }) {
  const [input, setInput] = useState(""),
    [output, setOutput] = useState(""),
    [status, setStatus] = useState("Ready"),
    [frame, setFrame] = useState<{
      id: string;
      code: string;
      input: string;
    } | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busy = frame !== null;
  function stop(label = "Stopped") {
    clearTimeout(timer.current);
    setFrame(null);
    setStatus(label);
  }
  useEffect(() => {
    if (!frame) return;
    const finish = (label: string) => {
      clearTimeout(timer.current);
      setFrame(null);
      setStatus(label);
    };
    timer.current = setTimeout(
      () => finish("Python took too long to load. Try again."),
      90000,
    );
    const receive = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "frame-ready") {
        frameRef.current?.contentWindow?.postMessage(
          {
            type: "run",
            runId: frame.id,
            code: frame.code,
            input: frame.input,
          },
          "*",
        );
        return;
      }
      if (data.runId !== frame.id) return;
      if (data.type === "running") {
        clearTimeout(timer.current);
        setStatus("Running…");
        timer.current = setTimeout(
          () => finish("Stopped after 10 seconds. Check for an endless loop."),
          10000,
        );
      }
      if (data.type === "output" && typeof data.text === "string")
        setOutput((p) => (p + data.text).slice(0, 20500));
      if (data.type === "error") {
        setOutput((p) =>
          (p + "\n" + String(data.text).slice(0, 12000)).slice(0, 33000),
        );
        finish("Check the error below");
      }
      if (data.type === "done") finish("Finished");
    };
    window.addEventListener("message", receive);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener("message", receive);
    };
  }, [frame]);
  return (
    <section className="python-runner" aria-label="Python runner">
      <label className="field">
        Program input (optional)
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"One answer per line, for input()\nExample: Thomman"}
        />
      </label>
      <div className="actions">
        <div>
          <button
            type="button"
            className="primary"
            disabled={busy || !code.trim()}
            onClick={() => {
              setOutput("");
              setStatus("Loading Python… First run may take a moment.");
              setFrame({ id: crypto.randomUUID(), code, input });
            }}
          >
            Run Python
          </button>{" "}
          <button
            type="button"
            className="secondary"
            disabled={!busy}
            onClick={() => stop()}
          >
            Stop
          </button>{" "}
          <button
            type="button"
            className="quiet"
            onClick={() => {
              stop("Ready");
              setOutput("");
            }}
          >
            Reset output
          </button>
        </div>
        <span role="status">{status}</span>
      </div>
      <p className="muted">
        Each run starts fresh. Run tests your code; Save progress keeps your
        solution. For input(), enter answers above before running.
      </p>
      <pre className="python-output" aria-label="Python output" tabIndex={0}>
        {output || "Output will appear here."}
      </pre>
      {frame && (
        <iframe
          key={frame.id}
          ref={frameRef}
          title="Isolated Python runtime"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          srcDoc={runnerDocument}
          style={{ display: "none" }}
        />
      )}
    </section>
  );
}
