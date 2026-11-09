// Origin and base path come only from configuration (spec CAT-01 R6/AC-4, AC-5).
// Builds the demo twice, as the default project site and as a custom domain at "/", and scans every output
// file for internal links that ignore the configuration.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { FIXTURES, buildSite } from "./harness.mjs";

const VARIANTS = {
  default: { env: {}, origin: "https://lindigo-design.github.io", base: "/devdigest-marketplace/" },
  custom: { env: { SITE_ORIGIN: "https://plugins.lindigo.design", SITE_BASE: "/" }, origin: "https://plugins.lindigo.design", base: "/" },
};
const builds = {};

before(() => {
  for (const [name, v] of Object.entries(VARIANTS)) builds[name] = buildSite({ repoRoot: join(FIXTURES, "demo"), env: v.env });
});
after(() => Object.values(builds).forEach((b) => b.cleanup()));

/** Every URL-ish reference in a file: href/src/content attributes, CSS url(), JSON/XML string URLs. */
function references(text) {
  const out = [];
  for (const m of text.matchAll(/\b(?:href|src|content|action)="([^"]*)"/g)) out.push(m[1]);
  for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) out.push(m[1]);
  for (const m of text.matchAll(/"(https?:\/\/[^"]+)"/g)) out.push(m[1]);
  for (const m of text.matchAll(/<(?:id|uri)>([^<]+)<\//g)) out.push(m[1]);
  return out;
}

for (const [name, v] of Object.entries(VARIANTS)) {
  describe(`${name} build (origin ${v.origin}, base ${v.base})`, () => {
    test("every root-relative link, asset and the index URL starts with the base path", () => {
      const bad = [];
      for (const file of builds[name].pages().filter((f) => /\.(html|css|js|json|xml)$/.test(f))) {
        const text = readFileSync(join(builds[name].out, file), "utf8");
        for (const ref of references(text)) {
          if (ref.startsWith("/") && !ref.startsWith("//") && !ref.startsWith(v.base)) bad.push(`${file}: ${ref}`);
        }
      }
      assert.deepEqual(bad, []);
    });

    test("every absolute link to the site uses the configured origin and base", () => {
      const other = Object.values(VARIANTS).find((x) => x.origin !== v.origin).origin;
      const bad = [];
      for (const file of builds[name].pages().filter((f) => /\.(html|json|xml)$/.test(f))) {
        const text = readFileSync(join(builds[name].out, file), "utf8");
        if (text.includes(other)) bad.push(`${file}: mentions ${other}`);
        for (const ref of references(text)) {
          if (ref.startsWith(v.origin) && !ref.startsWith(`${v.origin}${v.base}`)) bad.push(`${file}: ${ref}`);
        }
      }
      assert.deepEqual(bad, []);
    });

    test("the client finds index.json through the configured base", () => {
      assert.match(builds[name].page(""), new RegExp(`<meta name="catalog-base" content="${v.base.replace(/\//g, "\\/")}">`));
      const index = JSON.parse(builds[name].page("index.json"));
      assert.equal(index.site, `${v.origin}${v.base}`);
      assert.equal(JSON.parse(builds[name].page("feed.json")).feed_url, `${v.origin}${v.base}feed.json`);
    });
  });
}
