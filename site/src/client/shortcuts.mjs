// "/" (outside text fields) and Ctrl+K / Cmd+K focus the search line (spec CAT-01 R4/AC-3).
// On pages without a search line they go to the home page and focus it there (#q).

export function isTyping(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

/** True when the key event is one of the search shortcuts. */
export function isSearchShortcut(e, active) {
  if (e.defaultPrevented || e.altKey) return false;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key?.toLowerCase() === "k") return true;
  return e.key === "/" && !e.ctrlKey && !e.metaKey && !isTyping(active);
}

/** @param {{ base: string }} opts site base path, for the jump to the home page */
export function initShortcuts({ base }) {
  window.addEventListener("keydown", (e) => {
    if (!isSearchShortcut(e, document.activeElement)) return;
    e.preventDefault();
    const input = document.querySelector("[data-search-input]");
    if (input) {
      input.focus({ preventScroll: true });
      input.closest("section")?.scrollIntoView({ block: "start" });
    } else {
      window.location.assign(`${base}#q`);
    }
  });
}
