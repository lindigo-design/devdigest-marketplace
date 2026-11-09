// Query parsing (spec CAT-01 R2/AC-5–7; §7 stop-words-only and mixed UA/EN; acceptance demo step 1).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_SYNONYMS } from "../../lib/catalog.mjs";
import { Problems } from "../../lib/errors.mjs";
import { loadSynonyms } from "../../lib/synonyms.mjs";
import { kindOf, parseQuery, tokenMatches } from "../../src/client/query.mjs";

const SYN = loadSynonyms(DEFAULT_SYNONYMS, new Problems());
const q = (text) => parseQuery(text, SYN);
const texts = (r) => r.terms.map((t) => t.text);
const expands = (r, term, word) => r.terms.find((t) => t.text === term)?.expansions.includes(word);

describe("acceptance demo query", () => {
  const r = q("мені треба скіл для рев'ю безпеки");

  test("the kind word turns on the skill filter and leaves the terms (R2/AC-6)", () => {
    assert.deepEqual(r.kinds, ["skill"]);
    assert.deepEqual(texts(r), ["рев'ю", "безпеки"]);
  });

  test("Ukrainian terms expand to the English groups (R2/AC-7)", () => {
    assert.ok(expands(r, "рев'ю", "review"));
    assert.ok(expands(r, "безпеки", "security"));
    assert.ok(expands(r, "безпеки", "owasp"));
  });
});

describe("stop words and filler phrases (R2/AC-5)", () => {
  test("English filler", () => {
    const r = q("I need a skill for security review");
    assert.deepEqual(r.kinds, ["skill"]);
    assert.deepEqual(texts(r), ["security", "review"]);
  });

  test("Ukrainian filler", () => {
    assert.deepEqual(texts(q("мені потрібно щось для тестів")), ["тестів"]);
  });

  test("only stop and kind words → kind filter, empty terms (§7)", () => {
    assert.deepEqual(q("мені треба скіл"), { kinds: ["skill"], terms: [] });
    assert.deepEqual(q("I need a"), { kinds: [], terms: [] });
  });

  test("empty and punctuation-only queries", () => {
    assert.deepEqual(q(""), { kinds: [], terms: [] });
    assert.deepEqual(q("  ?!  "), { kinds: [], terms: [] });
  });
});

describe("kind words (R2/AC-6)", () => {
  for (const [word, kind] of [
    ["skill", "skill"], ["skills", "skill"], ["скіл", "skill"], ["скіла", "skill"], ["agent", "agent"], ["агентів", "agent"],
    ["hook", "hook"], ["хуки", "hook"], ["command", "command"], ["команда", "command"], ["plugin", "plugin"],
    ["плагін", "plugin"], ["mcp", "mcp"],
  ]) {
    test(`${word} → ${kind}`, () => assert.equal(kindOf(word), kind));
  }

  test("several kinds are all applied", () => {
    assert.deepEqual(q("agent or hook for git").kinds, ["agent", "hook"]);
  });

  test("kind words are case-insensitive", () => {
    assert.deepEqual(q("Security AGENT").kinds, ["agent"]);
  });
});

describe("synonym expansion (R2/AC-7)", () => {
  test("Ukrainian stems match as prefixes", () => {
    for (const w of ["безпека", "безпеки", "безпеку"]) assert.ok(expands(q(w), w, "security"), w);
  });

  test("apostrophe variants and the apostrophe-less spelling", () => {
    for (const w of ["рев'ю", "рев’ю", "ревю"]) assert.ok(expands(q(w), w.replace("’", "'"), "review"), w);
  });

  test("English inflections and partial words", () => {
    assert.ok(expands(q("reviewers"), "reviewers", "рев'ю"));
    assert.ok(expands(q("secur"), "secur", "security"));
  });

  test("a Ukrainian word matches while it is being typed, from 2 letters", () => {
    for (const w of ["ар", "арх", "архі"]) assert.ok(expands(q(w), w, "architecture"), w);
    assert.equal(tokenMatches("а", "архітектур"), false); // 1 letter is too short
    assert.equal(tokenMatches("ar", "architecture"), false); // English short prefixes stay with MiniSearch
  });

  test("short entries do not prefix-match unrelated words", () => {
    assert.ok(!expands(q("pretty"), "pretty", "pull request"));
    assert.equal(tokenMatches("pretty", "pr"), false);
  });

  test("multi-word entries match as one term", () => {
    const r = q("пул реквест review");
    assert.deepEqual(texts(r), ["пул реквест", "review"]);
    assert.ok(expands(r, "пул реквест", "pr"));
    assert.ok(expands(q("пошук інформації"), "пошук інформації", "research"));
  });

  test("words with no group keep only themselves", () => {
    assert.deepEqual(q("kubernetes").terms, [{ text: "kubernetes", expansions: ["kubernetes"] }]);
  });
});

describe("mixed UA/EN (§7)", () => {
  test("each term is handled on its own", () => {
    const r = q("агент для architecture і безпеки");
    assert.deepEqual(r.kinds, ["agent"]);
    assert.deepEqual(texts(r), ["architecture", "безпеки"]);
    assert.ok(expands(r, "architecture", "архітектур"));
    assert.ok(expands(r, "безпеки", "security"));
  });

  test("duplicate terms collapse", () => {
    assert.deepEqual(texts(q("review Review REVIEW")), ["review"]);
  });
});
