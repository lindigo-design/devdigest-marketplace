// CHANGELOG parsing (spec CAT-01 R8/AC-3, AC-4, AC-7; §7 same date, rollback, corrected items).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildCatalog } from "../../lib/catalog.mjs";
import {
  excerpt, isCalendarDate, parseChangelog, sectionUpdateTimes, sortReleases, updatedTime,
} from "../../lib/changelog.mjs";
import { CatalogError, Problems } from "../../lib/errors.mjs";
import { FIXTURES, tempRepo } from "./helpers.mjs";

const parse = (text) => {
  const p = new Problems();
  return { releases: parseChangelog(text, "plugins/x/CHANGELOG.md", p), errors: p.errors };
};

describe("parseChangelog", () => {
  const text = [
    "# Changelog — x", "", "## [Unreleased]", "", "### Added", "- pending", "",
    "## [0.2.0] — 2026-11-07", "", "### Added", "- **Bold** `code` and [a link](https://x.y).", "- Second.", "- Third.", "",
    "## [0.1.1] - 2026-11-03", "", "### Reverted", "- Undo 0.1.0.", "",
    "## [0.1.0] – 2026-11-01", "", "- First.", "",
  ].join("\n");

  test("dated sections only, Unreleased skipped (R8/AC-4)", () => {
    const { releases, errors } = parse(text);
    assert.deepEqual(errors, []);
    assert.deepEqual(releases.map((r) => [r.version, r.date]), [["0.2.0", "2026-11-07"], ["0.1.1", "2026-11-03"], ["0.1.0", "2026-11-01"]]);
    assert.ok(!JSON.stringify(releases).includes("pending"));
  });

  test("em dash, en dash and hyphen separators are accepted", () => {
    assert.equal(parse(text).releases.length, 3);
  });

  test("first 2 lines of notes as plain text (R8/AC-3)", () => {
    assert.deepEqual(parse(text).releases[0].excerpt, ["Bold code and a link.", "Second."]);
  });

  test("notes keep the full markdown of the section", () => {
    assert.match(parse(text).releases[0].notes, /^### Added\n- \*\*Bold\*\*[\s\S]*- Third\.$/);
  });

  test("### Reverted marks a rollback (§7)", () => {
    assert.deepEqual(parse(text).releases.map((r) => r.rollback), [false, true, false]);
  });

  for (const [title, head, reason] of [
    ["no date", "## [0.3.0]", /0\.3\.0 has no date/],
    ["unparseable date", "## [0.3.0] — 9 Nov 2026", /0\.3\.0 has no date/],
    ["impossible date", "## [0.3.0] — 2026-02-30", /0\.3\.0 has an invalid date "2026-02-30"/],
    ["not a version", "## [next] — 2026-11-01", /not a version/],
  ]) {
    test(`fails on ${title}, naming file and version (R8/AC-7)`, () => {
      const { errors } = parse(`## [Unreleased]\n\n${head}\n\n- x\n`);
      assert.equal(errors.length, 1);
      assert.equal(errors[0].file, "plugins/x/CHANGELOG.md");
      assert.match(errors[0].reason, reason);
    });
  }

  test("helpers", () => {
    assert.ok(isCalendarDate("2028", "02", "29"));
    assert.ok(!isCalendarDate("2026", "13", "01"));
    assert.deepEqual(excerpt("### Fixed\n\n1. One\n2. Two\n3. Three"), ["One", "Two"]);
  });
});

describe("release order and catalog integration", () => {
  const cat = buildCatalog({ repoRoot: join(FIXTURES, "demo"), history: false });

  test("newest first; same date ordered by plugin name (§7)", () => {
    assert.deepEqual(cat.releases.map((r) => `${r.plugin}@${r.version}`), [
      "architecture-review@0.1.1", "sdd-engineering@0.1.0",
      "engineering-paved-path@0.2.0", "research-tools@0.1.0",
      "architecture-review@0.1.0", "engineering-paved-path@0.1.0",
    ]);
    assert.equal(cat.lastRelease, "2026-11-08");
  });

  test("same plugin, same date: higher version first", () => {
    const rs = sortReleases([
      { plugin: "a", version: "0.1.0", date: "2026-11-01" },
      { plugin: "a", version: "0.1.1", date: "2026-11-01" },
    ]);
    assert.deepEqual(rs.map((r) => r.version), ["0.1.1", "0.1.0"]);
  });

  test("latest CHANGELOG entry on the plugin page (R5/AC-2)", () => {
    const p = cat.plugins.find((x) => x.name === "engineering-paved-path");
    assert.equal(p.page.latestRelease.version, "0.2.0");
  });

  test("without history, updated = release day", () => {
    assert.equal(cat.releases[0].updated, "2026-11-08T00:00:00Z");
  });

  test("a bad date anywhere fails the whole build", () => {
    const r = tempRepo("demo");
    try {
      r.write("plugins/research-tools/CHANGELOG.md", "# C\n\n## [Unreleased]\n\n## [0.1.0]\n\n- x\n");
      assert.throws(() => buildCatalog({ repoRoot: r.root, history: false }), (err) =>
        err instanceof CatalogError && /plugins\/research-tools\/CHANGELOG\.md: version 0\.1\.0 has no date/.test(err.message));
    } finally {
      r.cleanup();
    }
  });

  test("no dated releases → empty list, build passes (R9/AC-5 input)", () => {
    const r = tempRepo("empty-scaffold");
    try {
      for (const p of ["base", "workflow"]) r.write(`plugins/${p}/CHANGELOG.md`, "# C\n\n## [Unreleased]\n");
      const c = buildCatalog({ repoRoot: r.root, history: false });
      assert.deepEqual(c.releases, []);
      assert.equal(c.lastRelease, null);
    } finally {
      r.cleanup();
    }
  });
});

describe("updated times from git history (§7 corrected items)", () => {
  test("updatedTime never goes before the release day", () => {
    assert.equal(updatedTime("2026-11-08", undefined), "2026-11-08T00:00:00Z");
    assert.equal(updatedTime("2026-11-08", "2026-11-07T10:00:00+00:00"), "2026-11-08T00:00:00Z");
    assert.equal(updatedTime("2026-11-08", "2026-11-09T10:00:00+02:00"), "2026-11-09T08:00:00Z");
  });

  test("a section's time changes only when that section changes", () => {
    const r = tempRepo(null);
    // Hermetic git: no user/system config (no signing, hooks or identity from the machine).
    const empty = join(r.root, ".gitconfig-empty");
    writeFileSync(empty, "");
    const env = { ...process.env, GIT_CONFIG_GLOBAL: empty, GIT_CONFIG_NOSYSTEM: "1" };
    const git = (args, date) =>
      execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
        cwd: r.root, stdio: "ignore", env: { ...env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) },
      });
    const file = "plugins/x/CHANGELOG.md";
    const commit = (text, date) => { r.write(file, text); git(["add", "-A"]); git(["commit", "-q", "-m", "c"], date); };
    try {
      git(["init", "-q"]);
      commit("## [Unreleased]\n\n## [0.1.0] — 2026-11-01\n\n- First.\n", "2026-11-01T10:00:00Z");
      commit("## [Unreleased]\n\n## [0.2.0] — 2026-11-05\n\n- Second.\n\n## [0.1.0] — 2026-11-01\n\n- First.\n", "2026-11-05T10:00:00Z");
      commit("## [Unreleased]\n\n## [0.2.0] — 2026-11-05\n\n- Second.\n\n## [0.1.0] — 2026-11-01\n\n- First, corrected.\n", "2026-11-06T10:00:00Z");
      const t = sectionUpdateTimes(r.root, file);
      assert.equal(new Date(t.get("0.2.0")).toISOString(), "2026-11-05T10:00:00.000Z");
      assert.equal(new Date(t.get("0.1.0")).toISOString(), "2026-11-06T10:00:00.000Z");
    } finally {
      r.cleanup();
    }
  });

  test("outside a git repository → empty map (fallback)", () => {
    const r = tempRepo("empty-scaffold");
    try {
      assert.equal(sectionUpdateTimes(r.root, "plugins/base/CHANGELOG.md").size, 0);
    } finally {
      r.cleanup();
    }
  });
});

