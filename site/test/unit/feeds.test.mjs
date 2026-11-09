// Atom and JSON feeds (spec CAT-01 R9/AC-1–5; §7 corrected items, rollback, same-date order).
import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, test } from "node:test";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { buildCatalog } from "../../lib/catalog.mjs";
import { readConfig } from "../../lib/config.mjs";
import { MAX_ITEMS, buildAtom, buildJsonFeed } from "../../lib/feeds.mjs";
import { FIXTURES, tempRepo } from "./helpers.mjs";

const config = readConfig({});
const demo = buildCatalog({ repoRoot: join(FIXTURES, "demo"), history: false });
const parse = (xml) => new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", isArray: (n) => n === "entry" }).parse(xml);
const SITE = "https://lindigo-design.github.io/devdigest-marketplace/";

describe("Atom (feed.xml)", () => {
  const xml = buildAtom(demo, config, { now: new Date("2026-11-09T12:00:00Z") });
  const feed = parse(xml).feed;

  test("is well-formed XML in the Atom namespace", () => {
    assert.equal(XMLValidator.validate(xml), true);
    assert.equal(feed["@xmlns"], "http://www.w3.org/2005/Atom");
  });

  test("has the required feed elements", () => {
    assert.equal(feed.id, "tag:github.com,2026:lindigo-design/devdigest-marketplace/releases");
    assert.equal(feed.title, "lindigo-devdigest releases");
    assert.equal(feed.updated, "2026-11-08T00:00:00Z");
    assert.ok(feed.author.name);
    assert.equal(feed.link.find((l) => l["@rel"] === "self")["@href"], `${SITE}feed.xml`);
  });

  test("one entry per release, same order as What's new (R9/AC-1)", () => {
    assert.deepEqual(feed.entry.map((e) => e.title), demo.releases.map((r) => `${r.plugin} ${r.version}`));
  });

  test("entry: stable id, title, dates, notes, absolute link (R9/AC-2, AC-3)", () => {
    const e = feed.entry.find((x) => x.title === "engineering-paved-path 0.2.0");
    assert.equal(e.id, "tag:github.com,2026:lindigo-design/devdigest-marketplace/engineering-paved-path--v0.2.0");
    assert.equal(e.link["@href"], `${SITE}engineering-paved-path/`);
    assert.equal(e.published, "2026-11-07T00:00:00Z");
    assert.equal(e.updated, "2026-11-07T00:00:00Z");
    assert.match(e.content["#text"], /<li>Security rubric skill with OWASP categories\.<\/li>/);
    assert.equal(e.content["@type"], "html");
  });

  test("rollback releases carry a category (§7)", () => {
    const e = feed.entry.find((x) => x.title === "architecture-review 0.1.1");
    assert.equal(e.category["@term"], "rollback");
  });

  test("ids do not depend on the site host (R6/AC-5)", () => {
    const moved = buildAtom(demo, readConfig({ SITE_ORIGIN: "https://plugins.lindigo.design", SITE_BASE: "/" }));
    assert.deepEqual(parse(moved).feed.entry.map((e) => e.id), feed.entry.map((e) => e.id));
    assert.match(moved, /href="https:\/\/plugins\.lindigo\.design\/engineering-paved-path\/"/);
  });

  test("escapes markup and drops characters XML forbids", () => {
    const tricky = { ...demo, releases: [{ ...demo.releases[0], notes: "- a < b & \"c\" \u0007 <script>x</script>", excerpt: ["a < b & c"] }] };
    const out = buildAtom(tricky, config);
    assert.equal(XMLValidator.validate(out), true);
    assert.doesNotMatch(parse(out).feed.entry[0].content["#text"], /<script/);
  });
});

describe("JSON Feed 1.1 (feed.json)", () => {
  const feed = buildJsonFeed(demo, config);

  test("required top-level fields", () => {
    assert.equal(feed.version, "https://jsonfeed.org/version/1.1");
    assert.equal(feed.title, "lindigo-devdigest releases");
    assert.equal(feed.home_page_url, SITE);
    assert.equal(feed.feed_url, `${SITE}feed.json`);
  });

  test("items: id <plugin>--v<version>, title, dates, html notes, absolute url", () => {
    const i = feed.items.find((x) => x.id === "architecture-review--v0.1.1");
    assert.equal(i.title, "architecture-review 0.1.1");
    assert.equal(i.url, `${SITE}architecture-review/`);
    assert.equal(i.date_published, "2026-11-08T00:00:00Z");
    assert.match(i.content_html, /Roll back the gate hook timeout change/);
    assert.deepEqual(i.tags, ["rollback"]);
    assert.deepEqual(feed.items.map((x) => x.id), demo.releases.map((r) => `${r.plugin}--v${r.version}`));
  });
});

describe("limits and empty feeds", () => {
  test(`at most ${MAX_ITEMS} items`, () => {
    const many = { ...demo, releases: Array.from({ length: 60 }, (_, k) => ({ ...demo.releases[0], version: `0.${k}.0` })) };
    assert.equal(buildJsonFeed(many, config).items.length, MAX_ITEMS);
    assert.equal(parse(buildAtom(many, config)).feed.entry.length, MAX_ITEMS);
  });

  test("no dated releases → valid feeds with zero items (R9/AC-5)", () => {
    const r = tempRepo("empty-scaffold");
    try {
      for (const p of ["base", "workflow"]) r.write(`plugins/${p}/CHANGELOG.md`, "# C\n\n## [Unreleased]\n");
      const cat = buildCatalog({ repoRoot: r.root, history: false });
      const xml = buildAtom(cat, config, { now: new Date("2026-11-09T12:00:00Z") });
      assert.equal(XMLValidator.validate(xml), true);
      assert.equal(parse(xml).feed.entry, undefined);
      assert.equal(parse(xml).feed.updated, "2026-11-09T12:00:00Z");
      assert.deepEqual(buildJsonFeed(cat, config).items, []);
    } finally {
      r.cleanup();
    }
  });

  test("a corrected item keeps its id and gets a new updated time (§7)", () => {
    const fixed = { ...demo, releases: demo.releases.map((r, k) => (k === 0 ? { ...r, updated: "2026-11-10T09:00:00Z" } : r)) };
    const a = buildJsonFeed(demo, config).items[0];
    const b = buildJsonFeed(fixed, config).items[0];
    assert.equal(a.id, b.id);
    assert.notEqual(a.date_modified, b.date_modified);
  });
});
