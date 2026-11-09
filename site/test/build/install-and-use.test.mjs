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

describe("R4: manage block", () => {
  const M = "lindigo-design/devdigest-marketplace";
  const manage = (path) => {
    const html = site.page(path);
    return html.slice(html.indexOf('id="manage"'), html.indexOf("</details>", html.indexOf('id="manage"')));
  };

  test("AC-1: collapsed disclosure with every action, session and terminal forms", () => {
    const html = manage("sdd-engineering/");
    assert.match(html, /^id="manage"[^>]*>/);
    assert.doesNotMatch(html.slice(0, html.indexOf(">")), /open/); // collapsed by default
    const t = text(html);
    for (const re of [
      /Update this plugin In a Claude Code session \/plugin → Installed → sdd-engineering → Update now In your terminal/,
      /Update every plugin from this marketplace In a Claude Code session \/plugin → Marketplaces → lindigo-devdigest → Update marketplace In your terminal Use a Claude Code session\./,
      /Turn on auto-update In a Claude Code session \/plugin → Marketplaces → lindigo-devdigest → Enable auto-update .*"autoUpdate": true/,
      /Disable In a Claude Code session \/plugin disable sdd-engineering@lindigo-devdigest Copy/,
      /Enable In a Claude Code session \/plugin enable sdd-engineering@lindigo-devdigest Copy/,
      /Uninstall In a Claude Code session \/plugin uninstall sdd-engineering@lindigo-devdigest Copy/,
      /Pin this release In a Claude Code session Use the terminal\./,
      /Auto-update is off by default for this marketplace\./,
    ]) assert.match(t, re);
  });

  test("AC-2: scope-dependent terminal commands, one variant per scope", () => {
    const t = text(manage("sdd-engineering/"));
    assert.match(t, /User claude plugin uninstall sdd-engineering@lindigo-devdigest --prune Copy Project claude plugin uninstall sdd-engineering@lindigo-devdigest --scope project --prune Copy Local claude plugin uninstall sdd-engineering@lindigo-devdigest --scope local --prune Copy/);
    assert.match(t, /Project claude plugin disable sdd-engineering@lindigo-devdigest --scope project Copy/);
    assert.match(t, /User claude plugin update sdd-engineering@lindigo-devdigest Copy/);
  });

  test("AC-3, AC-4: listing refresh note, --prune and the project uninstall choice", () => {
    const t = text(manage("sdd-engineering/"));
    assert.match(t, /claude plugin marketplace update without a name only refreshes the listings; it installs no new versions\./);
    assert.match(t, /--prune also removes the dependencies that were installed with it/);
    assert.match(t, /disable it for you only, or uninstall it for everyone/);
  });

  test("AC-5: pin = remove, add #tag, reinstall, with the whole-catalog warning", () => {
    const t = text(manage("sdd-engineering/"));
    assert.match(t, new RegExp(`User claude plugin marketplace remove lindigo-devdigest Copy claude plugin marketplace add ${M}#sdd-engineering--v0\\.1\\.0 Copy claude plugin install sdd-engineering@lindigo-devdigest Copy`));
    assert.match(t, /A pin applies to the whole catalog, not only to this plugin\. Removing the marketplace uninstalls every plugin installed from it and deletes their saved data/);
  });

  test("AC-6: the disable note names the dependents, only when there are some", () => {
    assert.match(text(manage("engineering-paved-path/")), /While a plugin that depends on it is enabled \(research-tools, architecture-review, sdd-engineering\), Claude Code refuses/);
    assert.doesNotMatch(text(manage("sdd-engineering/")), /While a plugin that depends on it/);
  });
});

describe("R5: download source", () => {
  test("AC-1, AC-2: link to the tag archive with the whole-repository note", () => {
    const html = site.page("sdd-engineering/");
    assert.match(html, /href="https:\/\/github\.com\/lindigo-design\/devdigest-marketplace\/archive\/refs\/tags\/sdd-engineering--v0\.1\.0\.zip"/);
    assert.match(text(html), /Download source \(\.zip\) The whole repository at the release tag sdd-engineering--v0\.1\.0\. To install, use the commands above\./);
  });

  test("AC-3: no tag → no link, and a build warning", () => {
    assert.doesNotMatch(site.page("research-tools/"), /archive\/refs\/tags/);
    assert.match(site.log, /no release tag research-tools--v0\.1\.0 yet/);
  });
});

describe("R6: try it after install", () => {
  test("AC-1: check that it loaded", () => {
    const t = text(site.page("research-tools/"));
    assert.match(t, /Try it after install Check that it loaded In a session, type \/ and look for \/research-tools: List installed plugins .* claude plugin list Copy See its components .* claude plugin details research-tools Copy/);
  });

  test("AC-1, AC-3: how to call each kind; agents by mention, by name, or delegated", () => {
    const sdd = text(site.page("sdd-engineering/"));
    assert.match(sdd, /Call it Skills: type \/sdd-engineering:write-spec Commands: type \/sdd-engineering:sdd Hooks run automatically; there is nothing to call\. MCP servers start with the session/);
    const rt = text(site.page("research-tools/"));
    assert.match(rt, /Agents: mention @agent-research-tools:brainstorm ?, @agent-research-tools:researcher You can also name the agent in plain words, or let Claude delegate .* claude --agent research-tools:brainstorm/);
  });

  test("AC-2: the first two README examples, prompt copyable without backticks, result rendered", () => {
    const html = site.page("sdd-engineering/");
    const t = text(html);
    assert.match(t, /Examples from the README \/sdd-engineering:write-spec Customers need invoices as PDF Copy specs\/invoice-pdf\.md with EARS criteria\. @agent-sdd-engineering:scope-guard plans a\|b Copy A pipe-escaped cell stays one cell\./);
    const tryIt = text(html.slice(html.indexOf('id="try-it"'), html.indexOf('id="manage"')));
    assert.doesNotMatch(tryIt, /A third row the catalog does not show/);
    assert.match(html, /<code[^>]*data-copy-text[^>]*>\/sdd-engineering:write-spec Customers need invoices as PDF<\/code>/);
    assert.match(html, /<strong>EARS<\/strong>/);
  });

  test("AC-4: no How to use table → no examples, other parts stay", () => {
    const t = text(site.page("architecture-review/"));
    assert.match(t, /Try it after install Check that it loaded/);
    assert.doesNotMatch(t, /Examples from the README/);
  });
});

describe("D3: page order", () => {
  test("install, components, try it, manage, latest change, README, compatibility notes", () => {
    const html = site.page("sdd-engineering/");
    const at = ['id="install"', 'id="components"', 'id="try-it"', 'id="manage"', 'id="latest"', "Fixture README for", 'id="compat-notes"'].map((s) => html.indexOf(s));
    assert.ok(at.every((i) => i > -1), JSON.stringify(at));
    assert.deepEqual([...at].sort((a, b) => a - b), at);
  });
});

export { section };
