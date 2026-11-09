// Plugin page: install and use (spec CAT-02), built from the demo fixture.
import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { FIXTURES, buildSite, text } from "./harness.mjs";

const BASE = "/devdigest-marketplace/";
let site;
const section = (html, id) => {
  const start = html.indexOf(`id="${id}"`);
  assert.ok(start > -1, `no #${id}`);
  const end = html.indexOf("</section>", start);
  return html.slice(start, end);
};

before(() => {
  // sdd-engineering's release is tagged; the other plugins are not (R5/AC-1, AC-3).
  site = buildSite({ repoRoot: join(FIXTURES, "demo"), env: { CATALOG_RELEASE_TAGS: "sdd-engineering--v0.1.0" } });
});
after(() => site?.cleanup());

describe("R1: components grouped by kind", () => {
  test("AC-1: kind order with counts; empty kinds omitted", () => {
    const t = text(site.page("sdd-engineering/"));
    const order = ["Skill · 1", "Command · 1", "Hooks · 2", "MCP servers · 2"].map((h) => t.indexOf(h));
    assert.ok(order.every((i) => i > -1), JSON.stringify(order));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.doesNotMatch(t, /Agents? · \d/);
    assert.match(text(site.page("research-tools/")), /Agents · 2/);
  });

  test("AC-3: name links to the page; first sentence visible, full description kept for screen readers", () => {
    const html = site.page("architecture-review/");
    const row = html.slice(html.indexOf('data-component="architecture-review/agent/architecture-reviewer"'));
    assert.match(row, new RegExp(`href="${BASE}architecture-review/agent/architecture-reviewer/"`));
    assert.match(row, /class="[^"]*cg__desc[^"]*" aria-hidden="true"/);
    assert.match(row, /class="visually-hidden"/);
  });

  test("AC-4, AC-5: invocations in mono and who starts it", () => {
    const t = text(site.page("sdd-engineering/"));
    assert.match(t, /write-spec .*\/sdd-engineering:write-spec <feature request> you start it; Claude does not load it on its own/);
    assert.match(t, /\/sdd-engineering:sdd <spec\|plan\|implement\|test\|verify\|document>/);
    assert.match(t, /runs automatically/);
    assert.match(text(site.page("research-tools/")), /@agent-research-tools:researcher mention it, or Claude delegates to it when relevant/);
    assert.match(text(site.page("engineering-paved-path/")), /\/engineering-paved-path:security you can start it; Claude also loads it when relevant/);
  });

  test("AC-6: agent row lists preloaded skills, naming another plugin", () => {
    const t = text(site.page("architecture-review/"));
    assert.match(t, /Preloads: security \(engineering-paved-path\) ?, pr-self-review(?! \()/);
    const html = site.page("architecture-review/");
    assert.match(html, new RegExp(`href="${BASE}engineering-paved-path/skill/security/"`));
  });

  test("AC-7: skill row lists the agents that preload it, across plugins", () => {
    const t = text(site.page("engineering-paved-path/"));
    assert.match(t, /Preloaded by: security-reviewer \(architecture-review\)/);
  });

  test("AC-8: relations on component pages too", () => {
    assert.match(text(site.page("engineering-paved-path/skill/security/")), /Preloaded by: security-reviewer \(architecture-review\)/);
    assert.match(text(site.page("architecture-review/agent/security-reviewer/")), /Preloads: security \(engineering-paved-path\) ?, pr-self-review/);
  });

  test("AC-9: a missing skill is plain text, and the build warns", () => {
    const html = site.page("research-tools/");
    assert.match(text(html), /Preloads: engineering-paved-path:threat-model/);
    assert.doesNotMatch(html, /href="[^"]*threat-model/);
    assert.match(site.log, /brainstorm\.md: skills: "engineering-paved-path:threat-model" is not a skill in the catalog/);
  });

  test("AC-2: a plugin without components keeps the empty state", () => {
    const empty = buildSite({ repoRoot: join(FIXTURES, "empty-scaffold") });
    try {
      const t = text(empty.page(empty.pages().find((p) => /^[^/]+\/index\.html$/.test(p) && p !== "404/index.html").replace("index.html", "")));
      assert.match(t, /No components yet/);
      assert.doesNotMatch(t, /· \d/);
    } finally {
      empty.cleanup();
    }
  });
});

export { section };
