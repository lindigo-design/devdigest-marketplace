// tokens.css must stay a verbatim copy of design-tokens.md §8 (spec CAT-01 R7/AC-6; CLAUDE.md: token change → doc first).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");

function tokenBlockFromDoc() {
  const doc = read("../../../docs/design/design-tokens.md");
  const section = doc.slice(doc.indexOf("\n## 8."));
  const m = /```css\n([\s\S]*?)```/.exec(section);
  assert.ok(m, "design-tokens.md §8 has no ```css block");
  return m[1];
}

test("tokens.css body equals design-tokens.md §8", () => {
  const css = read("../../src/styles/tokens.css");
  const body = css.replace(/^\/\*[\s\S]*?\*\/\n\n/, "");
  assert.equal(body, tokenBlockFromDoc());
});

test("tokens.css header names its source and date", () => {
  const css = read("../../src/styles/tokens.css");
  assert.match(css, /^\/\*[\s\S]*docs\/design\/design-tokens\.md[\s\S]*\d{4}-\d{2}-\d{2}[\s\S]*?\*\//);
});
