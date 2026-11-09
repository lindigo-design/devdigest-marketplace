// Self-hosted fonts (spec CAT-01 R7/AC-5): fonts.css is generated, current, local-only, and uses the token family names.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { FACES, SUBSETS, render } from "../../scripts/fonts-css.mjs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("fonts.css is up to date with the @fontsource packages", () => {
  assert.equal(read("../../src/styles/fonts.css"), render(), "run: node scripts/fonts-css.mjs");
});

test("every face uses a family name declared in tokens.css", () => {
  const tokens = read("../../src/styles/tokens.css");
  for (const { family } of FACES) assert.ok(tokens.includes(`"${family}"`), `${family} not in tokens.css`);
});

test("no remote URLs, only bundled woff2 files", () => {
  const css = read("../../src/styles/fonts.css");
  assert.doesNotMatch(css, /https?:\/\//);
  for (const [, src] of css.matchAll(/url\("([^"]+)"\)/g)) assert.match(src, /^@fontsource(-variable)?\/[\w-]+\/files\/[\w-]+\.woff2$/);
});

test("Cyrillic is covered for every face (Ukrainian queries)", () => {
  assert.ok(SUBSETS.includes("cyrillic"));
  const css = read("../../src/styles/fonts.css");
  for (const { family } of FACES) {
    const faces = css.split("@font-face").filter((b) => b.includes(`"${family}"`));
    assert.ok(faces.some((b) => /U\+0400-045F/.test(b)), `${family}: no Cyrillic face`);
  }
});