describe("same-day releases: the one released last comes first (polish after CAT-02)", () => {
  test("sortReleases: same date → later release time first, even against plugin-name order", () => {
    const rs = sortReleases([
      { plugin: "architecture-review", version: "1.0.0", date: "2026-11-09", released: "2026-11-09T10:00:00Z" },
      { plugin: "research-tools", version: "1.0.1", date: "2026-11-09", released: "2026-11-09T18:00:00Z" },
      { plugin: "engineering-paved-path", version: "1.0.0", date: "2026-11-09", released: "2026-11-09T10:00:00Z" },
      { plugin: "zeta", version: "0.1.0", date: "2026-11-08", released: "2026-11-09T20:00:00Z" }, // older date stays last
    ]);
    assert.deepEqual(rs.map((r) => `${r.plugin}@${r.version}`),
      ["research-tools@1.0.1", "architecture-review@1.0.0", "engineering-paved-path@1.0.0", "zeta@0.1.0"]);
  });

  test("from git: two releases on the same date, ordered by their release commit; a later correction does not reorder", () => {
    const r = tempRepo("demo");
    const empty = join(r.root, ".gitconfig-empty");
    writeFileSync(empty, "");
    const env = { ...process.env, GIT_CONFIG_GLOBAL: empty, GIT_CONFIG_NOSYSTEM: "1" };
    const git = (args, date) =>
      execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
        cwd: r.root, stdio: "ignore", env: { ...env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) },
      });
    const commit = (date) => { git(["add", "-A"]); git(["commit", "-q", "-m", "c"], date); };
    const read = (file) => readFileSync(join(r.root, file), "utf8").replace(/\r\n/g, "\n");
    // A new dated section right under [Unreleased], as scripts/release.mjs writes it.
    const release = (plugin, notes) => {
      const file = `plugins/${plugin}/CHANGELOG.md`;
      r.write(file, read(file).replace("## [Unreleased]\n", `## [Unreleased]\n\n## [9.0.0] — 2026-11-20\n\n### Changed\n- ${notes}\n`));
    };
    try {
      git(["init", "-q"]);
      commit("2026-11-19T10:00:00Z");
      release("architecture-review", "First release of the day.");
      commit("2026-11-20T10:00:00Z");
      release("research-tools", "Second release of the day.");
      commit("2026-11-20T11:00:00Z");
      const correct = (s) => s.replace("First release of the day.", "First release of the day, corrected.");
      const arFile = "plugins/architecture-review/CHANGELOG.md";
      r.write(arFile, correct(read(arFile)));
      commit("2026-11-20T12:00:00Z");

      const cat = buildCatalog({ repoRoot: r.root, history: true, tags: new Set() });
      const sameDay = cat.releases.filter((x) => x.date === "2026-11-20");
      assert.deepEqual(sameDay.map((x) => x.plugin), ["research-tools", "architecture-review"]);
      assert.equal(sameDay[0].released, "2026-11-20T11:00:00Z");
      assert.equal(sameDay[1].released, "2026-11-20T10:00:00Z");
      assert.equal(sameDay[1].updated, "2026-11-20T12:00:00Z", "the correction changes updated (feeds), not the order");
    } finally {
      r.cleanup();
    }
  });
});
