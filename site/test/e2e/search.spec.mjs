// Search UI in a real browser (spec CAT-01 R2, R3, R4; acceptance demo step 1).
import { expect, test } from "@playwright/test";

const DEMO_QUERY = "мені треба скіл для рев'ю безпеки";
const ids = (page) => page.locator("[data-results-list] article").evaluateAll((els) => els.map((e) => e.dataset.entry));

async function type(page, text) {
  const q = page.locator("#q");
  await q.fill(text);
  await expect(page.locator("[data-search-meta]")).not.toHaveText(/Loading/);
}

test.describe("live search", () => {
  test("acceptance demo step 1: kind filter on, security and review skills lead", async ({ page }) => {
    await page.goto("./");
    await type(page, DEMO_QUERY);
    await expect(page.locator(".chip")).toHaveText(/Kind: Skill/);
    const order = await ids(page);
    expect(order.slice(0, 2).sort()).toEqual(["architecture-review/skill/pr-self-review", "engineering-paved-path/skill/security"]);
    expect(order.every((id) => id.includes("/skill/"))).toBe(true);
    await expect(page).toHaveURL(/\?q=.+&kind=skill$/);
  });

  test("matched words are highlighted in name and description (R3/AC-2)", async ({ page }) => {
    await page.goto("./");
    await type(page, "security");
    const first = page.locator("[data-results-list] article").first();
    await expect(first.locator(".entry__link mark")).toHaveText("security");
    await expect(first.locator("[data-entry-desc] mark").first()).toHaveText(/security/i);
    // Same token colors in the name as in the description, never the browser's default yellow.
    const bg = (loc) => loc.evaluate((m) => getComputedStyle(m).backgroundColor);
    expect(await bg(first.locator(".entry__link mark"))).toBe(await bg(first.locator("[data-entry-desc] mark").first()));
    expect(await bg(first.locator(".entry__link mark"))).not.toBe("rgb(255, 255, 0)");
  });

  test("results update within 100 ms of the last keystroke (R2/AC-2)", async ({ page }) => {
    await page.goto("./");
    await type(page, "x"); // index loaded
    const ms = await page.evaluate(async () => {
      await new Promise(requestAnimationFrame); // headless Chromium delays the very first frame; not search work
      const q = document.querySelector("#q");
      q.value = "architecture";
      const t = performance.now();
      q.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise(requestAnimationFrame);
      return performance.now() - t;
    });
    expect(ms).toBeLessThan(100);
    await expect(page.locator("[data-results-list] article").first()).toHaveAttribute("data-entry", /architecture/);
  });

  test("no request per keystroke (R2/AC-1)", async ({ page }) => {
    await page.goto("./");
    await type(page, "s");
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    for (const ch of "ecurity review") await page.locator("#q").press(ch === " " ? "Space" : ch);
    await expect(page.locator("[data-results-list] article").first()).toBeVisible();
    expect(requests).toEqual([]);
  });

  test("clearing the query returns to the home sections", async ({ page }) => {
    await page.goto("./");
    await type(page, "security");
    await expect(page.locator("#whatsnew")).toBeHidden();
    await type(page, "");
    await expect(page.locator("#whatsnew")).toBeVisible();
    await expect(page).toHaveURL(/\/devdigest-marketplace\/$/);
  });
});

