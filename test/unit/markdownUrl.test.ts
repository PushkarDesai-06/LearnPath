import { expect, it } from "vitest";
import { markdownUrl } from "@/lib/domain/markdownUrl";

it.each([
  "https://example.com", "http://example.com", "HTTPS://example.com",
  "mailto:learner@example.com", "/topics", "../lesson", "#practice", "?topic=SQL",
  "/learn/topic:lesson", "https://example.com/a%20b",
])("preserves safe Markdown URL %s", (url) => {
  expect(markdownUrl(url)).toBe(url);
});

it.each([
  "javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,bad",
  "vbscript:bad", "ftp://example.com", "file:///etc/passwd",
  "java\nscript:alert(1)", "\tjavascript:alert(1)", "https://example.com/\u0000",
])("removes unsafe Markdown URL %s", (url) => {
  expect(markdownUrl(url)).toBe("");
});
