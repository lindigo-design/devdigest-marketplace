// Astro build configuration. Origin and base path come from SITE_ORIGIN / SITE_BASE (spec CAT-01 R6/AC-4).
import { defineConfig } from "astro/config";
import { readConfig } from "./lib/config.mjs";

const { origin, base } = readConfig();

export default defineConfig({
  site: origin,
  base,
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  // No telemetry, no prefetch scripts, no dev toolbar in the output (R7/AC-5).
  devToolbar: { enabled: false },
  prefetch: false,
});
