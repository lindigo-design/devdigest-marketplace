// Match highlighting (R3/AC-2) and shortcut detection (R4/AC-3): the pure parts of the search UI.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { highlightSegments } from "../../src/client/highlight.mjs";
import { isSearchShortcut } from "../../src/client/shortcuts.mjs";

const marks = (text, terms) => highlightSegments(text, terms).filter((s) => s.mark).map((s) => s.text);

describe("highlightSegments", () => {
  test("marks whole words that are matched terms, case-insensitively", () => {
    assert.deepEqual(marks("Security rubric for reviewing a change", ["security", "reviewing"]), ["Security", "reviewing"]);
  });

  test("segments cover the whole text", () => {
    const text = "A pull request: review, then push.";
    assert.equal(highlightSegments(text, ["review", "push"]).map((s) => s.text).join(""), text);
  });

  test("hyphenated words light up when a part matched", () => {
    assert.deepEqual(marks("pr-self-review skill", ["review"]), ["pr-self-review"]);
  });

  test("apostrophes are normalized like the index", () => {
    assert.deepEqual(marks("Рев’ю коду", ["рев'ю"]), ["Рев’ю"]);
  });

  test("each matched word is its own mark; the text between stays plain", () => {
    assert.deepEqual(marks("security review now", ["security", "review"]), ["security", "review"]);
  });

  test("no terms → one plain segment", () => {
    assert.deepEqual(highlightSegments("plain text", []), [{ text: "plain text", mark: false }]);
  });
});

describe("isSearchShortcut (R4/AC-3)", () => {
  const key = (k, mods = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, defaultPrevented: false, ...mods });
  const body = { tagName: "BODY" };

  test("/ outside text fields", () => {
    assert.ok(isSearchShortcut(key("/"), body));
    assert.ok(!isSearchShortcut(key("/"), { tagName: "TEXTAREA" }));
    assert.ok(!isSearchShortcut(key("/"), { tagName: "INPUT" }));
    assert.ok(!isSearchShortcut(key("/"), { tagName: "DIV", isContentEditable: true }));
  });

  test("Ctrl+K and Cmd+K, also inside text fields", () => {
    assert.ok(isSearchShortcut(key("k", { ctrlKey: true }), body));
    assert.ok(isSearchShortcut(key("K", { metaKey: true }), { tagName: "INPUT" }));
    assert.ok(!isSearchShortcut(key("k"), body));
    assert.ok(!isSearchShortcut(key("k", { ctrlKey: true, shiftKey: true }), body));
  });
});
