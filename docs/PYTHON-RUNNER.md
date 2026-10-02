# Browser Python runner

Available in Daily Practice and LeetCode notebooks. Run executes the current solution without saving it; Save progress persists it as before. Input is pre-supplied, one answer per line. Empty input means EOF; a trailing empty line supplies a blank answer.

Pyodide 0.27.7 is loaded on demand from its pinned jsDelivr distribution. Each run gets a fresh classic Web Worker inside a sandboxed srcdoc iframe without allow-same-origin. The frame CSP limits scripts and connections to the pinned runtime path and prohibits app API access. The parent accepts messages only from its own frame and matches the run identifier. Code is passed via postMessage, never interpolated into HTML.

Loading has a 90-second limit; execution has a 10-second wall-clock limit. Stop, reset, closing the editor, or unmounting removes the frame and its worker. Output is bounded to 20,000 characters (plus an error message). This is intended for beginner text exercises, not arbitrary hostile workloads: browsers do not provide a strict per-worker memory quota. Files and variables are temporary; package installation, networking, graphical apps and project execution are not supported in this version.

Manually verified in Chrome using the same runner source: arithmetic, input, exceptions, output limit, and editor lifecycle controls. The runtime needs network access on first use and browser support for WebAssembly and Workers. No execution server or database migration is required.
