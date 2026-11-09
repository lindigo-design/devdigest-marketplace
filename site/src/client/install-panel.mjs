// Install panel state (spec CAT-02 R2/AC-3, AC-9; R3/AC-1, AC-2; R4/AC-2): the scope radios and the
// session/terminal tabs. Every element with [data-scope] on the page (install variants, manage commands) shows
// only for the selected scope; [data-surface-panel] only for the selected tab. State lives in the URL
// (?scope=project&in=terminal), defaults left out; unknown values fall back without rewriting the URL.
// Without JavaScript nothing here runs and the CSS shows every variant under its heading (R2/AC-10).
import { DEFAULT_SCOPE, DEFAULT_SURFACE, SCOPES, SURFACES } from "../../lib/install.mjs";

/** @returns {{ scope: string, surface: string }} */
export function parseInstallState(search) {
  const p = new URLSearchParams(search);
  return {
    scope: SCOPES.includes(p.get("scope")) ? p.get("scope") : DEFAULT_SCOPE,
    surface: SURFACES.includes(p.get("in")) ? p.get("in") : DEFAULT_SURFACE,
  };
}

/** The query string for a state, keeping unrelated parameters; "" when everything is default. */
export function installSearch(search, { scope, surface }) {
  const p = new URLSearchParams(search);
  if (scope === DEFAULT_SCOPE) p.delete("scope");
  else p.set("scope", scope);
  if (surface === DEFAULT_SURFACE) p.delete("in");
  else p.set("in", surface);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function initInstallPanel(doc = document) {
  const panel = doc.querySelector("[data-install-panel]");
  if (!panel) return;
  const tabs = [...panel.querySelectorAll('[role="tab"]')];
  const radios = [...panel.querySelectorAll("[data-scope-input]")];
  let state = parseInstallState(location.search);

  function apply() {
    for (const el of doc.querySelectorAll("[data-scope]")) el.classList.toggle("is-active", el.dataset.scope === state.scope);
    for (const r of radios) r.checked = r.value === state.scope;
    for (const tab of tabs) {
      const on = tab.dataset.surface === state.surface;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
    }
    for (const p of panel.querySelectorAll("[data-surface-panel]")) p.classList.toggle("is-active", p.dataset.surfacePanel === state.surface);
  }

  function update(next) {
    state = { ...state, ...next };
    apply();
    const url = `${location.pathname}${installSearch(location.search, state)}${location.hash}`;
    history.replaceState(history.state, "", url);
  }

  for (const r of radios) r.addEventListener("change", () => r.checked && update({ scope: r.value }));

  for (const tab of tabs) {
    tab.addEventListener("click", () => update({ surface: tab.dataset.surface }));
    tab.addEventListener("keydown", (event) => {
      const i = tabs.indexOf(tab);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[event.key];
      if (to === undefined) return;
      event.preventDefault();
      const next = tabs[(to + tabs.length) % tabs.length];
      update({ surface: next.dataset.surface });
      next.focus();
    });
  }

  panel.classList.add("is-ready");
  apply();
}
