// UI text lives only in src/i18n/en.json; components, pages and browser code call t(key, params) (site/README.md, Rules).
// 1. A pragmatic lint over the parsed source of every .astro file and browser module under src/: template text,
//    text attributes (aria-label, title, placeholder, alt, and the label/title/text props of our components),
//    strings that end up in the DOM (textContent, el() children, setAttribute) and prose-like string literals.
// 2. Every t("key") names a key of en.json, every key is used, keys are static strings.
// Repository content (plugin names, descriptions, markdown) is data, not UI text, and never appears as a literal.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "@astrojs/compiler-rs";
import { STRINGS, t } from "../../src/i18n/t.mjs";

const SITE = fileURLToPath(new URL("../..", import.meta.url));
const SRC = join(SITE, "src");
const LIB = join(SITE, "lib");

/** Files the lint skips entirely, with the reason. Keep this list short. */
const ALLOW_FILES = new Map([
  ["src/pages/[...dev].astro", "dev-only primitives sheet: getStaticPaths returns nothing in production builds; its sample text exercises type roles and states"],
  ["src/client/query.mjs", "search data, not UI text: the filler phrases and stop words the query parser removes (spec R2/AC-5), like synonyms.json"],
]);
/** Single literals the lint may flag wrongly: "file\ttext" → reason. */
const ALLOW_TEXT = new Map([]);

const TEXT_ATTRS = new Set([
  "aria-label", "aria-description", "aria-roledescription", "aria-placeholder", "aria-valuetext",
  "title", "placeholder", "alt", "label", "text", "caption", "description",
]);
const DOM_TEXT_PROPS = new Set(["textContent", "innerText", "title", "placeholder", "alt", "ariaLabel", "label"]);
/** Calls whose string arguments are selectors, attribute names, event names, URLs or diagnostics, never UI text. */
const SKIP_CALLS = new Set([
  "querySelector", "querySelectorAll", "closest", "matches", "$", "getElementById", "getAttribute", "removeAttribute",
  "hasAttribute", "toggleAttribute", "addEventListener", "removeEventListener", "add", "remove", "toggle", "contains",
  "fetch", "href", "url", "absUrl", "githubSource", "markdown", "assign", "pushState", "replaceState", "escape",
  "test", "replace", "replaceAll", "match", "matchAll", "split", "join", "includes", "startsWith", "endsWith",
  "indexOf", "slice", "padStart", "padEnd", "trim", "log", "warn", "error", "info", "debug", "Error", "TypeError",
  "RegExp", "URL", "URLSearchParams", "get", "has", "set", "delete", "getAll", "append", "Number", "String",
]);
/** Calls whose first argument is a tag/attribute name and later arguments may be UI text. */
const FIRST_ARG_ONLY = new Set(["el", "createElement", "setAttribute"]);
/** Object keys whose values are markup plumbing, not text. */
const SKIP_PROPS = /^(class|className|style|href|src|id|type|role|name|value|rel|target|for|key|kind|data-[\w-]+|aria-(?:live|hidden|expanded|controls|modal|describedby|labelledby|current|pressed|selected|checked|disabled|haspopup))$/;
const PASS_THROUGH = new Set(["ConditionalExpression", "LogicalExpression", "ParenthesizedExpression", "TemplateLiteral", "ArrayExpression", "SequenceExpression", "ArrowFunctionExpression", "TSAsExpression", "TSSatisfiesExpression"]);

const LETTER = /\p{L}/u;
const nameOf = (n) => (n?.type === "Identifier" || n?.type === "JSXIdentifier" ? n.name
  : n?.type === "JSXNamespacedName" ? `${n.namespace.name}:${n.name.name}`
  : n?.type === "Literal" ? String(n.value)
  : n?.type === "MemberExpression" || n?.type === "StaticMemberExpression" ? nameOf(n.property) : null);
const calleeName = (call) => nameOf(call.callee);

