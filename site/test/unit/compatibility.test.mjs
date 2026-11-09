// Compatibility badges (spec CAT-01 R10/AC-1–4; acceptance demo step 6).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildCatalog } from "../../lib/catalog.mjs";
import { badgeLabels, osBadges, parseCompatibility } from "../../lib/compatibility.mjs";
import { FIXTURES, tempRepo } from "./helpers.mjs";

const REPO = join(FIXTURES, "..", "..", "..");

describe("parseCompatibility", () => {
  test("real COMPATIBILITY.md: minimum, verified-on and OS (demo step 6)", () => {
    const text = readFileSync(join(REPO, "plugins/sdd-engineering/COMPATIBILITY.md"), "utf8").replace(/\r\n/g, "\n");
    const c = parseCompatibility(text);
    assert.equal(c.declared, true);
    assert.equal(c.claudeCode, "2.1.110");
    assert.equal(c.verifiedOn, "2.1.318");
    assert.deepEqual(c.os, ["Windows", "macOS"]);
    assert.equal(c.osRaw, "Windows 10/11, macOS");
    assert.deepEqual(badgeLabels(c), ["Claude Code ≥ 2.1.110", "Windows", "macOS"]);
  });

  test(">= is accepted like ≥; verified-on is optional", () => {
    const c = parseCompatibility("| | |\n|-|-|\n| Claude Code | >= 2.2.0 |\n| OS | Linux |\n");
    assert.equal(c.claudeCode, "2.2.0");
    assert.equal(c.verifiedOn, null);
    assert.deepEqual(c.os, ["Linux"]);
  });

  test("missing file → not declared (R10/AC-3)", () => {
    const c = parseCompatibility(null);
    assert.equal(c.declared, false);
    assert.deepEqual(badgeLabels(c), ["Compatibility not declared"]);
  });

  test("Claude Code row without ≥ X.Y.Z → not declared, OS still read", () => {
    const c = parseCompatibility("| | |\n| :- | :- |\n| Claude Code | latest |\n| OS | macOS |\n");
    assert.equal(c.declared, false);
    assert.match(c.reason, /no "≥ X\.Y\.Z"/);
    assert.deepEqual(badgeLabels(c), ["Compatibility not declared", "macOS"]);
  });

  test("only the first table counts", () => {
    const c = parseCompatibility("intro\n\n| | |\n|-|-|\n| OS | macOS |\n\ntext\n\n| | |\n|-|-|\n| Claude Code | ≥ 9.9.9 |\n");
    assert.equal(c.declared, false);
  });

  test("osBadges", () => {
    assert.deepEqual(osBadges("Windows 10/11, macOS, macOS 14; Linux (x64), FreeBSD"), ["Windows", "macOS", "Linux", "FreeBSD"]);
    assert.deepEqual(osBadges(null), []);
  });
});

describe("catalog integration", () => {
  test("plugins carry badges; components inherit them (R10/AC-2)", () => {
    const cat = buildCatalog({ repoRoot: join(FIXTURES, "demo"), history: false });
    for (const e of cat.entries) assert.deepEqual(e.compat, { declared: true, claudeCode: "2.1.110", verifiedOn: "2.1.318", os: ["Windows", "macOS"] }, e.id);
    assert.equal(cat.plugins[0].page.compatibility.osRaw, "Windows 10/11, macOS");
  });

  test("missing or undeclared → warning naming the file, build passes (R10/AC-3)", () => {
    const r = tempRepo("empty-scaffold");
    try {
      r.write("plugins/workflow/COMPATIBILITY.md", "| | |\n|-|-|\n| Claude Code | any |\n");
      const cat = buildCatalog({ repoRoot: r.root, history: false });
      const files = cat.warnings.filter((w) => /compatibility not declared/.test(w.reason)).map((w) => w.file);
      assert.deepEqual(files.sort(), ["plugins/base/COMPATIBILITY.md", "plugins/workflow/COMPATIBILITY.md"]);
      assert.ok(cat.entries.every((e) => e.compat.declared === false));
    } finally {
      r.cleanup();
    }
  });
});
