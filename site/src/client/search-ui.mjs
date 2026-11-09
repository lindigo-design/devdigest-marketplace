// Home page search UI (spec CAT-01 R2, R3, R4, R10/AC-5): live results as you type, filters with counts,
// chips, URL state, empty state, mobile filter drawer. Data: index.json, loaded once (R2/AC-1).
import { t } from "../i18n/t.mjs";
import { createEngine } from "./engine.mjs";
import { parseQuery } from "./query.mjs";
import { KIND_LABELS, el, renderEntry } from "./render.mjs";
import { FILTER_KEYS, clearFilters, hasFilters, hasQuery, isEmpty, parseState, toSearch, toggle } from "./url-state.mjs";

const PAGE = 60; // rows rendered at a time; "Show more" adds the next page
const GROUPS = { kind: t("field.kind"), plugin: t("field.plugin"), category: t("field.category"), tag: t("field.tag"), os: t("field.os") };
const TOP_TAGS = 8;

const $ = (sel, root = document) => root.querySelector(sel);
const valueLabel = (key, v) => (key === "kind" ? KIND_LABELS[v] ?? v : v);

export function initSearch() {
  const base = $('meta[name="catalog-base"]')?.content ?? "/";
  const href = (path = "") => `${base}${String(path).replace(/^\/+/, "")}`;
  const ui = {
    form: $("[data-search-form]"),
    input: $("[data-search-input]"),
    meta: $("[data-search-meta]"),
    chips: $("[data-search-chips]"),
    home: [...document.querySelectorAll("[data-home-section]")],
    summary: $("[data-rail-summary]"),
    filters: $("[data-rail-filters]"),
    groups: $("[data-filter-groups]"),
    toggle: $("[data-filters-toggle]"),
    panel: $("[data-filters-panel]"),
    clearAll: $("[data-filters-clear]"),
    done: $("[data-filters-done]"),
    results: $("[data-results]"),
    list: $("[data-results-list]"),
    more: $("[data-results-more]"),
    empty: $("#no-results"),
    clear: $("[data-clear-filters]"),
    showAll: $("[data-show-all]"),
  };
  if (!ui.input) return;

  const baseTitle = document.title;
  let engine = null;
  let marketplace = "";
  let failed = false;
  let state = parseState(location.search);
  // Kinds that came from kind words in the query (R2/AC-6), so they can leave again when the word does.
  let auto = new Set(parseQuery(state.q).kinds.filter((k) => state.kind.includes(k)));
  let shown = PAGE;
  let lastResults = [];

  const install = (plugin) => `/plugin install ${plugin}@${marketplace}`;

  // ---------- URL ----------
  function commit(mode) {
    const url = `${location.pathname}${toSearch(state)}`;
    if (url !== `${location.pathname}${location.search}`) history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
  }

  // ---------- input ----------
  function autosize() {
    ui.input.style.height = "auto";
    ui.input.style.height = `${ui.input.scrollHeight}px`;
  }

  function onQuery(q) {
    const kinds = new Set(parseQuery(q).kinds);
    let kind = state.kind.filter((k) => !(auto.has(k) && !kinds.has(k)));
    for (const k of kinds) if (!auto.has(k) && !kind.includes(k)) kind = [...kind, k];
    auto = kinds;
    state = { ...state, q, kind, view: hasQuery({ q }) ? "" : state.view };
    shown = PAGE;
    commit("replace");
    render();
  }

  ui.input.value = state.q;
  autosize();
  ui.input.addEventListener("input", () => { autosize(); onQuery(ui.input.value); });
  ui.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.preventDefault(); // results are already live
    if (e.key === "Escape") ui.input.blur();
  });
  ui.form?.addEventListener("submit", (e) => e.preventDefault());
  window.addEventListener("resize", autosize);

  // ---------- state changes from links, chips, filters ----------
  function setState(next, mode = "push") {
    state = next;
    auto = new Set([...auto].filter((k) => state.kind.includes(k)));
    shown = PAGE;
    ui.input.value = state.q;
    autosize();
    commit(mode);
    render();
  }

  window.addEventListener("popstate", () => {
    state = parseState(location.search);
    auto = new Set(parseQuery(state.q).kinds.filter((k) => state.kind.includes(k)));
    ui.input.value = state.q;
    autosize();
    render();
  });

  // Links to this page with a query string (stats, tags, categories, "Show everything") update in place.
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.("a[href]");
    if (!a || a.target) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.search) return;
    e.preventDefault();
    setState(parseState(url.search));
    ui.input.closest("section")?.scrollIntoView({ block: "start" });
  });

  ui.clear?.addEventListener("click", () => setState(clearFilters(state)));
  ui.clearAll?.addEventListener("click", () => setState(clearFilters(state)));
  ui.more?.addEventListener("click", () => { shown += PAGE; renderList(); });

  // ---------- mobile filter drawer ----------
  // Visible, enabled controls in tab order. Disabled checkboxes (0 results) cannot take focus:
  // focus() on them is silently ignored and focus would stay outside the drawer.
  function focusables(root) {
    return [...root.querySelectorAll("input:not([disabled]), button:not([disabled])")].filter((x) => x.offsetParent !== null);
  }

  function openDrawer(open) {
    ui.panel.classList.toggle("is-open", open);
    ui.toggle.setAttribute("aria-expanded", String(open));
    if (open) {
      ui.panel.setAttribute("role", "dialog");
      ui.panel.setAttribute("aria-modal", "true");
      ui.panel.setAttribute("aria-label", t("filters.title"));
      focusables(ui.panel)[0]?.focus();
    } else {
      ["role", "aria-modal", "aria-label"].forEach((a) => ui.panel.removeAttribute(a));
      ui.toggle.focus();
    }
  }
  ui.toggle?.addEventListener("click", () => openDrawer(!ui.panel.classList.contains("is-open")));
  ui.done?.addEventListener("click", () => openDrawer(false));
  ui.panel?.addEventListener("keydown", (e) => {
    if (!ui.panel.classList.contains("is-open")) return;
    if (e.key === "Escape") { e.preventDefault(); openDrawer(false); return; }
    if (e.key !== "Tab") return;
    const items = focusables(ui.panel);
    if (!items.length) return;
    const [first, last] = [items[0], items[items.length - 1]];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // ---------- rendering ----------
  function renderChips() {
    const chips = FILTER_KEYS.flatMap((k) => state[k].map((v) => ({ k, v })));
    ui.chips.hidden = chips.length === 0;
    ui.chips.replaceChildren(...chips.map(({ k, v }) => {
      const remove = el("button", { type: "button", class: "chip__remove", "aria-label": t("chip.remove.aria", { group: GROUPS[k], value: valueLabel(k, v) }) }, t("chip.remove"));
      remove.addEventListener("click", () => setState(toggle(state, k, v)));
      return el("li", { class: "chip" }, t("chip.label", { group: GROUPS[k], value: valueLabel(k, v) }), remove);
    }));
    ui.toggle.textContent = chips.length ? t("filters.toggle.count", { count: chips.length }) : t("filters.title");
  }

  function renderFilters(facets) {
    const groups = FILTER_KEYS.map((k) => {
      let options = facets[k];
      if (k === "tag") {
        const top = [...options].filter((o) => o.count > 0).sort((a, b) => b.count - a.count).slice(0, TOP_TAGS);
        const active = options.filter((o) => state.tag.includes(o.value) && !top.includes(o));
        options = [...top, ...active];
      }
      if (k === "category" || k === "os") options = options.filter((o) => o.count > 0 || state[k].includes(o.value));
      if (!options.length) return null;
      return el("fieldset", { class: "filter-group" },
        el("legend", { class: "t-label" }, GROUPS[k]),
        options.map((o) => {
          const checked = state[k].includes(o.value);
          const disabled = !checked && o.count === 0;
          const box = el("input", { type: "checkbox", name: k, value: o.value, checked, disabled });
          box.addEventListener("change", () => setState(toggle(state, k, o.value)));
          return el("label", { class: `filter-option${checked ? " filter-option--checked" : ""}${disabled ? " filter-option--disabled" : ""}` },
            box, el("span", { class: "filter-option__label" }, valueLabel(k, o.value)),
            el("span", { class: "filter-option__count", "aria-label": t("filters.option.count.aria", { count: o.count }) }, String(o.count)));
        }));
    }).filter(Boolean);
    // Keep focus on the same checkbox after re-rendering. If it is now disabled (an unchecked option
    // with 0 results) or gone, move to the first enabled option of the same group, then of the filters.
    const focused = document.activeElement?.closest?.("[data-filter-groups]") ? [document.activeElement.name, document.activeElement.value] : null;
    ui.groups.replaceChildren(...groups);
    if (focused) {
      const [name, value] = focused.map((s) => CSS.escape(s));
      const same = ui.groups.querySelector(`input[name="${name}"][value="${value}"]`);
      const target = same && !same.disabled ? same
        : ui.groups.querySelector(`input[name="${name}"]:not([disabled])`) ?? focusables(ui.groups)[0];
      target?.focus();
    }
  }

  function renderList() {
    const rows = lastResults.slice(0, shown).map((r, i) => renderEntry(r.entry, { href, install, terms: r.terms, index: i }));
    ui.list.replaceChildren(...rows);
    ui.more.hidden = lastResults.length <= shown;
    ui.more.textContent = t("results.more.count", { count: Math.min(PAGE, lastResults.length - shown) });
  }

  function renderEmpty() {
    const q = state.q.trim();
    $("[data-empty-title]", ui.empty).textContent = q ? t("results.empty.title.query", { query: q }) : t("results.empty.title.filters");
    const text = $("[data-empty-text]", ui.empty) ?? ui.empty.insertBefore(el("p", { class: "empty__text t-secondary measure", "data-empty-text": true }), ui.empty.children[1]);
    text.textContent = hasFilters(state)
      ? (q ? t("results.empty.text.queryFiltered") : t("results.empty.text.leftFiltered"))
      : (q ? t("results.empty.text.query") : t("results.empty.text.left"));
    ui.clear.hidden = !hasFilters(state);
    let label = t("results.clearFilters");
    if (hasFilters(state) && q) {
      // R2/AC-9 + owner's addition: say how many results the query has without the filters (count only, D6).
      const without = engine.search({ q: state.q }).total;
      if (without > 0) {
        const onlyKind = FILTER_KEYS.every((k) => k === "kind" || !state[k].length);
        label = onlyKind
          ? t("results.clearFilters.otherKinds", { count: without })
          : t("results.clearFilters.withoutFilters", { count: without });
      }
    }
    ui.clear.textContent = label;
  }

  function render() {
    const active = !isEmpty(state);
    ui.home.forEach((s) => { s.hidden = active; });
    ui.summary.hidden = active;
    ui.filters.hidden = !active;
    ui.results.hidden = !active;
    renderChips();
    document.title = active && hasQuery(state) ? t("doc.title.query", { query: state.q.trim(), title: baseTitle }) : baseTitle;

    if (!active) {
      ui.meta.textContent = t("search.hint");
      return;
    }
    if (failed) { ui.meta.textContent = t("search.failed"); return; }
    if (!engine) { ui.meta.textContent = t("search.loading"); return; }

    const r = engine.search(state);
    lastResults = r.results;
    renderFilters(r.facets);
    ui.empty.hidden = r.total > 0;
    ui.list.hidden = r.total === 0;
    if (r.total === 0) {
      renderEmpty();
      ui.list.replaceChildren();
      ui.more.hidden = true;
      ui.meta.textContent = t("search.noResults");
      return;
    }
    renderList();
    ui.meta.textContent = hasQuery(state) ? t("search.results", { count: r.total }) : t("search.showingAll", { count: r.total });
  }

  // ---------- data ----------
  fetch(href("index.json"))
    .then((res) => { if (!res.ok) throw new Error(String(res.status)); return res.json(); })
    .then((index) => {
      engine = createEngine(index);
      marketplace = index.marketplace?.name ?? "";
      render();
    })
    .catch(() => { failed = true; render(); });

  if (location.hash === "#q") ui.input.focus();
  render();
}