test.describe("filters and URL state (R4)", () => {
  test("filters combine with the query and live in the URL; reload restores them", async ({ page }) => {
    await page.goto("./");
    await type(page, "review");
    await page.locator('[data-filter-group="plugin"] > summary').click();
    await page.locator('[data-filter-groups] input[name="plugin"][value="architecture-review"]').check();
    await expect(page).toHaveURL(/q=review&plugin=architecture-review/);
    const before = await ids(page);
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((id) => id.startsWith("architecture-review"))).toBe(true);
    await page.reload();
    await expect(page.locator("#q")).toHaveValue("review");
    await expect(page.locator('[data-filter-groups] input[value="architecture-review"]')).toBeChecked();
    expect(await ids(page)).toEqual(before);
  });

  test("filter groups collapse; open state survives typing; groups with URL filters start open", async ({ page }) => {
    await page.goto("./?q=review");
    const group = (k) => page.locator(`[data-filter-group="${k}"]`);
    await expect(group("kind")).toHaveAttribute("open", "");
    for (const k of ["plugin", "tag"]) await expect(group(k)).not.toHaveAttribute("open", "");
    await expect(page.locator('input[name="plugin"]').first()).toBeHidden();
    await group("plugin").locator("summary").click();
    await group("kind").locator("summary").click();
    await type(page, "security");
    await expect(group("plugin")).toHaveAttribute("open", "");
    await expect(group("kind")).not.toHaveAttribute("open", "");
    await page.goto("./?q=review&tag=review");
    await expect(group("tag")).toHaveAttribute("open", "");
    await expect(group("tag").locator(".filter-group__active")).toHaveText("1");
  });

  test("removing a chip removes the filter; back button restores it", async ({ page }) => {
    await page.goto("./?kind=agent&os=macOS");
    await expect(page.locator(".chip")).toHaveCount(2);
    await page.getByRole("button", { name: "Remove filter Kind: Agent" }).click();
    await expect(page).toHaveURL(/\?os=macOS$/);
    await page.goBack();
    await expect(page.locator(".chip")).toHaveCount(2);
  });

  test("stat links open the kind-filtered list in place (R8/AC-2)", async ({ page }) => {
    await page.goto("./");
    await page.locator('a.stat[href$="?kind=hook"]').click();
    await expect(page).toHaveURL(/\?kind=hook$/);
    expect((await ids(page)).every((id) => id.includes("/hook/"))).toBe(true);
    await expect(page.locator("[data-search-meta]")).toHaveText("Showing everything · 3 entries");
  });

  test("/ and Ctrl+K focus the search line outside text fields (R4/AC-3)", async ({ page }) => {
    await page.goto("./");
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("/");
    await expect(page.locator("#q")).toBeFocused();
    await expect(page.locator("#q")).toHaveValue("");
    await page.locator("#q").blur();
    await page.keyboard.press("Control+k");
    await expect(page.locator("#q")).toBeFocused();
  });

  test("on other pages the shortcut goes to the search line on the home page", async ({ page }) => {
    await page.goto("./sdd-engineering/");
    await page.keyboard.press("/");
    await expect(page).toHaveURL(/\/devdigest-marketplace\/#q$/);
    await expect(page.locator("#q")).toBeFocused();
  });
});

test.describe("empty state (R2/AC-9)", () => {
  test("echoes the query and links to the full list", async ({ page }) => {
    await page.goto("./");
    await type(page, "kubernetes helm");
    await expect(page.locator("#no-results")).toBeVisible();
    await expect(page.locator("[data-empty-title]")).toHaveText("Nothing matches “kubernetes helm”.");
    await expect(page.locator("[data-clear-filters]")).toBeHidden();
    await page.locator("[data-show-all]").click();
    await expect(page).toHaveURL(/\?view=all$/);
    await expect(page.locator("[data-search-meta]")).toHaveText("Showing everything · 18 entries");
    const order = await ids(page);
    expect(order.slice(0, 4)).toEqual(["engineering-paved-path", "research-tools", "architecture-review", "sdd-engineering"]); // R2/AC-8
  });

  test("when filters cause zero results, the button counts the query's other results", async ({ page }) => {
    await page.goto("./");
    await type(page, "planning agent");
    await expect(page.locator("#no-results")).toBeVisible();
    await expect(page.locator("[data-clear-filters]")).toHaveText("Clear filters (7 results in other kinds)");
    await page.locator("[data-clear-filters]").click();
    await expect(page.locator("[data-search-meta]")).toHaveText("7 results");
    await expect(page.locator(".chip")).toHaveCount(0);
  });
});

