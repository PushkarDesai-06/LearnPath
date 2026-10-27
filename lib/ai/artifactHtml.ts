/**
 * Model-written interactive artifacts: pull the HTML out of the artifact
 * agent's reply, reject what can't work in the sandbox, and wrap the fragment
 * in the server-owned document the artifact route serves.
 *
 * The validator is a QUALITY gate, not the security boundary. Security comes
 * from how the document is served (see ARTIFACT_CSP and the artifact route): a
 * CSP `sandbox allow-scripts` opaque origin with `connect-src 'none'`. The
 * checks here catch output that would silently break under those rules
 * (network calls, storage, external scripts) so runAgent's corrective retry
 * can ask for a fixed version instead of shipping a dead demo.
 */

/** Stored fragment size cap — generous for a single demo, small for Mongo. */
export const MAX_ARTIFACT_CHARS = 60_000;

/**
 * Served on the artifact response. `sandbox allow-scripts` (no
 * allow-same-origin) makes the document an opaque origin even when the URL is
 * opened directly, so model-written JS can never read cookies, call our API or
 * navigate the app.
 */
export const ARTIFACT_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
  "sandbox allow-scripts",
].join("; ");

/** `frame-ancestors` and `sandbox` are ignored in a meta tag, so leave them out. */
const META_CSP = ARTIFACT_CSP.split("; ")
  .filter((d) => !d.startsWith("frame-ancestors") && !d.startsWith("sandbox"))
  .join("; ");

/** Declarations (not uses) of the tokens BASE_CSS defines, e.g. `--bg: #fff`. */
const THEME_TOKEN_DECLARATION =
  /--(bg|surface|fg|muted|border|accent|accent-fg|highlight|danger|success|series-\d|radius|font|mono)\s*:/;

const FORBIDDEN: { pattern: RegExp; reason: string }[] = [
  { pattern: /<script[^>]*\ssrc\s*=/i, reason: "external <script src> (inline all JavaScript)" },
  { pattern: /<link\b/i, reason: "<link> tags (inline all CSS in <style>)" },
  { pattern: /<iframe\b/i, reason: "<iframe>" },
  { pattern: /<form\b/i, reason: "<form> (use inputs and buttons with event listeners)" },
  { pattern: /<base\b/i, reason: "<base>" },
  { pattern: /\bfetch\s*\(/, reason: "fetch() (there is no network access)" },
  { pattern: /\bXMLHttpRequest\b/, reason: "XMLHttpRequest (there is no network access)" },
  { pattern: /\b(WebSocket|EventSource)\b/, reason: "WebSocket/EventSource (there is no network access)" },
  { pattern: /\bimport\s*\(|^\s*import\s[^(]/m, reason: "import (use plain inline scripts, no modules)" },
  { pattern: /\b(localStorage|sessionStorage|indexedDB)\b/, reason: "browser storage (it throws in the sandbox; keep state in variables)" },
  { pattern: /\b(alert|confirm)\s*\(/, reason: "alert()/confirm() (blocked in the sandbox; show messages in the page)" },
  // The shell owns the palette; a redefined token (often a light theme) breaks the dark lesson.
  { pattern: THEME_TOKEN_DECLARATION, reason: "redefining the theme CSS variables (use them as given, never declare them)" },
  // The SVG/XHTML namespace URIs are identifiers, not fetches.
  { pattern: /https?:\/\/(?!www\.w3\.org\/)/i, reason: "external URLs (everything must be inline)" },
];

export type ExtractResult =
  | { ok: true; html: string }
  | { ok: false; error: string };

function unwrapDocument(html: string): string {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!body) {
    return html
      .replace(/<!doctype[^>]*>/gi, "")
      .replace(/<\/?(html|head|body)[^>]*>/gi, "")
      .trim();
  }
  // A full document: keep <style> blocks from <head>, then the body.
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  const styles = head.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? [];
  return [...styles, body[1]].join("\n").trim();
}

/**
 * Take the artifact agent's raw reply and return the HTML fragment, or an
 * error phrased as correction feedback for the retry.
 */
export function extractArtifactHtml(reply: string): ExtractResult {
  const fenced = reply.match(/```html\s*\n([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : reply.trim().startsWith("<") ? reply : null;
  if (!raw) {
    return { ok: false, error: "Reply must contain the demo in a single ```html fenced block." };
  }
  const html = unwrapDocument(raw);
  if (!html) return { ok: false, error: "The ```html block is empty." };
  if (html.length > MAX_ARTIFACT_CHARS) {
    return { ok: false, error: `The demo is too long (${html.length} characters; limit ${MAX_ARTIFACT_CHARS}). Make it simpler.` };
  }
  if (!/<script\b/i.test(html)) {
    return { ok: false, error: "The demo must be interactive: include an inline <script> that wires up its controls." };
  }
  const problems = FORBIDDEN.filter((f) => f.pattern.test(html)).map((f) => f.reason);
  if (problems.length) {
    return { ok: false, error: `The demo uses things that do not work in the sandbox: ${problems.join("; ")}.` };
  }
  return { ok: true, html };
}

/**
 * Theme tokens mirroring the app's monochrome palette (app/globals.css), so a
 * demo reads as part of the lesson. The artifact agent is told to use these.
 */
const BASE_CSS = `
:root {
  color-scheme: dark;
  --bg: oklch(0.22 0.012 200);
  --surface: oklch(0.26 0.014 200);
  --fg: oklch(0.97 0.005 200);
  --muted: oklch(0.66 0.01 200);
  --border: oklch(1 0 0 / 12%);
  --accent: oklch(0.93 0.008 200);
  --accent-fg: oklch(0.16 0.012 200);
  --highlight: oklch(0.8 0.09 75);
  --danger: oklch(0.72 0.1 25);
  --success: oklch(0.78 0.08 160);
  --series-1: oklch(0.93 0.008 200);
  --series-2: oklch(0.78 0.008 200);
  --series-3: oklch(0.64 0.008 200);
  --radius: 10px;
  --font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: ui-monospace, "SFMono-Regular", Menlo, monospace;
}
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.5 var(--font); }
body { padding: 16px; overflow-x: hidden; }
button {
  font: inherit; color: var(--accent-fg); background: var(--accent);
  border: 0; border-radius: 8px; padding: 6px 12px; cursor: pointer;
}
button:disabled { opacity: 0.5; cursor: default; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
input, select { font: inherit; color: var(--fg); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; }
input[type="range"] { accent-color: var(--accent); padding: 0; }
svg, canvas { max-width: 100%; }
`;

/** Reports height and uncaught errors to the lesson page (InteractiveBlock). */
const BRIDGE_JS = `
(function () {
  var post = function (msg) { try { parent.postMessage(msg, "*"); } catch (e) {} };
  var report = function () {
    post({ type: "lp-artifact-height", h: Math.ceil(document.documentElement.scrollHeight) });
  };
  window.addEventListener("error", function (e) {
    post({ type: "lp-artifact-error", message: String((e && e.message) || "error") });
  });
  window.addEventListener("load", report);
  document.addEventListener("DOMContentLoaded", function () {
    report();
    if (typeof ResizeObserver === "function") new ResizeObserver(report).observe(document.body);
  });
})();
`;

/** Wrap a validated fragment in the document the artifact route serves. */
export function buildArtifactDocument(fragment: string, title = "Interactive demo"): string {
  const safeTitle = title.replace(/[<>&"]/g, "");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${META_CSP}">
<title>${safeTitle}</title>
<style>${BASE_CSS}</style>
<script>${BRIDGE_JS}</script>
</head>
<body>
${fragment}
</body>
</html>`;
}
