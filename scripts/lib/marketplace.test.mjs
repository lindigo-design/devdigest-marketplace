// Run: node --test scripts/
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addUnreleasedNote, bump, caretFor, changelogVersions, compare, dependentsOf, insertRelease, satisfies,
  unreleasedNotes,
} from "./marketplace.mjs";

test("bump", () => {
  assert.equal(bump("0.1.0", "patch"), "0.1.1");
  assert.equal(bump("0.1.3", "minor"), "0.2.0");
  assert.equal(bump("0.9.3", "major"), "1.0.0");
  assert.equal(bump("1.0.0-rc.1", "patch"), "1.0.0");
  assert.equal(bump("0.1.0", "0.3.0"), "0.3.0");
  assert.throws(() => bump("0.1.0", "huge"));
});

test("compare", () => {
  assert.equal(compare("0.2.0", "0.1.9"), 1);
  assert.equal(compare("1.0.0", "1.0.0-rc.1"), 1);
  assert.equal(compare("0.1.0", "0.1.0"), 0);
});

test("satisfies: caret on 0.x pins the minor", () => {
  assert.equal(satisfies("0.1.7", "^0.1"), true);
  assert.equal(satisfies("0.2.0", "^0.1"), false);
  assert.equal(satisfies("0.0.9", "^0.1"), false);
  assert.equal(satisfies("0.0.3", "^0.0.3"), true);
  assert.equal(satisfies("0.0.4", "^0.0.3"), false);
  assert.equal(satisfies("1.9.0", "^1.2"), true);
  assert.equal(satisfies("2.0.0", "^1.2"), false);
});

test("satisfies: tilde, exact, none, unknown", () => {
  assert.equal(satisfies("0.1.9", "~0.1"), true);
  assert.equal(satisfies("0.2.0", "~0.1.0"), false);
  assert.equal(satisfies("0.1.2", "0.1.2"), true);
  assert.equal(satisfies("0.1.3", "0.1.2"), false);
  assert.equal(satisfies("0.1.3", null), true);
  assert.equal(satisfies("0.1.3", ">=0.1 <0.3"), null);
  assert.equal(satisfies("0.2.0-rc.1", "^0.2"), false);
});

test("caretFor", () => {
  assert.equal(caretFor("0.2.0"), "^0.2");
  assert.equal(caretFor("1.4.2"), "^1.4");
});

test("dependentsOf reads object and string dependencies", () => {
  const manifests = new Map([
    ["a", { dependencies: [] }],
    ["b", { dependencies: [{ name: "a", version: "^0.1" }] }],
    ["c", { dependencies: ["a@lindigo-devdigest"] }],
  ]);
  assert.deepEqual(dependentsOf("a", manifests), [
    { plugin: "b", index: 0, range: "^0.1" },
    { plugin: "c", index: 0, range: null },
  ]);
});

const LOG = `# Changelog — x

## [Unreleased]

### Fixed
- A bug.

## [0.1.0] — 2026-11-09

### Added
- Scaffold.
`;

test("insertRelease moves [Unreleased] notes into the new version", () => {
  const out = insertRelease(LOG, "0.1.1", "2026-11-10", { moveUnreleased: true });
  assert.equal(unreleasedNotes(out), "");
  assert.match(out, /## \[Unreleased\]\n\n## \[0\.1\.1\] — 2026-11-10\n\n### Fixed\n- A bug\.\n\n## \[0\.1\.0\]/);
  assert.deepEqual(changelogVersions(out), ["0.1.1", "0.1.0"]);
});

test("insertRelease with a body keeps [Unreleased]", () => {
  const out = insertRelease(LOG, "0.1.1", "2026-11-10", { body: "### Reverted\n- Back to 0.1.0." });
  assert.equal(unreleasedNotes(out), "### Fixed\n- A bug.");
  assert.match(out, /- A bug\.\n\n## \[0\.1\.1\] — 2026-11-10\n\n### Reverted/);
});

test("insertRelease refuses empty notes and duplicate versions", () => {
  const empty = LOG.replace("### Fixed\n- A bug.\n", "");
  assert.throws(() => insertRelease(empty, "0.1.1", "d", { moveUnreleased: true }), /no release notes/);
  assert.throws(() => insertRelease(LOG, "0.1.0", "d", { moveUnreleased: true }), /already has/);
});

test("addUnreleasedNote appends to an existing subsection or creates one", () => {
  const same = addUnreleasedNote(LOG, "Fixed", "Another bug.");
  assert.match(same, /### Fixed\n- Another bug\.\n- A bug\./);
  const created = addUnreleasedNote(LOG, "Changed", "Range widened.");
  assert.match(created, /- A bug\.\n\n### Changed\n- Range widened\.\n\n## \[0\.1\.0\]/);
});