/** Looks like a sentence or a label: a capitalized word, or two plain words with no CSS/selector/path tokens. */
export function looksLikeProse(s) {
  if (!LETTER.test(s)) return false;
  if (/(^|[^\p{L}\p{N}_-])\p{Lu}\p{Ll}+/u.test(s)) return true;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.some((w) => /[-_=[\]#/.:@${}]\S/.test(w))) return false;
  return words.filter((w) => /^[\p{L}’']+[.,:;!?…]*$/u.test(w)).length >= 2;
}

function files(dir, re) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(join(dir, d.name), re) : re.test(d.name) ? [join(dir, d.name)] : []);
}

/** Parses .astro as is, and JS modules as the frontmatter of an empty component (same parser, same AST). */
function parseSource(file, text) {
  const isAstro = file.endsWith(".astro");
  const src = isAstro ? text : `---\n${text}\n---\n`;
  const offset = isAstro ? 0 : 4;
  const { ast, diagnostics } = parse(src);
  const errors = (diagnostics ?? []).filter((d) => d.severity === "error" || d.severity === 1);
  if (errors.length) throw new Error(`${file}: parse error: ${JSON.stringify(errors[0])}`);
  const lineAt = (pos) => text.slice(0, Math.max(0, pos - offset)).split("\n").length;
  return { ast, lineAt };
}

function walk(node, visit, parents = []) {
  if (Array.isArray(node)) { for (const n of node) walk(n, visit, parents); return; }
  if (!node || typeof node !== "object") return;
  if (node.type && visit(node, parents) === false) return;
  const next = node.type ? [...parents, node] : parents;
  for (const [k, v] of Object.entries(node)) if (k !== "position" && v && typeof v === "object") walk(v, visit, next);
}

/**
 * Lints one source text.
 * @returns {{ problems: { line: number, text: string, why: string }[], keys: { key: string, line: number }[], dynamic: number[] }}
 */
export function lintSource(file, text) {
  const { ast, lineAt } = parseSource(file, text);
  const problems = [];
  const keys = [];
  const dynamic = [];
  const flag = (node, s, why) => problems.push({ line: lineAt(node.start), text: s.trim(), why });

  walk(ast, (node, parents) => {
    if (/^TS/.test(node.type) && !PASS_THROUGH.has(node.type)) return false; // types are not output
    if (node.type === "ImportDeclaration" || node.type === "ImportExpression" || node.type === "ExportAllDeclaration") return false;
    if (node.type === "ExportNamedDeclaration" && node.source) return false;
    if (node.type === "JSXElement" && /^(style|script)$/.test(nameOf(node.openingElement?.name) ?? "")) return false;

    if (node.type === "CallExpression" && calleeName(node) === "t" && node.callee.type === "Identifier") {
      const a = node.arguments[0];
      if (a?.type === "Literal" && typeof a.value === "string") keys.push({ key: a.value, line: lineAt(node.start) });
      else dynamic.push(lineAt(node.start));
      return true;
    }

    if (node.type === "JSXText") {
      if (LETTER.test(node.value)) flag(node, node.value, "template text");
      return true;
    }

    if (node.type === "JSXAttribute") {
      const name = nameOf(node.name);
      // class, href, style, data-*: a plain value is plumbing; expressions are still walked (t() keys, prose in props).
      if (TEXT_ATTRS.has(name) && node.value?.type === "Literal" && LETTER.test(String(node.value.value))) flag(node, String(node.value.value), `${name} attribute`);
      return node.value?.type !== "Literal";
    }

    const str = node.type === "Literal" && typeof node.value === "string" ? node.value
      : node.type === "TemplateElement" ? node.value?.cooked ?? node.value?.raw ?? ""
      : null;
    if (str === null || !LETTER.test(str)) return true;

    // Climb through value-preserving wrappers to the place the string ends up.
    let i = parents.length - 1;
    let child = node;
    while (i >= 0 && PASS_THROUGH.has(parents[i].type)) {
      const p = parents[i];
      if (p.type === "ConditionalExpression" && p.test === child) break;
      if (p.type === "LogicalExpression" && p.left === child && p.operator === "&&") break;
      child = p;
      i--;
    }
    const at = parents[i];
    if (!at) return true;

    // Contexts that never hold UI text.
    if (at.type === "BinaryExpression" && /^(===|!==|==|!=|in|instanceof)$/.test(at.operator)) return true;
    if (at.type === "SwitchCase" || at.type === "TaggedTemplateExpression") return true;
    if ((at.type === "MemberExpression" || at.type === "ComputedMemberExpression") && at.property === child) return true;
    if (at.type === "Property" && at.key === child) return true;
    if (at.type === "Property" && SKIP_PROPS.test(nameOf(at.key) ?? "")) return true;
    if (at.type === "CallExpression" || at.type === "NewExpression") {
      const callee = calleeName(at);
      const index = at.arguments.indexOf(child);
      if (callee === "t") return true;
      if (FIRST_ARG_ONLY.has(callee)) {
        if (index === 0) return true;
        if (callee === "setAttribute" && !TEXT_ATTRS.has(String(at.arguments[0]?.value))) return true;
        if (callee === "el" && index === 1) return true;
        flag(node, str, `${callee}() text`);
        return true;
      }
      if (SKIP_CALLS.has(callee)) return true;
    }
    // Nested in the arguments of a selector/URL/diagnostic call further up, e.g. querySelector(`[name="${CSS.escape(x)}"]`).
    for (let j = parents.length - 1; j >= 0; j--) {
      const p = parents[j];
      const inner = parents[j + 1] ?? node;
      if ((p.type === "CallExpression" || p.type === "NewExpression") && p.arguments.includes(inner) && SKIP_CALLS.has(calleeName(p))) return true;
    }

    // Sinks: the string is rendered.
    if (at.type === "JSXExpressionContainer") {
      const host = parents[i - 1];
      if (host?.type === "JSXElement" || host?.type === "JSXFragment") { flag(node, str, "template expression"); return true; }
      if (host?.type === "JSXAttribute" && TEXT_ATTRS.has(nameOf(host.name))) { flag(node, str, `${nameOf(host.name)} attribute`); return true; }
    }
    if (at.type === "AssignmentExpression" && at.right === child && DOM_TEXT_PROPS.has(nameOf(at.left) ?? "")) {
      flag(node, str, `${nameOf(at.left)} assignment`);
      return true;
    }
    if (at.type === "Property" && TEXT_ATTRS.has(nameOf(at.key) ?? "")) { flag(node, str, `${nameOf(at.key)} property`); return true; }

    if (looksLikeProse(str)) flag(node, str, "prose-like string");
    return true;
  });
  return { problems, keys, dynamic };
}

const rel = (file) => relative(SITE, file).replace(/\\/g, "/");
const LINTED = files(SRC, /\.(astro|mjs|js)$/).filter((f) => !rel(f).startsWith("src/i18n/"));
const KEY_SOURCES = [...LINTED, ...files(LIB, /\.mjs$/)];

describe("UI strings live in src/i18n/en.json", () => {
  test("no hard-coded user-visible text in components, layouts, pages or browser code", () => {
    const problems = [];
    for (const file of LINTED) {
      const r = rel(file);
      if (ALLOW_FILES.has(r)) continue;
      for (const p of lintSource(r, readFileSync(file, "utf8")).problems) {
        if (ALLOW_TEXT.has(`${r}\t${p.text}`)) continue;
        problems.push(`${r}:${p.line}: ${p.why}: ${JSON.stringify(p.text)}`);
      }
    }
    assert.deepEqual(problems, [], "move these strings to src/i18n/en.json and use t(key)");
  });

  test("every allowlist entry still matches something", () => {
    for (const f of ALLOW_FILES.keys()) assert.ok(LINTED.some((x) => rel(x) === f), `stale ALLOW_FILES entry: ${f}`);
  });

  test("every t() key exists, keys are static, and no key is unused", () => {
    const used = new Set();
    const missing = [];
    const dynamic = [];
    for (const file of KEY_SOURCES) {
      const r = rel(file);
      const res = lintSource(r, readFileSync(file, "utf8"));
      for (const { key, line } of res.keys) {
        used.add(key);
        if (!Object.hasOwn(STRINGS, key)) missing.push(`${r}:${line}: ${key}`);
      }
      for (const line of res.dynamic) dynamic.push(`${r}:${line}`);
    }
    assert.deepEqual(missing, [], "keys used in code but missing from en.json");
    assert.deepEqual(dynamic, [], "t() needs a string literal key, so this test can see it");
    assert.deepEqual(Object.keys(STRINGS).filter((k) => !used.has(k)), [], "keys in en.json that no code uses");
  });

  test("en.json: English only, strings or { one, other } with matching placeholders", () => {
    for (const [key, v] of Object.entries(STRINGS)) {
      const forms = typeof v === "string" ? [v] : [v.one, v.other];
      assert.ok(forms.every((s) => typeof s === "string" && s.length > 0), `${key}: string or { one, other }`);
      if (typeof v !== "string") assert.deepEqual(Object.keys(v).sort(), ["one", "other"], key);
      for (const s of forms) assert.ok(!/[Ѐ-ӿ]/.test(s), `${key}: English only`);
      const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      if (typeof v !== "string") assert.deepEqual(ph(v.one), ph(v.other), `${key}: same placeholders in both forms`);
    }
  });
});

describe("t()", () => {
  test("placeholders, plurals, unknown keys", () => {
    assert.equal(t("copy.aria", { label: "install command for x" }), "Copy: install command for x");
    assert.equal(t("search.results", { count: 1 }), "1 result");
    assert.equal(t("search.results", { count: 7 }), "7 results");
    assert.equal(t("search.results", { count: 0 }), "0 results");
    assert.equal(t("compat.min", {}), "Claude Code ≥ {version}"); // a missing param stays visible
    assert.throws(() => t("no.such.key"), /Unknown UI string key/);
  });
});

describe("the lint catches what it should", () => {
  const astro = (body, front = "") => lintSource("x.astro", `---\n${front}\n---\n${body}\n`);
  const js = (code) => lintSource("x.mjs", code);
  test("bad", () => {
    for (const [what, r] of [
      ["text node", astro("<p>Hello</p>")],
      ["one-letter text", astro("<span>v{version}</span>")],
      ["text attribute", astro('<button aria-label="Close">×</button>')],
      ["template attribute", astro("<p title={`Copy ${x}`}></p>")],
      ["component prop", astro('<EmptyState title="Nothing here" />')],
      ["expression child", astro('<dd>{m ?? "(all)"}</dd>')],
      ["frontmatter prose", astro("<p>{a}</p>", 'const a = "Some text";')],
      ["textContent", js('node.textContent = "done";')],
      ["el() child", js('el("p", { class: "x" }, "hi");')],
      ["aria-label property", js('el("ul", { "aria-label": "Tags" });')],
      ["setAttribute", js('panel.setAttribute("aria-label", "filters");')],
      ["prose in code", js("const label = `Show ${n} more`;")],
      ["text before a .join()", js('node.textContent = items.map((x) => `Item ${x}`).join(", ");')],
    ]) assert.ok(r.problems.length > 0, what);
  });
  test("ok", () => {
    for (const [what, r] of [
      ["t() in text and attributes", astro('<p class="t-label" aria-label={t("tags")}>{t("tags")}</p>')],
      ["class, href, style", astro('<a class="entry__sub t-mono" href={href(`?category=${c}`)} style={`--i: ${i}`}>{c}</a>')],
      ["separators", astro('<p>{" · "}{i > 0 && ", "}</p>')],
      ["selectors and keys", js('$("[data-search-form]"); if (e.key === "Escape") x(); el("p", { class: "entry__desc t-secondary measure" });')],
      ["imports", js('import { t } from "../i18n/t.mjs";')],
      ["diagnostics", js('throw new Error("Unknown key");')],
      ["style and script blocks", astro("<style>.a { color: red; }</style><script>run('Hello there');</script>")],
    ]) assert.deepEqual(r.problems, [], what);
  });
  test("dynamic keys are reported", () => {
    assert.equal(js("t(`kind.${k}`);").dynamic.length, 1);
    assert.deepEqual(js('t("a.b"); t("c", { n });').keys.map((k) => k.key), ["a.b", "c"]);
  });
});
