// scripts/build-index.mjs: the catalog index built outside the site, as CI runs it on every PR.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildIndex } from "../../../scripts/build-index.mjs";
import { SCHEMA_VERSION } from "../../lib/index-json.mjs";
import { tempRepo } from "./helpers.mjs";

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../scripts/build-index.mjs");

describe("scripts/build-index.mjs", () => {
  test("builds the same index as the site, with counts", async () => {
    const repo = tempRepo("demo");
    try {
      const { index, counts } = await buildIndex({ repoRoot: repo.root, env: {}, now: new Date("2026-11-11T00:00:00Z") });
      assert.equal(index.schemaVersion, SCHEMA_VERSION);
      assert.equal(index.generated, "2026-11-11T00:00:00.000Z");
      assert.equal(index.entries.length, Object.values(counts).reduce((a, b) => a + b, 0));
      assert.ok(counts.plugin > 0);
    } finally {
      repo.cleanup();
    }
  });

  test("CLI writes --out and prints the counts", () => {
    const repo = tempRepo("demo");
    const dir = mkdtempSync(join(tmpdir(), "build-index-"));
    try {
      const out = join(dir, "nested", "index.json");
      const log = execFileSync(process.execPath, [SCRIPT, "--root", repo.root, "--out", out], { encoding: "utf8" });
      assert.match(log, /\d+ plugins, \d+ skills, .*entries, schemaVersion 1\)/);
      assert.equal(JSON.parse(readFileSync(out, "utf8")).schemaVersion, SCHEMA_VERSION);
    } finally {
      repo.cleanup();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("CLI exits 1 and names the broken file", () => {
    const repo = tempRepo("demo");
    try {
      repo.write("plugins/research-tools/skills/broken/SKILL.md", "no frontmatter");
      assert.throws(
        () => execFileSync(process.execPath, [SCRIPT, "--root", repo.root], { encoding: "utf8", stdio: "pipe" }),
        (err) => err.status === 1 && /skills\/broken\/SKILL\.md/.test(err.stderr),
      );
    } finally {
      repo.cleanup();
    }
  });
});