test.describe("cards (R3)", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copy puts the install command on the clipboard and says Copied, without opening the card", async ({ page }) => {
    await page.goto("./");
    await type(page, "gate");
    const card = page.locator('article[data-entry="architecture-review/hook/gate"]');
    await card.getByRole("button", { name: /Copy: install command for architecture-review/ }).click();
    await expect(card.locator("[data-copy-button]")).toHaveText("Copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("/plugin install architecture-review --marketplace lindigo-design/devdigest-marketplace");
    await expect(page).toHaveURL(/\?q=gate$/);
    await expect(card.locator("[data-copy-button]")).toHaveText("Copy", { timeout: 4000 });
  });

  test("clicking the card outside the copy button opens the page (R3/AC-5)", async ({ page }) => {
    await page.goto("./");
    await type(page, "gate");
    // The stretched link covers the whole row, so a click anywhere on the card lands on it.
    await page.locator('article[data-entry="architecture-review/hook/gate"]').click({ position: { x: 400, y: 70 } });
    await expect(page).toHaveURL(/\/architecture-review\/hook\/gate\/$/);
  });

  test("home and results views share the rail width and the gap to the main column (tokens §5 Filter panel)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const cols = (rail, main) => page.evaluate(([r, m]) => [r, m].map((s) => {
      const b = document.querySelector(s).getBoundingClientRect();
      return [Math.round(b.left), Math.round(b.width)];
    }), [rail, main]);
    await page.goto("./");
    const home = await cols("[data-rail-summary]", "[data-home-section]");
    await type(page, "review");
    expect(await cols("[data-rail-filters]", "[data-results]")).toEqual(home);
  });

  for (const width of [1440, 360]) {
    test(`a card's description, tags row and copy block share one right edge at ${width}px (tokens §5 ResultEntry body width)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("./?view=all&kind=plugin");
      await expect(page.locator("[data-search-meta]")).not.toHaveText(/Loading/);
      const edges = await page.evaluate(() => [...document.querySelectorAll("article.entry")].map((a) =>
        [".entry__desc", ".entry__meta", ".copy"].map((s) => Math.round(a.querySelector(s).getBoundingClientRect().right))));
      expect(edges.length).toBeGreaterThan(0);
      for (const e of edges) expect(new Set(e).size, JSON.stringify(e)).toBe(1);
      // Tags, then compatibility badges below them (tokens §5 Facts).
      const stacked = await page.evaluate(() => [...document.querySelectorAll("article.entry")].filter((a) => a.querySelector(".entry__tags"))
        .every((a) => a.querySelector(".badges").getBoundingClientRect().top >= a.querySelector(".entry__tags").getBoundingClientRect().bottom));
      expect(stacked).toBe(true);
    });
  }

  for (const url of ["./engineering-paved-path/skill/security/", "./research-tools/"]) {
    test(`page main column: one right edge for the install block and the text on ${url} (tokens §5 Page main column)`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(url);
      const r = await page.evaluate(() => {
        const m = document.querySelector(".main");
        const right = (el) => Math.round(el.getBoundingClientRect().right);
        const box = m.querySelector(".copy").closest("section, .block, [class*='install']");
        // Lines of the command text itself (the field stretches to the Copy button's height).
        const range = document.createRange();
        range.selectNodeContents(m.querySelector(".copy__text"));
        const copyLines = new Set([...range.getClientRects()].map((q) => Math.round(q.top))).size;
        // Any paragraph in the column (Try it notes, README text) ends at the same edge.
        const paras = [...m.querySelectorAll(".ti p, .prose p")].map(right);
        return { main: right(m), prose: right(m.querySelector(".prose")), box: right(box), copyLines, paras };
      });
      expect(r.prose).toBe(r.main);
      for (const p of r.paras) expect(p).toBe(r.main);
      expect(r.box).toBe(r.main);
      expect(r.copyLines).toBe(1);
    });
  }

  test("hook and agent cards show the runs-commands marker (R3/AC-3)", async ({ page }) => {
    await page.goto("./?kind=agent");
    await expect(page.locator('article[data-entry="architecture-review/agent/security-reviewer"] .runs')).toHaveText(/Runs commands\s*Read, Grep, Glob, Bash/);
  });
});

test.describe("narrow screens and no JavaScript", () => {
  test("the drawer toggle exists only on narrow screens", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("./?q=review");
    await expect(page.locator("[data-filters-toggle]")).toBeHidden();
    await expect(page.locator("[data-filter-groups]")).toBeVisible();
  });

  test("filters open in a drawer at 360 px and close with Escape", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("./?q=review");
    await expect(page.locator("[data-filter-groups]")).toBeHidden();
    await page.locator("[data-filters-toggle]").click();
    await expect(page.locator("[data-filters-panel]")).toHaveAttribute("role", "dialog");
    await expect(page.locator("[data-filter-groups]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-filter-groups]")).toBeHidden();
    await expect(page.locator("[data-filters-toggle]")).toBeFocused();
  });

  const focusInsidePanel = (page) => page.evaluate(() => {
    const a = document.activeElement;
    return Boolean(a && document.querySelector("[data-filters-panel]").contains(a) && !a.disabled);
  });

  test("unchecking an option that becomes disabled keeps focus in the drawer (PR review finding 3)", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    // research-tools has no skills: with this plugin, "Skill" has 0 results once unchecked, so it turns disabled.
    await page.goto("./?kind=skill&plugin=research-tools");
    await page.locator("[data-filters-toggle]").click();
    const skill = page.locator('[data-filter-groups] input[name="kind"][value="skill"]');
    await skill.focus();
    await page.keyboard.press("Space");
    await expect(skill).toBeDisabled();
    expect(await focusInsidePanel(page)).toBe(true);
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      expect(await focusInsidePanel(page)).toBe(true);
    }
  });

  test.describe("JavaScript disabled (§7)", () => {
    test.use({ javaScriptEnabled: false });
    test("plugin list and pages render; search shows a notice", async ({ page }) => {
      await page.goto("./");
      await expect(page.getByText("Search needs JavaScript.")).toBeVisible();
      await expect(page.locator("article.entry")).toHaveCount(4);
      await page.goto("./architecture-review/agent/security-reviewer/");
      await expect(page.locator("h1")).toHaveText("security-reviewer");
    });
  });
});
