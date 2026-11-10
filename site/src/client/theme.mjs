// Theme switch in the site header (spec CAT-01 R7/AC-2, amended 2026-11-10; tokens §5 ThemeSwitch).
// "auto" follows the OS (no data-theme); "light" / "dark" set data-theme on <html>, which the dark-token
// selectors in tokens.css honour. The choice is kept in localStorage; the inline script in Base.astro
// applies it before first paint. Storage can be blocked (private mode, blocked site data): the switch
// then still works for the current page, and the OS preference applies on the next one.

export const THEME_KEY = "lindigo-devdigest:theme";
const THEMES = ["auto", "light", "dark"];

export function readTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

function saveTheme(theme) {
  try {
    if (theme === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

export function applyTheme(theme, root = document.documentElement) {
  if (theme === "light" || theme === "dark") root.dataset.theme = theme;
  else delete root.dataset.theme;
}

export function initTheme() {
  const group = document.querySelector("[data-theme-switch]");
  if (!group) return;
  const buttons = [...group.querySelectorAll("[data-theme-value]")];
  const show = (theme) => buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeValue === theme)));
  show(readTheme());
  for (const b of buttons) {
    b.addEventListener("click", () => {
      const theme = THEMES.includes(b.dataset.themeValue) ? b.dataset.themeValue : "auto";
      applyTheme(theme);
      saveTheme(theme);
      show(theme);
    });
  }
}
