// Plugin page: install panel, manage block, try it (spec CAT-02 R2–R7) in a real browser.
import { expect, test } from "@playwright/test";

const M = "lindigo-design/devdigest-marketplace";
const visibleText = (page) => page.locator("#install").evaluate((el) => el.innerText.replace(/\s+/g, " "));

test.describe("install panel (R2, R3)", () => {
  test("defaults: User and the session tab; one variant visible", async ({ page }) => {
    await page.goto("./sdd-engineering/");
    await expect(page.getByRole("radio", { name: /^User/ })).toBeChecked();
    await expect(page.getByRole("tab", { name: "In a Claude Code session" })).toHaveAttribute("aria-selected", "true");
    const t = await visibleText(page);
    expect(t).toContain(`/plugin install sdd-engineering --marketplace ${M}`);
    expect(t).toContain("Install for you (user scope)");
    expect(t).not.toContain("project scope)");
    expect(t).not.toContain("claude plugin install");
  });

  test("AC-3, AC-9: scope and tab change the commands at once and go into the URL; reload keeps them", async ({ page }) => {
    await page.goto("./sdd-engineering/");
    await page.getByRole("radio", { name: /^Project/ }).check();
    await page.getByRole("tab", { name: "In your terminal" }).click();
    await expect(page).toHaveURL(/\/sdd-engineering\/\?scope=project&in=terminal$/);
    let t = await visibleText(page);
    expect(t).toContain(`claude plugin marketplace add ${M} --scope project`);
    expect(t).toContain("claude plugin install sdd-engineering@lindigo-devdigest --scope project");
    expect(t).toContain('"enabledPlugins"');
    expect(t).toContain("git add .claude/settings.json");

    await page.reload();
    await expect(page.getByRole("radio", { name: /^Project/ })).toBeChecked();
    await expect(page.getByRole("tab", { name: "In your terminal" })).toHaveAttribute("aria-selected", "true");
    t = await visibleText(page);
    expect(t).toContain("--scope project");

    await page.getByRole("radio", { name: /^User/ }).check();
    await page.getByRole("tab", { name: "In a Claude Code session" }).click();
    await expect(page).toHaveURL(/\/sdd-engineering\/$/); // defaults are left out
  });

  test("R3/AC-1: arrow keys, Home and End move between tabs", async ({ page }) => {
    await page.goto("./sdd-engineering/");
    const session = page.getByRole("tab", { name: "In a Claude Code session" });
    const terminal = page.getByRole("tab", { name: "In your terminal" });
    await session.focus();
    await page.keyboard.press("ArrowRight");
    await expect(terminal).toBeFocused();
    await expect(terminal).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#install-panel-terminal")).toBeVisible();
    await expect(page.locator("#install-panel-session")).toBeHidden();
    await page.keyboard.press("ArrowRight"); // wraps
    await expect(session).toBeFocused();
    await page.keyboard.press("End");
    await expect(terminal).toBeFocused();
    await page.keyboard.press("Home");
    await expect(session).toHaveAttribute("aria-selected", "true");
  });

  test("scope radios work with the keyboard", async ({ page }) => {
    await page.goto("./sdd-engineering/");
    await page.getByRole("radio", { name: /^User/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: /^Project/ })).toBeChecked();
    await expect(page).toHaveURL(/\?scope=project$/);
  });

  test("an unknown scope falls back to User and the URL is left alone", async ({ page }) => {
    await page.goto("./sdd-engineering/?scope=bogus&in=nowhere");
    await expect(page.getByRole("radio", { name: /^User/ })).toBeChecked();
    await expect(page.getByRole("tab", { name: "In a Claude Code session" })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/\?scope=bogus&in=nowhere$/);
  });

  test("copying the project settings copies the JSON with its line breaks", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("./research-tools/?scope=project");
    await page.getByRole("button", { name: "Copy: .claude/settings.json for this plugin" }).locator("visible=true").click();
    // The Windows clipboard returns CRLF line endings.
    const json = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
    expect(JSON.parse(json)).toEqual({
      enabledPlugins: { "research-tools@lindigo-devdigest": true, "engineering-paved-path@lindigo-devdigest": true },
      extraKnownMarketplaces: { "lindigo-devdigest": { source: { source: "github", repo: M } } },
    });
    expect(json).toContain('\n  "enabledPlugins": {\n');
  });
});

