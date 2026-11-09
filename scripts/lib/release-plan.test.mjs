import assert from "node:assert/strict";
import { test } from "node:test";
import { UsageError } from "./marketplace.mjs";
import { parseTargets, planRelease } from "./release-plan.mjs";

const CL = (notes = "") => `# Changelog\n\n## [Unreleased]\n\n${notes}\n\n## [0.1.0] — 2026-11-09\n\n### Added\n- Scaffold.\n`;

/** The marketplace graph: rt has no deps, ar → epp, sdd → epp, rt, ar. */
function graph(version = "0.1.1") {
  const dep = (name) => ({ name, version: "^0.1" });
  return new Map([
    ["epp", { name: "epp", version }],
    ["rt", { name: "rt", version }],
    ["ar", { name: "ar", version, dependencies: [dep("epp")] }],
    ["sdd", { name: "sdd", version, dependencies: [dep("epp"), dep("rt"), dep("ar")] }],
  ]);
}
const notes = () => CL("### Changed\n- Stable release.");
const base = (manifests, extra = {}) => ({ manifests, readChangelog: notes, date: "2026-11-10", ...extra });

test("pairs: four plugins to 1.0.0 in one run, ranges inside the set rewritten, no cascade", () => {
  const m = graph();
  const plan = planRelease(base(m, { targets: ["epp", "rt", "ar", "sdd"].map((name) => ({ name, kind: "major" })) }));
  assert.deepEqual([...plan.releases].map(([n, r]) => `${n} ${r.from}→${r.to}`),
    ["epp 0.1.1→1.0.0", "rt 0.1.1→1.0.0", "ar 0.1.1→1.0.0", "sdd 0.1.1→1.0.0"]);
  assert.deepEqual(plan.blocked, []);
  assert.deepEqual(m.get("ar").dependencies, [{ name: "epp", version: "^1.0" }]);
  assert.deepEqual(m.get("sdd").dependencies.map((d) => d.version), ["^1.0", "^1.0", "^1.0"]);
  const sdd = plan.changelogs.get("sdd");
  assert.match(sdd, /## \[1\.0\.0\] — 2026-11-10/);
  assert.match(sdd, /Dependency `ar` range `\^0\.1` → `\^1\.0`/);
  assert.match(sdd, /## \[Unreleased\]\n\n## \[1\.0\.0\]/); // notes moved out of [Unreleased]
});

test("pairs: order of targets does not matter", () => {
  const a = graph(); const b = graph();
  planRelease(base(a, { targets: ["sdd", "ar", "rt", "epp"].map((name) => ({ name, kind: "major" })) }));
  planRelease(base(b, { targets: ["epp", "rt", "ar", "sdd"].map((name) => ({ name, kind: "major" })) }));
  assert.deepEqual([...a], [...b]);
});

test("pairs: a dependent outside the run that breaks is blocked", () => {
  const plan = planRelease(base(graph(), { targets: [{ name: "epp", kind: "major" }, { name: "ar", kind: "major" }] }));
  assert.deepEqual(plan.blocked, ["sdd requires epp ^0.1", "sdd requires ar ^0.1"]);
});

test("single target with --update-dependents cascades patch releases, each plugin once", () => {
  const m = graph("0.1.0");
  const plan = planRelease(base(m, { targets: [{ name: "epp", kind: "major" }], updateDependents: true }));
  assert.deepEqual([...plan.releases].map(([n, r]) => `${n} ${r.to}`), ["epp 1.0.0", "ar 0.1.1", "sdd 0.1.1"]);
  assert.equal(m.get("sdd").dependencies[0].version, "^1.0");
  assert.equal(m.get("sdd").dependencies[2].version, "^0.1"); // ar 0.1.1 still satisfies ^0.1
});

test("mixed bump kinds and explicit versions", () => {
  const plan = planRelease(base(graph(), { targets: [{ name: "rt", kind: "1.2.0" }, { name: "sdd", kind: "patch" }] }));
  assert.equal(plan.releases.get("rt").to, "1.2.0");
  assert.equal(plan.releases.get("sdd").to, "0.1.2");
  assert.equal(graph().get("sdd").dependencies[1].version, "^0.1"); // fresh graph untouched
});

test("refuses duplicates, unknown plugins, lower versions, existing tags, empty notes", () => {
  assert.throws(() => planRelease(base(graph(), { targets: [{ name: "rt", kind: "patch" }, { name: "rt", kind: "minor" }] })), /named twice/);
  assert.throws(() => planRelease(base(graph(), { targets: [{ name: "nope", kind: "patch" }] })), UsageError);
  assert.throws(() => planRelease(base(graph(), { targets: [{ name: "rt", kind: "0.0.9" }] })), /must be higher/);
  assert.throws(() => planRelease(base(graph(), { targets: [{ name: "rt", kind: "major" }], tagExists: () => true })), /already exists/);
  assert.throws(() => planRelease({ ...base(graph(), { targets: [{ name: "rt", kind: "patch" }] }), readChangelog: () => CL() }), /\[Unreleased\] is empty/);
  const withNote = planRelease({ ...base(graph(), { targets: [{ name: "rt", kind: "patch" }] }), readChangelog: () => CL(), note: "Stable." });
  assert.match(withNote.changelogs.get("rt"), /## \[0\.1\.2\][^]*- Stable\./);
});

test("parseTargets", () => {
  assert.deepEqual(parseTargets(["rt", "patch"], "u"), [{ name: "rt", kind: "patch" }]);
  assert.deepEqual(parseTargets(["rt=major", "sdd=1.0.0"], "u"), [{ name: "rt", kind: "major" }, { name: "sdd", kind: "1.0.0" }]);
  assert.throws(() => parseTargets(["rt=major", "sdd"], "u"), /mix/);
  assert.throws(() => parseTargets(["rt"], "u"), UsageError);
  assert.throws(() => parseTargets(["rt=a=b"], "u"), /not <plugin>=<bump>/);
});
