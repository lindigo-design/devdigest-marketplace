// Quality bar in a real browser (spec CAT-01 R7): WCAG 2.1 AA (axe) in light and dark, keyboard reach and
// visible focus, 360 px without horizontal scroll, reduced motion, no third-party requests.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ROUTES = {
  home: "./",
  results: "./?q=security%20review",
  everything: "./?view=all",
  "no results": "./?q=kubernetes%20helm&kind=skill",
  plugin: "./sdd-engineering/",
  "plugin with warning": "./research-tools/",
  skill: "./engineering-paved-path/skill/security/",
  agent: "./architecture-review/agent/security-reviewer/",
  hook: "./architecture-review/hook/gate/",
  command: "./sdd-engineering/command/sdd/",
  mcp: "./sdd-engineering/mcp/devdigest/",
  "not found": "./no-such-page/",
};

async function ready(page, url) {
  await page.goto(url);
  // Search routes: wait until results or the empty state are rendered from index.json.
  if (url.includes("?")) await expect(page.locator("[data-search-meta]")).not.toHaveText(/Loading/);
  await page.evaluate(() => document.fonts.ready);
  // Let entrance animations finish so axe measures final colors.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))));
}

for (const scheme of ["light", "dark"]) {
  test.describe(`axe, WCAG 2.1 AA, ${scheme} (R7/AC-1, AC-2)`, () => {
    test.use({ colorScheme: scheme });
    for (const [name, url] of Object.entries(ROUTES)) {
      test(name, async ({ page }) => {
        await ready(page, url);
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const summary = violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
        expect(summary).toEqual([]);
      });
    }
  });
}

test.describe("360 px wide, no horizontal page scroll (R7/AC-3)", () => {
  test.use({ viewport: { width: 360, height: 740 } });
  for (const [name, url] of Object.entries(ROUTES)) {
    test(name, async ({ page }) => {
      await ready(page, url);
      const result = await page.evaluate(() => {
        window.scrollTo(1000, 0);
        const scrolled = window.scrollX;
        const vw = document.documentElement.clientWidth;
        // Elements that stick out of the viewport, unless they sit inside their own scroll container
        // (code blocks, tables, the command field) or are visually hidden on purpose.
        const inScroller = (el) => {
          for (let p = el.parentElement; p; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX;
            if (o === "auto" || o === "scroll") return true;
          }
          return false;
        };
        const out = [];
        for (const el of document.body.querySelectorAll("*")) {
          const r = el.getBoundingClientRect();
          if (!r.width || el.closest(".visually-hidden, .skip-link, [hidden]")) continue;
          if (r.right > vw + 1 && !inScroller(el)) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} right=${Math.round(r.right)}`);
        }
        return { scrolled, overflow: out.slice(0, 5) };
      });
      expect(result.scrolled).toBe(0);
      expect(result.overflow).toEqual([]);
    });
  }
});

test.describe("type sizes from design-tokens.md §5 (checkpoint 2)", () => {
  const px = (loc) => loc.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  for (const width of [1440, 360]) {
    test(`stat labels are body-lg (18px), relations lines body (16px) at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(ROUTES.home);
      for (const label of await page.locator(".stat__label").all()) expect(await px(label)).toBe(18);
      const rel = page.locator(".entry__rel");
      expect(await rel.count()).toBeGreaterThan(0);
      for (const line of await rel.all()) expect(await px(line)).toBe(16);
      await page.goto(ROUTES.plugin);
      for (const list of await page.locator(".rail .list").all()) expect(await px(list)).toBe(16);
      expect(await page.evaluate(() => { window.scrollTo(1000, 0); return window.scrollX; })).toBe(0);
    });
  }
});

test.describe("keyboard (R7/AC-1)", () => {
  test("search, filters, cards and copy buttons are reachable with Tab, with a visible focus ring", async ({ page }) => {
    await ready(page, ROUTES.results);
    const seen = new Set();
    const noRing = [];
    for (let i = 0; i < 120; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        const kind = el.matches("#q") ? "search" : el.matches('[data-filter-groups] input') ? "filter"
          : el.matches("[data-copy-button]") ? "copy" : el.matches(".entry__link") ? "card" : el.matches(".chip__remove") ? "chip" : "other";
        // The card link draws its ring on the row (article:has(:focus-visible)).
        const ringOn = kind === "card" ? el.closest("article") : kind === "search" ? el.closest("label") : el;
        const s = getComputedStyle(ringOn);
        return { kind, ring: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2 };
      });
      seen.add(info.kind);
      if (info.kind !== "other" && !info.ring) noRing.push(info.kind);
    }
    for (const k of ["search", "filter", "card", "copy"]) expect(seen, `reached ${k}`).toContain(k);
    expect(noRing).toEqual([]);
  });

  test("the skip link moves focus to the main content", async ({ page }) => {
    await page.goto(ROUTES.plugin);
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });

  test("a filter checkbox toggles with Space and keeps focus", async ({ page }) => {
    await ready(page, ROUTES.results);
    const box = page.locator('[data-filter-groups] input[name="kind"][value="skill"]');
    await box.focus();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/kind=skill/);
    await expect(page.locator('[data-filter-groups] input[name="kind"][value="skill"]')).toBeFocused();
  });
});

test.describe("reduced motion (R7/AC-7)", () => {
  test.use({ reducedMotion: "reduce" });
  for (const url of [ROUTES.home, ROUTES.results, ROUTES.plugin]) {
    test(`no running animations on ${url}`, async ({ page }) => {
      await page.goto(url);
      if (url.includes("?")) await expect(page.locator("[data-search-meta]")).not.toHaveText(/Loading/);
      await page.waitForTimeout(100);
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").map((a) => a.animationName ?? a.constructor.name));
      expect(running).toEqual([]);
    });
  }
});

test.describe("no third-party requests (R7/AC-5)", () => {
  for (const [name, url] of Object.entries(ROUTES)) {
    test(name, async ({ page, baseURL }) => {
      const origin = new URL(baseURL).origin;
      const foreign = [];
      page.on("request", (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith("data:")) foreign.push(r.url()); });
      await ready(page, url);
      expect(foreign).toEqual([]);
    });
  }
});
