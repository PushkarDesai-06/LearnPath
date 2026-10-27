/**
 * The artifact agent's reply → stored fragment → served document pipeline.
 * The extractor is a quality gate (the CSP sandbox is the security boundary),
 * so these pin down that sandbox-breaking output is rejected with feedback the
 * corrective retry can act on.
 */
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_CSP,
  MAX_ARTIFACT_CHARS,
  buildArtifactDocument,
  extractArtifactHtml,
} from "@/lib/ai/artifactHtml";

const DEMO = `<div id="out"></div>
<input type="range" id="n" min="1" max="10">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>
<script>
  const n = document.getElementById("n");
  n.addEventListener("input", () => { document.getElementById("out").textContent = n.value; });
</script>`;

const fenced = (html: string) => `Here you go:\n\`\`\`html\n${html}\n\`\`\`\n`;

describe("extractArtifactHtml", () => {
  it("extracts a fenced fragment and allows the SVG namespace URI", () => {
    expect(extractArtifactHtml(fenced(DEMO))).toEqual({ ok: true, html: DEMO });
  });

  it("accepts an unfenced reply that is just HTML", () => {
    expect(extractArtifactHtml(DEMO)).toMatchObject({ ok: true });
  });

  it("unwraps a full document, keeping head styles and the body", () => {
    const doc = `<!doctype html><html><head><style>.a{color:var(--fg)}</style><title>x</title></head><body>${DEMO}</body></html>`;
    const res = extractArtifactHtml(fenced(doc));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).toContain("<style>.a{color:var(--fg)}</style>");
      expect(res.html).toContain('id="out"');
      expect(res.html).not.toMatch(/<body|<html|<title/);
    }
  });

  it("rejects prose with no HTML", () => {
    expect(extractArtifactHtml("I would build a slider.")).toMatchObject({ ok: false });
  });

  it("requires a script, so the demo is actually interactive", () => {
    expect(extractArtifactHtml(fenced("<p>static</p>"))).toMatchObject({ ok: false });
  });

  it("rejects oversized output", () => {
    const big = `<script>${"x".repeat(MAX_ARTIFACT_CHARS)}</script>`;
    expect(extractArtifactHtml(fenced(big))).toMatchObject({ ok: false });
  });

  it.each([
    ['<script src="https://cdn.example/lib.js"></script>'],
    ['<link rel="stylesheet" href="a.css">'],
    ["<iframe></iframe>"],
    ["<form><button>go</button></form>"],
    ["<script>fetch('/api/me')</script>"],
    ["<script>new XMLHttpRequest()</script>"],
    ["<script>new WebSocket('ws://x')</script>"],
    ["<script>import('x')</script>"],
    ["<script>localStorage.setItem('a', 1)</script>"],
    ["<script>alert('hi')</script>"],
    ['<script>1</script><img src="https://example.com/a.png">'],
    ["<style>:root{--bg:#fff;--accent:#06f}</style><script>1</script>"],
  ])("rejects sandbox-breaking output: %s", (html) => {
    // A trailing script, so each case fails on its own rule, not "not interactive".
    const res = extractArtifactHtml(fenced(`${html}<script>1</script>`));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/do not work in the sandbox/);
  });
});

describe("buildArtifactDocument", () => {
  it("wraps the fragment with a CSP meta, theme tokens and the height/error bridge", () => {
    const doc = buildArtifactDocument(DEMO, "Binary <search>");
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc).toContain('http-equiv="Content-Security-Policy"');
    expect(doc).toContain("connect-src 'none'");
    expect(doc).toContain("--accent:");
    expect(doc).toContain("lp-artifact-height");
    expect(doc).toContain("lp-artifact-error");
    expect(doc).toContain("<title>Binary search</title>");
    // The bridge must be registered before the model's script runs.
    expect(doc.indexOf("lp-artifact-error")).toBeLessThan(doc.indexOf(DEMO));
  });

  it("serves a header CSP that sandboxes the document without same-origin", () => {
    expect(ARTIFACT_CSP).toContain("sandbox allow-scripts");
    expect(ARTIFACT_CSP).not.toContain("allow-same-origin");
    expect(ARTIFACT_CSP).toContain("frame-ancestors 'self'");
  });
});
