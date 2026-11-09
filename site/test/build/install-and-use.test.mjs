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

describe("R2, R3: install panel", () => {
  const M = "lindigo-design/devdigest-marketplace";
  const variant = (html, surface, scope) => {
    const panel = html.slice(html.indexOf(`data-surface-panel="${surface}"`));
    const start = panel.indexOf(`data-scope="${scope}"`);
    const next = panel.indexOf("data-scope=", start + 12);
    return text(panel.slice(start, next > -1 ? next : undefined));
  };

  test("AC-1, AC-2: scope radios with who and where, default User; the panel replaces the old block", () => {
    const html = site.page("sdd-engineering/");
    const t = text(html);
    assert.match(t, /Who gets it User you, in every project · ~\/\.claude\/settings\.json Project everyone in this repository · \.claude\/settings\.json, committed Local you, in this repository only · \.claude\/settings\.local\.json, not committed/);
    assert.match(html, /<input type="radio" name="install-scope" value="user" checked/);
    assert.equal((html.match(/id="install"/g) ?? []).length, 1);
  });

  test("R3/AC-1: two tabs in a tablist, session selected, with panels", () => {
    const html = site.page("sdd-engineering/");
    assert.match(html, /role="tablist" aria-label="Where you run it"/);
    assert.match(html, /role="tab"[^>]*aria-controls="install-panel-session"[^>]*aria-selected="true"[^>]*tabindex="0"[^>]*>In a Claude Code session/);
    assert.match(html, /role="tab"[^>]*aria-controls="install-panel-terminal"[^>]*aria-selected="false"[^>]*tabindex="-1"[^>]*>In your terminal/);
    assert.match(html, /id="install-panel-terminal" role="tabpanel" aria-labelledby="install-tab-terminal"/);
  });

  test("R2/AC-4, R3/AC-3: session commands and the panel option per scope", () => {
    const html = site.page("sdd-engineering/");
    for (const [scope, option] of [["user", "Install for you \\(user scope\\)"], ["project", "Install for all collaborators on this repository \\(project scope\\)"], ["local", "Install for you, in this repo only \\(local scope\\)"]]) {
      const v = variant(html, "session", scope);
      assert.match(v, new RegExp(`/plugin install sdd-engineering --marketplace ${M} Copy`));
      assert.match(v, /details open; nothing is installed yet/);
      assert.match(v, new RegExp(`Choose ${option}`));
    }
  });

  test("R2/AC-4: terminal commands per scope, then reload", () => {
    const html = site.page("sdd-engineering/");
    assert.match(variant(html, "terminal", "user"), new RegExp(`Run in your terminal: claude plugin install sdd-engineering --marketplace ${M} Copy Restart Claude Code, or run /reload-plugins`));
    assert.match(variant(html, "terminal", "project"), new RegExp(`claude plugin marketplace add ${M} --scope project Copy claude plugin install sdd-engineering@lindigo-devdigest --scope project Copy`));
    assert.match(variant(html, "terminal", "local"), new RegExp(`claude plugin install sdd-engineering --marketplace ${M} --scope local Copy`));
  });

  test("R2/AC-5, AC-6: project scope shows the settings file, git add, the note and the fallback", () => {
    const html = site.page("sdd-engineering/");
    for (const surface of ["session", "terminal"]) {
      const v = variant(html, surface, "project");
      assert.match(v, /The commands write this \.claude\/settings\.json: \{ "enabledPlugins": \{ "sdd-engineering@lindigo-devdigest": true, "engineering-paved-path@lindigo-devdigest": true, "research-tools@lindigo-devdigest": true, "architecture-review@lindigo-devdigest": true \}, "extraKnownMarketplaces": \{ "lindigo-devdigest": \{ "source": \{ "source": "github", "repo": "lindigo-design\/devdigest-marketplace" \} \} \} \} Copy/);
      assert.match(v, /Commit it: git add \.claude\/settings\.json Copy/);
      assert.match(v, /load without a separate install\. Each collaborator needs Claude Code ≥ 2\.1\.110\. Hooks need Node\.js on PATH\./);
      assert.match(v, /run this once: claude plugin install sdd-engineering@lindigo-devdigest --scope project Copy/);
    }
    assert.match(variant(html, "session", "project"), new RegExp(`record the marketplace in the repository for collaborators .*claude plugin marketplace add ${M} --scope project Copy`));
    // The JSON keeps its line breaks and indentation for copying.
    assert.match(html, /<code class="t-mono" data-copy-text[^>]*>\{\n {2}&quot;enabledPlugins&quot;: \{\n {4}&quot;sdd-engineering@lindigo-devdigest&quot;: true,/);
  });

  test("R2/AC-7: local scope note; no Node.js note for a plugin without hooks", () => {
    const html = site.page("research-tools/");
    assert.match(variant(html, "terminal", "local"), /\.claude\/settings\.local\.json is personal and is not committed\./);
    assert.doesNotMatch(variant(html, "terminal", "project"), /Node\.js/);
  });

  test("R2/AC-1, F7: dependencies installed at the same scope", () => {
    assert.match(text(site.page("sdd-engineering/")), /Also installs, at the same scope: engineering-paved-path \^0\.2, research-tools \^0\.1, architecture-review \^0\.1/);
  });

  test("R2/AC-8: context cost, and the total only when every dependency declares one", () => {
    assert.match(text(site.page("research-tools/")), /Adds ~155 tokens to every session\. With its dependencies: ~501 tokens\./);
    const sdd = text(site.page("sdd-engineering/"));
    assert.match(sdd, /Adds ~1,492 tokens to every session\./);
    assert.doesNotMatch(sdd, /With its dependencies/); // architecture-review declares none
    assert.doesNotMatch(text(site.page("architecture-review/")), /tokens to every session/);
  });

  test("R2/AC-10: without JavaScript every variant has a heading", () => {
    const html = site.page("sdd-engineering/");
    assert.equal((html.match(/class="t-label ip__nojs-title"/g) ?? []).length, 2 + 6);
  });

  test("R7/AC-5: commands come from data (marketplace name and SITE_REPO)", () => {
    const fork = buildSite({ repoRoot: join(FIXTURES, "demo"), env: { SITE_REPO: "https://github.com/someone/fork-of-marketplace" } });
    try {
      const t = text(fork.page("research-tools/"));
      assert.match(t, /claude plugin install research-tools --marketplace someone\/fork-of-marketplace Copy/);
      assert.match(t, /"repo": "someone\/fork-of-marketplace"/);
      assert.match(t, /"research-tools@lindigo-devdigest": true/);
    } finally {
      fork.cleanup();
    }
  });
});

export { section };
