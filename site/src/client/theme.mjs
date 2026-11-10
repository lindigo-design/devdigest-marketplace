// Light/Dark switch in the site header (spec CAT-01 R7/AC-2, amended 2026-11-10; tokens §5 ThemeSwitch).
// Until the reader flips it, the OS preference applies (no data-theme) and the switch shows it. Flipping
// sets data-theme="light" | "dark" on <html>, which the dark-token selectors in tokens.css honour, and
// keeps the choice in localStorage; the inline script in Base.astro applies it before first paint.
// Storage can be blocked (private mode, blocked site data): the switch then works for the current page.

export const THEME_KEY = "lindigo-devdigest:theme";

/** The saved choice: "light", "dark" or null (none: follow the OS). */
export function savedTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function initTheme() {
  const button = document.querySelector("[data-theme-switch]");
  if (!button) return;
  const root = document.documentElement;
  const os = window.matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : os.matches);
  const show = () => button.setAttribute("aria-checked", String(isDark()));

  show();
  os.addEventListener("change", show); // no saved choice: the switch follows the OS
  button.addEventListener("click", () => {
    const theme = isDark() ? "light" : "dark";
    root.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
    show();
  });
}
