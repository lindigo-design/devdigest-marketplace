// Query and filters in the URL (spec CAT-01 R4/AC-2).
import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyState, hasFilters, isEmpty, parseState, toSearch, toggle } from "../../src/client/url-state.mjs";

test("round trip restores the same state", () => {
  const s = { q: "рев'ю безпеки", kind: ["skill", "agent"], plugin: ["architecture-review"], category: [], tag: ["pr"], os: ["macOS"] };
  assert.deepEqual(parseState(toSearch(s)), s);
});

test("spec URL form ?q=…&kind=…&plugin=…&tag=…", () => {
  assert.equal(
    toSearch({ ...emptyState(), q: "security review", kind: ["skill"], plugin: ["engineering-paved-path"], tag: ["owasp"] }),
    "?q=security+review&kind=skill&plugin=engineering-paved-path&tag=owasp",
  );
});

test("empty state serializes to nothing", () => {
  assert.equal(toSearch(emptyState()), "");
  assert.equal(toSearch({ ...emptyState(), q: "   " }), "");
});

test("parsing drops unknown kinds, blanks and duplicates; caps q", () => {
  const s = parseState("?q=" + "x".repeat(300) + "&kind=skill&kind=widget&kind=skill&tag=&tag=%20a%20");
  assert.equal(s.q.length, 200);
  assert.deepEqual(s.kind, ["skill"]);
  assert.deepEqual(s.tag, ["a"]);
});

test("accepts URLSearchParams and ignores unrelated params", () => {
  assert.deepEqual(parseState(new URLSearchParams("utm_source=x&os=Windows")), { ...emptyState(), os: ["Windows"] });
});

test("toggle, hasFilters, isEmpty", () => {
  let s = toggle(emptyState(), "kind", "skill");
  assert.deepEqual(s.kind, ["skill"]);
  assert.ok(hasFilters(s) && !isEmpty(s));
  s = toggle(s, "kind", "skill");
  assert.ok(isEmpty(s));
});