test.describe("without JavaScript (R2/AC-10)", () => {
  test.use({ javaScriptEnabled: false });
  test("every scope × surface variant is visible under a heading; tabs and radios are hidden", async ({ page }) => {
    await page.goto("./sdd-engineering/");
    await expect(page.locator(".ip__nojs-title").first()).toBeVisible();
    await expect(page.locator("[role=tablist]")).toBeHidden();
    await expect(page.locator(".ip__scopes")).toBeHidden();
    const t = await visibleText(page);
    for (const s of ["Install for you (user scope)", "project scope)", "local scope)", `--scope local`, "git add .claude/settings.json"]) expect(t).toContain(s);
  });
});

test.describe("manage block (R4)", () => {
  test("collapsed; opens with the keyboard; terminal commands follow the scope choice", async ({ page }) => {
    await page.goto("./sdd-engineering/");
    const summary = page.locator("#manage > summary");
    await expect(page.locator("#manage")).not.toHaveAttribute("open", "");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#manage")).toHaveAttribute("open", "");
    const uninstall = page.locator('[data-action="uninstall"]');
    await expect(uninstall.getByText("claude plugin uninstall sdd-engineering@lindigo-devdigest --prune", { exact: true })).toBeVisible();
    await page.getByRole("radio", { name: /^Project/ }).check();
    await expect(uninstall.getByText("claude plugin uninstall sdd-engineering@lindigo-devdigest --scope project --prune", { exact: true })).toBeVisible();
    await expect(uninstall.getByText("claude plugin uninstall sdd-engineering@lindigo-devdigest --prune", { exact: true })).toBeHidden();
    await expect(uninstall.getByText(/uninstall it for everyone/)).toBeVisible();
  });

  test("download link points at the release tag archive (R5)", async ({ page }) => {
    await page.goto("./sdd-engineering/");
    await expect(page.getByRole("link", { name: "Download source (.zip)" }))
      .toHaveAttribute("href", "https://github.com/lindigo-design/devdigest-marketplace/archive/refs/tags/sdd-engineering--v0.1.0.zip");
  });
});

test.describe("quality on the plugin page (R7)", () => {
  test("AC-1: Tab reaches scope radios, tabs, copy buttons and Manage, each with a visible focus ring", async ({ page }) => {
    await page.goto("./sdd-engineering/");
    const seen = new Set();
    const noRing = [];
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        const kind = el.matches("[data-scope-input]") ? "scope" : el.matches('[role="tab"]') ? "tab"
          : el.matches("[data-copy-button]") ? "copy" : el.matches("#manage > summary") ? "manage" : "other";
        // The radio draws its ring on its label (.ip__scope:has(input:focus-visible)).
        const ringOn = kind === "scope" ? el.closest("label") : el;
        const s = getComputedStyle(ringOn);
        return { kind, ring: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2 };
      });
      seen.add(info.kind);
      if (info.kind !== "other" && !info.ring) noRing.push(info.kind);
    }
    for (const k of ["scope", "tab", "copy", "manage"]) expect(seen, `reached ${k}`).toContain(k);
    expect(noRing).toEqual([]);
  });

  test.describe("AC-4: reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("switching scope and tab runs no animation or transition", async ({ page }) => {
      await page.goto("./sdd-engineering/");
      await page.waitForTimeout(100);
      await page.getByRole("radio", { name: /^Local/ }).check();
      await page.getByRole("tab", { name: "In your terminal" }).click();
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").map((a) => a.constructor.name));
      expect(running).toEqual([]);
    });
  });
});
