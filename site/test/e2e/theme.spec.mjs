// Light/Dark switch (spec CAT-01 R7/AC-2, amended 2026-11-10; tokens §5 ThemeSwitch).
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const sw = (page) => page.getByRole("switch", { name: "Dark theme" });
const knobMoved = (page) => page.locator(".theme-switch__knob").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41 > 0);
const LIGHT_BG = "rgb(245, 243, 238)"; // surface/page, light
const DARK_BG = "rgb(17, 17, 21)"; // surface/page, dark

test.describe("theme switch", () => {
  test.use({ colorScheme: "light" });

  test("until flipped, the switch shows the OS theme and follows OS changes", async ({ page }) => {
    await page.goto("./");
    await expect(sw(page)).toHaveAttribute("aria-checked", "false");
    expect(await bg(page)).toBe(LIGHT_BG);
    expect(await knobMoved(page)).toBe(false);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(sw(page)).toHaveAttribute("aria-checked", "true");
    expect(await bg(page)).toBe(DARK_BG);
    await expect.poll(() => knobMoved(page)).toBe(true);
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
  });

  test("flipping overrides the OS and persists across pages and reloads", async ({ page }) => {
    await page.goto("./");
    await sw(page).click();
    await expect(sw(page)).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await bg(page)).toBe(DARK_BG);

    await page.goto("./sdd-engineering/");
    await expect(sw(page)).toHaveAttribute("aria-checked", "true");
    expect(await bg(page)).toBe(DARK_BG);

    await sw(page).click();
    await page.reload();
    await expect(sw(page)).toHaveAttribute("aria-checked", "false");
    expect(await bg(page)).toBe(LIGHT_BG);
    // The explicit Light choice now holds even on a dark OS.
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(sw(page)).toHaveAttribute("aria-checked", "false");
    expect(await bg(page)).toBe(LIGHT_BG);
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

  test("keyboard: the switch is reachable, flips with Space and Enter, with a visible focus ring", async ({ page }) => {
    await page.goto("./");
    const s = sw(page);
    await s.focus();
    const ring = await s.evaluate((el) => { const c = getComputedStyle(el); return c.outlineStyle !== "none" && parseFloat(c.outlineWidth) >= 2; });
    expect(ring).toBe(true);
    await page.keyboard.press("Space");
    await expect(s).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Enter");
    await expect(s).toHaveAttribute("aria-checked", "false");
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
