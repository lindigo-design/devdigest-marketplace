// Live result rows: the same markup as src/components/ResultEntry.astro (keep in sync; the component's styles
// are global for that reason). Built with createElement/textContent only, never innerHTML, so nothing from
// index.json can inject markup.
import { badgeLabels } from "../../lib/compatibility.mjs";
import { highlightSegments } from "./highlight.mjs";

export const KIND_LABELS = { plugin: "Plugin", skill: "Skill", agent: "Agent", command: "Command", hook: "Hook", mcp: "MCP" };

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "style") node.setAttribute("style", v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}

/** Text with <mark> around matched words (R3/AC-2). */
export function marked(text, terms) {
  return highlightSegments(text, terms).map((s) => (s.mark ? el("mark", {}, s.text) : document.createTextNode(s.text)));
}

/**
 * @param {object} e index.json entry
 * @param {{ href: (path: string) => string, install: (plugin: string) => string, terms?: string[], index?: number }} ctx
 */
export function renderEntry(e, { href, install, terms = [], index = 0 }) {
  const isPlugin = e.kind === "plugin";
  const sub = isPlugin
    ? el("a", { class: "entry__sub", href: href(`?category=${encodeURIComponent(e.category ?? "")}`) }, e.category ?? "")
    : el("a", { class: "entry__sub", href: href(`${e.plugin}/`) }, e.plugin);
  const tags = (e.tags ?? []).slice(0, 5);
  const [first, ...os] = badgeLabels(e.compat);
  return el("div", { role: "listitem" },
    el("article", { class: "entry entry--live", style: `--i: ${Math.min(index, 12)}`, "data-entry": e.id },
      el("span", { class: "t-label kind-label entry__kind", "data-kind": e.kind }, KIND_LABELS[e.kind] ?? e.kind),
      el("div", { class: "entry__body" },
        el("div", { class: "entry__title" },
          el("h3", { class: "t-heading-2 entry__name" },
            el("a", { class: "entry__link", href: href(e.path), "data-entry-link": true }, ...marked(e.name, terms))),
          el("p", { class: "t-caption entry__caption" }, sub, " · ", el("span", { class: "t-mono" }, `v${e.version}`))),
        el("p", { class: "entry__desc t-secondary measure", "data-entry-desc": true }, ...marked(e.description, terms)),
        el("div", { class: "entry__meta" },
          tags.length ? el("ul", { class: "entry__tags", "aria-label": "Tags" }, tags.map((t) => el("li", { class: "t-mono entry__tag" }, t))) : null,
          el("ul", { class: "badges", "aria-label": "Compatibility" },
            el("li", { class: e.compat?.declared ? "badge" : "badge badge--undeclared" }, first),
            os.map((o) => el("li", { class: "badge" }, o)))),
        e.runs ? el("p", { class: "runs" }, el("span", { class: "t-label runs__label" }, e.runs.label), el("span", { class: "runs__detail" }, e.runs.detail)) : null,
        el("div", { class: "copy", "data-copy": true },
          el("code", { class: "copy__text", "data-copy-text": true }, install(e.plugin)),
          el("button", { type: "button", class: "copy__button t-label", "data-copy-button": true, "aria-label": `Copy: install command for ${e.plugin}` }, "Copy")))));
}

export { el };
