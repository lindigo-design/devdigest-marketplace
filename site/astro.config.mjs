// Astro build configuration. Origin and base path come from SITE_ORIGIN / SITE_BASE (spec CAT-01 R6/AC-4).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import { readConfig } from "./lib/config.mjs";

// Page code is bundled into dist/.prerender, where import.meta.url no longer points at the source tree,
// so the catalog's input paths are fixed here (this file is not bundled) and passed through the env.
const siteDir = dirname(fileURLToPath(import.meta.url));
process.env.CATALOG_SITE_DIR ??= siteDir;
process.env.CATALOG_REPO_ROOT ??= join(siteDir, "..");
process.env.CATALOG_SYNONYMS ??= join(siteDir, "synonyms.json");

const { origin, base } = readConfig();

export default defineConfig({
  site: origin,
  base,
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  // No dev toolbar or prefetch scripts in the output (R7/AC-5).
  devToolbar: { enabled: false },
  prefetch: false,
});
