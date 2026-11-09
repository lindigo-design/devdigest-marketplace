// site/synonyms.json validation (spec CAT-01 R2/AC-10).
import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, test } from "node:test";
import { DEFAULT_SYNONYMS, buildCatalog } from "../../lib/catalog.mjs";
import { CatalogError, Problems } from "../../lib/errors.mjs";
import { loadSynonyms, validateSynonyms } from "../../lib/synonyms.mjs";
import { FIXTURES, tempRepo } from "./helpers.mjs";

const check = (json) => {
  const p = new Problems();
  const groups = validateSynonyms(json, p);
  return { groups, errors: p.errors };
};

describe("validateSynonyms", () => {
  test("the shipped synonyms.json is valid", () => {
    const p = new Problems();
    const groups = loadSynonyms(DEFAULT_SYNONYMS, p);
    assert.deepEqual(p.errors, []);
    assert.ok(groups.length >= 18);
  });

  test("terms are normalized: case, apostrophes, spaces", () => {
    assert.deepEqual(check([["Review", "РЕВ’Ю", "pull   request"]]).groups, [["review", "рев'ю", "pull request"]]);
  });

  test("a group with fewer than 2 terms fails and names the term", () => {
    const { errors } = check([["review", "reviewer"], ["lonely"]]);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].file, "site/synonyms.json");
    assert.match(errors[0].reason, /fewer than 2 terms: "lonely"/);
  });

  test("a term in two groups fails and names the term", () => {
    const { errors } = check([["review", "check"], ["test", "Check"]]);
    assert.equal(errors.length, 1);
    assert.match(errors[0].reason, /term "check" appears in groups 1 and 2/);
  });

  test("apostrophe variants count as the same term", () => {
    assert.match(check([["рев'ю", "review"], ["рев’ю", "x"]]).errors[0].reason, /"рев'ю"/);
  });

  test("a term twice in one group fails", () => {
    assert.match(check([["a1", "b1", "A1"]]).errors[0].reason, /twice in the same group/);
  });

  test("wrong shapes fail", () => {
    assert.match(check({}).errors[0].reason, /must be an array/);
    assert.match(check([["a", 1]]).errors[0].reason, /array of strings/);
  });
});

describe("build integration", () => {
  test("an invalid synonyms file fails the catalog build", () => {
    const r = tempRepo(null);
    try {
      r.write("synonyms.json", '[["security", "secure"], ["safe", "security"]]');
      assert.throws(
        () => buildCatalog({ repoRoot: join(FIXTURES, "demo"), history: false, synonymsFile: join(r.root, "synonyms.json") }),
        (err) => err instanceof CatalogError && /site\/synonyms\.json: term "security" appears in groups 1 and 2/.test(err.message),
      );
    } finally {
      r.cleanup();
    }
  });

  test("a missing synonyms file fails the build", () => {
    assert.throws(
      () => buildCatalog({ repoRoot: join(FIXTURES, "demo"), history: false, synonymsFile: join(FIXTURES, "nope.json") }),
      /site\/synonyms\.json: file not found/,
    );
  });

  test("the catalog carries the normalized groups for the browser", () => {
    const cat = buildCatalog({ repoRoot: join(FIXTURES, "demo"), history: false });
    assert.ok(cat.synonyms.some((g) => g.includes("безпек") && g.includes("security")));
  });
});
