// R7/AC-6: colors, spacing, type, radius and motion come from tokens.css only.
// Scans CSS files and the <style> blocks / style="" attributes of .astro components for raw values.
// Allowed: media query conditions (custom properties cannot be used there) and lines marked "lint-allow".
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../../src", import.meta.url));
const EXEMPT = new Set(["styles/tokens.css", "styles/fonts.css"]);

const RULES = [
  [/#[0-9a-f]{3,8}\b/i, "raw hex color"],
  [/\b(?:rgba?|hsla?|oklch|lab|lch)\(/i, "raw color function"],
  [/(?<![\w-])\d*\.?\d+(?:px|rem)\b/, "raw px/rem value"],
  [/(?<![\w-])\d*\.?\d+m?s\b/, "raw duration"],
  [/cubic-bezier\(/, "raw easing"],
  [/font-weight:\s*\d/, "raw font weight"],
  [/line-height:\s*\d/, "raw line height"],
];

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(join(dir, d.name)) : /\.(css|astro)$/.test(d.name) ? [join(dir, d.name)] : []);
}

/** CSS text of a file with its starting line numbers: whole .css files, <style> blocks and style="" in .astro. */
function cssChunks(file, text) {
  if (file.endsWith(".css")) return [{ css: text, line: 1 }];
  const chunks = [];
  const lineAt = (i) => text.slice(0, i).split("\n").length;
  for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) chunks.push({ css: m[1], line: lineAt(m.index) });
  for (const m of text.matchAll(/\sstyle="([^"]*)"/g)) chunks.push({ css: m[1], line: lineAt(m.index) });
  return chunks;
}

test("no raw design values outside tokens.css (R7/AC-6)", () => {
  const problems = [];
  for (const file of files(SRC)) {
    const rel = relative(SRC, file).replace(/\\/g, "/");
    if (EXEMPT.has(rel)) continue;
    for (const { css, line } of cssChunks(file, readFileSync(file, "utf8"))) {
      css.split("\n").forEach((l, i) => {
        const code = l.replace(/\/\*.*?\*\//g, "");
        if (/lint-allow/.test(l) || /^\s*@media\b/.test(code)) return;
        for (const [re, what] of RULES) if (re.test(code)) problems.push(`src/${rel}:${line + i}: ${what}: ${l.trim()}`);
      });
    }
  }
  assert.deepEqual(problems, []);
});

test("the lint catches what it should", () => {
  const bad = ["color: #fff;", "margin: 12px;", "transition: color 120ms;", "font-weight: 600;", "background: rgb(0 0 0);"];
  for (const l of bad) assert.ok(RULES.some(([re]) => re.test(l)), l);
  const ok = ["color: var(--ink-primary);", "letter-spacing: 0.08em;", "flex: 1 1 0;", "grid-column: 1 / 3;"];
  for (const l of ok) assert.ok(!RULES.some(([re]) => re.test(l)), l);
});
