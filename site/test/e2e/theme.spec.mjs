// Theme switch (spec CAT-01 R7/AC-2, amended 2026-11-10; tokens §5 ThemeSwitch).
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const pressed = (page) => page.locator('[data-theme-switch] [aria-pressed="true"]');
const LIGHT_BG = "rgb(245, 243, 238)"; // surface/page, light
const DARK_BG = "rgb(17, 17, 21)"; // surface/page, dark

test.describe("theme switch", () => {
  test.use({ colorScheme: "light" });

  test("Auto follows the OS; Dark and Light override it and persist across pages and reloads", async ({ page }) => {
    await page.goto("./");
    await expect(pressed(page)).toHaveText("Auto");
    expect(await bg(page)).toBe(LIGHT_BG);

    await page.getByRole("button", { name: "Dark" }).click();
    await expect(pressed(page)).toHaveText("Dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(() => bg(page)).toBe(DARK_BG);

    await page.goto("./sdd-engineering/");
    await expect(pressed(page)).toHaveText("Dark");
    expect(await bg(page)).toBe(DARK_BG);

    await page.getByRole("button", { name: "Auto" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
    await page.reload();
    await expect(pressed(page)).toHaveText("Auto");
    expect(await bg(page)).toBe(LIGHT_BG);
  });

  test("a light site on a dark OS", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("./");
    expect(await bg(page)).toBe(DARK_BG);
    await page.getByRole("button", { name: "Light" }).click();
    await expect.poll(() => bg(page)).toBe(LIGHT_BG);
  });

  test("the saved theme is applied before first paint (no flash of the other theme)", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("lindigo-devdigest:theme", "dark"));
    // Record data-theme as soon as <body> exists, before any module script runs.
    await page.addInitScript(() => {
      new MutationObserver((_, obs) => {
        if (document.body) { window.__themeAtBody = document.documentElement.dataset.theme ?? null; obs.disconnect(); }
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto("./");
    expect(await page.evaluate(() => window.__themeAtBody)).toBe("dark");
  });

  test("keyboard: the switch is reachable and toggles with Enter, with a visible focus ring", async ({ page }) => {
    await page.goto("./");
    const dark = page.getByRole("button", { name: "Dark" });
    await dark.focus();
    const ring = await dark.evaluate((el) => { const s = getComputedStyle(el); return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2; });
    expect(ring).toBe(true);
    await page.keyboard.press("Enter");
    await expect(dark).toHaveAttribute("aria-pressed", "true");
  });

  for (const theme of ["light", "dark"]) {
    test(`axe passes with ${theme} picked against the other OS scheme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme === "dark" ? "light" : "dark" });
      await page.addInitScript((v) => localStorage.setItem("lindigo-devdigest:theme", v), theme);
      for (const url of ["./", "./sdd-engineering/"]) {
        await page.goto(url);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))));
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(violations.map((v) => `${url} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      }
    });
  }
});
