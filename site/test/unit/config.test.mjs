import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_BASE, DEFAULT_ORIGIN, absUrl, normalizeBase, normalizeOrigin, readConfig, sourceUrl, url,
} from "../../lib/config.mjs";

test("defaults match the spec (R6/AC-4)", () => {
  const c = readConfig({});
  assert.equal(c.origin, "https://lindigo-design.github.io");
  assert.equal(c.base, "/devdigest-marketplace/");
  assert.equal(c.origin, DEFAULT_ORIGIN);
  assert.equal(c.base, DEFAULT_BASE);
  assert.equal(c.ref, "main");
});

test("empty env values count as unset", () => {
  assert.deepEqual(readConfig({ SITE_ORIGIN: "", SITE_BASE: "  " }), readConfig({}));
});

test("custom domain and root base need no source change (R6/AC-5)", () => {
  const c = readConfig({ SITE_ORIGIN: "https://plugins.lindigo.design/", SITE_BASE: "/" });
  assert.equal(c.origin, "https://plugins.lindigo.design");
  assert.equal(c.base, "/");
  assert.equal(url(c.base, "sdd-engineering/"), "/sdd-engineering/");
  assert.equal(absUrl(c, "feed.xml"), "https://plugins.lindigo.design/feed.xml");
});

test("sub-path of another site", () => {
  const c = readConfig({ SITE_ORIGIN: "https://lindigo.design", SITE_BASE: "devdigest-marketplace" });
  assert.equal(absUrl(c, "/sdd-engineering/"), "https://lindigo.design/devdigest-marketplace/sdd-engineering/");
});

test("normalizeBase", () => {
  for (const [input, want] of [["", "/"], ["/", "/"], ["a", "/a/"], ["/a", "/a/"], ["/a/b/", "/a/b/"], ["//a//", "/a/"]]) {
    assert.equal(normalizeBase(input), want, input);
  }
  assert.throws(() => normalizeBase("/a/../b/"), /must not contain/);
});

test("normalizeOrigin rejects paths and non-http schemes", () => {
  assert.equal(normalizeOrigin("http://localhost:4321"), "http://localhost:4321");
  assert.throws(() => normalizeOrigin("https://example.com/sub"), /without a path/);
  assert.throws(() => normalizeOrigin("javascript:alert(1)"), /http\(s\)/);
});

test("url() joins base and path without double slashes", () => {
  assert.equal(url("/devdigest-marketplace/", "/index.json"), "/devdigest-marketplace/index.json");
  assert.equal(url("/devdigest-marketplace/"), "/devdigest-marketplace/");
});

test("sourceUrl points at the configured repo and ref", () => {
  const c = readConfig({ SITE_REF: "abc123" });
  assert.equal(
    sourceUrl(c, "plugins/sdd-engineering/README.md"),
    "https://github.com/lindigo-design/devdigest-marketplace/blob/abc123/plugins/sdd-engineering/README.md",
  );
});
