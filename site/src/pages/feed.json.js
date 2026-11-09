// JSON Feed 1.1 of plugin releases (spec CAT-01 R9/AC-1).
import { buildJsonFeed } from "../../lib/feeds.mjs";
import { config, getCatalog } from "../data/site.mjs";

export function GET() {
  return new Response(`${JSON.stringify(buildJsonFeed(getCatalog(), config), null, 2)}\n`, {
    headers: { "Content-Type": "application/feed+json; charset=utf-8" },
  });
}
