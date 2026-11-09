// Copy-to-clipboard for every [data-copy] block (spec CAT-01 R3/AC-4; tokens §5 CopyCommand).
// copied: label "Copied" for 2 s, announced; error (clipboard blocked): the command text is selected instead.

import { t } from "../i18n/t.mjs";

export const COPIED_MS = 2000;

function announce(text) {
  let live = document.getElementById("copy-status");
  if (!live) {
    live = document.createElement("p");
    live.id = "copy-status";
    live.className = "visually-hidden";
    live.setAttribute("aria-live", "polite");
    document.body.append(live);
  }
  live.textContent = "";
  // A new text node in a later frame makes screen readers announce repeated messages too.
  requestAnimationFrame(() => { live.textContent = text; });
}

function selectText(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function setState(button, state, label) {
  clearTimeout(button._copyTimer);
  button.dataset.state = state;
  button.textContent = label;
  button._copyTimer = setTimeout(() => {
    delete button.dataset.state;
    button.textContent = t("copy.button");
  }, COPIED_MS);
}

/** Copies the command of the [data-copy] block that holds `button`. */
export async function copyFrom(button) {
  const block = button.closest("[data-copy]");
  const text = block?.querySelector("[data-copy-text]");
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text.textContent.trim());
    setState(button, "copied", t("copy.copied"));
    announce(t("copy.announce.copied", { command: text.textContent.trim() }));
    return true;
  } catch {
    selectText(text);
    setState(button, "error", t("copy.selected"));
    announce(t("copy.announce.blocked"));
    return false;
  }
}

/** One listener for the page; copy buttons inside clickable cards must not open the card (R3/AC-5). */
export function initCopy(root = document) {
  root.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-copy-button]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    copyFrom(button);
  });
}
