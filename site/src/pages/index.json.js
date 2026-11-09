// Public catalog index, also the browser's search data (spec CAT-01 R9/AC-6, R2/AC-1). Schema: docs/catalog-index.md.
import { toIndexJson } from "../../lib/index-json.mjs";
import { config, getCatalog } from "../data/site.mjs";

export function GET() {
  return new Response(JSON.stringify(toIndexJson(getCatalog(), config)), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
